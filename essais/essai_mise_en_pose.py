# -*- coding: utf-8 -*-
"""E4 — la mise en pose d'abord : la « prep » de SpriteCook.

**La question.** SpriteCook ne demande jamais la planche depuis le sprite de
base : il insère une génération intermédiaire qui met le personnage dans la
pose de départ du mouvement, puis anime **ce** sprite. Une planche demandée
depuis un sprite déjà de profil, en pose de contact, est-elle meilleure qu'une
planche demandée depuis l'artwork de face ?

**Ce qu'on attend.** Que l'échec dominant des bancs — la taille qui change
d'une case à l'autre — recule, et que « le personnage est le même » monte.

**Deux temps, et l'auteur entre les deux.**

- **Temps 1, la prep** : un appel d'image seule, huit fois — images = [le
  sprite promu, rôle `reference`, à la taille retenue par E2, sinon 256 px] ;
  texte = les lignes de bible du témoin, puis **une** ligne de demande, puis
  `FRAMING —` et `CAMERA —` du témoin s'il les porte. Le rapport montre les
  huit en grand, à côté du sprite promu ; **l'auteur en choisit une d'un clic**
  et télécharge le relevé : le choix part dans `notes-mise-en-pose.json`.
- **Temps 2, la planche depuis la prep** : `A-temoin` contre `B-prep`, où la
  prep choisie remplace le sprite promu de face en rôle `reference` ; texte
  identique au témoin. Si E1 a été concluant, A et B reçoivent tous deux les
  lignes de nommage — à armes égales, et c'est écrit en tête de rapport.

Le script fait le temps 1 tant qu'aucune prep n'est choisie, et le temps 2 dès
qu'elle l'est. Il ne repaie jamais ce qui est sur le disque.

    Coût   : temps 1 ~0,10 $ (huit images seules) ; temps 2 ~0,20 $ (huit planches) ;
             PLAFOND 0,50 $ sur ce lancement.
    A sec  : .venv\\Scripts\\python.exe essais/essai_mise_en_pose.py --a-sec
    Payer  : .venv\\Scripts\\python.exe essais/essai_mise_en_pose.py
    Rapport: essais/rapport-mise-en-pose.html · notes : essais/notes-mise-en-pose.json

Sortie : `essais/resultats_mise_en_pose/prep/jet<N>.png`,
`essais/resultats_mise_en_pose/B-prep/jet<N>.png`, et `mesures.json`.
"""

from __future__ import annotations

import asyncio
import html
import json
import sys
from dataclasses import replace
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from essai_references_nommees import ESSAI as ESSAI_E1  # noqa: E402
from essai_taille_reference import taille_retenue  # noqa: E402
from socle_essais import (  # noqa: E402
    JETS,
    MARQUEUR_CAMERA,
    MARQUEUR_FRAMING,
    MODELE_DEFAUT,
    REFERENCE_ROLE,
    ImageJointe,
    Seance,
    Variante,
    agrandir,
    arguments,
    blocs,
    estimer,
    nommer,
    notes_de,
    preparer_sortie,
    rapport,
    rejouer,
    temoin_du_disque,
    vignette,
)

ESSAI = "mise-en-pose"
PLAFOND_USD = 0.50

LIGNE_PREP = (
    "The same character, seen from the side as in the game's camera, standing in the contact pose "
    "of a walk cycle (front foot forward and planted, back foot behind, arms opposite to legs), "
    "full body, single isolated sprite, plain background."
)

ECHECS_PREP = (
    "le personnage a changé (tenue, proportions, couleurs)",
    "la vue n'est pas de profil",
    "la pose n'est pas une pose de marche",
    "il y a plus d'un sujet",
)
ECHEC_TAILLE = "la taille du personnage change d'une case à l'autre"
ECHECS_PLANCHE = (
    ECHEC_TAILLE,
    "les huit cases recopient la pose de la prep (rien ne bouge)",
    "le personnage n'est plus le même que l'artwork",
    "a redessiné la grille",
    "nombre de sujets ≠ 8",
)

REGLE = (
    "<b>B remplace la référence de face si B ≥ A + 2 bonnes planches</b>, ou si « la taille change » recule "
    "d'au moins trois planches sur huit. Sinon, la prep n'entre pas dans la V3 comme étape, et le référent de "
    "la fiche 04 reste une question ouverte. Le temps 1 ne se juge pas en bonnes planches : on y <b>choisit</b> "
    "la prep la plus « lui, de profil, en pose de contact », et les échecs cochés disent ce que les autres ont raté."
)

REGLE_JS = """function(s, notes){
 var E=%s, out=[], choix=(notes._choix||{}).prep;
 out.push('<span class=attente>prep choisie : '+(choix||'aucune — clique « c\\'est elle » sous une prep, puis télécharge le relevé')+'</span>');
 var A=s['A-temoin'], B=s['B-prep'];
 if(!A||!B){ out.push('<span class=attente>le temps 2 n\\'a pas encore de planches</span>'); return out; }
 if(!(A.notees&&B.notees)){ out.push('<span class=attente>temps 2 : en attente de notes sur A et B</span>'); return out; }
 var ta=A.echecs[E]||0, tb=B.echecs[E]||0;
 var gagne = B.bon>=A.bon+2, recule = (ta-tb)>=3;
 out.push('<span class="'+(gagne?'oui':'non')+'">B ≥ A + 2 : '+B.bon+' contre '+A.bon+' → '+(gagne?'oui':'non')+'</span>');
 out.push('<span class="'+(recule?'oui':'non')+'">« la taille change » recule d\\'au moins trois : A '+ta+' → B '+tb+' → '+(recule?'oui':'non')+'</span>');
 out.push('<span class="'+((gagne||recule)?'oui':'non')+'">'+((gagne||recule)?'la prep remplace la référence de face':'la prep n\\'entre pas dans la V3 comme étape')+'</span>');
 return out;
}"""


def nommage_retenu() -> bool:
    """E1 a-t-il été concluant ? B ≥ A en bonnes planches, d'après ses notes."""
    notes = notes_de(ESSAI_E1).get("notes", {})
    if not notes:
        return False

    def bonnes(cle: str) -> int:
        return sum(1 for j in JETS if notes.get(f"{cle}:jet{j}", {}).get("note") == "bon")

    notees = any(notes.get(f"B-nommees:jet{j}") for j in JETS)
    return notees and bonnes("B-nommees") >= bonnes("A-temoin")


def texte_de_prep(texte_temoin: str) -> str:
    """Les lignes de bible du témoin, une seule ligne de demande, puis FRAMING et CAMERA s'ils y sont."""
    paragraphes = blocs(texte_temoin)
    bible = paragraphes[0]
    queue = [l for p in paragraphes for l in p.split("\n") if l.startswith((MARQUEUR_FRAMING, MARQUEUR_CAMERA))]
    return "\n\n".join([bible, LIGNE_PREP] + (["\n".join(queue)] if queue else []))


def prep_choisie() -> str | None:
    choix = notes_de(ESSAI).get("notes", {}).get("_choix", {}).get("prep")
    return str(choix) if choix else None


def variantes() -> tuple[Variante, list[Variante], int, bool]:
    depart = rejouer()
    taille = taille_retenue()
    facteur = max(1, taille // 64)
    sprite = next(i for i in depart.images if i.role == REFERENCE_ROLE)
    sprite_agrandi = replace(sprite, rang=1, octets=agrandir(sprite.octets, facteur) if facteur > 1 else sprite.octets)
    prep = Variante(
        cle="prep",
        titre="Temps 1 — la prep",
        propos=f"un appel d'image seule : le sprite promu en {taille} px (taille retenue par E2), les lignes de bible "
               f"du témoin et une seule ligne de demande — le personnage de profil, en pose de contact",
        texte=texte_de_prep(depart.texte),
        images=(sprite_agrandi,),
        echecs_prevus=ECHECS_PREP,
        proportions="1:1",
        negatif=depart.negatif,
        cases=1,
    )

    nomme = nommage_retenu()
    texte = nommer(depart.texte, depart.roles) if nomme else depart.texte
    temoin = temoin_du_disque(depart, echecs=ECHECS_PLANCHE)
    if nomme:
        # À armes égales : le témoin du disque n'a pas reçu les lignes de nommage,
        # donc A doit être **repayé** avec elles. On le dit, et on ne relit pas.
        temoin = Variante(
            cle="A-temoin", titre="Le produit d'aujourd'hui, nommé",
            propos="le départ rejoué avec les lignes de nommage de E1 — retiré, donc A se repaie",
            texte=texte, images=depart.images, echecs_prevus=ECHECS_PLANCHE,
            proportions=depart.proportions, negatif=depart.negatif,
        )
    choix = prep_choisie()
    planche: list[Variante] = [temoin]
    if choix:
        chemin = RACINE / "resultats_mise_en_pose" / "prep" / f"{choix}.png"
        if chemin.exists():
            images = tuple(
                ImageJointe(i.rang, REFERENCE_ROLE, chemin.read_bytes(), f"prep {choix}") if i.role == REFERENCE_ROLE else i
                for i in depart.images
            )
            planche.append(Variante(
                cle="B-prep",
                titre="La planche depuis la prep",
                propos=f"la prep choisie ({choix}) remplace le sprite promu de face en rôle reference ; "
                       f"artwork, gabarit et texte identiques au témoin",
                texte=texte,
                images=images,
                echecs_prevus=ECHECS_PLANCHE,
                proportions=depart.proportions,
                negatif=depart.negatif,
            ))
    return prep, planche, taille, nomme


def _cartes_prep(seance: Seance, prep: Variante, sprite: ImageJointe, choix: str | None, jets=JETS) -> str:
    dossier = seance.dossier_de(prep)
    releve = seance.releve_de(prep)
    parts = ["<h2 id=prep>Temps 1 — les huit preps, et l'auteur en garde une</h2>",
             "<p class=axe>Chaque prep en grand (×4 au plus proche voisin), à côté du sprite promu tel qu'il est parti. "
             "<b>Choisis celle qui est le plus « lui, de profil, en pose de contact »</b> — le bouton « c'est elle » —, "
             "note les autres pour dire ce qu'elles ont raté, puis télécharge le relevé : c'est ce fichier que le temps 2 lit.</p>",
             "<div class=grille style='grid-template-columns:repeat(auto-fill,minmax(280px,1fr))'>"]
    parts.append(
        "<div class=carte><div class=entete><span class=jet>le sprite promu, tel qu'il est parti</span></div>"
        f"<div class=vue><img alt='sprite promu' src='data:image/png;base64,{vignette(sprite.octets, 256)}'></div>"
        f"<div class=pied><div class=ligne><span>{html.escape(sprite.legende)}</span></div></div></div>"
    )
    for jet in jets:
        fichier = dossier / f"jet{jet}.png"
        ident = f"prep:jet{jet}"
        ligne = releve.get(f"jet{jet}", {})
        parts.append(f"<div class='carte tirage' data-id='{ident}'>")
        parts.append(f"<div class=entete><span class=jet>prep jet {jet}</span>"
                     + (f"<span class='pastille p-oui'>choisie</span>" if choix == f"jet{jet}" else "") + "</div>")
        if fichier.exists():
            parts.append(f"<div class=vue><img alt='prep' src='data:image/png;base64,{vignette(fichier.read_bytes(), 1024)}'></div>")
            parts.append(f"<div class=pied><div class=ligne><span>prix</span><b>{ligne.get('cout_usd', 0):.4f} $</b></div>"
                         f"<div class=ligne><span>durée</span><b>{ligne.get('secondes', 0):.0f} s</b></div></div>")
        elif ligne.get("echec"):
            parts.append(f"<div class='vue vide'>l'appel n'a pas abouti<br>{html.escape(str(ligne['echec']))}</div>")
        else:
            parts.append("<div class='vue vide'>pas encore tirée</div>")
        parts.append("<div class=notation><div class=note>")
        for valeur, mot, touche in (("mauvais", "Mauvais", 1), ("moyen", "Moyen", 2), ("bon", "Bon", 3)):
            parts.append(f"<button data-v={valeur} title='raccourci : {touche}'>{mot}</button>")
        parts.append("</div><div class=echecs>")
        for echec in ECHECS_PREP:
            parts.append(f"<label><input type=checkbox value='{html.escape(echec, quote=True)}'> {html.escape(echec)}</label>")
        parts.append("</div>")
        parts.append(f"<button class=choisir data-jet='jet{jet}' style='width:100%;background:var(--fond-1);color:var(--signal);"
                     f"border:0;border-top:1px solid var(--bord);padding:8px;font:inherit;font-size:12px;cursor:pointer'>"
                     f"c'est elle</button>")
        parts.append("<input class=libre type=text placeholder='autre — une ligne' maxlength=200></div></div>")
    parts.append("</div>")
    return "".join(parts)


SCRIPT_CHOIX = """
document.addEventListener('click', function(e){
 var b=e.target; if(!b || !b.classList || !b.classList.contains('choisir')) return;
 e.stopPropagation();
 var n=window.NOTES(); n._choix=n._choix||{}; n._choix.prep=b.getAttribute('data-jet'); window.SAUVER();
 [].forEach.call(document.querySelectorAll('.choisir'), function(x){ x.textContent = x.getAttribute('data-jet')===n._choix.prep ? '✓ c\\'est elle — télécharge le relevé' : 'c\\'est elle'; });
}, true);
var APRES_NOTE=function(n){ var c=(n._choix||{}).prep; if(!c) return;
 [].forEach.call(document.querySelectorAll('.choisir'), function(x){ x.textContent = x.getAttribute('data-jet')===c ? '✓ c\\'est elle — télécharge le relevé' : 'c\\'est elle'; }); };
APRES_NOTE(window.NOTES());
"""


async def principal() -> None:
    preparer_sortie()
    parseur = arguments(__doc__.split("\n")[0])
    args = parseur.parse_args()
    seance = Seance(ESSAI, PLAFOND_USD)
    jets = tuple(range(1, args.tirages + 1))
    prep, planche, taille, nomme = variantes()
    choix = prep_choisie()
    temps_2 = len(planche) == 2
    sprite = prep.images[0]

    avertissements: list[str] = []
    if nomme:
        avertissements.append("E1 a été concluant : A et B reçoivent tous deux les lignes de nommage, à armes égales — "
                              "le témoin se repaie donc au lieu d'être relu du disque.")
    if not choix:
        avertissements.append("aucune prep choisie : le temps 2 attend. Choisis-en une ci-dessous, télécharge le relevé "
                              "dans essais/notes-mise-en-pose.json, puis relance le script.")
    elif not temps_2:
        avertissements.append(f"la prep choisie ({choix}) n'est pas sur le disque : le temps 2 ne peut pas partir.")

    if args.a_sec:
        print(f"taille retenue par E2 : {taille} px · nommage de E1 retenu : {'oui' if nomme else 'non'} · "
              f"prep choisie : {choix or 'aucune'}\n")
        print("### TEMPS 1 — la prep, huit images seules")
        seance.a_sec([prep], jets=jets, prix_appel=estimer(1, 1))
        print("\n### TEMPS 2 — la planche depuis la prep" + ("" if temps_2 else " (PAS ENCORE : aucune prep choisie)"))
        seance.a_sec(planche, jets=jets)
    elif not args.rapport:
        passerelle, catalogue = await seance.passerelle_reelle()
        modele = catalogue.get(MODELE_DEFAUT)
        if modele is None:
            print(f"[x] {MODELE_DEFAUT} absent du catalogue")
            return
        print(f"plafond de ce lancement ${PLAFOND_USD:.2f}\n")
        if not temps_2:
            print("temps 1 — la prep")
            await seance.tirer(prep, passerelle, modele, jets=jets)
        else:
            print(f"temps 2 — la planche depuis la prep {choix}")
            await asyncio.gather(*(seance.tirer(v, passerelle, modele, jets=jets) for v in planche))
        seance.bilan()

    rapport(
        ESSAI,
        "E4 · La mise en pose d'abord — la « prep »",
        planche,
        seance,
        question="SpriteCook insère une génération intermédiaire qui met le personnage dans la pose de départ du "
                 "mouvement, puis anime ce sprite. Une planche demandée depuis un sprite déjà de profil, en pose de "
                 "contact, est-elle meilleure qu'une planche demandée depuis l'artwork de face ?",
        attendu="Que l'échec dominant des bancs — la taille qui change d'une case à l'autre — recule, et que "
                "« le personnage est le même » monte.",
        regle=REGLE,
        regle_js=REGLE_JS % json.dumps(ECHEC_TAILLE, ensure_ascii=False),
        jets=jets,
        avant=_cartes_prep(seance, prep, sprite, choix, jets),
        script_extra=SCRIPT_CHOIX,
        avertissements=avertissements,
        groupes_extra={"prep": {"titre": prep.titre,
                                "cout": round(sum(float(l.get("cout_usd") or 0) for l in seance.releve_de(prep).values()), 4),
                                "jets": [{"jet": f"jet{j}", "revenue": (seance.dossier_de(prep) / f"jet{j}.png").exists()} for j in jets]}},
    )


if __name__ == "__main__":
    asyncio.run(principal())
