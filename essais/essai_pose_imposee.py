# -*- coding: utf-8 -*-
"""E5 — la pose imposée par image : le quatrième chemin d'A0.

**La question.** Le « guide de marche » joint en troisième image d'une planche
a échoué (2 sur 8 contre 5 sur 8 sans). Mais il était une image de plus dans
une planche à huit cases. Ici : **une seule pose par appel**, l'image de
posture en **rôle édition** — elle *est* la demande —, le sprite promu en
référence — l'identité. Le modèle habille-t-il une géométrie imposée ?

**Ce qu'on attend.** Pas un taux : une réponse à « est-ce que ça obéit, et à
quoi ça ressemble quand ça obéit ». C'est une **exploration** : une tentative
à la fois, quatre poses par tour, et l'on écrit **avant** chaque tour ce qu'on
attend et ce qui peut rater ; **après**, quel échec prévu s'est produit.

**Les images de pose** viennent de `guide_marche.image_guide` : contact,
appui, passage, envol — les phases 0, ¼, ½ et ¾ du demi-cycle — en silhouette
pleine d'abord ; le bâton est le tour 2 si la silhouette échoue.

**Un seul correctif par tour**, et le script le tient : la forme du guide
(`--forme silhouette|baton|coloree|proportionnee`), l'ordre des deux images (`--ordre
pose-puis-sprite|sprite-puis-pose`), ou la ligne de texte (`--texte "..."`).
Deux changements à la fois sont refusés. **Arrêt** quand les quatre poses
obéissent et sont le même personnage, ou quand deux tours de suite
n'apprennent rien — c'est l'auteur qui le dit, dans la conclusion du tour.

**Le cinquième tour, si ça marche** (`--bande`) : huit appels, une pose
chacun, sur les huit instants du cycle, assemblés par le socle en une bande à
fenêtre commune et montrés animés à côté du témoin.

    Coût   : un appel par pose ; `--poses contact,passage` fait un tour à deux appels
             (~0,06 $, choix de l'auteur du 2 septembre 2026) ; quatre tours au plus ;
             la bande ~0,25 $ ; PLAFOND 0,50 $ sur ce lancement.
    A sec  : .venv\\Scripts\\python.exe essais/essai_pose_imposee.py --a-sec
    Tour   : .venv\\Scripts\\python.exe essais/essai_pose_imposee.py            (le tour suivant)
    Bande  : .venv\\Scripts\\python.exe essais/essai_pose_imposee.py --bande
    Rapport: essais/rapport-pose-imposee.html · notes : essais/notes-pose-imposee.json

Sortie : `essais/resultats_pose_imposee/tour<N>/jet<N>.png` (une pose par jet) et
`mesures.json`, qui porte pour chaque tour ce qu'on attendait et ce qui pouvait rater.
"""

from __future__ import annotations

import asyncio
import base64
import html
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RACINE = Path(__file__).resolve().parent
sys.path.insert(0, str(RACINE))

from atelier.image.traitement import boite_opaque  # noqa: E402

from essai_taille_reference import taille_retenue  # noqa: E402
from guide_marche import FOND as FOND_GUIDE  # noqa: E402
from guide_marche import MICHEL, image_guide  # noqa: E402
from socle_essais import (  # noqa: E402
    DETOURAGE,
    EDITION,
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
    caler,
    carres,
    detourer,
    estimer,
    image_animee,
    preparer_sortie,
    rapport,
    rejouer,
    temoin_du_disque,
    vignette,
)

ESSAI = "pose-imposee"
PLAFOND_USD = 0.50
TOURS_MAX = 4

LIGNE_POSE = (
    "Image 1 is a pose guide: redraw it as the character shown in Image 2, in exactly this pose "
    "and these proportions of limbs — same body position, same foot placement. Image 2 gives the "
    "identity: colours, outfit, face, drawing style. Single isolated sprite, plain background."
)

# **La ligne du tour 3** (2 septembre 2026). Le tour 1 a rendu la pose exacte mais
# des jambes d'adulte : la ligne ci-dessus **demandait** les proportions du guide
# (« and these proportions of limbs »). Le tour 2 a corrigé le guide, en le
# taillant à la carrure de Michel — ce qui n'est pas automatisable, un personnage
# à mesurer à la main chacun. Celle-ci corrige le **texte**, qui vaut pour tout
# personnage : le guide ne donne que les angles et la place des pieds, le corps
# vient de l'image du personnage.
LIGNE_ANGLES = (
    "Image 1 is a pose guide: a generic stick figure. Copy ONLY its pose from it — the angle of "
    "each limb, which foot is forward, which foot is on the ground. Ignore its body: its height, "
    "its build, the length of its limbs and the size of its head are NOT the character's. "
    "Image 2 is the character: keep its own body proportions, silhouette, colours, outfit and "
    "drawing style exactly as they are. Draw the character of Image 2 standing in the pose of "
    "Image 1. Single isolated sprite, plain background."
)

# Les quatre instants du demi-cycle, en phases du cycle complet de `squelette`.
POSES = (("contact", 0.0), ("appui", 0.125), ("passage", 0.25), ("envol", 0.375))
PHASES_BANDE = tuple((f"etape{i + 1}", i / 8) for i in range(8))

ECHECS = (
    "a dessiné le guide lui-même (une silhouette grise, un bâton)",
    "a gardé l'identité mais ignoré la pose (pose idle)",
    "a suivi la pose mais perdu l'identité (tenue, couleurs)",
    "a changé de caméra (trois quarts, face)",
    "a rendu plusieurs sujets",
    "n'est pas le même personnage",
)
ECHECS_TEMOIN = ("la taille du personnage change d'une case à l'autre", "les huit cases sont la même pose")

REGLE = (
    "Une exploration, pas un arbitrage : <b>on ne note pas bon / moyen / mauvais, on dit quel échec prévu s'est "
    "produit</b>. Les trois boutons se lisent <i>n'obéit pas / obéit à moitié / obéit</i>, et la case « n'est pas "
    "le même personnage » porte l'identité. <b>Arrêt</b> quand les quatre poses obéissent et sont le même "
    "personnage, ou quand deux tours de suite n'apprennent rien — écrit dans la conclusion de chaque tour. Si la "
    "bande de huit appels est jugée meilleure que le témoin, le quatrième chemin entre dans A0 comme chemin retenu."
)

REGLE_JS = """function(s, notes){
 var out=[], E='n\\'est pas le même personnage';
 Object.keys(GROUPES).forEach(function(cle){
  if(cle.indexOf('tour')!==0 && cle!=='bande') return;
  var g=GROUPES[cle], obeit=0, meme=0, n=0;
  g.jets.forEach(function(j){ var x=notes[cle+':'+j.jet]||{}; if(x.note){ n++; if(x.note==='bon') obeit++; if((x.echecs||[]).indexOf(E)<0) meme++; } });
  var tout = n===g.jets.length && obeit===n && meme===n;
  out.push('<span class="'+(n?(tout?'oui':'non'):'attente')+'">'+cle+' : '+obeit+' obéissent sur '+n+' notées, '+meme+' même personnage'+(tout?' — les quatre obéissent : arrêt, ça marche':'')+'</span>');
  var c=((notes._tours||{})[cle]||{}).conclusion; if(c){ out.push('<span class=attente>&nbsp;&nbsp;conclusion : '+c.replace(/</g,'&lt;')+'</span>'); }
 });
 return out;
}"""


# ── Les réglages d'un tour, et le correctif unique ───────────────────────────


def guide(phase: float, forme: str, sprite: bytes, cote: int = 512) -> bytes:
    """L'image de pose dans l'une des trois formes : silhouette, bâton, silhouette colorée."""
    if forme == "baton":
        return image_guide(phase, cote, pleine=False)
    if forme == "proportionnee":
        # Tour 2 (2 septembre 2026) : la silhouette aux proportions de Michel —
        # jambes courtes, grande capuche —, parce que le modèle avait allongé les
        # jambes du personnage pour suivre la silhouette d'adulte.
        return image_guide(phase, cote, pleine=True, proportions=MICHEL)
    octets = image_guide(phase, cote, pleine=True)
    if forme != "coloree":
        return octets
    # La silhouette teinte aux couleurs du sprite : la couleur médiane du sujet,
    # posée sur la masse — la géométrie ne bouge pas d'un pixel.
    rgba = detourer(DETOURAGE, sprite)
    sujet = rgba[rgba[:, :, 3] > 127][:, :3]
    teinte = tuple(int(v) for v in np.median(sujet, axis=0)) if len(sujet) else (120, 124, 132)
    with Image.open(io.BytesIO(octets)) as image:
        tableau = np.asarray(image.convert("RGB")).copy()
    masse = (np.abs(tableau.astype(int) - np.array(FOND_GUIDE)).sum(axis=2) > 60)
    tableau[masse] = teinte
    tampon = io.BytesIO()
    Image.fromarray(tableau, "RGB").save(tampon, format="PNG")
    return tampon.getvalue()


def reglages_du_tour(seance: Seance, args) -> tuple[int, dict]:
    """Le numéro du tour à faire, et ses réglages — un seul changement par tour.

    `--depuis tourN` repart d'un tour antérieur au lieu du dernier : quand un
    correctif se révèle sans issue (le tour 2 du 2 septembre 2026, un guide
    taillé à la carrure du personnage — non automatisable), on reprend la
    branche où elle était bonne. La branche est écrite dans le relevé, et le
    correctif reste unique **par rapport à ce tour-là**.
    """
    faits = sorted(int(k[4:]) for k in seance.releve if k.startswith("tour") and k[4:].isdigit())
    depuis = args.depuis or (f"tour{faits[-1]}" if faits else None)
    if args.depuis and args.depuis not in seance.releve:
        raise SystemExit(f"[x] {args.depuis} n'a pas ete tire : impossible d'en repartir")
    precedent = seance.releve.get(depuis, {}).get("_tour") if depuis else None
    defaut = {"forme": "silhouette", "ordre": "pose-puis-sprite", "texte": LIGNE_POSE}
    base = dict(precedent or defaut)
    voulu = {
        "forme": args.forme or base["forme"],
        "ordre": args.ordre or base["ordre"],
        "texte": args.texte or base["texte"],
        # Les poses du tour ne sont pas un correctif : deux par tour par choix de
        # l'auteur (2 septembre 2026), les plus différentes d'abord.
        "poses": poses_choisies(args.poses or base.get("poses") or "contact,appui,passage,envol"),
    }
    if precedent is not None:
        changes = [k for k in ("forme", "ordre", "texte") if voulu[k] != base[k]]
        if len(changes) > 1:
            raise SystemExit(f"[x] deux correctifs a la fois ({', '.join(changes)}) : un seul par tour")
        voulu["correctif"] = changes[0] if changes else "aucun"
        voulu["depuis"] = depuis
    else:
        voulu["correctif"] = "premier tour"
    numero = (faits[-1] + 1) if faits else 1
    return numero, voulu


def poses_choisies(noms: str) -> str:
    """Les noms de poses demandés, dans l'ordre du cycle, vérifiés contre POSES."""
    connus = [n for n, _ in POSES]
    voulus = [n.strip() for n in noms.split(",") if n.strip()]
    inconnus = [n for n in voulus if n not in connus]
    if inconnus or not voulus:
        raise SystemExit(f"[x] poses inconnues : {', '.join(inconnus) or 'aucune'} — connues : {', '.join(connus)}")
    return ",".join(n for n in connus if n in voulus)


def poses_du_tour(reglages: dict):
    noms = reglages.get("poses", "contact,appui,passage,envol").split(",")
    return tuple(p for p in POSES if p[0] in noms)


def texte_du_tour(texte_temoin: str, ligne: str) -> str:
    paragraphes = blocs(texte_temoin)
    queue = [l for p in paragraphes for l in p.split("\n") if l.startswith((MARQUEUR_FRAMING, MARQUEUR_CAMERA))]
    return "\n\n".join([paragraphes[0], ligne] + (["\n".join(queue)] if queue else []))


def variante_du_tour(cle: str, titre: str, reglages: dict, poses, depart, sprite_agrandi: bytes) -> list[Variante]:
    """Une variante **par pose** — chaque appel ne demande qu'une image, et le jet est la pose."""
    liste: list[Variante] = []
    for nom, phase in poses:
        pose = ImageJointe(1, EDITION, guide(phase, reglages["forme"], sprite_agrandi), f"guide {nom}")
        sprite = ImageJointe(2, REFERENCE_ROLE, sprite_agrandi, "sprite promu")
        images = (pose, sprite) if reglages["ordre"] == "pose-puis-sprite" else (
            ImageJointe(1, REFERENCE_ROLE, sprite_agrandi, "sprite promu"), ImageJointe(2, EDITION, pose.octets, f"guide {nom}"))
        liste.append(Variante(
            cle=cle, titre=titre, propos=f"{nom} — phase {phase:.3f} du cycle",
            texte=texte_du_tour(depart.texte, reglages["texte"]), images=images,
            echecs_prevus=ECHECS, proportions="1:1", negatif=depart.negatif, cases=1,
        ))
    return liste


# ── Le rapport, propre à l'exploration ──────────────────────────────────────


def _guide_rouge(octets: bytes) -> str:
    """Le guide en rouge sur transparent, pour la surimpression."""
    with Image.open(io.BytesIO(octets)) as image:
        tableau = np.asarray(image.convert("RGB")).astype(int)
    masse = np.abs(tableau - np.array(FOND_GUIDE)).sum(axis=2) > 60
    rouge = np.zeros((*masse.shape, 4), np.uint8)
    rouge[masse] = (220, 60, 50, 255)
    tampon = io.BytesIO()
    Image.fromarray(rouge, "RGBA").save(tampon, format="PNG", optimize=True)
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def _section_tour(seance: Seance, cle: str, tour: dict, poses, sprite: bytes) -> str:
    dossier = seance.dossier / cle
    releve = {k: v for k, v in seance.releve.get(cle, {}).items() if k.startswith("jet")}
    parts = [f"<h2 id={cle}>{html.escape(cle)} — {html.escape(tour.get('correctif', ''))}"
             f"<span class=prix style='font-weight:400;font-size:12px;color:var(--texte-3)'> · forme {html.escape(tour['forme'])} · "
             f"ordre {html.escape(tour['ordre'])}"
             + (f" · reparti de {html.escape(tour['depuis'])}" if tour.get("depuis") else "") + "</span></h2>"]
    parts.append(f"<div class=retenir><p><b>Ce que j'attends :</b> {html.escape(tour.get('attendu') or '—')}</p>"
                 f"<p><b>Ce qui peut rater :</b> {html.escape(tour.get('peut_rater') or '—')}</p>"
                 f"<p><b>La ligne envoyée :</b> <span class=mono style='font-size:11.5px'>{html.escape(tour['texte'])}</span></p></div>")
    parts.append("<p class=axe><label><input type=checkbox class=superposer data-tour='" + cle + "' checked> superposer le guide (en rouge)</label> "
                 "&nbsp; opacité <input type=range class=opacite data-tour='" + cle + "' min=0 max=100 value=45 style='vertical-align:middle'></p>")
    parts.append("<div class=grille style='grid-template-columns:repeat(auto-fill,minmax(300px,1fr))'>")
    parts.append("<div class=carte><div class=entete><span class=jet>le sprite promu — l'identité</span></div>"
                 f"<div class=vue><img alt='sprite' src='data:image/png;base64,{vignette(sprite, 256)}'></div></div>")
    poses = poses_du_tour(tour)
    for index, (nom, phase) in enumerate(poses, start=1):
        fichier = dossier / f"jet{index}.png"
        ident = f"{cle}:jet{index}"
        ligne = releve.get(f"jet{index}", {})
        guide_octets = guide(phase, tour["forme"], sprite)
        parts.append(f"<div class='carte tirage' data-id='{ident}'><div class=entete><span class=jet>{nom} · jet {index}</span></div>")
        if fichier.exists():
            resultat = fichier.read_bytes()
            with Image.open(io.BytesIO(resultat)) as im:
                l, h = im.size
            parts.append(f"<div class=vue style='position:relative'>"
                         f"<img alt='résultat' src='data:image/png;base64,{vignette(resultat, 1024)}'>"
                         f"<img class=calque-guide data-tour='{cle}' alt='guide' src='data:image/png;base64,{_guide_rouge(guide_octets)}' "
                         f"style='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.45;pointer-events:none'></div>")
            parts.append(f"<div class=pied><div class=ligne><span>rendu</span><b>{l}×{h}</b></div>"
                         f"<div class=ligne><span>prix</span><b>{ligne.get('cout_usd', 0):.4f} $</b></div></div>")
        elif ligne.get("echec"):
            parts.append(f"<div class='vue vide'>l'appel n'a pas abouti<br>{html.escape(str(ligne['echec']))}</div>")
        else:
            parts.append(f"<div class='vue vide'>pas encore tiré — le guide qui partirait :<br>"
                         f"<img alt=guide style='width:120px;height:120px' src='data:image/png;base64,{vignette(guide_octets, 120)}'></div>")
        parts.append("<div class=notation><div class=note>")
        for valeur, mot, touche in (("mauvais", "n'obéit pas", 1), ("moyen", "obéit à moitié", 2), ("bon", "obéit", 3)):
            parts.append(f"<button data-v={valeur} title='raccourci : {touche}'>{mot}</button>")
        parts.append("</div><div class=echecs>")
        for echec in ECHECS:
            parts.append(f"<label><input type=checkbox value='{html.escape(echec, quote=True)}'> {html.escape(echec)}</label>")
        parts.append("</div><input class=libre type=text placeholder='autre — une ligne' maxlength=200></div></div>")
    parts.append("</div>")
    parts.append(f"<p class=axe style='margin-top:12px'><b>Conclusion du tour — quel échec prévu s'est produit, ou lequel n'était pas prévu ?</b><br>"
                 f"<textarea class=conclusion data-tour='{cle}' rows=2 style='width:100%;background:var(--fond-1);color:var(--texte);"
                 f"border:1px solid var(--bord);border-radius:3px;padding:8px;font:inherit;font-size:12.5px'></textarea></p>")
    return "".join(parts)


def _bande(seance: Seance, sprite: bytes, temoin_images: list[str] | None) -> str:
    """Le cinquième tour : les huit poses assemblées en bande à fenêtre commune, animées à côté du témoin."""
    dossier = seance.dossier / "bande"
    fichiers = [dossier / f"jet{i}.png" for i in range(1, 9)]
    if not all(f.exists() for f in fichiers):
        return ""
    rgbas = [detourer(DETOURAGE, f.read_bytes()) for f in fichiers]
    boites = []
    for r in rgbas:
        b = boite_opaque(r[:, :, 3] > 127)
        boites.append(b if b else (0, 0, r.shape[1] - 1, r.shape[0] - 1))
    decalages, (x0, y0, x1, y1) = caler(boites)
    vues = []
    for f, (dx, dy) in zip(fichiers, decalages):
        with Image.open(io.BytesIO(f.read_bytes())) as im:
            toile = Image.new("RGB", (im.width + abs(dx) + 1, im.height + abs(dy) + 1), (235, 235, 235))
            toile.paste(im.convert("RGB"), (max(0, dx), max(0, dy)))
            vues.append(toile.crop((x0 + max(0, dx), y0 + max(0, dy), x1 + 1 + max(0, dx), y1 + 1 + max(0, dy))))
    images = []
    for c in carres(vues):
        t = io.BytesIO(); c.save(t, format="PNG", optimize=True)
        images.append(base64.b64encode(t.getvalue()).decode("ascii"))
    return ("<h2 id=bande>Le cinquième tour — la bande de huit appels, à côté du témoin</h2>"
            "<p class=axe>Huit appels, une pose chacun, sur les huit instants du cycle ; les huit images calées pieds sur la "
            "même ligne, dans une fenêtre commune (l'union des boîtes). À gauche la bande ; à droite, la meilleure planche du "
            "témoin — même échelle, même vitesse.</p><div class=grille style='grid-template-columns:repeat(2,minmax(0,300px))'>"
            f"<div class='carte tirage' data-id='bande:jet1'><div class=entete><span class=jet>la bande de huit appels</span></div>"
            f"<div class=vue style='height:auto;padding:12px'>{image_animee(images)}</div>"
            "<div class=notation><div class=note><button data-v=mauvais>pire que le témoin</button><button data-v=moyen>pareil</button>"
            "<button data-v=bon>meilleure que le témoin</button></div></div></div>"
            + (f"<div class=carte><div class=entete><span class=jet>le témoin — sa planche jet 1</span></div>"
               f"<div class=vue style='height:auto;padding:12px'>{image_animee(temoin_images)}</div></div>" if temoin_images else "")
            + "</div>")


SCRIPT_TOUR = """
[].forEach.call(document.querySelectorAll('.superposer'), function(c){ c.addEventListener('change', function(){
 [].forEach.call(document.querySelectorAll('.calque-guide[data-tour="'+c.getAttribute('data-tour')+'"]'), function(i){ i.style.display=c.checked?'':'none'; }); }); });
[].forEach.call(document.querySelectorAll('.opacite'), function(r){ r.addEventListener('input', function(){
 [].forEach.call(document.querySelectorAll('.calque-guide[data-tour="'+r.getAttribute('data-tour')+'"]'), function(i){ i.style.opacity=r.value/100; }); }); });
[].forEach.call(document.querySelectorAll('.conclusion'), function(t){
 var n=window.NOTES(); var c=((n._tours||{})[t.getAttribute('data-tour')]||{}).conclusion; if(c) t.value=c;
 t.addEventListener('input', function(){ var n=window.NOTES(); n._tours=n._tours||{}; n._tours[t.getAttribute('data-tour')]={conclusion:t.value}; window.SAUVER(); });
});
"""


async def principal() -> None:
    preparer_sortie()
    parseur = arguments(__doc__.split("\n")[0])
    parseur.add_argument("--forme", choices=("silhouette", "baton", "coloree", "proportionnee"), help="le correctif : la forme du guide")
    parseur.add_argument("--ordre", choices=("pose-puis-sprite", "sprite-puis-pose"), help="le correctif : l'ordre des images")
    parseur.add_argument("--texte", help="le correctif : la ligne de texte")
    parseur.add_argument("--angles", action="store_true",
                         help="le correctif : la ligne qui ne prend du guide que les angles (LIGNE_ANGLES)")
    parseur.add_argument("--depuis", help="repartir d'un tour anterieur (ex. tour1) plutot que du dernier")
    parseur.add_argument("--bande", action="store_true", help="le cinquième tour : huit appels, un par instant du cycle")
    parseur.add_argument("--poses", help="les poses du tour, parmi contact,appui,passage,envol (défaut : les quatre)")
    parseur.add_argument("--attendu", help="ce que j'attends (sinon demandé au terminal)")
    parseur.add_argument("--peut-rater", help="ce qui peut rater (sinon demandé au terminal)")
    args = parseur.parse_args()
    if args.angles:
        if args.texte:
            raise SystemExit("[x] --angles et --texte sont le meme correctif : un seul")
        args.texte = LIGNE_ANGLES
    seance = Seance(ESSAI, PLAFOND_USD)
    depart = rejouer()
    taille = taille_retenue()
    # **La taille du sprite ne change pas d'un tour à l'autre** : E2 peut conclure
    # entre deux tours (il l'a fait le 2 septembre 2026, 256 → 64 px), et un
    # tour ne change qu'une chose. Le premier tour fixe la taille pour les suivants.
    tours_faits = [k for k in seance.releve if k.startswith("tour") and k[4:].isdigit()]
    if tours_faits:
        premier = seance.releve[min(tours_faits, key=lambda k: int(k[4:]))].get("_tour", {})
        taille = int(premier.get("taille_px") or taille)
    sprite = next(i for i in depart.images if i.role == REFERENCE_ROLE).octets
    sprite_agrandi = agrandir(sprite, max(1, taille // 64)) if taille > 64 else sprite

    numero, reglages = reglages_du_tour(seance, args)
    cle = "bande" if args.bande else f"tour{numero}"
    poses = PHASES_BANDE if args.bande else poses_du_tour(reglages)
    if not args.bande and numero > TOURS_MAX and not args.rapport:
        print(f"[x] {TOURS_MAX} tours faits : le cahier n'en prevoit pas plus. --bande pour le cinquieme, ou --rapport.")
        return
    variantes = variante_du_tour(cle, f"Tour {numero}" if not args.bande else "La bande", reglages, poses, depart, sprite_agrandi)

    if args.a_sec:
        print(f"taille retenue par E2 : {taille} px · prochain tour : {cle} · reglages {json.dumps({k: v for k, v in reglages.items() if k != 'texte'}, ensure_ascii=False)}")
        print(f"poses du tour : {', '.join(n for n, _ in poses)}")
        print(f"ligne : {reglages['texte']}\n")
        # Une variante par pose : le socle en montre une, les autres ne changent que le guide.
        seance.a_sec(variantes[:1] + [], jets=(1,), prix_appel=estimer(1, 1))
        for v in variantes[1:]:
            print(f"    + {v.propos} : meme texte, meme sprite, guide different · 1 appel")
        print(f"\nappels du tour : {len(variantes)} · cout estime ${estimer(len(variantes), 1):.3f}")
        print("avant le tour reel, le script demande deux lignes : « ce que j'attends » et « ce qui peut rater », ecrites dans mesures.json")
    elif not args.rapport:
        attendu = args.attendu or input("Ce que j'attends de ce tour : ").strip()
        peut_rater = args.peut_rater or input("Ce qui peut rater (les echecs prevus, d'avance) : ").strip()
        if not attendu or not peut_rater:
            print("[x] les deux lignes sont obligatoires avant d'envoyer : c'est ce qui rend la boucle convergente")
            return
        seance.releve.setdefault(cle, {})["_tour"] = {**reglages, "attendu": attendu, "peut_rater": peut_rater, "taille_px": taille}
        seance.dossier.mkdir(parents=True, exist_ok=True)
        seance.mesures.write_text(json.dumps(seance.releve, indent=1, ensure_ascii=False), "utf-8")
        passerelle, catalogue = await seance.passerelle_reelle()
        modele = catalogue.get(MODELE_DEFAUT)
        if modele is None:
            print(f"[x] {MODELE_DEFAUT} absent du catalogue")
            return
        print(f"plafond de ce lancement ${PLAFOND_USD:.2f} · {cle}\n")
        await asyncio.gather(*(seance.tirer(v, passerelle, modele, jets=(i,)) for i, v in enumerate(variantes, start=1)))
        seance.bilan()

    # ── le rapport : un tour après l'autre, puis la bande ────────────────
    tours = sorted((k for k in seance.releve if k.startswith("tour")), key=lambda k: int(k[4:]))
    sections = []
    groupes_extra: dict = {}
    for t in tours:
        tour = seance.releve[t].get("_tour", reglages)
        sections.append(_section_tour(seance, t, tour, POSES, sprite_agrandi))
        n_poses = len(poses_du_tour(tour))
        groupes_extra[t] = {"titre": t, "cout": round(sum(float(v.get("cout_usd") or 0) for k, v in seance.releve[t].items() if k.startswith("jet")), 4),
                            "jets": [{"jet": f"jet{i}", "revenue": (seance.dossier / t / f"jet{i}.png").exists()} for i in range(1, n_poses + 1)]}
    if not tours:
        sections.append(_section_tour(seance, cle, reglages, POSES, sprite_agrandi))
        groupes_extra[cle] = {"titre": cle, "cout": 0.0, "jets": [{"jet": f"jet{i}", "revenue": False} for i in range(1, len(poses) + 1)]}
    temoin = temoin_du_disque(depart, echecs=ECHECS_TEMOIN)
    from socle_essais import animer as _animer
    temoin_images = _animer((temoin.dossier / "jet1.png").read_bytes()) if temoin.dossier and (temoin.dossier / "jet1.png").exists() else None
    bande_html = _bande(seance, sprite_agrandi, temoin_images)
    if bande_html:
        groupes_extra["bande"] = {"titre": "la bande", "cout": round(sum(float(v.get("cout_usd") or 0) for k, v in seance.releve.get("bande", {}).items() if k.startswith("jet")), 4),
                                  "jets": [{"jet": "jet1", "revenue": True}]}

    rapport(
        ESSAI,
        "E5 · La pose imposée par image — le quatrième chemin d'A0",
        [temoin],
        seance,
        question="Une seule pose par appel, l'image de posture en rôle édition — elle est la demande —, le sprite "
                 "promu en référence — l'identité. Le modèle habille-t-il une géométrie imposée ?",
        attendu="Pas un taux : une réponse à « est-ce que ça obéit, et à quoi ça ressemble quand ça obéit ». Une "
                "tentative à la fois, quatre poses par tour, ce qu'on attend et ce qui peut rater écrits avant l'envoi, "
                "et la conclusion « quel échec s'est produit » après. Le témoin est là pour l'échelle et la vitesse — "
                "et pour le cinquième tour, s'il a lieu.",
        regle=REGLE,
        regle_js=REGLE_JS,
        avant="".join(sections) + bande_html,
        script_extra=SCRIPT_TOUR,
        groupes_extra=groupes_extra,
        chapeau_extra=f"<p class=chapeau>Le sprite promu part en {taille} px — la taille du premier tour, gardée pour tous les tours.</p>",
    )


if __name__ == "__main__":
    asyncio.run(principal())
