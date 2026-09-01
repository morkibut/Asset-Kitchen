# -*- coding: utf-8 -*-
"""Juger l'essai de recette — **quel réglage bouge, et lequel se contente de poser.**

Le banc précédent comparait des modèles à demande identique. Celui-ci compare des
demandes à modèle identique, ce qui change deux choses dans le jugement :

1. **Le compte attendu n'est plus toujours huit.** Certains réglages demandent
   quatre ou six cases ; une planche à quatre sujets y est parfaite, alors
   qu'elle serait un ratage ailleurs. Le compte se lit dans le réglage.
2. **Deux tirages seulement par réglage.** Un taux de réussite sur deux vaut
   0 %, 50 % ou 100 % — trop grossier pour classer vingt-cinq réglages. C'est
   donc **la forme**, mesure continue, qui classe, et le compte qui disqualifie.

La forme reste ce qu'elle était : de combien le rapport hauteur/largeur du
personnage change d'une case à l'autre. Constante, le modèle a redessiné le même
sprite ; variable, le corps se déforme — et se déformer, c'est marcher.

    .venv\\Scripts\\python.exe essais/juger_recette.py
"""

from __future__ import annotations

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

BANC = RACINE / "resultats_recette"
SEUIL_FORME = 8.0

# La référence à battre : les huit tirages de `gpt-image-2` du banc des modèles,
# c'est-à-dire **la recette du produit telle qu'elle part aujourd'hui**. Un
# réglage qui ne fait pas mieux qu'elle ne mérite pas qu'on change quoi que ce soit.
TEMOIN = RACINE / "resultats_animation" / "openai_gpt-image-2"


def sans_barre(masque: np.ndarray) -> int:
    """Où s'arrête le personnage, quand un modèle lui a dessiné un sol sous les pieds.

    **Certains modèles ajoutent une barre de sol qui traverse toute la case**, et
    elle colle aux pieds : le détourage la garde, la boîte du sujet prend la
    largeur de la barre au lieu de celle du corps, et comme la forme est un
    rapport hauteur/largeur, tous les sujets se mettent à avoir la même. Le banc
    conclurait *ce personnage ne bouge pas* sur une planche où il marche
    parfaitement. C'est arrivé : `seedream-4.5` a été noté zéro pour ça.

    **On mesure l'étendue d'une ligne, pas son nombre de pixels.** Le bord bas
    d'une barre est adouci : la dernière ligne ne porte qu'un tiers des pixels,
    mais ils sont étalés d'un bord à l'autre. Compter les pixels la laisse
    passer, et une seule ligne oubliée redonne à la boîte toute sa largeur.

    Deux conditions, parce qu'une seule couperait les pieds d'un personnage
    jambes écartées : la ligne doit traverser **presque toute la boîte**, *et*
    être **bien plus étalée que le corps au-dessus**. Un corps ne remplit jamais
    sa propre boîte une fois et demie.
    """
    hauteur, largeur = masque.shape
    if hauteur < 12:
        return hauteur
    etendues = np.zeros(hauteur, int)
    for i in range(hauteur):
        cols = np.where(masque[i])[0]
        if cols.size:
            etendues[i] = cols[-1] - cols[0] + 1
    corps = etendues[: int(hauteur * 0.8)]
    corps = corps[corps > 0]
    if corps.size < 4:
        return hauteur
    typique = float(np.median(corps))
    seuil = max(0.85 * largeur, 1.5 * typique)
    bas = hauteur
    plancher = hauteur - max(1, hauteur // 6)
    while bas > plancher and etendues[bas - 1] >= seuil:
        bas -= 1
    return bas



DETOURAGE = Recette(passes=(Passe(moteur="bord"),))
PLEINE = 0.92  # au-delà, la « silhouette » est un carré : ce n'est pas un sujet


def recouper(octets: bytes, boite: tuple[int, int, int, int]) -> np.ndarray | None:
    """Redécouper une case dont le quadrillage a été redessiné par le modèle.

    **Le piège, et il coûte cher.** Quand on joint un gabarit, le modèle recopie
    souvent ses traits dans son image. Le détourage du produit inonde depuis le
    bord de la planche : il bute sur ces traits et s'arrête. Chaque case ressort
    alors en **carré opaque** — le fond intérieur n'a pas été retiré.

    Une planche dans cet état est mesurée « figée » alors qu'on ne sait
    simplement pas la découper, et les deux choses n'ont rien à voir. On rentre
    donc de quelques pixels pour passer *derrière* le trait, et on inonde depuis
    le bord de la case. Ce que ça rend est le vrai sujet.
    """
    x0, y0, x1, y1 = boite
    marge = 7
    if x1 - x0 <= 2 * marge or y1 - y0 <= 2 * marge:
        return None
    crop = Image.open(io.BytesIO(octets)).convert("RGBA").crop(
        (x0 + marge, y0 + marge, x1 - marge, y1 - marge)
    )
    tampon = io.BytesIO()
    crop.save(tampon, format="PNG")
    return detourer(DETOURAGE, tampon.getvalue())


def ouvrir(octets: bytes) -> tuple[list[np.ndarray], dict]:
    """Une planche → la liste de ses sujets, chacun serré sur son contenu.

    **Le juge et le rapport doivent voir exactement la même chose.** Si la mesure
    recoupe une case et que l'animation ne la recoupe pas, le tableau dit *ça
    marche* pendant que l'image montre un carré opaque, et on ne sait plus qui
    croire. Ce passage-là est donc écrit une fois, et les deux s'en servent.
    """
    rgba = detourer(DETOURAGE, octets)
    boites = en_ordre_de_lecture(zones_opaques(rgba[:, :, 3]))
    compte = {"sujets": len(boites), "cases_recoupees": 0, "barres_de_sol": 0}
    if len(boites) < 3:
        return [], compte

    # **Les cases pleines sont rouvertes une par une**, sinon on conclurait « ce
    # personnage ne bouge pas » sur une planche qu'on n'a pas su découper.
    alpha_source = rgba[:, :, 3] > 127
    plans: list[np.ndarray] = []
    for x0, y0, x1, y1 in boites:
        if alpha_source[y0:y1, x0:x1].mean() > PLEINE:
            ouvert = recouper(octets, (x0, y0, x1, y1))
            if ouvert is not None and (ouvert[:, :, 3] > 127).mean() < PLEINE:
                compte["cases_recoupees"] += 1
                plans.append(ouvert)
                continue
        plans.append(rgba[y0:y1, x0:x1])

    # Chaque sujet est ensuite débarrassé du sol qu'on lui a peut-être dessiné,
    # puis serré sur ce qui reste — sinon la barre décide à la place du corps.
    sujets: list[np.ndarray] = []
    for plan in plans:
        masque = plan[:, :, 3] > 127
        bas = sans_barre(masque)
        if bas < masque.shape[0]:
            compte["barres_de_sol"] += 1
        plan, masque = plan[:bas], masque[:bas]
        cols = np.where(masque.any(axis=0))[0]
        rangs = np.where(masque.any(axis=1))[0]
        if cols.size and rangs.size:
            sujets.append(plan[rangs[0] : rangs[-1] + 1, cols[0] : cols[-1] + 1])
    return sujets, compte


def mesurer(octets: bytes, attendu: int) -> dict:
    """Les mesures d'une planche, sachant combien de cases on avait demandé."""
    sujets, compte = ouvrir(octets)
    m: dict = {"attendu": attendu, **compte}
    if len(sujets) < 3:
        return m

    h = np.array([s.shape[0] for s in sujets], float)
    w = np.array([s.shape[1] for s in sujets], float)
    forme = h / w
    m["ecart_hauteur_pct"] = round(float(h.max() / h.min() - 1) * 100, 1)
    m["forme_pct"] = round(float(forme.max() / forme.min() - 1) * 100, 1)

    # Les silhouettes ramenées à une boîte commune, posées sur la même ligne de
    # sol : c'est la seule façon de comparer des cases entre elles sans que le
    # recadrage invente le mouvement qu'on cherche.
    H, W = int(h.max()) + 4, int(w.max()) + 4
    cadres, sommets = [], []
    for sujet in sujets:
        crop = sujet[:, :, 3] > 127
        cadre = np.zeros((H, W), bool)
        dy, dx = H - crop.shape[0], (W - crop.shape[1]) // 2
        cadre[dy : dy + crop.shape[0], dx : dx + crop.shape[1]] = crop
        cadres.append(cadre)
        sommets.append(dy)
    bas = slice(int(H * 0.62), H)
    jambes = [
        np.logical_xor(a[bas], cadres[(i + 1) % len(cadres)][bas]).sum()
        / max(1, np.logical_or(a[bas], cadres[(i + 1) % len(cadres)][bas]).sum())
        * 100
        for i, a in enumerate(cadres)
    ]
    m["jambes_pct"] = round(float(np.mean(jambes)), 1)
    m["balancement_px"] = round((max(sommets) - min(sommets)) * 64 / H, 1)

    xs = []
    for sujet in sujets:
        c = sujet.astype(int)
        r, g, b, a = c[:, :, 0], c[:, :, 1], c[:, :, 2], c[:, :, 3]
        flamme = (a > 127) & (r > 200) & (g > 140) & (b < 140)
        xs.append(
            float(np.where(flamme)[1].mean()) / sujet.shape[1] * 100 if flamme.any() else None
        )
    connus = [v for v in xs if v is not None]
    m["lanterne_pct"] = round(max(connus) - min(connus), 1) if len(connus) >= 2 else None
    return m


def temoin() -> dict:
    """Ce que la recette d'aujourd'hui donne, en huit tirages déjà payés.

    **Remesuré ici, pas relu.** Le banc des modèles avait jugé ces mêmes planches
    avant qu'on sache rouvrir une case dont le quadrillage a été redessiné : ses
    chiffres sous-estiment le témoin, et comparer les nouveaux réglages à un
    témoin sous-évalué gonflerait leur avance. On les repasse donc au juge
    d'aujourd'hui — le fichier est sur le disque, ça ne coûte rien.
    """
    planches = sorted(TEMOIN.glob("jet*.png")) if TEMOIN.exists() else []
    mesures = [mesurer(p.read_bytes(), 8) for p in planches]
    formes = [m["forme_pct"] for m in mesures if m.get("forme_pct") is not None]
    return {
        "essais": len(mesures),
        "forme_moyenne": round(float(np.mean(formes)), 1) if formes else None,
        "forme_max": max(formes) if formes else None,
        "utilisables": sum(
            1 for m in mesures if m["sujets"] >= 8 and (m.get("forme_pct") or 0) >= SEUIL_FORME
        ),
        "jambes_moyennes": round(
            float(np.mean([m["jambes_pct"] for m in mesures if m.get("jambes_pct") is not None])), 1
        ) if mesures else None,
    }


def main() -> None:
    releve = json.loads((BANC / "mesures.json").read_text("utf-8"))
    lignes: list[dict] = []

    for nom in sorted(releve):
        reglage = releve[nom].get("reglage", {})
        attendu = reglage.get("cases", 8)
        for planche in sorted((BANC / nom).glob("jet*.png")):
            m = mesurer(planche.read_bytes(), attendu)
            paye = releve[nom].get(planche.stem, {})
            m.update(
                reglage=nom,
                quoi=reglage.get("quoi", ""),
                jet=planche.stem,
                fichier=str(planche),
                cout_usd=paye.get("cout_usd"),
                secondes=paye.get("secondes"),
            )
            # **Le compte propose, il ne refuse pas** — c'est la conclusion 3 de
            # `docs/v3-animation.md`, appliquée à son propre banc. Une planche qui
            # porte au moins ce qu'on a demandé est exploitable ; le surplus
            # s'écarte à la main.
            # **Découpable ou non, et c'est une question à part.** Une planche
            # dont le modèle a redessiné le quadrillage passe le contrôle du
            # compte — huit taches opaques, huit cases — et rend huit carrés
            # pleins. Le produit ne refuse pas : il garde du vide payé. Ce banc
            # sait les rouvrir pour les mesurer ; le produit, non.
            m["decoupable"] = m.get("cases_recoupees", 0) == 0
            m["compte_ok"] = m["sujets"] >= attendu
            m["anime"] = (m.get("forme_pct") or 0) >= SEUIL_FORME
            m["utilisable"] = bool(m["compte_ok"] and m["anime"])
            lignes.append(m)

    (BANC / "jugements.json").write_text(json.dumps(lignes, indent=1, ensure_ascii=False), "utf-8")

    # ── Le détail, planche par planche ───────────────────────────────────────
    e = (
        f"{'reglage':<20} {'jet':<5} {'suj':>4}/{'att':<3} {'forme':>6} {'jambes':>7} "
        f"{'balanc':>7} {'lant':>5} {'sec':>4} {'$':>7}  ok"
    )
    print(e)
    print("-" * len(e))
    for l in lignes:
        if l["sujets"] < 3:
            print(f"{l['reglage']:<20} {l['jet']:<5} {l['sujets']:>4}/{l['attendu']:<3}  planche illisible")
            continue
        marque = "OUI" if l["utilisable"] else ("compte" if not l["compte_ok"] else "fige")
        lant = l["lanterne_pct"] if l["lanterne_pct"] is not None else "—"
        print(
            f"{l['reglage']:<20} {l['jet']:<5} {l['sujets']:>4}/{l['attendu']:<3} "
            f"{l['forme_pct']:>6} {l['jambes_pct']:>7} {l['balancement_px']:>7} {lant:>5} "
            f"{l['secondes'] or 0:>4.0f} {l['cout_usd'] or 0:>7.4f}  {marque}"
        )

    # ── Le classement des réglages ───────────────────────────────────────────
    print()
    e2 = f"{'reglage':<20} {'ok':>3}/{'n':<2} {'forme moy':>10} {'forme max':>10} {'jambes':>7}  ce qui change"
    print(e2)
    print("-" * 96)
    synthese = []
    for nom in sorted({l["reglage"] for l in lignes}):
        siens = [l for l in lignes if l["reglage"] == nom]
        formes = [l["forme_pct"] for l in siens if l.get("forme_pct") is not None]
        jambes = [l["jambes_pct"] for l in siens if l.get("jambes_pct") is not None]
        s = {
            "reglage": nom,
            "quoi": siens[0]["quoi"],
            "essais": len(siens),
            "utilisables": sum(1 for l in siens if l["utilisable"]),
            "comptes_ok": sum(1 for l in siens if l["compte_ok"]),
            "forme_moyenne": round(float(np.mean(formes)), 1) if formes else None,
            "forme_max": max(formes) if formes else None,
            "jambes_moyennes": round(float(np.mean(jambes)), 1) if jambes else None,
            "cout_total": round(sum(l["cout_usd"] or 0 for l in siens), 4),
        }
        synthese.append(s)

    for s in sorted(synthese, key=lambda s: -(s["forme_moyenne"] or 0)):
        fm = f"{s['forme_moyenne']:.1f}" if s["forme_moyenne"] is not None else "—"
        fx = f"{s['forme_max']:.1f}" if s["forme_max"] is not None else "—"
        jm = f"{s['jambes_moyennes']:.1f}" if s["jambes_moyennes"] is not None else "—"
        print(
            f"{s['reglage']:<20} {s['utilisables']:>3}/{s['essais']:<2} {fm:>10} {fx:>10} "
            f"{jm:>7}  {s['quoi'][:44]}"
        )

    (BANC / "synthese.json").write_text(json.dumps(synthese, indent=1, ensure_ascii=False), "utf-8")

    t = temoin()
    print()
    if t:
        print(
            f"temoin — la recette d'aujourd'hui, {t['essais']} tirages du banc des modeles "
            f"remesures par ce juge : forme moyenne {t['forme_moyenne']}, max {t['forme_max']}, "
            f"jambes {t['jambes_moyennes']}, {t['utilisables']} utilisables."
        )
        (BANC / "temoin.json").write_text(json.dumps(t, indent=1, ensure_ascii=False), "utf-8")
    total = sum(s["cout_total"] for s in synthese)
    print(f"anime = forme >= {SEUIL_FORME} % · compte = au moins le nombre de cases demande")
    print(f"depense de ce banc : ${total:.4f}")
    print("-> essais/resultats_recette/jugements.json et synthese.json")


if __name__ == "__main__":
    main()
