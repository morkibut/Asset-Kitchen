# Les étiquettes livrées avec l'atelier

*Écrit le 1<sup>er</sup> septembre 2026, à la demande de l'auteur : « crée les étiquettes les
plus connues pour chaque champ ».*

> **Ce fichier ne tranche rien sur l'apparence** — c'est `docs/DESIGN.md` qui le fait, et
> `docs/design-decisions.md` qui garde le pourquoi. Celui-ci porte **le contenu** : les
> soixante-dix paires que l'atelier apporte avec lui. Il se lit quand on veut en ajouter une,
> en corriger une, ou comprendre pourquoi une case n'en a pas.

---

## La panne que ça répare, et elle est mesurée

Ouvrir l'étape *L'allure* sur le jeu de l'auteur, le 1<sup>er</sup> septembre 2026, à
1 600 × 900 : la ligne dit **« disponibles — 0 dans la base »**, la phrase sous elle dit
*rien dans la base pour cette case*, et la zone de texte dit **0 caractère**. Trois manières
de dire la même chose, et rien à cliquer nulle part.

C'est conforme à ce qui avait été décidé — *« la base naît vide, personne ne l'écrit à ta
place »* (`atelier/domaine/etiquette.py`) — et c'est cette décision-là qui change.

**Ce qui la fait changer n'est pas un goût, c'est le compte.** Le mécanisme des étiquettes
existe pour rendre la description *mécanique au lieu d'être rédigée*. Une base vide ne rend
rien de mécanique : elle rend sept cases de texte libre, en anglais, exactement l'écran
qu'on avait avant l'assistant. Le mécanisme ne commence à servir qu'au deuxième jeu — et
seulement si l'auteur a pris la peine, au premier, de fabriquer à la main les paires qu'il
aurait fallu lui donner.

---

## Livrée n'est pas fabriquée, et les deux ne se confondent jamais

**Deux origines, et l'écran les distingue** — c'est le vocabulaire que le produit possède
déjà et qu'il emploie partout ailleurs :

| Origine | Ce que c'est | Comment ça se lit |
|---|---|---|
| **livrée** | Ce fichier. Elle arrive avec l'atelier, elle est la même chez tout le monde, on ne la modifie pas | rangée ordinaire, en `--texte-2` |
| **fabriquée** | Ce que l'auteur a nommé lui-même, dans n'importe quel jeu | rangée ordinaire, **plus** la marque `--epingle` de ce qui est réglé à la main |

C'est très exactement la distinction *défaut du catalogue* / *réglé à la main* que le produit
tient déjà sur le modèle d'une famille, sur l'occupation d'un asset et sur le repli d'un
fournisseur. Aucun vocabulaire neuf : **`--epingle` veut dire « ça vient de toi », ici comme
ailleurs.**

**Une livrée ne se supprime pas, elle se masque** — et le masque appartient à l'atelier, pas
au jeu, comme la base elle-même. Supprimer pour de bon une donnée qu'on n'a pas écrite est un
geste qui ne peut pas s'annuler, pour un encombrement qui se règle en une ligne de recherche.

**Le compte d'emplois vaut pour les deux**, et c'est lui qui trie : au bout de trois jeux, la
liste d'un auteur qui fait de la fantaisie sombre ne ressemble plus à celle de départ, sans
qu'on lui ait rien demandé.

---

## Les cinq cases qui en reçoivent, et les deux qui n'en reçoivent pas

Le produit écrit lui-même dans trois cases de la bible :

| Case | Ce que le produit y écrit | D'où ça vient |
|---|---|---|
| `rendu` | `2D pixel art on a 64x64 grid` | le choix de taille, étape 3 |
| `technique` | `single isolated sprite on a flat background, strict 64x64 px tile snap` | le choix de taille, étape 3 |
| `vue` | `3/4 top-down orthographic view, full-body character centered` | le choix de vue, étape 2 |

**Il le faisait en l'écrivant dans la case, et il cessait dès que l'auteur y touchait.** La
borne était `_phrase_posee` : le produit n'écrivait que dans une case vide ou sur une phrase
qu'il avait lui-même écrite. Cliquer une étiquette **décrochait donc silencieusement la case
de son réglage** — et rouvrait, à la première étiquette, la contradiction exacte que
l'assistant a été construit pour fermer : *le réglage disait 128 pendant que le texte envoyé
disait 64, trois fois.*

**C'est réparé — 1<sup>er</sup> septembre 2026.** La phrase ne vit plus dans la case : elle se
calcule à l'envoi depuis la taille et la vue, qui la déterminent entièrement
(`Univers.phrase_du_produit`), et les fichiers écrits avant sont relus sans elle
(`sans_phrase_du_produit`). `_phrase_posee` n'existe plus, et il n'y a plus rien à décrocher :
**une étiquette peut désormais entrer dans n'importe quelle case sans geler quoi que ce soit.**

**Et pourtant `vue` et `technique` n'en reçoivent aucune**, pour une raison qui n'a rien à voir
avec le gel. Ce sont les deux cases du **cadre** (`CADRE` dans `Assistant.tsx`) : elles disent
d'où l'on regarde et comment l'image est calée, et ces deux choses **se choisissent deux étapes
plus haut, avec une vignette**. Offrir à les redécrire en mots serait ouvrir un second endroit
qui règle la même chose — ce que le produit s'interdit partout ailleurs.

`rendu`, elle, **en reçoit quatorze** : *pixel art 16 bits* et *aquarelle* sont la matière même
de l'allure, aucune autre case ne les porte, et la phrase de grille que l'atelier ajoute devant
ne les gêne plus.

---

## Le catalogue — 70 paires

Une étiquette est **une paire** : le libellé français qu'on clique, le texte anglais qui part
vraiment. Les textes anglais sont écrits pour un modèle d'image, pas pour un humain : ils
nomment des choses visibles, jamais des intentions.

### `monde` — où ça se passe · 18

| Libellé | Ce qui part |
|---|---|
| haute fantaisie | `high fantasy, elves and dwarves, ancient kingdoms` |
| fantaisie sombre | `dark fantasy, grim decaying world, muted and oppressive` |
| épée et sorcellerie | `sword and sorcery, mercenaries and forbidden magic` |
| steampunk | `steampunk, brass machinery, steam pipes and gears` |
| dieselpunk | `dieselpunk, riveted iron, industrial war machines` |
| cyberpunk | `cyberpunk, neon megacity, rain-slick streets` |
| post-apocalyptique | `post-apocalyptic wasteland, ruins and scavenged gear` |
| opéra spatial | `space opera setting, starships and alien worlds` |
| îles flottantes | `floating islands drifting above an endless sky` |
| désert et dunes | `arid desert of dunes, sandstone ruins, heat haze` |
| toundra et glace | `frozen tundra, ice fields, aurora on the horizon` |
| marais et tourbières | `peat marshland, black water, reeds and dead trees` |
| forêt profonde | `deep old-growth forest, moss, ferns and giant roots` |
| souterrain et cavernes | `underground caverns, stalactites, mineral glow` |
| bord de mer | `salt-worn coastal town, docks, fishing boats and nets` |
| village pastoral | `pastoral farmland village, fields and dry stone walls` |
| ruines antiques | `ancient overgrown ruins, broken columns, vines` |
| cité verticale | `dense vertical city, stacked rooftops and rope bridges` |

### `epoque` — quand ça se passe · 14

| Libellé | Ce qui part |
|---|---|
| préhistoire | `stone age, bone and flint tools, hide clothing` |
| antiquité | `classical antiquity, bronze weapons and marble` |
| haut moyen âge | `early middle ages, mail and spears, before gunpowder` |
| moyen âge tardif | `late middle ages, plate armour and crossbows` |
| renaissance | `renaissance, early firearms, clockwork and lace` |
| âge de la voile | `age of sail, tall ships, tricorns and flintlocks` |
| révolution industrielle | `industrial revolution, coal smoke, iron and soot` |
| belle époque | `belle époque, gas lamps, wrought iron and velvet` |
| années folles | `roaring twenties, art deco geometry, jazz age` |
| entre-deux-guerres | `interwar period, khaki wool, rivets and canvas` |
| années 80 | `1980s, cathode screens, chrome and plastic` |
| futur proche | `near future, ten years from now, familiar but newer` |
| futur lointain | `far future, millennia ahead, unfamiliar technology` |
| hors du temps | `timeless, no identifiable historical period` |

### `rendu` — comment c'est dessiné · 14

| Libellé | Ce qui part |
|---|---|
| pixel art 8 bits | `8-bit pixel art, very tight palette, chunky pixels` |
| pixel art 16 bits | `16-bit pixel art, SNES era rendering, rich palette` |
| pixel art moderne | `modern high-resolution pixel art, clean colour clusters` |
| dessin animé | `cel-shaded cartoon rendering, flat fills, bold shapes` |
| aquarelle | `watercolour painting, soft bleeding edges, paper grain` |
| gouache | `gouache painting, opaque matte pigment, visible strokes` |
| peinture à l'huile | `oil painting, thick visible brushwork, rich impasto` |
| encre et lavis | `ink and wash, brush lines over grey washes` |
| crayonné | `pencil drawing, graphite hatching, paper texture` |
| vectoriel | `flat vector illustration, crisp geometric shapes` |
| papier découpé | `cut-paper collage, layered flat shapes, soft drop shadows` |
| pâte à modeler | `stop-motion clay look, fingerprint texture, soft edges` |
| rendu 3D stylisé | `stylised 3D render, soft shading, rounded forms` |
| bande dessinée | `comic book rendering, halftone dots, inked linework` |

### `trait` — la ligne et les aplats · 12

| Libellé | Ce qui part |
|---|---|
| contour noir | `solid black outline, one pixel wide` |
| contour brun | `dark brown outline, one pixel wide` |
| contour coloré | `coloured outline, a darker shade of the fill it borders` |
| sans contour | `no outline, shapes read by colour alone` |
| contour sélectif | `selective outline, only around the silhouette` |
| trait épais | `thick bold outline, heavy weight` |
| trait tremblé | `wobbly hand-drawn line, uneven weight` |
| aplats | `flat colour fills, no gradients` |
| ombrage en bandes | `banded cel shading, hard-edged shadow steps` |
| tramé | `dithered shading, checkerboard gradients` |
| dégradés doux | `smooth gradients, blended shading` |
| anti-crénelage manuel | `hand-placed anti-aliasing on curves and diagonals` |

### `eclairage` — la lumière · 12

| Libellé | Ce qui part |
|---|---|
| lumière rasante | `low raking light, long cast shadows` |
| lumière zénithale | `overhead noon light, short hard shadows` |
| contre-jour | `backlight, rim-lit silhouette, dark front` |
| heure dorée | `golden hour, warm low sun, long amber shadows` |
| clair de lune | `moonlight, cool blue key light, deep shadows` |
| lumière d'orage | `stormlight, heavy overcast broken by sharp flashes` |
| lumière de torche | `flickering torchlight, warm pooled glow, dark falloff` |
| néon | `neon lighting, saturated coloured glow on wet surfaces` |
| lumière de forge | `forge light, hot orange glow from below` |
| brume basse | `thick low-lying fog, volumetric haze` |
| lumière sous-marine | `underwater light, caustics and blue depth falloff` |
| lumière plate | `flat even light, no directional shadow` |

**70 paires, cinq cases.** `vue` et `technique` en ont zéro, et c'est écrit plus haut.

---

## Comment on en ajoute une

Une paire entre dans ce fichier quand elle passe **les trois tests** :

1. **Elle nomme quelque chose de visible.** *brume basse* décrit une image ; *ambiance
   mystérieuse* décrit une impression, et deux modèles la rendront de deux façons.
2. **Elle est reconnue sans être expliquée.** Le libellé français doit se comprendre seul dans
   une liste de vingt — c'est le seul texte que l'auteur lira en cliquant.
3. **Elle ne rejoue pas une autre case.** *vue de dessus* n'entre pas dans `monde` : la vue
   est un réglage, deux étapes plus haut, avec une vignette.

Et **elle est écrite en anglais pour une machine, pas pour un lecteur** : des noms de choses,
séparés par des virgules, sans phrase, sans verbe, sans superlatif. `thick low-lying fog,
volumetric haze` — pas `the scene should feel misty and mysterious`.
