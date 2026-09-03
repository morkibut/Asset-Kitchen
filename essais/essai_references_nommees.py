# -*- coding: utf-8 -*-
"""E1 — les références nommées, et le texte vraiment rangé.

**La question.** Les artworks officiels, le sprite promu et le gabarit partent
dans le même sac. Dire à chaque image ce qu'elle est change-t-il le taux de
bonnes planches ? Et un texte **vraiment** rangé — sections nettes, la vue dite
une fois, l'interdiction de grille dite une fois, la priorité entre les images —
fait-il mieux que le pavé du produit ? Et un texte entièrement réécrit par une
IA, avec ses images nommées, fait-il mieux encore — auquel cas c'est une passe
« amélioration par IA » qu'il faudrait dans l'atelier ?

**Ce que la première séance a appris, le 2 septembre 2026, et qui a refait cet
essai.** Le projet n'avait qu'un artwork officiel, et c'était le sprite
lui-même, de profil, à l'arrêt : « ne copie pas la pose de l'artwork » ne
pouvait rien mesurer. Et les premières variantes ont été notées par l'auteur :
témoin 2 bonnes sur 4, `B-nommees` 0 sur 4, `C-rangees` (trois titres posés sur
le même texte) 0 sur 4. **Le nommage tel qu'il était écrit a nui**, et trois
titres ne rangent rien. Ces huit planches restent dans le rapport, payées, à
titre de témoin de ce qui ne marche pas.

**La seconde séance part avec les artworks du jour.** Le 2 septembre 2026,
l'auteur a promu deux artworks officiels de Michel dans l'atelier — deux
peintures, en vue de trois quarts et de dos, avec un décor — et retiré l'ancien.
Le script relit ce que le personnage désigne (`personnages/michel.json`) et
envoie **ce que le produit enverrait aujourd'hui**, dans son ordre : les deux
artworks en rôle style, puis le sprite promu en rôle référence, puis le gabarit.
Comme les images ont changé, le témoin du disque n'est plus comparable : un
témoin neuf (`A2-temoin-art`) part avec le texte du produit tel quel et ces
quatre images. Les clés des variantes neuves prennent le suffixe `-art`.

**Les variantes neuves, deux tirages chacune — choix de l'auteur.** À deux
tirages, un résultat est un indice, pas une preuve : une variante n'est
poursuivie que si **au moins la moitié** de ses planches sont bonnes, sinon on
n'insiste pas.

- `A2-temoin-art` : le texte du produit tel quel, avec les images du jour ;
- `R1-range-art` : le texte du produit **rangé et dégraissé**, sans fait
  nouveau — sept sections, la vue dite une fois, chaque instant du cycle réduit
  à ce qui le distingue, la case vide du 3×3 expliquée, les exclusions
  regroupées ;
- `R2-priorite-art` : R1, plus la **priorité entre les images** si elles se
  contredisent — le sprite pour l'identité, les artworks pour le style, la
  grille pour la place ;
- `IA-reecrit-art` : le prompt **entièrement réécrit** par l'IA, images
  nommées, d'après les trois relectures reçues le 2 septembre 2026, en gardant
  ce que le dépôt a mesuré : on génère toujours en 1024, pas de couleurs en
  hexadécimal (la bande de palette est une autre case), et une seule planche de
  huit.

    Coût   : huit planches neuves, ~0,20 $ à 0,25 $ ; PLAFOND 0,60 $.
    A sec  : .venv\\Scripts\\python.exe essais/essai_references_nommees.py --a-sec
    Payer  : .venv\\Scripts\\python.exe essais/essai_references_nommees.py
    Rapport: essais/rapport-references-nommees.html · notes : essais/notes-references-nommees.json

Sortie : `essais/resultats_references_nommees/<cle>/jet<N>.png` et `mesures.json`.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Sequence

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from socle_essais import (  # noqa: E402
    GABARIT,
    MODELE_DEFAUT,
    REFERENCE_ROLE,
    ROLE_STYLE,
    Seance,
    Variante,
    arguments,
    artworks_du_jour,
    images_du_jour,
    blocs,
    instants_de,
    lignes_de_nommage,
    nommer,
    notes_de,
    preparer_sortie,
    ranger,
    rapport,
    rejouer,
    temoin_du_disque,
)

ESSAI = "references-nommees"
PLAFOND_USD = 0.60
JETS_ANCIENS = (1, 2, 3, 4)
JETS_NEUFS = (1, 2)

ECHECS = (
    "les huit cases sont la même pose",
    "le personnage n'est pas le même d'une case à l'autre",
    "a redessiné les traits de la grille",
    "a rendu un nombre de sujets différent de huit",
    "la lanterne ou la capuche change d'une case à l'autre",
    "a copié la pose ou la vue d'un artwork (trois quarts, de dos) au lieu du profil",
    "a dessiné un décor derrière le personnage",
)

REGLE = (
    "<b>Une variante n'est poursuivie que si au moins la moitié de ses planches sont bonnes</b> — règle de "
    "l'auteur, à deux tirages : un résultat est un indice, pas une preuve. Le témoin de la première séance a "
    "fait 2 bonnes sur 4, et les deux premières variantes 0 sur 4. Les variantes neuves se comparent au témoin "
    "neuf <code>A2-temoin-art</code>, parti avec les mêmes images. Si R1 ou R2 passe la barre, le rangement entre "
    "dans R7 ; si seul IA-reecrit la passe, c'est la <b>construction</b> du texte qui compte, et une passe "
    "d'amélioration par IA est à envisager dans l'atelier. Si rien ne la passe, le texte ne bouge pas, et c'est écrit."
)

REGLE_JS = """function(s){
 var out=[];
 Object.keys(s).forEach(function(cle){
  var g=s[cle]; if(!g.essais) return;
  var moitie = Math.ceil(g.essais/2);
  var temoin = cle.indexOf('A')===0;
  var cls = g.notees ? (g.bon>=moitie ? 'oui' : 'non') : 'attente';
  var verdict = !g.notees ? 'en attente de notes' : temoin ? 'témoin — le point de comparaison'
    : (g.bon>=moitie ? 'à poursuivre' : 'on n\\'insiste pas');
  out.push('<span class="'+cls+'">'+cle+' : '+g.bon+' bonne(s) sur '+g.essais+' ('+g.notees+' notées)'
   +(temoin ? '' : ' — il en faut '+moitie)+' → '+verdict+'</span>');
 });
 return out;
}"""


# ── Les textes ───────────────────────────────────────────────────────────────


def _morceaux(texte: str) -> tuple[str, str, list[str]]:
    """La bible, le sujet, les huit instants — relus dans le témoin, jamais retapés."""
    paragraphes = blocs(texte)
    return paragraphes[0], paragraphes[1], instants_de(texte)


def _numeros(roles: Sequence[str], role: str) -> list[int]:
    return [rang for rang, r in enumerate(roles, start=1) if r == role]


def _images(numeros: Sequence[int]) -> str:
    """« Image 1 », « Images 1 and 2 », « Images 1, 2 and 3 »."""
    if len(numeros) == 1:
        return f"Image {numeros[0]}"
    return "Images " + ", ".join(str(n) for n in numeros[:-1]) + f" and {numeros[-1]}"


def ranger_vraiment(texte: str, roles: Sequence[str]) -> str:
    """R1 : le texte du produit rangé et dégraissé, sans fait nouveau.

    Sept sections. La bible et le sujet sont ceux du témoin, mot pour mot. Les
    huit instants ne gardent que ce qui les distingue (`instants_de`), la vue
    étant dite une fois en tête de la liste. Les phrases de grille, de
    cohérence et d'exclusion du témoin sont regroupées chacune à sa place, et
    dites une fois — le témoin interdisait la grille trois fois.
    """
    bible, sujet, instants = _morceaux(texte)
    return "\n\n".join([
        "ART DIRECTION\n" + bible,
        "CHARACTER\n" + sujet,
        "REFERENCES\n" + "\n".join(lignes_de_nommage(roles)),
        "LAYOUT\n"
        "A sprite sheet of 8 sprites of the SAME subject. Exactly 3 columns and 3 rows, 8 cells total: "
        "the ninth position stays empty. One single sprite per cell, evenly spaced on a regular grid, "
        "every sprite the same height, all standing on the same baseline. The attached layout image "
        "shows the 8 empty cells: keep the cells at their positions and sizes.",
        "FRAMES — walk cycle, facing right, side view, one instant per cell, in reading order\n"
        + "\n".join(f"{i}. {instant}" for i, instant in enumerate(instants, start=1)),
        "CONSISTENCY\n"
        "It must be the same subject in every cell: same colors, same outfit, same proportions, "
        "same size, same style.",
        "EXCLUSIONS\n"
        "Plain flat light gray background over the whole image. No cell borders, no grid lines, "
        "no separating lines, no text, no numbers, no frames, no ground shadow.",
    ])


def priorite(roles: Sequence[str]) -> str:
    """La phrase de priorité entre les images, numérotées d'après leur rôle réel."""
    sprite = _images(_numeros(roles, REFERENCE_ROLE))
    styles = _images(_numeros(roles, ROLE_STYLE))
    grille = _images(_numeros(roles, GABARIT))
    verbe = "decides" if len(_numeros(roles, ROLE_STYLE)) == 1 else "decide"
    return (
        f"If the references disagree: {sprite} decides who the character is, {styles} {verbe} the colours "
        f"and the drawing style, {grille} decides where each sprite goes. Do not mix their roles."
    )


def avec_priorite(texte_r1: str, roles: Sequence[str]) -> str:
    """R2 : R1, plus la priorité entre les images, à la fin de REFERENCES."""
    return texte_r1.replace("\n\nLAYOUT\n", "\n" + priorite(roles) + "\n\nLAYOUT\n", 1)


def reecrit_par_ia(texte: str, roles: Sequence[str]) -> str:
    """IA-reecrit : le prompt entièrement réécrit, d'après les trois relectures du 2 septembre 2026.

    Ce qu'il reprend d'elles : les contraintes critiques en tête, la direction
    artistique séparée du personnage, les références nommées avec leur
    priorité, la mise en page expliquée, les instants en liste, les exclusions
    regroupées, les verrous sur ce qui saute d'une case à l'autre. Ce qu'il ne
    reprend **pas**, parce que le dépôt l'a mesuré : un canevas de 256×128 (on
    ne génère jamais petit), des couleurs en hexadécimal (la bande de palette
    est une case à part), deux planches de quatre (zéro bonne sur seize), la
    bande 1×8 dans une image carrée. Les instants sont ceux du témoin, et les
    numéros d'images sont ceux de l'envoi réel.
    """
    _, _, instants = _morceaux(texte)
    sprite = _images(_numeros(roles, REFERENCE_ROLE))
    styles = _images(_numeros(roles, ROLE_STYLE))
    grille = _images(_numeros(roles, GABARIT))
    return "\n\n".join([
        "CRITICAL\n"
        "- Exactly 8 sprites, one per cell of the attached layout grid; the unused ninth position stays empty.\n"
        "- The same character in all 8 cells: same silhouette, proportions, size, colours, outfit and equipment.\n"
        "- Strict side view, orthographic, facing right, full body, feet on the same baseline in every cell.\n"
        "- One plain flat light gray background over the whole image: no visible grid, borders or lines.",
        "ART DIRECTION\n"
        "World: a quiet medieval fantasy world of long roads, forests and cold nights.\n"
        "Era: early middle ages, mail and spears, before gunpowder.\n"
        "Rendering: 2D pixel art, crisp blocky pixels, solid black outline one pixel wide, flat shading.\n"
        "Camera: side view, orthographic, the character facing right.",
        "CHARACTER — a hooded traveller\n"
        "- deep teal hooded cloak covering the head and falling down the back\n"
        "- ochre long coat closed by a brown leather belt\n"
        "- brown leather backpack with a rolled bedroll strapped on top\n"
        "- brown boots\n"
        "- a lit lantern hanging from the near hand",
        "REFERENCES (priority if they conflict: 1 > 2 > 3)\n"
        f"1. {sprite} — the character, already drawn in the game's camera: the identity to keep.\n"
        f"2. {styles} — official artworks: the colours, outfit and drawing style to follow. Do not copy their "
        "pose, camera angle, scenery or layout.\n"
        f"3. {grille} — empty layout grid: the 8 cells to fill, at their exact positions and sizes.",
        "SPRITE SHEET\n"
        "8 sprites on the attached 3×3 layout: 8 cells used in reading order, the last position empty. "
        "One sprite per cell, centred in its cell, the same height in every cell, feet on the cell's baseline.",
        "ANIMATION — walk cycle, one instant per cell\n"
        + "\n".join(f"{i}. {instant}" for i, instant in enumerate(instants, start=1)),
        "CONSISTENCY\n"
        "The lantern stays in the same hand and barely swings. The hood keeps the same silhouette; only the "
        "lower cloak may sway with the stride. Nothing else changes between cells except the pose of the legs and arms.",
        "EXCLUSIONS\n"
        "No cell borders, no grid lines, no separating lines, no text, no numbers, no labels, no frames, "
        "no ground shadow, no scenery, no extra characters.",
    ])


# ── Les variantes ────────────────────────────────────────────────────────────


def variantes() -> list[Variante]:
    depart = rejouer()
    roles = depart.roles
    commun = dict(proportions=depart.proportions, negatif=depart.negatif)
    anciennes = [
        temoin_du_disque(depart, echecs=ECHECS),
        Variante(cle="B-nommees", titre="Les références nommées (1ʳᵉ séance)",
                 propos="une ligne par image jointe, à la place de la phrase générique — 0 bonne sur 4 à la première séance",
                 texte=nommer(depart.texte, roles), images=depart.images, echecs_prevus=ECHECS, **commun),
        Variante(cle="C-rangees", titre="Trois titres posés sur le même texte (1ʳᵉ séance)",
                 propos="B, puis trois titres sans qu'un mot change — 0 bonne sur 4 à la première séance",
                 texte=ranger(depart.texte, roles), images=depart.images, echecs_prevus=ECHECS, **commun),
    ]
    for v in anciennes:
        v.jets = JETS_ANCIENS

    artworks = artworks_du_jour()
    if not artworks:
        raise RuntimeError("le personnage ne désigne aucun artwork officiel : rien à envoyer de neuf")
    images = images_du_jour(depart, artworks)
    roles_neufs = [i.role for i in images]
    noms = ", ".join(identifiant for identifiant, _, _ in artworks)
    r1 = ranger_vraiment(depart.texte, roles_neufs)
    neuves = [
        Variante(cle="A2-temoin-art", titre="Le témoin, avec les artworks du jour",
                 propos=f"le texte du produit tel quel, les deux artworks officiels ({noms}) devant le sprite promu et "
                        "le gabarit — le point de comparaison des variantes neuves, puisque les images ont changé",
                 texte=depart.texte, images=images, echecs_prevus=ECHECS, jets=JETS_NEUFS, **commun),
        Variante(cle="R1-range-art", titre="Rangé et dégraissé",
                 propos="sept sections, la vue dite une fois, chaque instant réduit à ce qui le distingue, la case "
                        "vide expliquée, les exclusions regroupées — aucun fait nouveau",
                 texte=r1, images=images, echecs_prevus=ECHECS, jets=JETS_NEUFS, **commun),
        Variante(cle="R2-priorite-art", titre="Rangé, plus la priorité des images",
                 propos="R1, plus une phrase : si les images se contredisent, le sprite décide de l'identité, "
                        "les artworks du style, la grille de la place",
                 texte=avec_priorite(r1, roles_neufs), images=images, echecs_prevus=ECHECS, jets=JETS_NEUFS, **commun),
        Variante(cle="IA-reecrit-art", titre="Entièrement réécrit par l'IA",
                 propos="le prompt réécrit de bout en bout d'après les trois relectures, images nommées et "
                        "priorisées, verrous sur la lanterne et la capuche — même canevas, mêmes huit instants",
                 texte=reecrit_par_ia(depart.texte, roles_neufs), images=images, echecs_prevus=ECHECS,
                 jets=JETS_NEUFS, **commun),
    ]
    return anciennes + neuves


def notes_de_la_premiere_seance() -> dict:
    """Les notes que l'auteur a déposées sur A, B et C à la première séance — à ne pas lui faire refaire.

    Le rapport garde ses notes par séance ; celle-ci en est une autre. Les
    notes des trois groupes anciens sont donc relues dans le fichier déposé et
    semées dans le rapport, une fois, pour chaque planche qui n'y est pas encore notée.
    """
    notes = notes_de(ESSAI).get("notes", {})
    anciens = ("A-temoin", "B-nommees", "C-rangees")
    return {cle: n for cle, n in notes.items() if cle.split(":")[0] in anciens}


SCRIPT_SEMIS = """
(function(){
 var anciennes=%s;
 var notes=window.NOTES();
 var semees=false;
 Object.keys(anciennes).forEach(function(k){ if(!notes[k]){ notes[k]=anciennes[k]; semees=true; } });
 if(!semees) return;
 window.SAUVER();
 var garde='semis-'+ESSAI+':'+SEANCE;
 try{ if(!sessionStorage.getItem(garde)){ sessionStorage.setItem(garde,'1'); location.reload(); } }catch(e){}
})();
"""


async def principal() -> None:
    preparer_sortie()
    args = arguments(__doc__.split("\n")[0]).parse_args()
    seance = Seance(ESSAI, PLAFOND_USD)
    liste = variantes()
    avertissements = [
        "Les variantes de la première séance (A, B, C) sont parties avec l'ancien artwork, qui était le sprite "
        "lui-même de profil ; elles ne se comparent pas aux variantes « -art », parties avec les deux artworks "
        "officiels du 2 septembre 2026 : une peinture de trois quarts face (lanterne à la main, souterrain derrière) "
        "et une peinture de dos (le personnage regarde un château). Aucun des deux n'est de profil : « ne copie pas "
        "la pose de l'artwork » mesure enfin quelque chose — et les deux ont un décor, ce que le texte du produit "
        "n'interdit pas.",
        "B et C sont payées à quatre tirages ; les variantes « -art » sont tirées à deux, par choix de l'auteur.",
        "Les notes déposées sur A, B et C à la première séance sont reprises telles quelles dans ce rapport ; "
        "seules les huit planches « -art » restent à noter.",
    ]

    if args.a_sec:
        seance.a_sec(liste, jets=JETS_NEUFS)
    elif not args.rapport:
        passerelle, catalogue = await seance.passerelle_reelle()
        modele = catalogue.get(MODELE_DEFAUT)
        if modele is None:
            print(f"[x] {MODELE_DEFAUT} absent du catalogue")
            return
        print(f"plafond de ce lancement ${PLAFOND_USD:.2f}\n")
        await asyncio.gather(*(seance.tirer(v, passerelle, modele, jets=JETS_NEUFS) for v in liste))
        seance.bilan()

    rapport(
        ESSAI,
        "E1 · Les références nommées, et le texte vraiment rangé",
        liste,
        seance,
        question="Nommer chaque image jointe, ranger vraiment le texte, ou le faire réécrire entièrement par une IA : "
                 "l'un de ces trois gestes donne-t-il plus de bonnes planches que le pavé du produit, à images égales ?",
        attendu="Le témoin de la première séance a fait 2 bonnes sur 4 ; les deux premières variantes 0 sur 4. "
                "À deux tirages, on cherche un indice — au moins une bonne sur deux — et on n'insiste pas en dessous. "
                "Le témoin neuf A2 dit ce que le produit fait avec les artworks du jour ; si seul le texte réécrit "
                "passe, c'est la construction qui compte, et une passe d'amélioration par IA dans l'atelier se discute.",
        regle=REGLE,
        regle_js=REGLE_JS,
        jets=JETS_ANCIENS,
        avertissements=avertissements,
        script_extra=SCRIPT_SEMIS % json.dumps(notes_de_la_premiere_seance(), ensure_ascii=False),
    )


if __name__ == "__main__":
    asyncio.run(principal())
