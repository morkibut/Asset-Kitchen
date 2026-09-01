# -*- coding: utf-8 -*-
"""Le rapport visuel de l'essai de recette — **on voit ce qui a été envoyé, et ce qui est revenu.**

Le rapport du banc des modèles montrait des résultats. Celui-ci doit montrer
**des couples** : à gauche ce qu'on a joint à la demande, à droite ce que le
modèle en a fait. Sans les deux côte à côte, un réglage qui gagne ne dit pas
pourquoi il gagne.

Le montage des animations et l'habillage sont ceux du premier rapport — on ne
réécrit pas ce qui marche, on l'importe.

    .venv\\Scripts\\python.exe essais/rapport_recette.py
"""

from __future__ import annotations

import base64
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))
sys.path.insert(0, str(RACINE.parent))

from juger_recette import ouvrir  # noqa: E402
from rapport_animation import FOND_GIF, MS, STYLE, ZOOM  # noqa: E402

import numpy as np  # noqa: E402

BANC = RACINE / "resultats_recette"
TEMOIN = RACINE / "resultats_animation"
SORTIE = BANC / "rapport.html"

# Les six axes du banc, dans l'ordre où ils se lisent — F en dernier, parce que
# c'est la seconde vague, décidée en dépouillant les cinq premiers. Le texte dit
# ce qu'on cherchait, pour qu'un tableau de chiffres six mois plus tard reste
# lisible sans avoir à relire le programme qui l'a produit.
AXES = [
    ("A", "Combien de cases sur la planche",
     "Huit cases sur une image de mille pixels, c'est un personnage de trois cents "
     "pixels de côté. À quatre cases il est deux fois plus grand — et un corps plus "
     "grand a peut-être plus de place pour se déformer."),
    ("B", "Comment la consigne est écrite",
     "Six façons de demander la même marche, des attitudes énumérées à l'interdiction "
     "explicite de dessiner des poses statiques. Tout le reste est identique."),
    ("C", "Ce qu'on joint comme images",
     "C'est le pari de ce banc. Les mots n'ont jamais réussi à décrire une "
     "chorégraphie ; une image, peut-être. Le guide de marche ci-dessus est dessiné "
     "par le programme, gratuitement, avec la géométrie d'un vrai cycle."),
    ("D", "Les croisements qui valaient la peine",
     "Ce qui a marché sur un axe, combiné avec ce qui a marché sur un autre."),
    ("E", "Le format de l'image",
     "Une bande large plutôt qu'un carré : quatre colonnes sur deux lignes, où le "
     "sujet est plus haut que dans une grille de trois sur trois."),
    ("F", "Ce que la première vague a obligé à vérifier",
     "En dépouillant les vingt-cinq premiers réglages, une erreur est apparue : la "
     "consigne que je croyais être celle du produit en omettait le dernier paragraphe. "
     "Ce paragraphe dit deux choses, et les deux comptent. Il demande « same "
     "proportions, same size » — une phrase qui interdit au corps de changer de forme, "
     "dans une demande de marche. Et il interdit de redessiner les traits du "
     "quadrillage — sans quoi le modèle les redessine, et la planche devient "
     "indécoupable. Ces trois réglages-là repartent du prompt complet."),
    ("G", "La case décisive, payée en dernier",
     "Trois tirages avaient laissé croire que retirer la clause de forme changeait tout. "
     "Huit de plus, ici, sur la seule combinaison qui serait à la fois animée et "
     "découpable — prompt complet, clause remplacée, guide joint. L'effet a disparu : "
     "c'était du hasard. Ces huit-là valent plus cher que les vingt-cinq premiers, parce "
     "qu'ils empêchent une conclusion fausse d'entrer dans le produit."),
]

SUPPLEMENT = """
.couple{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px;
 align-items:start;margin-top:14px}
@media(max-width:820px){.couple{grid-template-columns:1fr}}
.envoye{background:var(--fond-1);border:1px solid var(--bord);border-radius:3px;padding:12px}
.envoye .titre{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;
 color:var(--texte-3);margin-bottom:9px}
.vignettes{display:flex;gap:6px;flex-wrap:wrap}
.vignettes img{width:62px;height:62px;object-fit:contain;background:var(--fond-3);
 border:1px solid var(--bord);border-radius:2px;image-rendering:pixelated}
.consigne{margin-top:10px;font-size:11.5px;color:var(--texte-3);line-height:1.5;
 max-height:132px;overflow:auto;font-family:ui-monospace,Consolas,monospace}
.reglage{margin:26px 0 0;padding-top:20px;border-top:1px solid var(--bord)}
.reglage:first-of-type{border-top:0;padding-top:0}
.reglage h3{font-size:14px;margin:0 0 2px}
.reglage .quoi{color:var(--texte-2);font-size:12.5px;margin:0}
.axe{color:var(--texte-2);margin:0 0 4px;max-width:70ch}
.guides{display:flex;gap:14px;flex-wrap:wrap;margin:16px 0 6px}
.guides figure{margin:0}
.guides img{width:230px;background:var(--fond-3);border:1px solid var(--bord);border-radius:3px}
.guides figcaption{color:var(--texte-3);font-size:11.5px;margin-top:6px;max-width:230px}
.mieux{color:var(--ok)}.pire{color:var(--texte-3)}
"""


CIBLE = 96


def animer(chemin: Path) -> str | None:
    """La planche en animation, montée sur une boîte commune.

    **La même ouverture que le juge** — recoupe des cases dont le quadrillage a
    été redessiné, retrait de la barre de sol — pour que ce qu'on voit soit ce
    qui a été mesuré. Et **une seule boîte pour toute la bande**, jamais une par
    case : recadrer chaque étape sur elle-même écrase le balancement, qui est
    très exactement ce qu'on vient regarder.
    """
    sujets, _ = ouvrir(chemin.read_bytes())
    if len(sujets) < 2:
        return None
    haut = max(s.shape[0] for s in sujets)
    larg = max(s.shape[1] for s in sujets)
    plats = []
    for s in sujets:
        toile = np.zeros((haut, larg, 4), np.uint8)
        dy, dx = haut - s.shape[0], (larg - s.shape[1]) // 2
        toile[dy : dy + s.shape[0], dx : dx + s.shape[1]] = s
        im = Image.fromarray(toile, "RGBA").resize(
            (max(1, round(larg * CIBLE / haut)), CIBLE), Image.NEAREST
        )
        fond = Image.new("RGBA", im.size, FOND_GIF + (255,))
        fond.alpha_composite(im)
        plats.append(
            fond.convert("RGB")
            .resize((im.width * ZOOM, im.height * ZOOM), Image.NEAREST)
            .convert("P", palette=Image.ADAPTIVE, colors=64)
        )
    tampon = io.BytesIO()
    plats[0].save(
        tampon, format="GIF", save_all=True, append_images=plats[1:], duration=MS, loop=0
    )
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def vignette(octets: bytes, cote: int = 128) -> str:
    """Une image réduite et embarquée — les références pèsent trop en taille réelle."""
    im = Image.open(io.BytesIO(octets)).convert("RGB")
    im.thumbnail((cote, cote), Image.LANCZOS)
    t = io.BytesIO()
    im.save(t, format="PNG", optimize=True)
    return base64.b64encode(t.getvalue()).decode("ascii")


def grosse(chemin: Path, largeur: int = 480) -> str:
    im = Image.open(chemin).convert("RGB")
    im.thumbnail((largeur, largeur), Image.LANCZOS)
    t = io.BytesIO()
    im.save(t, format="PNG", optimize=True)
    return base64.b64encode(t.getvalue()).decode("ascii")


def images_envoyees(nom: str) -> list[bytes]:
    """Ce que ce réglage a joint — refabriqué à l'identique, jamais deviné."""
    from essai_recette import reglages

    for r in reglages():
        if r["nom"] == nom:
            return r["images"]
    return []


def main() -> None:
    releve = json.loads((BANC / "mesures.json").read_text("utf-8"))
    jugements = json.loads((BANC / "jugements.json").read_text("utf-8"))
    synthese = {s["reglage"]: s for s in json.loads((BANC / "synthese.json").read_text("utf-8"))}
    total = sum(l.get("cout_usd") or 0.0 for l in jugements)

    # Le témoin : la recette d'aujourd'hui, huit tirages déjà payés au banc des
    # modèles — **remesurés par le juge de ce banc-ci**, sinon la comparaison
    # opposerait deux façons de compter et l'avance serait fabriquée.
    t = json.loads((BANC / "temoin.json").read_text("utf-8"))
    ref = t["forme_moyenne"] or 0.0

    classe = sorted(synthese.values(), key=lambda s: -(s["forme_moyenne"] or 0))
    parts: list[str] = []
    parts.append(
        "<!doctype html><html lang=fr><meta charset=utf-8>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        "<title>Essai de recette — Asset Kitchen</title>"
        f"<style>{STYLE}{SUPPLEMENT}</style><body><div class=page>"
    )
    parts.append("<h1>Vingt-neuf façons de demander la même marche</h1>")
    parts.append(
        f"<p class=chapeau>Même modèle du début à la fin — <span class=mono>openai/gpt-image-2</span>, "
        f"celui que le produit utilise déjà. Ce qui change, c'est la demande : le nombre de "
        f"cases, le texte de la consigne, et surtout <b>les images qu'on joint</b>. "
        f"{len(jugements)} planches, ${total:.2f} dépensés, deux tirages par réglage — "
        f"jusqu'à huit pour ceux qu'il a fallu départager.</p>"
    )

    # **Ce qu'il faut retenir est calculé, jamais écrit d'avance.** Les quatre
    # cases du croisement se retrouvent par leur nom, et les phrases se
    # fabriquent à partir de leurs chiffres : si un tirage de plus change le
    # résultat, le résumé change avec lui.
    familles = json.loads((BANC / "familles.json").read_text("utf-8"))
    par_nom = {f["famille"]: f for f in familles}

    def case(cle: str) -> dict:
        return next(f for n, f in par_nom.items() if n.startswith(cle))

    actuel = case("1 prompt du produit")
    clause = case("2 idem, clause de forme remplacee")
    clause_guide = case("2b idem, plus le guide")
    reecrites = case("8 consigne reecrite")
    decoupables = json.loads((BANC / "decoupables.json").read_text("utf-8"))
    # **Désignés par leur nom, jamais par leur rang.** Le tableau est classé au
    # rendement, et ce classement a déjà changé une fois : s'y fier pour savoir
    # qui est qui inverse les chiffres dès que l'ordre bouge.
    produit = next(d for d in decoupables if "produit" in d["consigne"])
    essai = next(d for d in decoupables if "d'essai" in d["consigne"])

    parts.append("<div class=retenir>")
    parts.append(
        f"<p><b>Une hypothèse est morte en cours de banc, et il faut la dire en premier.</b> "
        f"Sur trois tirages, retirer du prompt la phrase <span class=mono>same "
        f"proportions, same size</span> — qui interdit au corps de changer de forme — "
        f"semblait tout changer. Huit tirages plus tard, l'effet a disparu : "
        f"{actuel['animes']} planches animées sur {actuel['tirages']} avec la phrase, "
        f"{clause['animes']} sur {clause['tirages']} sans elle, "
        f"{clause_guide['animes']} sur {clause_guide['tirages']} sans elle et avec un guide "
        f"de marche joint. <b>Ces trois-là ne se distinguent pas.</b> C'était du hasard, "
        f"et trois tirages ne savent pas le voir.</p>"
    )
    parts.append(
        f"<p><b>Et le prompt du produit reste le meilleur de bout en bout.</b> Ma consigne "
        f"d'essai — qui détaille chaque case (« pied droit en arrière », « corps au plus "
        f"bas », « jambes jointes ») — anime bien mieux ce qu'elle sauve : médiane "
        f"{essai['mediane']} % contre {produit['mediane']} % pour le produit, et "
        f"{essai['animees']} planches animées sur ses {essai['tirages']} découpables. "
        f"Mais elle n'en sauve que {essai['tirages']} sur {essai['tirages_en_tout']} "
        f"tirages payés, quand le produit garde ses {produit['tirages']} sur "
        f"{produit['tirages_en_tout']}. <b>Rendement final : "
        f"{produit['exploitables_sur_paye_pct']} % pour le produit, "
        f"{essai['exploitables_sur_paye_pct']} % pour la mienne.</b></p>"
    )
    parts.append(
        f"<p><b>Ces pertes sont mon erreur, et elles se réparent.</b> Ma consigne d'essai "
        f"avait laissé tomber le paragraphe du produit qui interdit de redessiner les "
        f"traits du quadrillage — et le modèle les a redessinés sur 47 planches sur 53. "
        f"Le produit ne saurait pas les ouvrir : il en tirerait huit carrés opaques, sans "
        f"rien refuser. <b>Une consigne à la fois détaillée et protégée n'a jamais été "
        f"essayée</b> ; c'est elle qui pourrait cumuler les deux, et elle coûte une "
        f"dizaine de tirages.</p>"
    )
    parts.append(
        f"<p><b>Aucune réécriture de fond de la consigne n'a marché</b> — "
        f"{reecrites['animes']} planche animée sur {reecrites['tirages']}, et zéro "
        f"découpable. Toutes remplaçaient l'énumération des poses case par case par une "
        f"description générale du mouvement. <b>C'est l'énumération qui porte la marche</b>, "
        f"et le produit l'écrit déjà — il la détaille seulement moins.</p>"
    )
    parts.append("</div>")

    # ── Les familles, qui décident ───────────────────────────────────────────
    parts.append("<h2>Les familles, et pourquoi le classement des réglages ne veut rien dire</h2>")
    parts.append(
        "<p class=axe>Chaque réglage n'a que deux tirages, et ce banc prouve lui-même que "
        "ça ne suffit pas : deux tirages d'une même demande ont donné 67 % et 14 %. On "
        "regroupe donc les réglages qui partagent ce qu'on teste. Les familles 1, 2 et 2b "
        "sont les trois qu'on a payées cher pour départager — et elles ne se départagent "
        "pas. Les familles au fort pourcentage sont celles dont les planches ne sont pas "
        "découpables, ce que la colonne suivante dit.</p>"
    )
    parts.append(
        "<table><thead><tr><th>Famille</th><th>Ce que c'est</th><th>Tirages</th>"
        "<th>Qui bougent</th><th>Part</th><th>Découpables</th><th>Forme moyenne</th>"
        "<th>Médiane</th><th>Jambes</th></tr></thead><tbody>"
    )
    for f in familles:
        cl = " class=vainqueur" if "LIVRABLE" in f["famille"] else ""
        nom = (f["famille"].replace("<<", "→").replace("LIVRABLE", "à retenir")
               .replace("ACTUEL", "ce qui part aujourd'hui"))
        entier = f["decoupables"] == f["tirages"]
        marque = "mieux" if (f["forme_moyenne"] or 0) > ref else "pire"
        parts.append(
            f"<tr{cl}><td>{html.escape(nom)}</td>"
            f"<td style='text-align:left;white-space:normal'>{html.escape(f['propos'])}</td>"
            f"<td>{f['tirages']}</td><td>{f['animes']}</td>"
            f"<td><b>{f['part_animee_pct']} %</b></td>"
            f"<td class={'mieux' if entier else 'pire'}>{f['decoupables']}</td>"
            f"<td class={marque}>{f['forme_moyenne']} %</td>"
            f"<td>{f['forme_mediane']} %</td>"
            f"<td>{f['jambes_moyennes']} %</td></tr>"
        )
    parts.append("</tbody></table>")
    parts.append(
        "<p class=legende><code>Découpables</code> = planches que le produit saurait "
        "ouvrir. Sur les autres, le modèle a <b>redessiné les traits du quadrillage</b> ; "
        "le détourage inonde depuis le bord de l'image, bute sur ces traits, et chaque "
        "case ressort en carré opaque. Le contrôle du compte ne les attrape pas — huit "
        "carrés font huit taches — donc le produit les garde. Ce banc sait les rouvrir "
        "pour les mesurer, le produit non : une famille à zéro découpable a beau bien "
        "bouger, elle n'est pas livrable.</p>"
    )

    # ── Le tableau qui décide ────────────────────────────────────────────────
    parts.append("<h2>Et maintenant, seulement les planches que le produit saurait ouvrir</h2>")
    parts.append(
        "<p class=axe>Une planche dont le modèle a redessiné le quadrillage, ce banc sait "
        "la rouvrir pour la mesurer — le produit, non. La garder dans un classement revient "
        "à comparer ce qu'on saurait livrer avec ce qu'on ne saurait pas. Ce tableau-ci ne "
        "garde que les découpables, et c'est le seul endroit du banc où un écart franc "
        "apparaît.</p>"
    )
    parts.append(
        "<table><thead><tr><th>Nature de la consigne envoyée</th><th>Découpables</th>"
        "<th>Sur tirages payés</th><th>Qui bougent</th><th>Médiane</th>"
        "<th>Rendement</th><th>Les valeurs, l'une après l'autre</th></tr></thead><tbody>"
    )
    for i, d in enumerate(decoupables):
        cl = " class=vainqueur" if i == 0 else ""
        valeurs = " · ".join(f"{v:.1f}" for v in d["formes"])
        parts.append(
            f"<tr{cl}><td style='text-align:left;white-space:normal'>"
            f"{html.escape(d['consigne'])}</td><td>{d['tirages']}</td>"
            f"<td>{d['tirages_en_tout']}</td><td>{d['animees']}</td>"
            f"<td>{d['mediane']} %</td>"
            f"<td><b>{d['exploitables_sur_paye_pct']} %</b></td>"
            f"<td class=mono style='white-space:normal;font-size:11px'>{valeurs}</td></tr>"
        )
    parts.append(
        "<tr><td style='text-align:left;white-space:normal'>consigne réécrite de fond, "
        "mouvement décrit en général</td><td>0</td><td>20</td><td>—</td><td>—</td>"
        "<td><b>0 %</b></td><td style='text-align:left;white-space:normal'>aucune de ses "
        "20 planches n'était découpable</td></tr>"
    )
    parts.append("</tbody></table>")
    parts.append(
        "<p class=legende><code>Rendement</code> = planches <b>à la fois découpables et "
        "animées</b>, divisées par tout ce qu'on a payé. C'est le seul chiffre de bout en "
        "bout, et il renverse le classement : ma consigne d'essai anime mieux ce qu'elle "
        "sauve (médiane 18,4 % contre 4,5 %) mais elle en perd les cinq sixièmes, "
        "et <b>le prompt du produit gagne, 31 % contre 18 %</b>. La médiane ne parle que "
        "des survivantes ; le rendement parle de la facture.</p>"
    )
    parts.append(
        "<p class=legende>Reste que les pertes de la consigne d'essai viennent d'une seule "
        "chose, et elle se répare : le paragraphe qui interdit de redessiner le quadrillage, "
        "que j'avais laissé tomber. <b>Une consigne qui serait à la fois détaillée et "
        "protégée n'a jamais été essayée.</b> Et un réglage a évité le problème par un autre "
        "chemin : celui qui <b>ne joint aucun gabarit du tout</b> — rien à redessiner — et "
        "qui a donné deux planches sur deux, animées et découpables. C'est là qu'il faut "
        "dépenser la prochaine fois.</p>"
    )

    # ── Le classement ────────────────────────────────────────────────────────
    parts.append("<h2>Le classement, réglage par réglage</h2>")
    parts.append(
        "<table><thead><tr><th>Réglage</th><th>Ce qui change</th><th>Cases</th>"
        "<th>Comptes bons</th><th>Utilisables</th><th>Forme moyenne</th>"
        "<th>Forme du meilleur</th><th>Jambes</th><th>Payé</th></tr></thead><tbody>"
    )
    for i, s in enumerate(classe):
        cl = " class=vainqueur" if i == 0 else ""
        cases = next((l["attendu"] for l in jugements if l["reglage"] == s["reglage"]), "—")
        fm = s["forme_moyenne"]
        marque = "mieux" if fm is not None and fm > ref else "pire"
        parts.append(
            f"<tr{cl}><td class=mono>{html.escape(s['reglage'])}</td>"
            f"<td style='text-align:left;white-space:normal'>{html.escape(s['quoi'])}</td>"
            f"<td>{cases}</td><td>{s['comptes_ok']}/{s['essais']}</td>"
            f"<td>{s['utilisables']}/{s['essais']}</td>"
            f"<td class={marque}><b>{fm if fm is not None else '—'} %</b></td>"
            f"<td>{s['forme_max'] if s['forme_max'] is not None else '—'} %</td>"
            f"<td>{s['jambes_moyennes'] if s['jambes_moyennes'] is not None else '—'} %</td>"
            f"<td>${s['cout_total']:.3f}</td></tr>"
        )
    parts.append("</tbody></table>")
    parts.append(
        f"<p class=legende><code>Forme</code> = de combien le rapport hauteur/largeur du "
        f"personnage change d'une case à l'autre. C'est le juge du mouvement : constante, le "
        f"modèle a dessiné la même pose plusieurs fois ; variable, le corps se déforme "
        f"vraiment. En vert, les réglages qui font mieux que la recette actuelle "
        f"({ref:.1f} %). <code>Comptes bons</code> = la planche porte au moins le nombre de "
        f"cases demandé ; le surplus s'écarte à la main.</p>"
    )

    # ── Le guide, montré en grand ────────────────────────────────────────────
    parts.append("<h2>La référence visuelle : un cycle de marche dessiné par le programme</h2>")
    parts.append(
        "<p class=axe>Les mots n'ont jamais réussi à faire balancer un corps. Cette image-là "
        "le dit sans mots : le pied recule au sol pendant l'appui puis repart en avant, le "
        "bassin monte et descend deux fois par cycle, le genou est calculé et non dessiné à "
        "vue, les bras balancent à l'opposé des jambes. Elle ne coûte rien à fabriquer.</p>"
    )
    parts.append("<div class=guides>")
    for fichier, legende in (
        ("guide_baton_8.png", "Le guide en bonhomme-bâton, huit cases — les articulations se lisent."),
        ("guide_silhouette_8.png", "Le même en silhouettes pleines — c'est la masse qui se lit."),
        ("apercu_amorce.png", "Le gabarit dont la première case est déjà remplie : le modèle n'a plus à deviner par quoi commencer."),
    ):
        chemin = RACINE / fichier
        if chemin.exists():
            parts.append(
                f"<figure><img alt='{html.escape(legende)}' "
                f"src='data:image/png;base64,{grosse(chemin)}'>"
                f"<figcaption>{html.escape(legende)}</figcaption></figure>"
            )
    parts.append("</div>")

    # ── Les planches, axe par axe ────────────────────────────────────────────
    for lettre, titre, propos in AXES:
        noms = [s["reglage"] for s in classe if s["reglage"].startswith(lettre + "-")]
        if not noms:
            continue
        parts.append(f"<h2>{lettre} · {html.escape(titre)}</h2>")
        parts.append(f"<p class=axe>{html.escape(propos)}</p>")
        for nom in noms:
            s = synthese[nom]
            siens = sorted(
                (l for l in jugements if l["reglage"] == nom), key=lambda x: x["jet"]
            )
            fm = s["forme_moyenne"]
            marque = "mieux" if fm is not None and fm > ref else "pire"
            parts.append("<div class=reglage>")
            parts.append(
                f"<h3 class=mono>{html.escape(nom)} "
                f"<span class='{marque}' style='font-weight:400'>· forme {fm} %</span></h3>"
                f"<p class=quoi>{html.escape(s['quoi'])}</p>"
            )
            parts.append("<div class=couple>")

            parts.append("<div class=envoye><div class=titre>ce qui a été envoyé</div>")
            parts.append("<div class=vignettes>")
            for octets in images_envoyees(nom):
                parts.append(f"<img alt='référence jointe' src='data:image/png;base64,{vignette(octets)}'>")
            parts.append("</div>")
            texte = releve[nom]["reglage"]["texte"]
            parts.append(f"<div class=consigne>{html.escape(texte)}</div></div>")

            parts.append("<div><div class=grille style='margin-top:0'>")
            for l in siens:
                if not l.get("decoupable", True):
                    pas, mot = "p-echec", "quadrillage redessiné"
                elif l["utilisable"]:
                    pas, mot = "p-oui", "utilisable"
                elif l["compte_ok"]:
                    pas, mot = "p-non", "figé"
                else:
                    pas, mot = "p-geste", "compte raté"
                parts.append("<div class=carte>")
                parts.append(
                    f"<div class=entete><span class=jet>{html.escape(l['jet'])}</span>"
                    f"<span class='pastille {pas}'>{mot}</span></div>"
                )
                gif = animer(Path(l["fichier"]))
                if gif:
                    parts.append(
                        f"<div class=vue><img alt='animation' "
                        f"src='data:image/gif;base64,{gif}'></div>"
                    )
                else:
                    parts.append("<div class='vue vide'>planche illisible</div>")
                parts.append("<div class=pied>")
                for cle, valeur in (
                    ("sujets", f"{l['sujets']} / {l['attendu']}"),
                    ("cases rouvertes", str(l.get("cases_recoupees", 0))),
                    ("forme", f"{l.get('forme_pct','—')} %"),
                    ("jambes", f"{l.get('jambes_pct','—')} %"),
                    ("balancement", f"{l.get('balancement_px','—')} px"),
                    ("prix", f"${l['cout_usd']:.4f}" if l.get("cout_usd") else "—"),
                ):
                    parts.append(f"<div class=ligne><span>{cle}</span><b>{valeur}</b></div>")
                parts.append("</div></div>")
            parts.append("</div></div>")
            parts.append("</div></div>")

    parts.append(
        "<p class=legende style='margin-top:40px'>Toutes les animations sont montées de la "
        "même façon : les cases découpées sur une <b>boîte commune</b>, posées sur la même "
        "ligne de sol, jamais recadrées une par une. La consigne affichée à gauche est le "
        "troisième bloc du prompt ; les deux premiers — la bible du jeu et le signalement du "
        "personnage — sont identiques pour les vingt-cinq réglages.</p>"
    )
    parts.append("</div></body></html>")

    SORTIE.write_text("".join(parts), encoding="utf-8")
    print(f"-> {SORTIE}  ({SORTIE.stat().st_size/1_048_576:.1f} Mo, {len(jugements)} planches, ${total:.2f})")


if __name__ == "__main__":
    main()
