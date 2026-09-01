# -*- coding: utf-8 -*-
"""Le rapport visuel du banc — un seul fichier HTML, qui marche hors ligne.

**Chaque planche y devient une animation qui tourne**, à côté de son prix et de
ses mesures. C'est le seul moyen de vérifier un chiffre : la forme dit *le corps
se déforme de neuf pour cent*, l'œil dit *oui, il marche* — ou *non, il tremble*.

Les images sont **embarquées dans le fichier**, en clair dedans : on peut le
déplacer, l'envoyer, l'ouvrir sans réseau et sans le dossier d'à côté.

Les couleurs sont celles du produit (`docs/DESIGN.md`) : châssis froid et muet,
les sprites sont la seule chose colorée de l'écran.

    .venv\\Scripts\\python.exe essais/rapport_animation.py
"""

from __future__ import annotations

import base64
import html
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE.parent))

from atelier.domaine.recette import Passe, Recette
from atelier.image.decoupe import en_ordre_de_lecture, zones_opaques
from atelier.image.traitement import detourer

BANC = RACINE / "resultats_animation"
SORTIE = BANC / "rapport.html"
ZOOM, MS, CIBLE = 3, 100, 96
FOND_GIF = (23, 27, 33)  # --fond-2


def animer(chemin: Path) -> tuple[str, int] | None:
    """La planche en animation, posée sur une ligne de sol commune.

    **Une boîte commune pour toute la bande**, jamais une par case : recadrer
    chaque étape sur elle-même écrase le balancement, qui est très exactement ce
    qu'on vient regarder.
    """
    rgba = detourer(Recette(passes=(Passe(moteur="bord"),)), chemin.read_bytes())
    boites = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    if len(boites) < 2:
        return None
    larg = max(b[2] - b[0] for b in boites)
    haut = max(b[3] - b[1] for b in boites)
    plats = []
    for x0, y0, x1, y1 in boites:
        crop = rgba[y0:y1, x0:x1]
        toile = np.zeros((haut, larg, 4), np.uint8)
        dy, dx = haut - crop.shape[0], (larg - crop.shape[1]) // 2
        toile[dy : dy + crop.shape[0], dx : dx + crop.shape[1]] = crop
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
    octets = tampon.getvalue()
    return base64.b64encode(octets).decode("ascii"), len(octets)


STYLE = """
:root{
 --fond-0:#0B0D10; --fond-1:#111419; --fond-2:#171B21; --fond-3:#1E242B;
 --bord:#252B33; --bord-fort:#39424C;
 --texte:#E6EAEE; --texte-2:#98A2AC; --texte-3:#5E6771;
 --signal:#49B3CE; --ok:#5FA871; --epingle:#C8A03C; --echec:#CB6C65;
}
*{box-sizing:border-box}
body{margin:0;background:var(--fond-0);color:var(--texte);
 font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
.page{max-width:1180px;margin:0 auto;padding:40px 24px 80px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:17px;margin:44px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--bord);
 font-weight:600}
h3{font-size:14px;margin:0;font-weight:600}
.chapeau{color:var(--texte-2);margin:0 0 26px}
.retenir{background:var(--fond-1);border:1px solid var(--bord);border-left:3px solid var(--signal);
 border-radius:3px;padding:18px 22px;margin:0 0 30px}
.retenir p{margin:0 0 10px}.retenir p:last-child{margin:0}
.retenir b{color:var(--texte)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{text-align:right;color:var(--texte-3);font-weight:500;padding:7px 10px;
 border-bottom:1px solid var(--bord);white-space:nowrap;
 font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
th:first-child,td:first-child{text-align:left}
td{padding:9px 10px;border-bottom:1px solid var(--bord);text-align:right;white-space:nowrap}
tr:hover td{background:var(--fond-1)}
.vainqueur td{background:rgba(73,179,206,.06)}
.vainqueur td:first-child{box-shadow:inset 2px 0 0 var(--signal)}
.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(178px,1fr));gap:12px;margin-top:14px}
.carte{background:var(--fond-2);border:1px solid var(--bord);border-radius:3px;overflow:hidden;
 display:flex;flex-direction:column}
.vue{background:var(--fond-2);display:flex;align-items:center;justify-content:center;
 min-height:150px;padding:8px}
.vue img{image-rendering:pixelated;max-width:100%;height:auto;display:block}
.vue.vide{color:var(--texte-3);font-size:11px;text-align:center;padding:30px 12px}
.pied{padding:9px 11px;border-top:1px solid var(--bord);font-size:11px}
.ligne{display:flex;justify-content:space-between;gap:8px;color:var(--texte-3);padding:1.5px 0}
.ligne b{color:var(--texte-2);font-weight:500}
.entete{display:flex;justify-content:space-between;align-items:center;gap:8px;
 padding:8px 11px;border-bottom:1px solid var(--bord);background:var(--fond-1)}
.jet{color:var(--texte-2);font-size:11px}
.pastille{font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;
 padding:2px 7px;border-radius:2px;white-space:nowrap}
.p-oui{background:rgba(95,168,113,.16);color:var(--ok)}
.p-geste{background:rgba(200,160,60,.16);color:var(--epingle)}
.p-non{background:rgba(94,103,113,.16);color:var(--texte-3)}
.p-echec{background:rgba(203,108,101,.16);color:var(--echec)}
.legende{color:var(--texte-3);font-size:11.5px;margin-top:12px}
.legende code{color:var(--texte-2)}
.modele{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.modele .prix{color:var(--texte-3);font-size:12px}
"""


def pastille(l: dict) -> str:
    if l.get("echec"):
        return '<span class="pastille p-echec">appel raté</span>'
    if l.get("utilisable_strict"):
        return '<span class="pastille p-oui">utilisable</span>'
    if l.get("utilisable_geste"):
        return '<span class="pastille p-geste">un geste</span>'
    return '<span class="pastille p-non">non</span>'


def main() -> None:
    jugements = json.loads((BANC / "jugements.json").read_text("utf-8"))
    synthese = json.loads((BANC / "synthese.json").read_text("utf-8"))
    total = sum(l.get("cout_usd") or 0.0 for l in jugements)

    classe = sorted(
        [s for s in synthese if s["cout_par_utile"] is not None],
        key=lambda s: s["cout_par_utile"],
    )
    perdants = [s for s in synthese if s["cout_par_utile"] is None]
    ordre = [s["modele"] for s in classe] + [s["modele"] for s in perdants]

    parts: list[str] = []
    parts.append(
        f"<!doctype html><html lang=fr><meta charset=utf-8>"
        f"<meta name=viewport content='width=device-width,initial-scale=1'>"
        f"<title>Banc d'animation — Asset Kitchen</title><style>{STYLE}</style>"
        f"<body><div class=page>"
    )
    parts.append("<h1>Quel modèle sait dessiner une marche</h1>")
    parts.append(
        f"<p class=chapeau>Banc d'essai du 1<sup>er</sup> septembre 2026 — "
        f"{len(jugements)} planches, ${total:.2f} dépensés. "
        f"Chaque animation ci-dessous est une planche réelle, découpée et montée "
        f"par le programme, à dix images par seconde.</p>"
    )

    # ── Ce qu'il faut retenir, calculé et non écrit d'avance ─────────────────
    if classe:
        premier = classe[0]
        cher = max(classe, key=lambda s: s["cout_par_utile"])
        parts.append("<div class=retenir>")
        parts.append(
            f"<p><b>Le meilleur rapport : {html.escape(premier['modele'])}.</b> "
            f"Une planche qui marche lui revient à <b>${premier['cout_par_utile']:.3f}</b>, "
            f"ratés compris — il réussit {premier['reussite_pct']} % de ses essais, "
            f"en {premier['secondes_par_utile']} secondes par planche utilisable.</p>"
        )
        if cher["modele"] != premier["modele"]:
            rapport = cher["cout_par_utile"] / premier["cout_par_utile"]
            parts.append(
                f"<p>Le plus cher du classement, {html.escape(cher['modele'])}, revient à "
                f"<b>${cher['cout_par_utile']:.3f}</b> la planche utilisable — "
                f"<b>{rapport:.1f} fois plus</b>. C'est le prix réel, celui qui compte "
                f"les ratés : le tarif affiché, lui, ne les compte pas.</p>"
            )
        rates = sum(1 for l in jugements if l.get("sujets") == 9)
        if rates:
            parts.append(
                f"<p><b>{rates} planches sur {len(jugements)} sont revenues avec neuf sujets "
                f"au lieu de huit</b>, les modèles ayant complété la grille tout seuls. "
                f"L'atelier les refuse aujourd'hui : l'argent est parti, rien n'est gardé. "
                f"Écarter une case à la main les rendrait toutes utilisables.</p>"
            )
        parts.append("</div>")

    # ── La synthèse ──────────────────────────────────────────────────────────
    parts.append("<h2>Le classement, au prix réel</h2>")
    parts.append(
        "<table><thead><tr><th>Modèle</th><th>Essais</th><th>Utilisables</th>"
        "<th>Réussite</th><th>Total payé</th><th>$ par planche utile</th>"
        "<th>Secondes par utile</th><th>Forme moyenne</th></tr></thead><tbody>"
    )
    for i, s in enumerate(classe + perdants):
        cl = " class=vainqueur" if i == 0 and s in classe else ""
        cpu = f"${s['cout_par_utile']:.3f}" if s["cout_par_utile"] else "—"
        spu = str(s["secondes_par_utile"]) if s["secondes_par_utile"] else "—"
        fm = f"{s['forme_moyenne']} %" if s["forme_moyenne"] is not None else "—"
        parts.append(
            f"<tr{cl}><td>{html.escape(s['modele'])}</td><td>{s['essais']}</td>"
            f"<td>{s['utilisables']}</td><td>{s['reussite_pct']} %</td>"
            f"<td>${s['cout_total']:.3f}</td><td><b>{cpu}</b></td>"
            f"<td>{spu}</td><td>{fm}</td></tr>"
        )
    parts.append("</tbody></table>")
    parts.append(
        "<p class=legende><code>Utilisable</code> = la planche porte huit sujets "
        "<i>et</i> le corps s'y déforme d'au moins 8 % — en dessous, le modèle a dessiné "
        "huit fois la même pose. <code>$ par planche utile</code> = tout ce qui a été payé "
        "chez ce modèle, divisé par ses planches qui marchent : c'est le prix réel, celui "
        "qui fait payer les ratés aux réussites. <code>Forme</code> = de combien le rapport "
        "hauteur/largeur du personnage change d'une case à l'autre — c'est le juge du "
        "mouvement.</p>"
    )

    # ── Les planches, modèle par modèle ──────────────────────────────────────
    for modele in ordre:
        siens = [l for l in jugements if l["modele"] == modele]
        s = next(x for x in synthese if x["modele"] == modele)
        cpu = f"${s['cout_par_utile']:.3f} la planche utile" if s["cout_par_utile"] else "aucune planche utilisable"
        parts.append(
            f"<h2><span class=modele>{html.escape(modele)} "
            f"<span class=prix>{cpu} · {s['reussite_pct']} % de réussite</span></span></h2>"
        )
        parts.append("<div class=grille>")
        for l in sorted(siens, key=lambda x: x["jet"]):
            parts.append("<div class=carte>")
            parts.append(
                f"<div class=entete><span class=jet>{html.escape(l['jet'])}</span>{pastille(l)}</div>"
            )
            gif = animer(Path(l["fichier"])) if l.get("fichier") else None
            if gif:
                parts.append(
                    f"<div class=vue><img alt='animation {html.escape(l['jet'])}' "
                    f"src='data:image/gif;base64,{gif[0]}'></div>"
                )
            elif l.get("echec"):
                parts.append(
                    f"<div class='vue vide'>l'appel n'a pas abouti<br>"
                    f"{html.escape(l.get('echec',''))}</div>"
                )
            else:
                parts.append("<div class='vue vide'>planche illisible</div>")
            parts.append("<div class=pied>")
            if l.get("echec"):
                parts.append(
                    f"<div class=ligne><span>perdu à attendre</span>"
                    f"<b>{l.get('secondes') or '—'} s</b></div>"
                    f"<div class=ligne><span>facturé</span><b>rien</b></div>"
                )
            else:
                lignes = [
                    ("sujets trouvés", f"{l.get('sujets','—')}"),
                    ("forme", f"{l.get('forme_pct','—')} %"),
                    ("jambes", f"{l.get('jambes_pct','—')} %"),
                    ("balancement", f"{l.get('balancement_px','—')} px"),
                    ("lanterne", f"{l['lanterne_pct']} %" if l.get("lanterne_pct") is not None else "—"),
                    ("durée", f"{l.get('secondes','—')} s"),
                    ("prix", f"${l['cout_usd']:.4f}" if l.get("cout_usd") is not None else "—"),
                ]
                for nom, valeur in lignes:
                    parts.append(f"<div class=ligne><span>{nom}</span><b>{valeur}</b></div>")
            parts.append("</div></div>")
        parts.append("</div>")

    parts.append(
        "<p class=legende style='margin-top:40px'>Toutes les animations sont montées "
        "de la même façon : les huit cases découpées sur une <b>boîte commune</b>, posées "
        "sur la même ligne de sol, jamais recadrées une par une — recadrer chaque case sur "
        "elle-même écrase le balancement, qui est justement ce qu'on vient voir.</p>"
    )
    parts.append("</div></body></html>")

    SORTIE.write_text("".join(parts), encoding="utf-8")
    poids = SORTIE.stat().st_size / 1_048_576
    print(f"-> {SORTIE}  ({poids:.1f} Mo, {len(jugements)} planches, ${total:.2f})")


if __name__ == "__main__":
    main()
