# -*- coding: utf-8 -*-
"""L'arbitrage — les deux dernières pistes, mises en carré et à noter à l'œil.

**Pourquoi un second rapport plutôt qu'une section de plus dans le grand.**
`essais/rapport-animation.html` porte les cent dix-sept planches de toute
l'histoire, et c'est très bien pour l'archive. Mais ce qu'il reste à faire est
un geste précis : **regarder trente-neuf animations et en noter vingt-quatre**,
pour trancher entre deux pistes. Les noyer dans cent dix-sept déjà notées, c'est
demander à l'auteur de chercher son travail.

**Ce que le banc mesure tient dans un carré**, et le rapport le montre comme
tel — c'est tout l'intérêt de cette page :

|                | clause de constance telle quelle | clause remplacée        |
|----------------|----------------------------------|-------------------------|
| **8 cases**    | le produit d'aujourd'hui         | `F-sans-proportions`    |
| **4 cases**    | `H-4-produit`                    | `H-4-sans-proportions`  |

Les quatre cases du carré partent du **bloc complet du produit**, paragraphe
protecteur compris, et ne diffèrent que par les deux axes testés. C'est ce qui
manquait aux essais à quatre cases des vagues précédentes : les leurs étaient
tous indécoupables, et l'on ne savait pas ce qui les rendait bons.

**Le tableau du carré se recalcule dans le navigateur, à chaque note donnée.**
C'est la raison d'être de la page : on note, et l'on voit la décision se former.
Un tableau cuit d'avance ne dirait rien, puisque les vingt-quatre planches
neuves n'ont pas encore de note.

**Les animations sont montées sur les cases brutes, sans détourage** — comme
partout ailleurs depuis que le détourage a été reconnu coupable de fabriquer des
défauts qui n'existent pas. La ligne *découpable* sous chaque animation dit,
elle, ce que l'œil ne peut pas voir : si l'atelier saurait l'ouvrir.

Les notes sont partagées avec le grand rapport — même tiroir du navigateur, même
identifiants. Noter ici, c'est noter là-bas.

    .venv\\Scripts\\python.exe essais/banc_complet.py
    .venv\\Scripts\\python.exe essais/rapport_arbitrage.py
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE.parent))

from banc_complet import SORTIE as TOUT  # noqa: E402
from banc_complet import images_de, references_du_produit  # noqa: E402
from rapport_tout import NOTES, SCRIPT, STYLE, carte, vignette  # noqa: E402

SORTIE = RACINE / "rapport-arbitrage.html"

# Les quatre cases du carré, dans l'ordre où elles se lisent : le témoin
# d'abord, puisque c'est ce qui tourne aujourd'hui et que tout le reste doit
# battre. Chaque entrée dit **comment retrouver ses planches** dans `tout.json`,
# et ce qu'elle vaut sur les deux axes.
CARRE = [
    {
        "cle": "temoin",
        "titre": "Le produit d'aujourd'hui",
        "cases": 8,
        "clause": "telle quelle",
        "propos":
            "Le prompt du produit, ses trois images, rejoués à l'identique dans une vraie "
            "génération. C'est la barre à battre, et elle est déjà notée : c'est le seul "
            "groupe de cette page qui ne demande aucun travail. Il est là pour l'œil — "
            "comparer un chiffre à un chiffre ne dit pas si l'on préfère la marche.",
        "trouver": lambda p: (p["banc"] == "modeles" and p["modele"] == "openai/gpt-image-2"),
    },
    {
        "cle": "F-sans-proportions",
        "titre": "Huit cases, clause de constance remplacée",
        "cases": 8,
        "clause": "remplacée",
        "propos":
            "Le prompt du produit demande, mot pour mot, que le sujet garde « same "
            "proportions, same size » — c'est-à-dire que le corps ne change pas de forme, "
            "dans une demande de marche. Ici cette phrase est remplacée par une qui dit "
            "l'inverse : le personnage reste le même, mais son corps a le droit de se "
            "déformer, puisque c'est ce que marcher veut dire. Sept tirages avaient donné "
            "un écart trop beau pour être cru ; huit de plus le confirment ou le tuent.",
        "trouver": lambda p: (p["banc"] == "recette" and p["reglage"] == "F-sans-proportions"),
    },
    {
        "cle": "H-4-produit",
        "titre": "Quatre cases, clause de constance telle quelle",
        "cases": 4,
        "clause": "telle quelle",
        "propos":
            "Huit cases sur une image de mille pixels, c'est un personnage de trois cents "
            "pixels de côté. À quatre cases il est deux fois plus grand, et il a la place "
            "de se déformer. Les six tirages à quatre cases des vagues précédentes "
            "portaient tous ma consigne d'essai, sans le paragraphe protecteur : aucun "
            "n'était découpable, et l'on ne savait donc pas ce qu'on mesurait.",
        "trouver": lambda p: (p["banc"] == "recette" and p["reglage"] == "H-4-produit"),
    },
    {
        "cle": "H-4-sans-proportions",
        "titre": "Quatre cases, clause de constance remplacée",
        "cases": 4,
        "clause": "remplacée",
        "propos":
            "Les deux pistes croisées. Si les deux axes portent chacun un peu, c'est ici "
            "que ça se verra — et si l'une des deux ne porte rien, ce groupe le dira aussi, "
            "en ne faisant pas mieux que celui qui ne change qu'un axe.",
        "trouver": lambda p: (p["banc"] == "recette"
                              and p["reglage"] == "H-4-sans-proportions"),
    },
]

# Le tableau vivant : une ligne par case du carré, remplie par le navigateur.
# **Les colonnes ne sont pas celles du grand rapport.** Ici on ne classe pas, on
# décide : ce qu'on veut lire, c'est *combien de bonnes*, et *ce que coûterait
# une bonne* si l'on commandait à ce réglage-là.
VIVANT = """
(function(){
 var GROUPES = %s;
 var corps = document.getElementById('carre-corps');
 if(!corps) return;

 function relever(){
  var par = {};
  [].forEach.call(document.querySelectorAll('.carte[data-groupe]'), function(c){
   var g = c.getAttribute('data-groupe');
   var e = par[g] || (par[g] = {n:0, notees:0, bon:0, moyen:0, mauvais:0, cout:0});
   e.n++;
   e.cout += parseFloat(c.getAttribute('data-cout')||'0');
   var v = c.getAttribute('data-note');
   if(v){ e.notees++; e[v]++; }
  });
  return par;
 }

 function sou(x){ return '$' + x.toFixed(3); }

 function peindre(){
  var par = relever(), lignes = [];
  GROUPES.forEach(function(g){
   var e = par[g.cle] || {n:0, notees:0, bon:0, moyen:0, mauvais:0, cout:0};
   var reste = e.n - e.notees;
   // **Un pourcentage sur une notation à moitié faite ment**, et il ment dans le
   // sens flatteur : on note d'abord ce qui saute aux yeux, et une seule bonne
   // planche vue sur huit afficherait déjà le taux du groupe entier. Les deux
   // colonnes qui divisent par le nombre de tirages restent donc muettes tant
   // qu'il reste une planche à voir ; la colonne *Reste* dit où l'on en est.
   var pct = reste ? '—' : Math.round(e.bon / e.n * 100) + ' %%';
   var parBon = (!reste && e.bon) ? sou(e.cout / e.bon) : '—';
   lignes.push(
    '<tr' + (reste ? '' : ' class=fini') + '>' +
    '<td class=mono>' + g.titre + '</td>' +
    '<td>' + g.cases + '</td><td>' + g.clause + '</td>' +
    '<td>' + e.n + '</td>' +
    '<td' + (reste ? ' class=reste-a-voir' : '') + '>' +
      (reste ? reste + ' à voir' : 'toutes vues') + '</td>' +
    '<td class=b-bon><b>' + e.bon + '</b></td>' +
    '<td class=b-moyen>' + e.moyen + '</td>' +
    '<td class=b-mauvais>' + e.mauvais + '</td>' +
    '<td><b>' + pct + '</b></td>' +
    '<td>' + sou(e.cout) + '</td>' +
    '<td><b>' + parBon + '</b></td></tr>'
   );
  });
  corps.innerHTML = lignes.join('');
 }

 // Le script de notation pose `data-note` sur la carte ; on le regarde changer
 // plutôt que d'aller lire ses variables. Les deux scripts restent ainsi
 // étrangers l'un à l'autre, et celui de la notation n'a pas eu à bouger.
 var oeil = new MutationObserver(peindre);
 [].forEach.call(document.querySelectorAll('.carte[data-groupe]'), function(c){
  oeil.observe(c, {attributes:true, attributeFilter:['data-note']});
 });
 peindre();
})();
"""


def _cout(p: dict) -> float:
    return float(p.get("cout_usd") or 0.0)


def main() -> None:
    tout = json.loads(TOUT.read_text("utf-8"))
    notes = json.loads(NOTES.read_text("utf-8")) if NOTES.exists() else {}
    planches = tout["planches"]

    groupes = []
    for entree in CARRE:
        siens = sorted(
            (p for p in planches if entree["trouver"](p)),
            key=lambda p: (len(p["jet"]), p["jet"]),
        )
        groupes.append({**entree, "planches": siens})

    total = sum(len(g["planches"]) for g in groupes)
    neuves = sum(1 for g in groupes for p in g["planches"]
                 if not notes.get(_ident(p)))
    paye = sum(_cout(p) for g in groupes for p in g["planches"])

    parts: list[str] = []
    parts.append(
        "<!doctype html><html lang=fr><meta charset=utf-8>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        "<title>L'arbitrage — quatre cases, ou la clause de constance ?</title>"
        f"<style>{STYLE}{SUPPLEMENT}</style><body><div class=page>"
    )

    parts.append(
        "<div class=barre>"
        "<span class=compte id=compte>0 / 0 notées</span>"
        "<span class=part>· <b class=b-bon id=nb-bon>0</b> bonnes "
        "· <b class=b-moyen id=nb-moyen>0</b> moyennes "
        "· <b class=b-mauvais id=nb-mauvais>0</b> mauvaises</span>"
        "<label><input type=checkbox id=filtre> ne montrer que celles qui restent</label>"
        "<span class=part>survole une carte et tape <b>1</b>, <b>2</b> ou <b>3</b></span>"
        "<span class=pousse></span>"
        "<button id=voir-releve>voir le relevé</button>"
        "<button id=copier>copier mon relevé</button>"
        "<button id=telecharger>télécharger</button>"
        "<button id=vider>tout effacer</button>"
        "<span id=alerte hidden class=part style='color:var(--echec);flex-basis:100%'>"
        "⚠ ce navigateur ne mémorise pas les notes sur cette page — pense à "
        "<b>copier ton relevé</b> avant de la fermer.</span>"
        "</div>"
        "<div id=zone-releve hidden style='margin:-10px 0 24px'>"
        "<textarea id=releve readonly rows=6 style='width:100%;background:var(--fond-1);"
        "color:var(--texte-2);border:1px solid var(--bord);border-radius:3px;padding:10px;"
        "font:12px ui-monospace,Consolas,monospace'></textarea></div>"
    )

    parts.append("<h1>L'arbitrage : quatre cases, ou la clause de constance ?</h1>")
    parts.append(
        f"<p class=chapeau>Les cent onze animations des deux premiers bancs ont laissé "
        f"<b>deux pistes vivantes et aucune prouvée</b>. Cette page les paie, huit tirages "
        f"chacune, et les met en carré : <b>{total} animations</b>, dont "
        f"<b>{neuves} à noter</b>. ${paye:.2f} en tout, dont "
        f"${sum(_cout(p) for g in groupes for p in g['planches'] if not notes.get(_ident(p))):.2f} "
        f"payés aujourd'hui.</p>"
    )
    parts.append(
        "<p class=chapeau><b>Les quatre groupes partent du bloc complet du produit</b>, "
        "avec le paragraphe qui interdit de redessiner le quadrillage — celui sans lequel "
        "l'atelier ne saurait pas ouvrir la planche. Ils ne diffèrent que par les deux axes "
        "du carré. C'est exactement ce qui manquait aux essais à quatre cases des vagues "
        "précédentes : ils avaient perdu ce paragraphe en route, et leurs six planches "
        "étaient toutes inutilisables, si bien qu'on ne savait pas ce qu'on mesurait.</p>"
    )
    parts.append(
        "<p class=chapeau><b>Les animations sont montées sur les cases brutes, sans "
        "détourage.</b> La planche est seulement coupée en ses cases ; les pixels sont ceux "
        "que le modèle a dessinés, fond compris. Le détourage grignote un pied et laisse des "
        "miettes : on finirait par juger le détourage au lieu de la marche. La ligne "
        "<i>découpable</i> sous chaque animation dit, elle, ce que l'œil ne peut pas voir — "
        "si l'atelier saurait l'ouvrir.</p>"
    )

    # ── Le carré, vivant ─────────────────────────────────────────────────────
    parts.append("<h2 id=carre>Ce que ces trente-neuf animations décident</h2>")
    parts.append(
        "<p class=axe>Ce tableau <b>se remplit à mesure que tu notes</b>. Il n'y a rien de "
        "cuit dedans : chaque clic sur <i>mauvais</i>, <i>moyen</i> ou <i>bon</i> le "
        "recalcule. La colonne <i>% bonnes</i> reste vide tant qu'un groupe n'a pas été vu "
        "en entier — un pourcentage sur une notation à moitié faite ment, et il ment "
        "toujours dans le sens flatteur.</p>"
    )
    parts.append(
        "<div class=tableau><table><thead><tr>"
        "<th>Groupe</th><th>Cases</th><th>Clause</th><th>Tirages</th><th>Reste</th>"
        "<th>Bonnes</th><th>Moyennes</th><th>Mauvaises</th><th>% bonnes</th>"
        "<th>Payé</th><th>$ par bonne</th>"
        "</tr></thead><tbody id=carre-corps></tbody></table></div>"
    )
    parts.append(
        "<p class=legende><b>Ce que ça décidera.</b> Si un groupe à quatre cases dépasse "
        "franchement le produit d'aujourd'hui, le nombre de cases est le levier et le "
        "changement à faire tient en quelques lignes. Si c'est la clause remplacée qui "
        "l'emporte à huit cases, c'est une phrase à réécrire dans le prompt. Si aucun des "
        "trois ne bat le produit, <b>la demande est épuisée comme levier</b> — et ce serait "
        "aussi une réponse : elle renvoie au mannequin articulé, qui impose la géométrie au "
        "lieu de l'espérer.</p>"
    )

    # ── Les quatre groupes ───────────────────────────────────────────────────
    for g in groupes:
        siens = g["planches"]
        if not siens:
            continue
        restant = sum(1 for p in siens if not notes.get(_ident(p)))
        etat = (f"{restant} à noter" if restant else "déjà notées")
        parts.append(
            f"<h2 id={html.escape(g['cle'])} style='margin-top:46px'>"
            f"<span class=groupe>{html.escape(g['titre'])}"
            f"<span class=prix>{len(siens)} tirages · {etat} · "
            f"${sum(_cout(p) for p in siens):.3f}</span></span></h2>"
        )
        parts.append(f"<p class=axe>{html.escape(g['propos'])}</p>")

        # **Ce qui est parti est montré avec ce qui est revenu.** Un réglage lu
        # six mois plus tard sans sa consigne n'est plus le résultat de rien.
        jointes = images_de(siens[0]) if siens[0]["banc"] == "recette" \
            else references_du_produit()
        parts.append("<div class=envoye style='margin-top:12px'>")
        parts.append(
            f"<div class=titre>ce qui est parti — {len(jointes)} images jointes, "
            f"et ce texte</div>"
        )
        parts.append("<div class=vignettes>")
        for octets in jointes:
            parts.append(
                f"<img alt='image jointe' src='data:image/png;base64,{vignette(octets)}'>"
            )
        parts.append("</div>")
        parts.append(f"<div class=consigne>{html.escape(siens[0]['texte'])}</div></div>")

        parts.append("<div class=grille>")
        for p in siens:
            # Le groupe et le prix voyagent sur la carte : c'est le tableau
            # vivant qui les relit, et il ne connaît que le DOM.
            brut = carte(p, avec_modele=False, notes=notes)
            parts.append(brut.replace(
                "<div class=carte",
                f"<div class=carte data-groupe=\"{html.escape(g['cle'])}\" "
                f"data-cout=\"{_cout(p):.4f}\"",
                1,
            ))
        parts.append("</div>")

    minimal = [{"cle": g["cle"], "titre": g["titre"], "cases": g["cases"],
                "clause": g["clause"]} for g in groupes]
    parts.append(
        f"<script>var CUITES={json.dumps(notes, ensure_ascii=False)};</script>"
        f"<script>{SCRIPT}</script>"
        f"<script>{VIVANT % json.dumps(minimal, ensure_ascii=False)}</script>"
    )
    parts.append("</div></body></html>")

    SORTIE.write_text("".join(parts), "utf-8")
    poids = SORTIE.stat().st_size / 1_048_576
    print(f"{total} animations, dont {neuves} a noter · ${paye:.3f}")
    for g in groupes:
        vus = sum(1 for p in g["planches"] if notes.get(_ident(p)))
        print(f"  {g['cle']:<22} {len(g['planches']):>2} tirages · {vus} deja notees")
    print(f"-> {SORTIE} ({poids:.1f} Mo)")


def _ident(p: dict) -> str:
    from rapport_tout import identifiant

    return identifiant(p)


# Ce que le tableau vivant ajoute au style commun — et rien de plus : tout le
# reste est celui du grand rapport, pour que les deux pages se lisent pareil.
SUPPLEMENT = """
#carre-corps .fini td{background:rgba(73,179,206,.05)}
#carre-corps .reste-a-voir{color:var(--epingle)}
#carre-corps td:first-child{color:var(--texte);font-family:inherit}
"""


if __name__ == "__main__":
    main()
