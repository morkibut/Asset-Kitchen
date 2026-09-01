# -*- coding: utf-8 -*-
"""Les étiquettes que l'atelier apporte avec lui.

**La base ne naît plus vide — 1ᵉʳ septembre 2026.** La décision d'origine était
*« personne ne l'écrit à la place de l'auteur »*, et elle est renversée pour un
compte, pas pour un goût : le mécanisme des étiquettes existe pour rendre la
description **mécanique au lieu d'être rédigée**, et une base vide ne rend rien de
mécanique — elle rend sept cases blanches, en anglais, exactement l'écran d'avant
l'assistant. Mesuré à l'ouverture de l'étape : trois lignes disaient la même
absence, et il n'y avait rien à cliquer.

**Livrée n'est pas fabriquée, et rien ne les confond.** Une livrée arrive avec
l'atelier et est la même partout ; une fabriquée est ce que l'auteur a nommé, et
elle porte à l'écran la marque `--epingle` de ce qui est réglé à la main. Aucun
vocabulaire neuf : c'est la distinction *défaut du catalogue* / *réglé à la main*
que le produit tient déjà sur le modèle d'une famille et sur l'occupation d'un
asset.

**Deux cases n'en reçoivent aucune, et ce n'est pas un oubli** : `vue` et
`technique` sont les deux cases du *cadre*. Elles disent d'où l'on regarde et
comment l'image est calée — deux choses qui se choisissent deux étapes plus haut,
avec une vignette. Offrir à les redécrire en mots serait ouvrir un second endroit
qui règle la même chose.

**Trois tests pour entrer, et ils sont dans le document** : nommer quelque chose
de visible, se reconnaître sans être expliquée, et ne pas rejouer une autre case.
Le texte anglais est écrit pour une machine — des noms de choses, séparés par des
virgules, sans phrase et sans verbe.

Le catalogue lisible, avec ses raisons, vit dans `docs/etiquettes-livrees.md` ;
`tests/test_etiquettes_livrees.py` tient les deux d'accord.
"""

from __future__ import annotations

import re
import unicodedata

from atelier.domaine.etiquette import Etiquette


# **Le repère d'une livrée est stable et lisible**, dérivé de son libellé et
# préfixé de sa case — jamais un tirage au sort. C'est ce qui permet de la
# reconnaître dans `etiquettes.json` une fois la base écrite sur le disque, et
# donc d'en ajouter à la version suivante sans redonner celles qu'on a retirées.
PREFIXE = "livree"


def _repere(libelle: str) -> str:
    """Un repère lisible, dérivé du libellé — la règle de `_identifiant` du
    service, sans son suffixe aléatoire : une livrée doit se retrouver à
    l'identique d'une version à l'autre."""
    plat = unicodedata.normalize("NFKD", libelle.lower())
    plat = "".join(c for c in plat if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", plat).strip("-")


_CATALOGUE: tuple[tuple[str, tuple[tuple[str, str], ...]], ...] = (
    # ── `monde` — où ça se passe · 18 ───────────────────────────
    ("monde", (
        ("haute fantaisie", "high fantasy, elves and dwarves, ancient kingdoms"),
        ("fantaisie sombre", "dark fantasy, grim decaying world, muted and oppressive"),
        ("épée et sorcellerie", "sword and sorcery, mercenaries and forbidden magic"),
        ("steampunk", "steampunk, brass machinery, steam pipes and gears"),
        ("dieselpunk", "dieselpunk, riveted iron, industrial war machines"),
        ("cyberpunk", "cyberpunk, neon megacity, rain-slick streets"),
        ("post-apocalyptique", "post-apocalyptic wasteland, ruins and scavenged gear"),
        ("opéra spatial", "space opera setting, starships and alien worlds"),
        ("îles flottantes", "floating islands drifting above an endless sky"),
        ("désert et dunes", "arid desert of dunes, sandstone ruins, heat haze"),
        ("toundra et glace", "frozen tundra, ice fields, aurora on the horizon"),
        ("marais et tourbières", "peat marshland, black water, reeds and dead trees"),
        ("forêt profonde", "deep old-growth forest, moss, ferns and giant roots"),
        ("souterrain et cavernes", "underground caverns, stalactites, mineral glow"),
        ("bord de mer", "salt-worn coastal town, docks, fishing boats and nets"),
        ("village pastoral", "pastoral farmland village, fields and dry stone walls"),
        ("ruines antiques", "ancient overgrown ruins, broken columns, vines"),
        ("cité verticale", "dense vertical city, stacked rooftops and rope bridges"),
    )),
    # ── `epoque` — quand ça se passe · 14 ───────────────────────
    ("epoque", (
        ("préhistoire", "stone age, bone and flint tools, hide clothing"),
        ("antiquité", "classical antiquity, bronze weapons and marble"),
        ("haut moyen âge", "early middle ages, mail and spears, before gunpowder"),
        ("moyen âge tardif", "late middle ages, plate armour and crossbows"),
        ("renaissance", "renaissance, early firearms, clockwork and lace"),
        ("âge de la voile", "age of sail, tall ships, tricorns and flintlocks"),
        ("révolution industrielle", "industrial revolution, coal smoke, iron and soot"),
        ("belle époque", "belle époque, gas lamps, wrought iron and velvet"),
        ("années folles", "roaring twenties, art deco geometry, jazz age"),
        ("entre-deux-guerres", "interwar period, khaki wool, rivets and canvas"),
        ("années 80", "1980s, cathode screens, chrome and plastic"),
        ("futur proche", "near future, ten years from now, familiar but newer"),
        ("futur lointain", "far future, millennia ahead, unfamiliar technology"),
        ("hors du temps", "timeless, no identifiable historical period"),
    )),
    # ── `rendu` — comment c'est dessiné · 14 ────────────────────
    ("rendu", (
        ("pixel art 8 bits", "8-bit pixel art, very tight palette, chunky pixels"),
        ("pixel art 16 bits", "16-bit pixel art, SNES era rendering, rich palette"),
        ("pixel art moderne", "modern high-resolution pixel art, clean colour clusters"),
        ("dessin animé", "cel-shaded cartoon rendering, flat fills, bold shapes"),
        ("aquarelle", "watercolour painting, soft bleeding edges, paper grain"),
        ("gouache", "gouache painting, opaque matte pigment, visible strokes"),
        ("peinture à l'huile", "oil painting, thick visible brushwork, rich impasto"),
        ("encre et lavis", "ink and wash, brush lines over grey washes"),
        ("crayonné", "pencil drawing, graphite hatching, paper texture"),
        ("vectoriel", "flat vector illustration, crisp geometric shapes"),
        ("papier découpé", "cut-paper collage, layered flat shapes, soft drop shadows"),
        ("pâte à modeler", "stop-motion clay look, fingerprint texture, soft edges"),
        ("rendu 3D stylisé", "stylised 3D render, soft shading, rounded forms"),
        ("bande dessinée", "comic book rendering, halftone dots, inked linework"),
    )),
    # ── `trait` — la ligne et les aplats · 12 ───────────────────
    ("trait", (
        ("contour noir", "solid black outline, one pixel wide"),
        ("contour brun", "dark brown outline, one pixel wide"),
        ("contour coloré", "coloured outline, a darker shade of the fill it borders"),
        ("sans contour", "no outline, shapes read by colour alone"),
        ("contour sélectif", "selective outline, only around the silhouette"),
        ("trait épais", "thick bold outline, heavy weight"),
        ("trait tremblé", "wobbly hand-drawn line, uneven weight"),
        ("aplats", "flat colour fills, no gradients"),
        ("ombrage en bandes", "banded cel shading, hard-edged shadow steps"),
        ("tramé", "dithered shading, checkerboard gradients"),
        ("dégradés doux", "smooth gradients, blended shading"),
        ("anti-crénelage manuel", "hand-placed anti-aliasing on curves and diagonals"),
    )),
    # ── `eclairage` — la lumière · 12 ───────────────────────────
    ("eclairage", (
        ("lumière rasante", "low raking light, long cast shadows"),
        ("lumière zénithale", "overhead noon light, short hard shadows"),
        ("contre-jour", "backlight, rim-lit silhouette, dark front"),
        ("heure dorée", "golden hour, warm low sun, long amber shadows"),
        ("clair de lune", "moonlight, cool blue key light, deep shadows"),
        ("lumière d'orage", "stormlight, heavy overcast broken by sharp flashes"),
        ("lumière de torche", "flickering torchlight, warm pooled glow, dark falloff"),
        ("néon", "neon lighting, saturated coloured glow on wet surfaces"),
        ("lumière de forge", "forge light, hot orange glow from below"),
        ("brume basse", "thick low-lying fog, volumetric haze"),
        ("lumière sous-marine", "underwater light, caustics and blue depth falloff"),
        ("lumière plate", "flat even light, no directional shadow"),
    )),
)


LIVREES: tuple[Etiquette, ...] = tuple(
    Etiquette(
        identifiant=f"{PREFIXE}-{case}-{repere}",
        libelle=libelle,
        texte=anglais,
        case=case,
        livree=True,
    )
    for case, paires in _CATALOGUE
    for libelle, anglais, repere in (
        (l, a, _repere(l)) for l, a in paires
    )
)
