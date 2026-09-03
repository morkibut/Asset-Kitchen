# -*- coding: utf-8 -*-
"""Le rapport unique des deux bancs d'animation — un seul fichier, tout dedans.

**Chaque planche payée y devient une animation qui tourne**, à côté de ce qui l'a
produite : le modèle, ce qui était testé, la consigne envoyée, les images jointes,
le prix, la durée, et les mesures.

**Les animations sont montées sur les cases brutes, sans détourage.** C'est le
point important. Le détourage abîme ce qu'on vient juger — il grignote un pied,
laisse des miettes blanches, coupe une barre de sol — et on finit par juger le
détourage au lieu de juger la marche. Ici la planche est seulement **coupée en
ses cases** (`essais/decoupe_brute.py`) ; les pixels sont ceux du modèle.

Les mesures affichées sous chaque animation, elles, se calculent bien sur les
silhouettes détourées — c'est la seule façon de mesurer une forme. **L'œil et le
chiffre ne regardent donc pas tout à fait la même chose**, et c'est écrit dans le
rapport pour qu'on ne s'y trompe pas : en cas de désaccord, l'œil gagne.

Chaque animation porte trois boutons — **mauvais, moyen, bon** — et le relevé se
copie ou se télécharge d'un clic.

    .venv\\Scripts\\python.exe essais/banc_complet.py
    .venv\\Scripts\\python.exe essais/rapport_tout.py
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

from banc_complet import SORTIE as TOUT  # noqa: E402
from banc_complet import images_de  # noqa: E402
from decoupe_brute import cases as cases_brutes  # noqa: E402
from juger_recette import SEUIL_FORME  # noqa: E402

SORTIE = RACINE / "rapport-animation.html"
NOTES = RACINE / "notes-auteur.json"
VERDICT = RACINE / "verdict.json"
MS, CIBLE, COULEURS = 100, 184, 32

# Les axes du banc de recette, dans l'ordre où ils se lisent. Le texte dit ce
# qu'on cherchait, pour qu'un tableau de chiffres six mois plus tard reste
# lisible sans avoir à relire le programme qui l'a produit.
AXES = [
    ("A", "Combien de cases sur la planche",
     "Huit cases sur une image de mille pixels, c'est un personnage de trois cents pixels "
     "de côté. À quatre cases il est deux fois plus grand — et un corps plus grand a "
     "peut-être plus de place pour se déformer."),
    ("B", "Comment la consigne est écrite",
     "Cinq façons de demander la même marche autrement, de l'énumération remplacée par un "
     "cycle continu jusqu'à l'interdiction explicite de dessiner des poses statiques. Tout "
     "le reste est identique."),
    ("C", "Ce qu'on joint comme images",
     "Le pari du banc. Les mots ne savent pas dire une chorégraphie ; une image, "
     "peut-être. On enlève le gabarit, on le numérote, on remplit sa première case, on "
     "joint un guide de cycle de marche dessiné par le programme."),
    ("D", "Les croisements de ce qui avait marché",
     "Ce qui avait bien marché sur un axe, combiné avec ce qui avait bien marché sur un "
     "autre."),
    ("E", "Le format de l'image",
     "Une bande large plutôt qu'un carré : quatre colonnes sur deux lignes, où le sujet "
     "est plus haut que dans une grille de trois sur trois."),
    ("F", "Ce que la première vague a obligé à vérifier",
     "En dépouillant les vingt-cinq premiers réglages, une erreur est apparue : la "
     "consigne que je croyais être celle du produit en omettait le dernier paragraphe. Ce "
     "paragraphe dit deux choses, et les deux comptent. Il demande « same proportions, "
     "same size » — une phrase qui interdit au corps de changer de forme, dans une demande "
     "de marche. Et il interdit de redessiner les traits du quadrillage, sans quoi la "
     "planche devient indécoupable. Ces trois réglages repartent du prompt complet."),
    ("G", "La case décisive, payée en dernier",
     "Trois tirages avaient laissé croire que retirer la clause de forme changeait tout. "
     "Huit de plus, ici, sur la seule combinaison qui serait à la fois animée et "
     "découpable — prompt complet, clause remplacée, guide joint. L'effet a disparu : "
     "c'était du hasard. Ces huit-là valent plus cher que les vingt-cinq premiers, parce "
     "qu'ils empêchent une conclusion fausse d'entrer dans le produit."),
    ("H", "L'arbitrage — les deux dernières pistes, et leur mort",
     "Les cent onze animations notées à la main n'avaient laissé que deux pistes vivantes : "
     "moins de cases sur la planche, et le remplacement de la clause de constance. Ces "
     "deux réglages les paient huit fois chacun, en partant du bloc complet du produit — "
     "ce qui manquait aux essais à quatre cases des vagues précédentes, dont les six "
     "planches étaient toutes indécoupables. Les seize d'ici le sont toutes, et c'était "
     "l'objet de la manœuvre. Le résultat est net et il ferme le sujet : zéro bonne "
     "planche sur seize. Le personnage est deux fois plus grand, parfaitement découpable, "
     "et il ne marche pas mieux. À lire dans leur propre page, où les quatre combinaisons "
     "sont mises en carré : essais/rapport-arbitrage.html."),
]

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
.page{max-width:1320px;margin:0 auto;padding:0 24px 90px}
h1{font-size:27px;margin:0 0 6px;letter-spacing:-.01em}
h2{font-size:18px;margin:52px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--bord);
 font-weight:600;scroll-margin-top:70px}
h3{font-size:14px;margin:0;font-weight:600}
.chapeau{color:var(--texte-2);margin:0 0 18px;max-width:82ch}

/* La barre de notation reste sous les yeux : on note en descendant la page, et
   remonter pour voir où on en est ferait perdre le fil. */
.barre{position:sticky;top:0;z-index:20;background:rgba(11,13,16,.94);
 backdrop-filter:blur(8px);border-bottom:1px solid var(--bord);
 margin:0 -24px 26px;padding:11px 24px;display:flex;align-items:center;gap:16px;
 flex-wrap:wrap;font-size:12.5px}
.barre .compte{color:var(--texte);font-weight:600}
.barre .part{color:var(--texte-3)}
.barre .part b{font-weight:600}
.b-bon{color:var(--ok)}.b-moyen{color:var(--epingle)}.b-mauvais{color:var(--echec)}
.barre label{color:var(--texte-2);display:flex;align-items:center;gap:6px;cursor:pointer}
.barre button{background:var(--fond-2);color:var(--texte-2);border:1px solid var(--bord);
 border-radius:3px;padding:5px 11px;font:inherit;font-size:12px;cursor:pointer}
.barre button:hover{border-color:var(--bord-fort);color:var(--texte)}
.pousse{margin-left:auto}

.sommaire{background:var(--fond-1);border:1px solid var(--bord);border-radius:3px;
 padding:14px 20px;margin:0 0 30px;font-size:13px;
 display:flex;flex-wrap:wrap;gap:4px 22px}
.sommaire a{color:var(--texte-2);text-decoration:none;white-space:nowrap;line-height:2}
.sommaire a:hover{color:var(--signal)}
.retenir{background:var(--fond-1);border:1px solid var(--bord);border-left:3px solid var(--signal);
 border-radius:3px;padding:18px 22px;margin:0 0 26px}
.retenir p{margin:0 0 11px}.retenir p:last-child{margin:0}
.retenir b{color:var(--texte)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
.tableau{overflow-x:auto}
th{text-align:right;color:var(--texte-3);font-weight:500;padding:7px 10px;
 border-bottom:1px solid var(--bord);white-space:nowrap;
 font-size:10.5px;text-transform:uppercase;letter-spacing:.08em}
th:first-child,td:first-child{text-align:left}
td{padding:9px 10px;border-bottom:1px solid var(--bord);text-align:right;white-space:nowrap}
tr:hover td{background:var(--fond-1)}
.vainqueur td{background:rgba(73,179,206,.06)}
.vainqueur td:first-child{box-shadow:inset 2px 0 0 var(--signal)}

.grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px;
 margin-top:14px}
.carte{background:var(--fond-2);border:1px solid var(--bord);border-radius:3px;overflow:hidden;
 display:flex;flex-direction:column;scroll-margin-top:86px}
.carte[data-note=bon]{border-color:rgba(95,168,113,.55)}
.carte[data-note=moyen]{border-color:rgba(200,160,60,.55)}
.carte[data-note=mauvais]{border-color:rgba(203,108,101,.5)}
.carte.vise{box-shadow:0 0 0 2px var(--signal)}
/* Toutes les vues à la même hauteur, quelle que soit la forme de la case. Une
   planche coupée en bandes larges et une autre en colonnes étroites donneraient
   sinon des cartes du simple au triple, et on ne pourrait plus les comparer
   d'un coup d'œil. */
.vue{background:var(--fond-3);display:flex;align-items:center;justify-content:center;
 height:296px;padding:0;overflow:hidden}
.vue img{image-rendering:pixelated;width:100%;height:100%;object-fit:contain;display:block}
.vue.vide{color:var(--texte-3);font-size:11px;text-align:center;padding:44px 12px;
 height:296px;flex-direction:column}
.pied{padding:8px 11px;border-top:1px solid var(--bord);font-size:11px}
.ligne{display:flex;justify-content:space-between;gap:8px;color:var(--texte-3);padding:1px 0}
.ligne b{color:var(--texte-2);font-weight:500}
.entete{display:flex;justify-content:space-between;align-items:center;gap:8px;
 padding:8px 11px;border-bottom:1px solid var(--bord);background:var(--fond-1)}
.jet{color:var(--texte-2);font-size:11px}
.pastille{font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;
 padding:2px 7px;border-radius:2px;white-space:nowrap}
.p-oui{background:rgba(95,168,113,.16);color:var(--ok)}
.p-coupe{background:rgba(200,160,60,.16);color:var(--epingle)}
.p-non{background:rgba(94,103,113,.16);color:var(--texte-3)}
.p-echec{background:rgba(203,108,101,.16);color:var(--echec)}

/* Les trois boutons de note, collés au bas de la carte : c'est le geste qu'on
   répète cent onze fois, il doit tomber sous le doigt sans viser. */
.note{display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid var(--bord)}
.note button{background:var(--fond-1);color:var(--texte-3);border:0;
 border-right:1px solid var(--bord);padding:9px 4px;font:inherit;font-size:11px;
 cursor:pointer;transition:background .12s,color .12s}
.note button:last-child{border-right:0}
.note button:hover{background:var(--fond-3);color:var(--texte-2)}
.note button.actif[data-v=bon]{background:rgba(95,168,113,.2);color:var(--ok);font-weight:600}
.note button.actif[data-v=moyen]{background:rgba(200,160,60,.2);color:var(--epingle);font-weight:600}
.note button.actif[data-v=mauvais]{background:rgba(203,108,101,.2);color:var(--echec);font-weight:600}
body.reste .carte[data-note]{display:none}

.legende{color:var(--texte-3);font-size:11.5px;margin-top:12px;max-width:96ch}
.legende code{color:var(--texte-2)}
.groupe{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.groupe .prix{color:var(--texte-3);font-size:12px;font-weight:400}
.couple{display:grid;grid-template-columns:minmax(0,268px) minmax(0,1fr);gap:16px;
 align-items:start;margin-top:14px}
@media(max-width:900px){.couple{grid-template-columns:1fr}}
.envoye{background:var(--fond-1);border:1px solid var(--bord);border-radius:3px;padding:12px}
.envoye .titre{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;
 color:var(--texte-3);margin-bottom:9px}
.vignettes{display:flex;gap:6px;flex-wrap:wrap}
.vignettes img{width:64px;height:64px;object-fit:contain;background:var(--fond-3);
 border:1px solid var(--bord);border-radius:2px;image-rendering:pixelated}
.consigne{margin-top:10px;font-size:11.5px;color:var(--texte-3);line-height:1.5;
 max-height:190px;overflow:auto;font-family:ui-monospace,Consolas,monospace}
.reglage{margin:26px 0 0;padding-top:20px;border-top:1px solid var(--bord)}
.reglage h3{font-size:14px;margin:0 0 2px}
.reglage .quoi{color:var(--texte-2);font-size:12.5px;margin:0}
.axe{color:var(--texte-2);margin:0 0 4px;max-width:80ch}
.mieux{color:var(--ok)}.pire{color:var(--texte-3)}
"""

SCRIPT = """
(function(){
 var CLE='notes-animation-v1', notes={}, dispo=true, vise=null;
 // Les notes déjà données sont cuites dans la page ; ce que le navigateur a
 // gardé passe par-dessus, pour qu'une correction faite ici ne soit pas effacée
 // à la prochaine version du rapport.
 for(var k in CUITES){ notes[k]=CUITES[k]; }
 // Le stockage du navigateur peut refuser — page ouverte depuis le disque, mode
 // privé. On garde alors les notes en mémoire pour la session, et le bouton
 // « copier » reste le vrai moyen de les sortir.
 try{ var gardees=JSON.parse(localStorage.getItem(CLE)||'{}')||{};
       for(var g in gardees){ notes[g]=gardees[g]; }
       localStorage.setItem(CLE+':essai','1'); localStorage.removeItem(CLE+':essai');
     }catch(e){ dispo=false; }
 function sauver(){ if(!dispo){ prevenir(); return; }
  try{ localStorage.setItem(CLE,JSON.stringify(notes)); }catch(e){ dispo=false; prevenir(); } }
 // **Si le navigateur refuse de mémoriser, il faut le dire tout de suite.** Une
 // page ouverte depuis le disque, ou en navigation privée, perd les notes en se
 // fermant : mieux vaut l'avertir à la première note que le découvrir à la
 // cent-onzième.
 function prevenir(){
  var z=document.getElementById('alerte'); if(!z || !z.hidden) return;
  z.hidden=false;
 }

 var cartes=[].slice.call(document.querySelectorAll('.carte[data-id]'));
 var total=cartes.length;

 function peindre(carte){
  var v=notes[carte.getAttribute('data-id')];
  if(v){ carte.setAttribute('data-note',v); } else { carte.removeAttribute('data-note'); }
  [].forEach.call(carte.querySelectorAll('.note button'),function(b){
   b.classList.toggle('actif', b.getAttribute('data-v')===v);
  });
 }
 function compter(){
  // **On compte les cartes de la page, jamais le tiroir.** Le tiroir est
  // partagé entre les rapports : une page qui n'en montre que trente-neuf y
  // trouverait les cent onze notes de l'autre, et annoncerait « 111 / 39 ». Le
  // relevé exporté, lui, reste entier — c'est lui qui retourne dans le fichier.
  var n={bon:0,moyen:0,mauvais:0}, faites=0;
  cartes.forEach(function(c){
   var v=notes[c.getAttribute('data-id')];
   if(n[v]!==undefined){ n[v]++; faites++; }
  });
  document.getElementById('compte').textContent=faites+' / '+total+' notées';
  document.getElementById('nb-bon').textContent=n.bon;
  document.getElementById('nb-moyen').textContent=n.moyen;
  document.getElementById('nb-mauvais').textContent=n.mauvais;
  document.getElementById('releve').value=JSON.stringify(notes,null,1);
 }
 function noter(carte,v){
  var id=carte.getAttribute('data-id');
  if(notes[id]===v){ delete notes[id]; } else { notes[id]=v; }
  sauver(); peindre(carte); compter();
 }

 cartes.forEach(function(c){
  peindre(c);
  c.addEventListener('click',function(e){
   var b=e.target; while(b && b!==c && b.tagName!=='BUTTON'){ b=b.parentNode; }
   if(b && b.tagName==='BUTTON'){ noter(c, b.getAttribute('data-v')); }
  });
  c.addEventListener('mouseenter',function(){ vise=c; c.classList.add('vise'); });
  c.addEventListener('mouseleave',function(){ if(vise===c){ vise=null; } c.classList.remove('vise'); });
 });

 // Au clavier : 1, 2, 3 notent la carte survolée. Cent onze animations à la
 // souris, c'est long ; sous le doigt, c'est trois fois plus rapide.
 document.addEventListener('keydown',function(e){
  if(!vise || e.metaKey || e.ctrlKey || e.altKey) return;
  var v={'1':'mauvais','2':'moyen','3':'bon'}[e.key];
  if(v){ e.preventDefault(); noter(vise,v); }
 });

 document.getElementById('filtre').addEventListener('change',function(e){
  document.body.classList.toggle('reste', e.target.checked);
 });
 document.getElementById('copier').addEventListener('click',function(){
  var t=document.getElementById('releve'), z=document.getElementById('zone-releve');
  var cache=z.hidden; z.hidden=false; t.select();
  var ok=false; try{ ok=document.execCommand('copy'); }catch(e){}
  if(navigator.clipboard){ navigator.clipboard.writeText(t.value).then(function(){},function(){}); ok=true; }
  if(ok && cache){ z.hidden=true; }
  var b=this; b.textContent = ok ? 'copié !' : 'sélectionne et copie ci-dessous';
  setTimeout(function(){ b.textContent='copier mon relevé'; },1800);
 });
 document.getElementById('telecharger').addEventListener('click',function(){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(notes,null,1)],{type:'application/json'}));
  a.download='notes-animation.json'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
 });
 document.getElementById('vider').addEventListener('click',function(){
  if(!confirm('Effacer toutes les notes ?')) return;
  notes={}; sauver(); cartes.forEach(peindre); compter();
 });
 document.getElementById('voir-releve').addEventListener('click',function(){
  var z=document.getElementById('zone-releve');
  z.hidden=!z.hidden; this.textContent = z.hidden ? 'voir le relevé' : 'cacher le relevé';
 });
 compter();
 if(!dispo) prevenir();
})();
"""


# ─────────────────────────────────────────────────────────────────────────────


def animer(chemin: str) -> str | None:
    """La planche en animation, **montée sur ses cases brutes**.

    Aucun détourage : la planche est coupée en ses cases, et ce sont les pixels
    d'origine qui défilent — fond, barre de sol et traits de quadrillage compris.
    C'est ce qu'il faut pour juger à l'œil, parce qu'un détourage qui grignote un
    pied fabrique un défaut d'animation qui n'existe pas.
    """
    vues = cases_brutes(Path(chemin).read_bytes())
    if len(vues) < 2:
        return None
    plats = []
    for v in vues:
        im = v.resize((max(1, round(v.width * CIBLE / v.height)), CIBLE), Image.LANCZOS)
        plats.append(im.convert("P", palette=Image.ADAPTIVE, colors=COULEURS))
    tampon = io.BytesIO()
    plats[0].save(
        tampon, format="GIF", save_all=True, append_images=plats[1:], duration=MS, loop=0
    )
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def vignette(octets: bytes, cote: int = 132) -> str:
    im = Image.open(io.BytesIO(octets)).convert("RGB")
    im.thumbnail((cote, cote), Image.LANCZOS)
    t = io.BytesIO()
    im.save(t, format="PNG", optimize=True)
    return base64.b64encode(t.getvalue()).decode("ascii")


def identifiant(p: dict) -> str:
    """Le nom d'une planche dans le relevé de notes — stable d'une version à l'autre.

    **Il ne doit jamais changer** : c'est la clé sous laquelle le navigateur garde
    la note, et la renommer effacerait tout le travail de notation.
    """
    tete = "m" if p["banc"] == "modeles" else "r"
    quoi = p["modele"] if p["banc"] == "modeles" else p["reglage"]
    return f"{tete}:{quoi}:{p['jet']}"


def pastille(p: dict) -> str:
    """L'état d'une planche en un mot — et il y en a quatre, pas deux.

    Une planche peut bien marcher **et** être inutilisable : c'est le cas quand
    le modèle a redessiné le quadrillage. Confondre les deux ferait croire que le
    réglage a échoué alors que c'est la découpe qui échoue.
    """
    if p.get("echec"):
        return '<span class="pastille p-echec">appel raté</span>'
    if p["utilisable"]:
        return '<span class="pastille p-oui">utilisable</span>'
    if p["anime"] and not p["decoupable"]:
        return '<span class="pastille p-coupe">bouge, indécoupable</span>'
    if not p["compte_ok"]:
        return '<span class="pastille p-echec">compte raté</span>'
    return '<span class="pastille p-non">figé</span>'


def carte(p: dict, avec_modele: bool, notes: dict[str, str]) -> str:
    gif = animer(p["fichier"]) if p.get("fichier") else None
    ident = identifiant(p) if gif else None
    note = notes.get(ident) if ident else None
    # **La note déjà donnée est écrite dans la page**, pas seulement gardée par
    # le navigateur : le rapport doit dire la même chose sur n'importe quelle
    # machine, sans quoi ses tableaux et ses cartes se contrediraient.
    ouverture = (
        f'<div class=carte data-id="{html.escape(ident)}"'
        + (f" data-note={note}" if note else "")
        + ">"
        if ident else "<div class=carte>"
    )
    parts = [ouverture]
    parts.append(
        f"<div class=entete><span class=jet>{html.escape(p['jet'])}</span>{pastille(p)}</div>"
    )
    if gif:
        # **Chargement différé, et ce n'est pas un détail de confort.** Cent onze
        # animations qui tournent toutes en même temps saturent le navigateur :
        # la page met une minute à peindre et le défilement saccade. Différées,
        # elles ne s'animent qu'en approchant de l'écran.
        parts.append(
            f"<div class=vue><img alt=animation loading=lazy decoding=async "
            f"src='data:image/gif;base64,{gif}'></div>"
        )
    elif p.get("echec"):
        parts.append(
            f"<div class='vue vide'>l'appel n'a pas abouti<br>{html.escape(p['echec'])}</div>"
        )
    else:
        parts.append("<div class='vue vide'>planche illisible</div>")

    lignes = []
    if avec_modele:
        lignes.append(("modèle", p["modele"].split("/")[-1]))
    if p.get("echec"):
        lignes += [("perdu à attendre", f"{p.get('secondes') or 0:.0f} s"), ("facturé", "rien")]
    else:
        lignes += [
            ("cases trouvées", f"{p.get('sujets', '—')} / {p['cases']}"),
            ("découpable", "oui" if p["decoupable"] else "non"),
            ("forme", f"{p.get('forme_pct', '—')} %"),
            ("jambes", f"{p.get('jambes_pct', '—')} %"),
            ("durée", f"{p['secondes']:.0f} s" if p.get("secondes") else "—"),
            ("prix", f"${p['cout_usd']:.4f}" if p.get("cout_usd") else "—"),
        ]
    parts.append("<div class=pied>")
    for nom, valeur in lignes:
        parts.append(f"<div class=ligne><span>{nom}</span><b>{html.escape(str(valeur))}</b></div>")
    parts.append("</div>")
    if ident:
        parts.append("<div class=note>")
        for valeur, mot, touche in (
            ("mauvais", "Mauvais", 1), ("moyen", "Moyen", 2), ("bon", "Bon", 3)
        ):
            vif = " class=actif" if note == valeur else ""
            parts.append(
                f"<button data-v={valeur}{vif} title='raccourci : {touche}'>{mot}</button>"
            )
        parts.append("</div>")
    parts.append("</div>")
    return "".join(parts)


def tableau_verdict(lignes: list[dict], colonne: str, gagnant: str | None = None) -> str:
    """Le classement **sur les notes de l'auteur** — le seul qui décide désormais.

    Deux colonnes ne viennent pas des notes et restent vraies : *revenues*, parce
    qu'un appel qui échoue coûte du temps sans rien donner à juger, et
    *découpables*, parce que l'animation est montrée brute et que l'œil ne peut
    pas voir qu'une planche résistera au détourage de l'atelier.
    """
    parts = [
        f"<div class=tableau><table><thead><tr><th>{colonne}</th><th>Essais</th>"
        "<th>Revenues</th><th>Découpables</th><th>Bonnes</th><th>Moyennes</th>"
        "<th>Mauvaises</th><th>% bonnes</th><th>% gardables</th><th>Note moyenne</th>"
        "<th>Total payé</th><th>$ par bonne</th><th>$ par gardable</th>"
        "</tr></thead><tbody>"
    ]
    for g in sorted(lignes, key=lambda g: (-g["taux_bon_pct"], -g["taux_tenable_pct"])):
        cl = " class=vainqueur" if g["nom"] == gagnant else ""
        cb = f"${g['cout_par_bon']:.3f}" if g["cout_par_bon"] else "—"
        ct = f"${g['cout_par_tenable']:.3f}" if g["cout_par_tenable"] else "—"
        sc = f"{g['score']:.2f}" if g["score"] is not None else "—"
        parts.append(
            f"<tr{cl}><td class=mono>{html.escape(g['nom'])}</td><td>{g['essais']}</td>"
            f"<td>{g['revenues']}</td><td>{g['decoupables']}</td>"
            f"<td class=b-bon><b>{g['n_bon']}</b></td>"
            f"<td class=b-moyen>{g['n_moyen']}</td>"
            f"<td class=b-mauvais>{g['n_mauvais']}</td>"
            f"<td><b>{g['taux_bon_pct']} %</b></td><td>{g['taux_tenable_pct']} %</td>"
            f"<td>{sc}</td><td>${g['cout_total']:.3f}</td><td><b>{cb}</b></td>"
            f"<td>{ct}</td></tr>"
        )
    parts.append("</tbody></table></div>")
    return "".join(parts)


# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    tout = json.loads(TOUT.read_text("utf-8"))
    # **Les notes de l'auteur sont la source qui décide.** Elles sont cuites dans
    # la page pour que ses tableaux disent la même chose sur n'importe quelle
    # machine, et le navigateur ne fait plus que les laisser modifier.
    notes = json.loads(NOTES.read_text("utf-8")) if NOTES.exists() else {}
    verdict = json.loads(VERDICT.read_text("utf-8")) if VERDICT.exists() else None
    planches = tout["planches"]
    paye = sum(p.get("cout_usd") or 0.0 for p in planches)
    # **Le nombre d'animations à noter se compte sur les cartes produites**, pas
    # sur les fichiers présents : une planche peut être là et refuser de se
    # découper. Le chiffre est donc posé en dernier, quand les cartes existent.

    # **Aucun compte n'est écrit à la main dans cette page.** Une vague de plus
    # payée sur le banc, et « les 71 planches du banc 2 » devient un mensonge que
    # personne ne relit — c'est arrivé, et ça se répare une seule fois.
    n_modeles = sum(1 for p in planches if p["banc"] == "modeles")
    n_recette = sum(1 for p in planches if p["banc"] == "recette")
    n_reglages = len({p["reglage"] for p in planches if p["banc"] == "recette"})
    n_notees = sum(1 for p in planches if notes.get(identifiant(p)))

    parts: list[str] = []
    parts.append(
        "<!doctype html><html lang=fr><meta charset=utf-8>"
        "<meta name=viewport content='width=device-width,initial-scale=1'>"
        "<title>Les bancs d'animation — Asset Kitchen</title>"
        f"<style>{STYLE}</style><body><div class=page>"
    )

    # ── La barre de notation, collante ───────────────────────────────────────
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

    parts.append("<h1>Faire marcher un personnage : tout ce qui a été essayé</h1>")
    parts.append(
        f"<p class=chapeau>Deux bancs d'essai du 1<sup>er</sup> septembre 2026, réunis ici et "
        f"<b>jugés une seule fois, de la même façon</b>. Le premier compare <b>huit modèles à "
        f"demande identique</b> ; le second compare <b>{n_reglages} demandes au même modèle</b>. "
        f"{len(planches)} planches, ${paye:.2f} dépensés, <b>@NOTABLES@ animations</b>, "
        f"dont <b>@RESTE@ qui attendent encore une note</b>.</p>"
    )
    parts.append(
        "<p class=chapeau><b>Les animations sont montées sur les cases brutes, sans "
        "détourage.</b> La planche est seulement coupée en ses cases ; les pixels sont ceux que "
        "le modèle a dessinés — fond, barre de sol et traits de quadrillage compris. Les "
        "chiffres affichés sous chaque animation, eux, se calculent sur les silhouettes "
        "détourées : c'est la seule façon de mesurer une forme. <b>L'œil et le chiffre ne "
        "regardent donc pas tout à fait la même chose, et en cas de désaccord c'est l'œil qui a "
        "raison</b> — c'est bien pour ça qu'il y a des boutons.</p>"
    )

    parts.append("<div class=sommaire>")
    for ancre, titre in (
        ("verdict", "Verdict — les modèles"),
        ("verdict-consignes", "Verdict — les consignes"),
        ("verdict-reglages", f"Verdict — les {n_reglages} réglages"),
        ("accord", "Pourquoi ma mesure ne vaut rien"),
        ("juger", "Ce que la mesure comptait"),
        ("planches-modeles", f"Les {n_modeles} planches du banc 1"),
        ("planches-recette", f"Les {n_recette} planches du banc 2"),
    ):
        parts.append(f"<a href='#{ancre}'>{html.escape(titre)}</a>")
    parts.append("</div>")

    # ── Ce qu'il faut retenir, et c'est le verdict de l'auteur ───────────────
    croise = verdict["accord"]["croise"]
    par_note = verdict["accord"]["forme_moyenne_par_note"]

    m_gagnant = max(verdict["modeles"], key=lambda g: (g["taux_bon_pct"], -(g["cout_par_bon"] or 9e9)))
    # **Le dauphin, jamais le gagnant lui-même.** Tant que le modèle en place était
    # deuxième en régularité, la phrase se lisait ; le jour où il prend les deux
    # places, elle se compare à elle-même — « X est le plus régulier, contre X ».
    # C'est arrivé, et on ne l'écrit pas deux fois.
    m_sur = max((g for g in verdict["modeles"] if g["nom"] != m_gagnant["nom"]),
                key=lambda g: (g["taux_tenable_pct"], g["score"] or 0))
    produit = next(g for g in verdict["natures"] if "produit" in g["nom"])
    essai = next(g for g in verdict["natures"] if "essai" in g["nom"])
    reecrite = next(g for g in verdict["natures"] if "réécrite" in g["nom"])

    ret_bon = croise["utilisable"]["bon"]
    ret_total = sum(croise["utilisable"].values())
    rej_bon = croise["rejetee"]["bon"]
    rej_total = sum(croise["rejetee"].values())

    parts.append("<div class=retenir>")
    parts.append(
        f"<p><b>Ma mesure automatique ne prédisait rien, et c'est le premier résultat de "
        f"cette page.</b> Sur les {ret_total} planches qu'elle déclarait utilisables, "
        f"l'auteur en a trouvé <b>{ret_bon} bonnes</b> ; sur les {rej_total} qu'elle "
        f"rejetait, <b>{rej_bon}</b>. Le taux de bonnes est le même des deux côtés — "
        f"{round(ret_bon / max(1, ret_total) * 100)} % contre "
        f"{round(rej_bon / max(1, rej_total) * 100)} %. Pire, la « forme » va à l'envers : "
        f"{par_note['bon']} % en moyenne sur les bonnes, {par_note['mauvais']} % sur les "
        f"mauvaises. <b>Tous les classements que j'avais publiés reposaient dessus ; ils "
        f"sont refaits ici sur les notes.</b></p>"
    )
    parts.append(
        f"<p><b>Le meilleur modèle est {html.escape(m_gagnant['nom'])}</b> — celui que le "
        f"produit utilise déjà : {m_gagnant['n_bon']} planches bonnes sur "
        f"{m_gagnant['essais']}, à ${m_gagnant['cout_par_bon']:.3f} la bonne. "
        f"Il est aussi le plus régulier : {m_gagnant['taux_tenable_pct']} % de planches "
        f"gardables. Son seul rival est "
        f"<span class=mono>{html.escape(m_sur['nom'])}</span>, qui en garde autant — "
        f"{m_sur['taux_tenable_pct']} % — mais n'en signe que {m_sur['n_bon']} vraiment "
        f"bonne, et elle lui revient à ${m_sur['cout_par_bon']:.3f}.</p>"
    )
    parts.append(
        f"<p><b>La consigne du produit gagne nettement</b> : {produit['taux_bon_pct']} % de "
        f"planches bonnes sur {produit['essais']} tirages, contre "
        f"{essai['taux_bon_pct']} % pour ma consigne d'essai plus détaillée "
        f"({essai['essais']} tirages) et <b>{reecrite['taux_bon_pct']} %</b> pour les cinq "
        f"réécritures de fond ({reecrite['essais']} tirages). Il n'y a rien à réécrire.</p>"
    )

    # **Les deux pistes qui restaient sont mortes, et ça se compte au lieu de
    # s'affirmer.** Les chiffres sont recalculés ici à partir des planches
    # notées, pour qu'un tirage ajouté demain les corrige tout seul plutôt que
    # de les périmer — c'est précisément ce qui vient d'arriver à la phrase que
    # ce paragraphe remplace, laquelle annonçait « la seule piste encore
    # vivante » sur six tirages.
    notees = [p for p in planches if notes.get(identifiant(p))]

    def compte(sous: list[dict]) -> tuple[int, int]:
        return sum(1 for p in sous if notes[identifiant(p)] == "bon"), len(sous)

    par_reg = {g["nom"]: g for g in verdict["reglages"]}
    h = [par_reg[n] for n in ("H-4-produit", "H-4-sans-proportions") if n in par_reg]
    h_n = sum(g["essais"] for g in h)
    h_bon = sum(g["n_bon"] for g in h)
    h_moyen = sum(g["n_moyen"] for g in h)
    clause = par_reg.get("F-sans-proportions")
    temoin = next((g for g in verdict["modeles"] if g["nom"] == "openai/gpt-image-2"), None)
    if h_n and clause and temoin:
        parts.append(
            f"<p><b>Les deux dernières pistes ont été payées, et elles sont mortes.</b> "
            f"Huit tirages chacune, avec le bloc complet du produit : à <b>quatre cases</b>, "
            f"<b>{h_bon} planche bonne sur {h_n}</b> — et {h_moyen} moyenne. Le personnage "
            f"est bien deux fois plus grand et parfaitement découpable, mais il ne marche "
            f"pas mieux pour autant. La <b>clause de constance remplacée</b>, portée à "
            f"{clause['essais']} tirages, donne {clause['taux_bon_pct']} % de bonnes contre "
            f"{temoin['taux_bon_pct']} % au prompt du produit tel qu'il est : elle ne le "
            f"bat pas non plus. <b>La façon de demander est épuisée comme levier</b>, et "
            f"c'est une réponse — elle renvoie au mannequin articulé, qui impose la "
            f"géométrie au lieu de l'espérer.</p>"
        )
    peu_b, peu_n = compte([p for p in notees if p["cases"] <= 4])
    huit_b, huit_n = compte([p for p in notees if p["cases"] >= 8])
    parts.append(
        f"<p><b>Le compte, toutes vagues confondues.</b> À quatre cases ou moins, "
        f"<b>{peu_b} planches sur {peu_n}</b> sont bonnes ; à huit, {huit_b} sur "
        f"{huit_n}. L'écart qui avait fait espérer — deux bonnes sur six — venait de "
        f"<span class=mono>D-4-guide</span>, seul réglage à quatre cases à en signer, et "
        f"ses deux planches ne sont <b>pas découpables</b> : elles employaient une consigne "
        f"privée du paragraphe protecteur. Personne ne sait ce qui les rendait bonnes, et "
        f"le produit ne saurait pas les livrer.</p>"
    )
    # **Une note relue n'est pas une note nouvelle, et ça se dit.** Cinq planches
    # du témoin ont changé de note en seconde passe, toutes vers le haut ; le
    # taux du modèle en place a doublé sans qu'une seule image change. C'est la
    # limite du juge unique, et elle est ici mesurée plutôt que redoutée.
    parts.append("</div>")

    # ── Le verdict, groupe par groupe ────────────────────────────────────────
    parts.append("<h2 id=verdict>Le verdict de l'auteur — les modèles</h2>")
    parts.append(
        f"<p class=axe>{n_notees} animations regardées une par une et notées "
        "<b>mauvais</b>, <b>moyen</b> ou <b>bon</b>. <i>Gardable</i> veut dire bonne ou "
        "moyenne : ce qu'on garderait, quitte à le retoucher. <i>Revenues</i> et "
        "<i>découpables</i> ne viennent pas des notes : un appel qui échoue ne rend rien à "
        "juger, et l'œil ne peut pas voir qu'une planche résistera au découpage de "
        "l'atelier, puisqu'elle lui est montrée brute.</p>"
    )
    parts.append(tableau_verdict(verdict["modeles"], "Modèle", m_gagnant["nom"]))

    parts.append("<h2 id=verdict-consignes>Le verdict de l'auteur — la nature de la consigne</h2>")
    parts.append(
        "<p class=axe>Les deux bancs confondus, mais <b>seul "
        "<span class=mono>gpt-image-2</span></b> : il est le seul modèle présent des deux "
        "côtés, et mélanger les modèles mesurerait leur écart au lieu de celui des "
        "consignes.</p>"
    )
    parts.append(tableau_verdict(verdict["natures"], "Nature de la consigne", produit["nom"]))

    parts.append(f"<h2 id=verdict-reglages>Le verdict de l'auteur — les {n_reglages} réglages</h2>")
    parts.append(
        "<p class=axe>Deux tirages par réglage ne prouvent rien — ce banc l'a démontré "
        "plusieurs fois. Ce tableau <b>désigne des pistes</b> ; seuls les réglages à sept ou "
        "huit tirages permettent de conclure.</p>"
    )
    parts.append(tableau_verdict(verdict["reglages"], "Réglage"))

    # ── L'écart entre la mesure et l'œil ─────────────────────────────────────
    parts.append("<h2 id=accord>Pourquoi ma mesure automatique ne vaut rien</h2>")
    parts.append(
        "<p class=axe>Toute la conduite de ces bancs a reposé sur une mesure : <b>la "
        "forme</b>, l'écart du rapport hauteur/largeur du personnage d'une case à l'autre. "
        "L'idée était qu'un corps qui marche se déforme, et qu'un sprite recopié ne se "
        "déforme pas. Voici ce que ça donne face à un œil.</p>"
    )
    parts.append(
        "<div class=tableau><table><thead><tr><th>Ce que ma mesure disait</th>"
        "<th>Bonnes</th><th>Moyennes</th><th>Mauvaises</th><th>Part de bonnes</th>"
        "</tr></thead><tbody>"
    )
    for etat, mot in (("utilisable", "utilisable"), ("rejetee", "à rejeter")):
        l = croise[etat]
        n = sum(l.values())
        parts.append(
            f"<tr><td>{mot}</td><td class=b-bon><b>{l['bon']}</b></td>"
            f"<td class=b-moyen>{l['moyen']}</td><td class=b-mauvais>{l['mauvais']}</td>"
            f"<td><b>{round(l['bon'] / max(1, n) * 100)} %</b></td></tr>"
        )
    parts.append("</tbody></table></div>")
    parts.append(
        f"<p class=legende>Même part de bonnes des deux côtés : la mesure n'apporte aucune "
        f"information. Et la forme elle-même va dans le mauvais sens — "
        f"<b>{par_note['bon']} %</b> en moyenne sur les planches jugées bonnes, "
        f"<b>{par_note['moyen']} %</b> sur les moyennes, <b>{par_note['mauvais']} %</b> sur "
        f"les mauvaises. L'explication tient en une phrase : une forme qui varie beaucoup "
        f"signale aussi bien <i>un corps qui marche</i> qu'<i>un modèle qui dessine des "
        f"sprites de tailles différentes</i>, et le second cas est bien plus fréquent que le "
        f"premier. La mesure confondait le mouvement avec l'incohérence.</p>"
    )

    # ── Comment on juge ──────────────────────────────────────────────────────
    parts.append("<h2 id=juger>Comment une planche est jugée</h2>")
    parts.append(
        "<p class=axe>Trois conditions, et il les faut <b>toutes les trois</b> pour qu'une "
        "planche serve à quelque chose.</p>"
        "<p class=axe><b>1 · Le compte.</b> La planche porte au moins le nombre de cases "
        "demandé. En dessous, il manque des étapes ; au-dessus, on en écarte une à la main.</p>"
        "<p class=axe><b>2 · Découpable.</b> Certains modèles <b>redessinent les traits du "
        "quadrillage</b> du gabarit qu'on leur envoie. Le détourage de l'atelier inonde depuis "
        "le bord de l'image : il bute sur ces traits, et chaque case ressort en carré opaque. "
        "Ça ne se voit pas dans les animations ci-dessous, qui sont brutes — d'où la ligne "
        "<i>découpable</i> sous chacune.</p>"
        f"<p class=axe><b>3 · Animée.</b> C'est la mesure qui décide, et elle s'appelle <b>la "
        f"forme</b> : de combien le rapport hauteur/largeur du personnage change d'une case à "
        f"l'autre. Elle sépare deux choses opposées. Si le modèle a dessiné le même sprite en "
        f"plus petit, hauteur et largeur bougent ensemble et la forme reste — ça se rattrape "
        f"sans un centime, c'est du recalage. Si le corps se tasse et se détend, la forme "
        f"change — et ça, ça ne se fabrique jamais après coup. Le seuil est "
        f"<b>{SEUIL_FORME} %</b>.</p>"
    )

    # ── Banc 1 ───────────────────────────────────────────────────────────────
    parts.append("<h2 id=modeles>Banc 1 — quel modèle sait dessiner une marche</h2>")
    parts.append(
        f"<p class=axe>Un seul geste rejoué {n_modeles} fois : <b>le prompt du produit et ses "
        "trois images sont relus dans une vraie génération</b>, jamais recomposés. Chaque "
        "modèle a reçu exactement la même chose, ce qui rend les huit colonnes comparables. Le "
        f"classement de ces {n_modeles} planches est plus haut, <a href='#verdict'>dans le "
        "verdict</a> : il n'est pas répété ici, parce qu'il n'y a qu'un seul classement qui "
        "vaille et qu'en afficher deux inviterait à choisir le plus flatteur.</p>"
    )

    parts.append(f"<h2 id=planches-modeles>Les {n_modeles} planches du banc 1</h2>")
    jointes = images_de({"banc": "modeles"})
    texte = next(p["texte"] for p in planches if p["banc"] == "modeles")
    parts.append("<div class=envoye style='margin-top:14px'>")
    parts.append("<div class=titre>ce que les huit modèles ont reçu, à l'identique</div>")
    parts.append("<div class=vignettes>")
    for octets in jointes:
        parts.append(f"<img alt='image jointe' src='data:image/png;base64,{vignette(octets)}'>")
    parts.append("</div>")
    parts.append(f"<div class=consigne>{html.escape(texte)}</div></div>")

    # **Les modèles sont rangés par la note de l'auteur, pas par ma mesure**, et
    # leur bandeau annonce le même chiffre que le verdict. Deux ordres différents
    # dans une même page se liraient comme deux avis, alors qu'il n'y en a qu'un.
    par_modele = {g["nom"]: g for g in verdict["modeles"]}
    modeles_tries = [g["nom"] for g in sorted(
        verdict["modeles"],
        key=lambda g: (-g["taux_bon_pct"], -g["taux_tenable_pct"], g["cout_par_bon"] or 9e9))]
    for modele in modeles_tries:
        g = par_modele[modele]
        siens = sorted(
            (p for p in planches if p["banc"] == "modeles" and p["modele"] == modele),
            key=lambda p: p["jet"],
        )
        cpu = (f"${g['cout_par_bon']:.3f} la bonne"
               if g["cout_par_bon"] else "aucune bonne planche")
        # Le pluriel s'accorde : « 1 bonnes » dans un bandeau de titre se lit
        # comme une faute de calcul avant de se lire comme une faute de français.
        def _s(n: int, mot: str) -> str:
            return f"{n} {mot}{'s' if n > 1 else ''}"

        parts.append(
            f"<h2 style='margin-top:38px'><span class=groupe>{html.escape(modele)} "
            f"<span class=prix>{cpu} · {_s(g['n_bon'], 'bonne')} et "
            f"{_s(g['n_moyen'], 'moyenne')} sur {g['essais']} · "
            f"${g['cout_total']:.3f} dépensés</span></span></h2>"
        )
        parts.append("<div class=grille>")
        parts.extend(carte(p, avec_modele=False, notes=notes) for p in siens)
        parts.append("</div>")

    # ── Banc 2 ───────────────────────────────────────────────────────────────
    parts.append(f"<h2 id=reglages>Banc 2 — les {n_reglages} réglages, un par un</h2>")
    parts.append(
        "<p class=axe>Même modèle du début à la fin — <span class=mono>openai/gpt-image-2</span>, "
        "celui que le produit utilise déjà, et le seul présent des deux côtés. <b>Deux tirages "
        "par réglage ne prouvent rien</b>, et ce banc le démontre lui-même : deux tirages d'une "
        "même demande ont reçu <i>bon</i> et <i>mauvais</i>. Les réglages qu'il fallait "
        "départager ont donc reçu jusqu'à huit tirages ; les autres sont là pour dire ce qui a "
        "été essayé, pas pour trancher. Leur classement est <a href='#verdict-reglages'>dans le "
        "verdict</a> ; ici on montre ce qui a été envoyé et ce qui est revenu.</p>"
    )

    parts.append(f"<h2 id=planches-recette>Les {n_recette} planches du banc 2</h2>")
    par_reglage = {g["nom"]: g for g in verdict["reglages"]}
    for lettre, titre, propos in AXES:
        noms = sorted(
            (n for n in par_reglage if n.startswith(lettre + "-")),
            key=lambda n: (-par_reglage[n]["taux_bon_pct"], -par_reglage[n]["taux_tenable_pct"]),
        )
        if not noms:
            continue
        parts.append(f"<h2 style='margin-top:44px'>{lettre} · {html.escape(titre)}</h2>")
        parts.append(f"<p class=axe>{html.escape(propos)}</p>")
        for nom in noms:
            g = par_reglage[nom]
            siens = sorted(
                (p for p in planches if p["banc"] == "recette" and p["reglage"] == nom),
                key=lambda p: p["jet"],
            )
            # **Mieux ou pire que quoi ?** Que le prompt du produit tel qu'il est
            # aujourd'hui — c'est la seule comparaison qui intéresse, puisqu'un
            # réglage ne se retient que s'il vaut mieux que ce qui tourne déjà.
            marque = "mieux" if g["taux_bon_pct"] > produit["taux_bon_pct"] else "pire"
            parts.append("<div class=reglage>")
            parts.append(
                f"<h3 class=mono>{html.escape(nom)} "
                f"<span class='{marque}' style='font-weight:400'>· {g['n_bon']} bonne(s) et "
                f"{g['n_moyen']} moyenne(s) sur {g['essais']}"
                f"</span></h3><p class=quoi>{html.escape(siens[0]['quoi'])}</p>"
            )
            parts.append("<div class=couple>")
            parts.append("<div class=envoye><div class=titre>ce qui a été envoyé</div>")
            parts.append("<div class=vignettes>")
            for octets in images_de(siens[0]):
                parts.append(
                    f"<img alt='image jointe' src='data:image/png;base64,{vignette(octets)}'>"
                )
            parts.append("</div>")
            parts.append(f"<div class=consigne>{html.escape(siens[0]['texte'])}</div></div>")
            parts.append("<div><div class=grille style='margin-top:0'>")
            parts.extend(carte(p, avec_modele=False, notes=notes) for p in siens)
            parts.append("</div></div></div></div>")

    parts.append(
        "<p class=legende style='margin-top:44px'>Toutes les animations sont montées de la même "
        "façon : la planche est coupée en ses cases — les lignes de coupe sont trouvées sur les "
        "sujets eux-mêmes, à mi-chemin entre deux voisins, parce que ni la grille demandée ni le "
        "gabarit envoyé ne sont respectés par les modèles — et chaque case est rendue <b>telle "
        "quelle</b>, calée en bas pour que la ligne de sol ne saute pas. La consigne montrée à "
        "gauche de chaque réglage est le troisième bloc du prompt ; les deux premiers — la bible "
        "du jeu et le signalement du personnage — sont identiques partout. Les programmes sont "
        "dans <code>essais/</code> : <code>decoupe_brute.py</code> coupe, "
        "<code>banc_complet.py</code> mesure, <code>rapport_tout.py</code> dessine cette page.</p>"
    )
    cuites = json.dumps(notes, ensure_ascii=False)
    parts.append(f"</div><script>var CUITES={cuites};{SCRIPT}</script></body></html>")

    page = "".join(parts)
    # **Notable et non notée sont deux comptes, et les confondre s'est vu.** Une
    # carte est notable quand la planche a pu se découper ; elle reste à noter
    # tant que l'auteur ne l'a pas regardée. Tant que tout était noté les deux
    # chiffres coïncidaient, et le second se lisait à la place du premier.
    notables = page.count("<div class=carte data-id=")
    reste = notables - sum(1 for p in planches if notes.get(identifiant(p)))
    page = page.replace("@NOTABLES@", str(notables)).replace("@RESTE@", str(reste))
    SORTIE.write_text(page, encoding="utf-8")
    poids = SORTIE.stat().st_size / 1_048_576
    print(f"-> {SORTIE}  ({poids:.1f} Mo, {len(planches)} planches, "
          f"{notables} notables dont {reste} a noter, ${paye:.2f})")


if __name__ == "__main__":
    main()
