# -*- coding: utf-8 -*-
"""Essai de recette — vingt-neuf façons de demander la même marche.

**Ce que le banc des modèles avait établi** (`docs/v3-animation.md`) : le modèle
tient le personnage, aucun modèle ne produit un cycle de façon fiable, et
`openai/gpt-image-2` est le meilleur rapport. Ce qui restait ouvert, c'est
**pourquoi** : le modèle, ou la façon de demander ?

Ce banc-ci ne change plus de modèle. Il change **la demande**, et il n'en bouge
qu'un morceau à la fois : combien de cases, comment la consigne est écrite, et ce
qu'on joint comme images — dont un **guide de cycle de marche dessiné par le
programme** (`essais/guide_marche.py`), qui était le mannequin de
`docs/etude-mannequin.md` en deux dimensions et pour zéro euro.

**Il s'est écrit en trois vagues, et les deux dernières sont des corrections.**
C'est la partie utile de ce fichier :

1. **vingt-cinq réglages, deux tirages chacun.** Dépouillés, ils désignaient un
   coupable : la clause « same proportions, same size ».
2. **trois réglages de plus**, pour isoler cette clause proprement — et pour
   réparer une erreur de ma part, la consigne d'essai ayant laissé tomber tout un
   paragraphe du prompt du produit. Ils l'ont confirmée, sur trois tirages.
3. **douze tirages de plus**, sur les deux seules cases qui pouvaient trancher.
   **Ils ont tué la conclusion des deux vagues précédentes** : l'effet de la
   clause était du hasard, et trois tirages ne savent pas le voir.

La leçon est dans le nombre, pas dans le texte : **rien ne se décide ici sous
huit tirages.**

    .venv\Scripts\python.exe essais/essai_recette.py

Sortie : `essais/resultats_recette/<reglage>/jet<N>.png`, plus `mesures.json` qui
garde **ce que chaque réglage a envoyé**. Relancer ne repaie jamais.
"""

from __future__ import annotations

import asyncio
import io
import json
import sys
import time
from pathlib import Path

RACINE = Path(__file__).resolve().parent
DEPOT = RACINE.parent
sys.path.insert(0, str(DEPOT))

from PIL import Image, ImageDraw, ImageFont

from atelier.domaine.demande import Demande
from atelier.fournisseur.openrouter import CLE, OpenRouter
from atelier.reglages import lire_secret

from guide_marche import FOND, TRAIT, planche_guide

SORTIE = RACINE / "resultats_recette"
MESURES = SORTIE / "mesures.json"
REFERENCE = DEPOT / "donnees" / "generations" / "cb3ebb37f3cd4e21987964cd1af87770"
PROJET = "essai-animation"

MODELE = "openai/gpt-image-2"
JETS = (1, 2)
PLAFOND_USD = 2.60
PARALLELE = 4

# La grille la plus carrée pour N cases — la même règle que le pliage du produit.
GRILLES = {4: (2, 2), 6: (3, 2), 8: (3, 3)}


# ─────────────────────────────────────────────────────────────────────────────
# Les images qu'on peut joindre
# ─────────────────────────────────────────────────────────────────────────────


def _sprite() -> Image.Image:
    gen, rang = "038b7c1113c84457a232a28dabc7cd1d", "0"
    return Image.open(DEPOT / "donnees" / "generations" / gen / f"{rang}-rendu.png").convert("RGBA")


def _chiffres(taille: int = 46) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Une police assez grosse pour se lire, quelle que soit la machine."""
    for nom in ("arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            continue
    return ImageFont.load_default()


def gabarit(cases: int, largeur: int = 1024, hauteur: int = 1024, colonnes: int | None = None,
            lignes: int | None = None, numerote: bool = False, amorce: bool = False) -> bytes:
    """Une planche de cases vides — celle du produit, plus deux variantes.

    **Numérotée** : le chiffre de chaque case, pour lever l'ordre de lecture, que
    les bancs précédents ont vu se mélanger.
    **Amorcée** : la première case déjà remplie du sprite de référence. Le modèle
    n'a plus à deviner par quoi commencer — c'est le pliage d'habillage du
    produit, appliqué à une animation.
    """
    colonnes = colonnes or GRILLES[cases][0]
    lignes = lignes or GRILLES[cases][1]
    marge, gouttiere = 40, 24
    large = (largeur - 2 * marge - gouttiere * (colonnes - 1)) // colonnes
    haut = (hauteur - 2 * marge - gouttiere * (lignes - 1)) // lignes
    image = Image.new("RGB", (largeur, hauteur), FOND)
    d = ImageDraw.Draw(image)
    for i in range(cases):
        c, l = i % colonnes, i // colonnes
        x0 = marge + c * (large + gouttiere)
        y0 = marge + l * (haut + gouttiere)
        d.rectangle([x0, y0, x0 + large, y0 + haut], outline=TRAIT, width=3)
        if numerote:
            # **Gros, sinon il ne se voit pas.** La police par défaut de Pillow
            # fait onze pixels ; sur une planche de mille, le modèle ne la lirait
            # pas plus que nous.
            d.text((x0 + 14, y0 + 8), str(i + 1), fill=(150, 150, 156), font=_chiffres())
        if amorce and i == 0:
            # **Recadré sur le personnage, pas sur sa marge vide** : la case doit
            # montrer la taille qu'on attend, et le sprite d'origine flotte petit
            # au milieu d'un carré transparent.
            s = _sprite()
            s = s.crop(s.getbbox())
            k = min(large, haut) * 0.86 / max(s.size)
            s = s.resize((max(1, int(s.width * k)), max(1, int(s.height * k))), Image.NEAREST)
            image.paste(s, (x0 + (large - s.width) // 2, y0 + haut - 24 - s.height), s)
    tampon = io.BytesIO()
    image.save(tampon, format="PNG")
    return tampon.getvalue()


def references_du_projet() -> dict[str, bytes]:
    """Les deux images que le produit joint de lui-même, relues à la source."""
    fiche = json.loads((REFERENCE / "generation.json").read_text("utf-8"))
    sorties: dict[str, bytes] = {}
    for r in fiche["references"]:
        if r["origine"] == "carte":
            sorties["carte"] = (
                DEPOT / "donnees" / "projets" / PROJET / "tableau" / f"{r['asset']}.png"
            ).read_bytes()
        else:
            gen, rang = r["asset"].rsplit("-", 1)
            sorties["promue"] = (
                DEPOT / "donnees" / "generations" / gen / f"{rang}-rendu.png"
            ).read_bytes()
    return sorties


# ─────────────────────────────────────────────────────────────────────────────
# Les textes
# ─────────────────────────────────────────────────────────────────────────────

# Les étapes d'un cycle de marche, dans le vocabulaire des animateurs. C'est le
# découpage standard depuis toujours : si le modèle connaît quelque chose de la
# marche, il connaît ces mots-là.
ETAPES = {
    8: [
        "contact, left foot forward, right foot back",
        "down, weight on the left foot, body at its lowest",
        "passing, right leg swinging through, legs together",
        "up, left leg straight, body at its highest",
        "contact, right foot forward, left foot back",
        "down, weight on the right foot, body at its lowest",
        "passing, left leg swinging through, legs together",
        "up, right leg straight, body at its highest",
    ],
    6: [
        "contact, left foot forward, right foot back",
        "down, weight on the left foot, body at its lowest",
        "passing, right leg swinging through, legs together",
        "contact, right foot forward, left foot back",
        "down, weight on the right foot, body at its lowest",
        "passing, left leg swinging through, legs together",
    ],
    4: [
        "contact, left foot forward, right foot back",
        "passing, right leg swinging through, legs together",
        "contact, right foot forward, left foot back",
        "passing, left leg swinging through, legs together",
    ],
}


def t_produit(n: int) -> str:
    """La composition du produit, telle qu'elle part aujourd'hui."""
    c, l = GRILLES[n]
    cases = " ".join(
        f"{i+1}. walk cycle, frame {i+1} of {n}: {e}, facing right, side view;"
        for i, e in enumerate(ETAPES[n])
    )
    return (
        f"Render this as a sprite sheet of {n} sprites of the SAME subject. "
        f"Exactly {c} columns and {l} rows, {n} cells total, one single sprite per cell, "
        f"evenly spaced on a regular grid, every sprite the same height, all standing on "
        f"the same baseline. The cells, in reading order, show: {cases}"
    )


def t_cycle(n: int) -> str:
    hauts = [i + 1 for i, e in enumerate(ETAPES[n]) if e.startswith("up")] or [n]
    bas = [i + 1 for i, e in enumerate(ETAPES[n]) if e.startswith("down")] or [2]
    return (
        f"Render ONE continuous walk cycle of the SAME character as a sprite sheet of {n} "
        f"frames, one per cell, read left to right. This is a single motion sampled at {n} "
        f"instants, NOT {n} separate poses. Across the cycle the whole body must visibly "
        f"rise and fall: highest on frame(s) {', '.join(map(str, hauts))}, lowest on "
        f"frame(s) {', '.join(map(str, bas))}. The arm and whatever it holds must swing "
        f"back and forth, opposite to the leading leg. Same character, same colours, seen "
        f"from the same side, every sprite standing on the same baseline."
    )


def t_animateur(n: int) -> str:
    return (
        f"You are drawing a looping game sprite sheet: a {n}-frame side-view walk cycle, "
        f"one frame per cell, in reading order. Use the classic animator keys — contact, "
        f"down, passing, up — twice over the cycle, alternating the leading leg. Keep the "
        f"same character, the same size and the same baseline in every cell. The hips must "
        f"drop on the down keys and lift on the up keys; the arms counter-swing the legs. "
        f"Frame {n} must lead back into frame 1 without a jump."
    )


def t_difference(n: int) -> str:
    lignes = " ".join(
        f"Cell {i+1}: exactly like cell {i}, except the body has advanced one "
        f"{n}th of a step further into the same walk."
        if i else "Cell 1: the character in mid-stride, left foot forward."
        for i in range(n)
    )
    return (
        f"Render a sprite sheet of {n} cells, one sprite per cell, same character "
        f"throughout, read left to right. Each cell differs from the one before it by ONE "
        f"small increment of the same continuous walk — nothing else changes. {lignes} "
        f"Cell 1 must follow on from cell {n}, so the cycle loops."
    )


def t_minimal(n: int) -> str:
    return (
        f"A {n}-frame side-view walk cycle sprite sheet of this character, "
        f"one frame per cell, looping."
    )


def t_interdit(n: int) -> str:
    return (
        f"Render a {n}-frame walk cycle sprite sheet of the SAME character, one frame per "
        f"cell, read left to right. IMPORTANT: do NOT draw {n} static standing poses. Do "
        f"NOT redraw the same sprite {n} times with small random changes. Each cell is the "
        f"SAME body, {1/n:.2f} of a step later than the cell before it: the legs scissor, "
        f"the hips rise and fall, the arms counter-swing. If two neighbouring cells look "
        f"interchangeable, the sheet is wrong."
    )


PHRASE_GUIDE = (
    " A pose guide is attached: it shows, cell by cell in the same grid, the exact body "
    "pose each frame must take — the leg positions, the knee bends, how high the hips sit, "
    "and how the arms swing. Follow that geometry cell for cell. Draw the character with "
    "its own look, clothing and colours; the guide gives only the pose."
)


# ─────────────────────────────────────────────────────────────────────────────
# Les vingt-cinq réglages
# ─────────────────────────────────────────────────────────────────────────────


def reglages() -> list[dict]:
    r = references_du_projet()
    carte, promue = r["carte"], r["promue"]

    def base(n=8, **kw):
        return {"cases": n, **kw}

    liste: list[dict] = []

    def poser(nom: str, quoi: str, texte: str, images: list[bytes], cases: int = 8,
              proportions: str = "1:1", jets: tuple[int, ...] = JETS) -> None:
        liste.append(
            {
                "nom": nom,
                "quoi": quoi,
                "cases": cases,
                "texte": texte,
                "images": images,
                "proportions": proportions,
                "jets": jets,
            }
        )

    # A · le nombre de cases, tout le reste comme aujourd'hui
    for n in (4, 6, 8):
        poser(
            f"A-{n}-cases",
            f"{n} cases, texte du produit, gabarit vide",
            t_produit(n),
            [carte, promue, gabarit(n)],
            cases=n,
        )

    # B · le texte, à huit cases et références inchangées
    for nom, fabrique, quoi in (
        ("B-cycle", t_cycle, "texte « un seul cycle continu », balancement nommé"),
        ("B-animateur", t_animateur, "texte en vocabulaire d'animateur"),
        ("B-difference", t_difference, "texte par différence — chaque case dérive de la précédente"),
        ("B-minimal", t_minimal, "texte d'une seule phrase"),
        ("B-interdit", t_interdit, "texte qui interdit explicitement les poses statiques"),
    ):
        poser(nom, quoi, fabrique(8), [carte, promue, gabarit(8)])

    # C · ce qu'on joint
    poser("C-sans-gabarit", "aucun gabarit — seulement le personnage",
          t_produit(8), [carte, promue])
    poser("C-numerote", "gabarit dont les cases portent leur numéro",
          t_produit(8), [carte, promue, gabarit(8, numerote=True)])
    poser("C-guide-baton", "gabarit + guide de marche en bonhomme-bâton",
          t_produit(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)])
    poser("C-guide-seul", "guide de marche à la place du gabarit",
          t_produit(8) + PHRASE_GUIDE, [carte, promue, planche_guide(8, 3, 3)])
    poser("C-guide-silhouette", "gabarit + guide en silhouettes pleines",
          t_produit(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3, pleine=True)])
    poser("C-sans-carte", "sans l'artwork du jeu — seulement le sprite et le gabarit",
          t_produit(8), [promue, gabarit(8)])
    poser("C-amorce", "gabarit dont la première case est déjà remplie du sprite",
          t_produit(8), [carte, promue, gabarit(8, amorce=True)])
    poser("C-guide-sans-carte", "guide seul, sans artwork ni gabarit",
          t_produit(8) + PHRASE_GUIDE, [promue, planche_guide(8, 3, 3)])

    # D · les croisements qui valent la peine
    poser("D-4-guide", "4 cases + guide de marche", t_produit(4) + PHRASE_GUIDE,
          [carte, promue, gabarit(4), planche_guide(4, 2, 2)], cases=4)
    poser("D-6-guide", "6 cases + guide de marche", t_produit(6) + PHRASE_GUIDE,
          [carte, promue, gabarit(6), planche_guide(6, 3, 2)], cases=6)
    poser("D-guide-cycle", "guide + texte « cycle continu »", t_cycle(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)])
    poser("D-tout", "guide + gabarit numéroté + texte « cycle continu »",
          t_cycle(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8, numerote=True), planche_guide(8, 3, 3)])
    poser("D-4-cycle", "4 cases + texte « cycle continu »", t_cycle(4),
          [carte, promue, gabarit(4)], cases=4)
    poser("D-amorce-cycle", "case 1 amorcée + texte « cycle continu »", t_cycle(8),
          [carte, promue, gabarit(8, amorce=True)])
    poser("D-guide-difference", "guide + texte par différence", t_difference(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)])

    # E · le format de l'image — une bande plutôt qu'un carré
    for nom, prop, (l, h) in (("E-3-2", "3:2", (1536, 1024)), ("E-16-9", "16:9", (1792, 1008))):
        texte = t_produit(8).replace("Exactly 3 columns and 3 rows", "Exactly 4 columns and 2 rows")
        poser(nom, f"image en {prop}, 8 cases sur 4 colonnes et 2 lignes", texte,
              [carte, promue, gabarit(8, l, h, colonnes=4, lignes=2)], proportions=prop)

    # ── Seconde vague ────────────────────────────────────────────────────────
    #
    # **La première vague a révélé une erreur de ma part, et elle est instructive.**
    # Le réglage `A-8-cases`, que je croyais être la recette du produit, laisse
    # tomber le dernier paragraphe du prompt stocké. Ce paragraphe contient
    # « same proportions, same size, same style » — **une consigne qui interdit au
    # corps de changer de forme, dans une demande de marche.** Or changer de
    # forme, c'est très exactement ce que marcher veut dire.
    #
    # Les huit tirages témoins portaient cette phrase et ont marqué 8,1 % ;
    # `A-8-cases`, sans elle, a marqué 17,8 %. Ça mérite d'être isolé plutôt que
    # deviné, et trois tirages de plus valent mieux qu'une hypothèse.
    exact = bloc_du_produit()
    poser("F-exact-guide", "prompt exact du produit + guide de marche",
          exact + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)], jets=(1, 2, 3))
    poser("F-sans-proportions",
          "prompt exact du produit, moins « same proportions, same size »",
          sans_proportions(exact), [carte, promue, gabarit(8)], jets=(1, 2, 3, 4, 5, 6, 7))
    poser("F-gagnant-encore", "le gagnant de la premiere vague, trois tirages de plus",
          t_produit(8) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)], jets=(3, 4, 5))

    # ── Troisieme vague : la case qui manquait ───────────────────────────────
    #
    # **Les deux vagues precedentes ont laisse une case vide du tableau**, et
    # c'est celle qui decide : le prompt **complet** du produit — donc avec le
    # paragraphe qui interdit de redessiner le quadrillage, sans lequel la
    # planche n'est pas decoupable — **clause de forme remplacee**, *et* le guide
    # de marche joint. C'est la seule combinaison qui serait a la fois animee et
    # utilisable par l'atelier.
    #
    # Elle se mesure contre `F-sans-proportions`, qui est exactement la meme
    # demande sans le guide, et qui monte a sept tirages pour l'occasion : dix
    # tirages contre trois ne compareraient rien.
    poser("G-livrable-guide",
          "prompt complet, clause remplacee, plus le guide de marche",
          sans_proportions(exact) + PHRASE_GUIDE,
          [carte, promue, gabarit(8), planche_guide(8, 3, 3)],
          jets=(1, 2, 3, 4, 5, 6, 7, 8))

    return liste


def bloc_du_produit() -> str:
    """La consigne de planche telle qu'elle est partie, relue dans la génération."""
    fiche = json.loads((REFERENCE / "generation.json").read_text("utf-8"))
    return fiche["demande"]["prompt"].split("\n\n")[2]


CLAUSE = (
    " It must be the same subject in every cell: same colors, same outfit, same "
    "proportions, same size, same style."
)
REMPLACEE = (
    " It must be the same character in every cell: same colors, same outfit, same "
    "style. Its body may change shape from cell to cell — that is what walking is."
)


def sans_proportions(texte: str) -> str:
    """La phrase de constance, privée de ce qui interdit au corps de bouger.

    On ne la supprime pas : le personnage doit rester le même, et c'est cette
    phrase qui le tient. On lui retire **« same proportions, same size »** et on
    dit à la place, en clair, que le corps a le droit de changer de forme.
    """
    assert CLAUSE in texte, "la phrase de constance a change — verifier avant de mesurer"
    return texte.replace(CLAUSE, REMPLACEE)


# ─────────────────────────────────────────────────────────────────────────────


class Caisse:
    """Ce qui a été dépensé, partagé par les appels en parallèle."""

    def __init__(self, plafond: float) -> None:
        self.depense = 0.0
        self.plafond = plafond
        self._verrou = asyncio.Lock()

    async def autorise(self) -> bool:
        async with self._verrou:
            return self.depense < self.plafond

    async def ajoute(self, montant: float) -> float:
        async with self._verrou:
            self.depense += montant
            return self.depense


async def principal() -> None:
    fiche = json.loads((REFERENCE / "generation.json").read_text("utf-8"))
    blocs = fiche["demande"]["prompt"].split("\n\n")
    tete = "\n\n".join(blocs[:2])  # la bible du jeu, puis le signalement du sujet
    print(f"tete commune : {len(tete)} caracteres (bible + sujet)")

    jeu = reglages()
    appels = sum(len(r["jets"]) for r in jeu)
    print(f"reglages     : {len(jeu)} · {appels} appels au total")

    passerelle = OpenRouter(lire_secret(CLE.nom))
    if (raison := passerelle.indisponible()) is not None:
        print(f"[x] {raison}")
        return
    catalogue = {m.chez_lui: m for m in await passerelle.catalogue()}
    modele = catalogue.get(MODELE)
    if modele is None:
        print(f"[x] {MODELE} absent du catalogue")
        return

    SORTIE.mkdir(parents=True, exist_ok=True)
    releve = json.loads(MESURES.read_text("utf-8")) if MESURES.exists() else {}
    # **Le plafond porte sur le cumul, pas sur ce lancement.** Deux dollars ont
    # été accordés pour l'essai entier ; une seconde vague qui repartirait de zéro
    # les dépenserait une deuxième fois. Ce qui est déjà sur le disque a déjà été
    # payé, et se retranche.
    deja = sum(
        v.get("cout_usd", 0.0)
        for config in releve.values()
        for cle, v in config.items()
        if cle.startswith("jet")
    )
    caisse = Caisse(max(0.0, PLAFOND_USD - deja))
    print(f"deja paye    : ${deja:.4f} sur les ${PLAFOND_USD:.2f} accordes")
    plume = asyncio.Lock()
    portillon = asyncio.Semaphore(PARALLELE)
    print(f"reste        : ${caisse.plafond:.4f}\n")

    async def noter(nom: str, cle: str, valeur) -> None:
        async with plume:
            releve.setdefault(nom, {})[cle] = valeur
            MESURES.write_text(json.dumps(releve, indent=1, ensure_ascii=False), "utf-8")

    async def un_tirage(r: dict, jet: int) -> None:
        dossier = SORTIE / r["nom"]
        fichier = dossier / f"jet{jet}.png"
        if fichier.exists():
            return
        async with portillon:
            if not await caisse.autorise():
                return
            demande = Demande(
                prompt=f"{tete}\n\n{r['texte']}",
                proportions=r["proportions"],
                variations=1,
                references=tuple(r["images"]),
                repris=True,
            )
            debut = time.monotonic()
            try:
                image = await passerelle.generer(modele, demande)
            except Exception as erreur:  # noqa: BLE001
                await noter(r["nom"], f"jet{jet}",
                            {"echec": f"{type(erreur).__name__}: {erreur}",
                             "secondes": round(time.monotonic() - debut, 1), "cout_usd": 0.0})
                print(f"{r['nom']:<22} jet {jet} — echec : {type(erreur).__name__}")
                return
            fichier.write_bytes(image.octets)
            total = await caisse.ajoute(image.cout_usd)
            await noter(r["nom"], f"jet{jet}",
                        {"cout_usd": image.cout_usd, "unite": image.unite,
                         "secondes": round(time.monotonic() - debut, 1),
                         "octets": len(image.octets)})
            print(f"{r['nom']:<22} jet {jet} — ${image.cout_usd:.4f} · "
                  f"{time.monotonic()-debut:.0f}s · total ${total:.4f}")

    taches = []
    for r in jeu:
        (SORTIE / r["nom"]).mkdir(parents=True, exist_ok=True)
        # **Ce que le réglage a envoyé est écrit à côté de ses images**, sinon un
        # résultat six mois plus tard ne dit plus de quoi il est le résultat.
        await noter(r["nom"], "reglage", {
            "quoi": r["quoi"], "cases": r["cases"], "proportions": r["proportions"],
            "images": len(r["images"]), "texte": r["texte"], "jets": list(r["jets"]),
        })
        for jet in r["jets"]:
            taches.append(un_tirage(r, jet))

    await asyncio.gather(*taches)
    print(f"\ntotal depense : ${caisse.depense:.4f}")
    if caisse.depense >= PLAFOND_USD:
        print("[!] plafond atteint — des tirages ont ete sautes.")


if __name__ == "__main__":
    asyncio.run(principal())
