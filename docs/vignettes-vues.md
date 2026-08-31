# Les huit vignettes de vue — consignes de production

*Ce document produit les huit premières des dix-sept vignettes d'exemple annoncées dans
`docs/PLAN.md`, § « Trois choses à produire avant que le code commence ». Elles servent
l'étape 2 de l'assistant de démarrage (`docs/maquettes-v2.1/06ter-assistant-demarrage.html`,
§ 03), où l'auteur choisit **la vue de son jeu sur des images, pas sur des mots**.*

Ce ne sont pas des illustrations : ce sont des **instruments de comparaison**. Elles ne
valent que si elles montrent le même personnage, dans la même pose, sous huit caméras
différentes — et que si l'on voit d'un coup d'œil ce qui les sépare deux à deux.

---

## Le personnage de référence

Un petit voyageur encapuchonné : capuche et cape vert sarcelle sombre, tunique moutarde,
sac de cuir brun avec un tapis roulé sur le dessus, bottes brunes, visage simple à deux
points. Il est fixé par une image de référence, **jointe à chacune des huit demandes**.
On ne le redessine jamais : on le reprojette.

L'image de référence de travail est celle produite le 31 août 2026 pour la vue
isométrique, sur fond transparent.

## Les quatre repères qui se lisent sur les huit images

Tout le contenu des consignes tient à ces quatre-là. Chaque bloc dit exactement combien on
en voit — ni plus, ni moins.

| Le repère | Ce qu'il apprend au lecteur |
|---|---|
| **Le visage** | la hauteur de la caméra : entier de face, réduit sous la capuche quand elle monte, absent à la verticale |
| **Le sac** | l'orientation du corps : invisible de face, entier de profil, en bosse au-dessus des épaules quand on plonge |
| **La lanterne** | le côté : elle est dans la main **gauche** et se lit **toujours dans la moitié droite du cadre**, sur les huit |
| **La dalle** | la projection : bande fine, rectangle écrasé, carré plein, parallélogramme ou losange |

Deux invariants tiennent la famille entière, et une image qui les enfreint est à refaire :

1. **La lanterne est toujours dans la moitié droite** du cadre, dégagée de la silhouette.
2. **Le sac ne se pose jamais à droite du corps**, à hauteur de hanche, là où vit la
   lanterne — il est caché, à gauche, ou au-dessus. *Au-dessus* est le cas des caméras
   hautes : le tapis roulé y déborde des deux côtés de la capuche, et c'est normal.

C'est pour tenir le second que la vue oblique fuit vers le **haut-gauche** et non vers le
haut-droit : dans l'autre sens, le sac viendrait se poser là où vit la lanterne.

## Ce que chaque vue vaut, par ailleurs

Ces colonnes sont celles de l'étape 2 de l'assistant ; la consigne anglaise est celle que le
choix écrit dans la case *vue*, lue dans `atelier/domaine/vue.py` — la liste `VUES`, qui en est
la seule source.

| Identifiant | Libellé | Des jeux qui l'emploient | Images par pose | La consigne écrite |
|---|---|---|---|---|
| `vue-face-fixe` | De face, fixe | les écrans de combat au tour par tour | 1 | *(aucune)* |
| `vue-dessus-verticale` | De dessus, verticale | les jeux de tir à défilement vertical | 1 | *(aucune)* |
| `vue-cote-plateforme` | De côté — plateforme | Mario, Celeste, Hollow Knight | 2 | `facing right, side view` |
| `vue-cote-defilement` | De côté — défilement | les jeux de baston de rue | 2 | `facing right, side view` |
| `vue-dessus-stricte` | De dessus, stricte | le premier Zelda, Hotline Miami | 4 | `facing south, toward the viewer` |
| `vue-dessus-34` | De dessus, 3/4 | Zelda A Link to the Past, Stardew Valley | 4 ou 8 | `facing south, toward the viewer` |
| `vue-oblique` | Oblique (cavalière) | Ultima, EarthBound | 4 | `facing south, oblique projection` |
| `vue-isometrique` | Isométrique | Diablo 2, Age of Empires 2 | 4 ou 8 | `facing south, isometric three-quarter view` |

---

## Le mode d'emploi

Une demande = **le préambule, puis un seul bloc de caméra**, l'image de référence jointe.
Une image à la fois. Jamais une planche de huit : les cases du bas y sont bâclées.

---

## PRÉAMBULE — en tête des huit demandes

```
Pixel-art sprite illustration for a small user-interface thumbnail. Generate ONE image only.

REFERENCE
An image is attached. Keep the character exactly as it is drawn there: same design, same
proportions, same palette, same shading, same amount of detail, same outline treatment. Do
not restyle it, do not add ornaments, do not change a single colour. You are not redrawing
the character — you are re-projecting the same character under a different camera.
The character is a small hooded traveler: dark teal hood and cape, mustard tunic, brown
leather backpack with a rolled bedroll on top, brown boots, plain face with two dot eyes.
KEEP EVERYTHING FROM THE ATTACHED IMAGE EXCEPT ITS CAMERA. The attached image was drawn
under one particular camera, and that camera is the wrong one for every block but its own.
Do not let it pull the drawing back toward the angle it happens to be drawn at. The block
below overrides it completely.

POSE — identical in all eight images
Standing still at rest. Arms hanging down, feet together, head level. No walking, no
gesture, no head tilt, no expression, no equipment other than the backpack and the lantern.

THE FOUR TELLS — this is what the image exists for
The face, the backpack, the lantern and the floor tile are what tell the viewer where the
camera stands. The block below states exactly how much of each one is seen. Draw them
exactly as stated: not more, not less.
- The backpack is on the BACK. It NEVER appears beside the body in the right half of the
  frame at hip height, where the lantern hangs. When the camera is high enough to look down
  on the tops of the shoulders, the pack may straddle the TOP of the silhouette and show on
  both sides of the hood — that is the only case, and it is stated in the block that needs it.
- The lit brass lantern is in the LEFT hand. It ALWAYS reads in the right half of the
  frame, clear of the body silhouette, at hip height.

STYLE — identical in all eight images
Flat pixel art, about 12 colours, no gradients, no anti-aliasing, no glow, no bloom, no
texture, no rendering effect. Orthographic drawing: NO perspective convergence anywhere,
in any image. Parallel edges stay parallel, far edges keep the same length as near edges,
nothing tapers with distance.

FRAME — identical in all eight images
Square image, 1024 x 1024. Truly transparent alpha background: not a white fill, not a
light grey fill, not a checkerboard pattern drawn as pixels. Nothing in the frame but the
character and its single floor tile — no scenery, no props, no second light source, no cast
shadow, no contact shadow, no text, no label, no border, no watermark.
THE FLOOR TILE IS NOT OPTIONAL AND IT IS NOT SCENERY. It is one of the four tells, and it
is the one that carries the projection: an image without it does not say which camera drew
it. Every block below states its exact shape. Draw it, every time, in every view.
The drawing — character plus floor tile — is centred and fills about 70% of the frame in
its LONGEST direction, whichever direction that turns out to be. When the camera is high
the silhouette is short and wide, and it is then the WIDTH that reaches 70%: never stretch
a squashed figure back to full height in order to fill the frame. The floor tile never
touches the edges: leave at least 10% of empty transparent margin on all four sides.
The whole image must stay readable when scaled down to 70 x 70 pixels: large shapes,
nothing thinner than 2 pixels.

WORDING RULE
The words "three-quarter" and "3/4" never describe the body's rotation in these images. The
body faces the direction stated below, and only the camera moves.

CAMERA FOR THIS IMAGE
```

---

## 1 · `vue-face-fixe` — De face, fixe

```
Elevation: 0 degrees. The camera sits exactly at the character's chest height.
Body: square to the screen, facing the viewer. No rotation.

VISIBLE
- The whole face, centred under the hood rim, both dot eyes level and evenly spaced.
- The front of the cape, the front of the tunic, the belt.
- Both boots side by side, their soles at the same height.
- The lantern hanging from the left hand, in the RIGHT half of the frame, fully clear of
  the body silhouette.

NOT VISIBLE
- The backpack: nothing of it. No strap, no bedroll, no bulge above the shoulders. At most
  a one-pixel edge of the cape showing past each side of the body.
- No top surface anywhere in the image: not the top of the hood, not the tops of the
  shoulders, not the top face of the floor tile.
- No foreshortening: the body keeps its full standing height.

FLOOR TILE
Seen exactly edge-on, as a plain horizontal band under the boots: its height is at most one
twentieth of its width. A line, not a slab. No top face, no side thickness, no texture.

CHECK: the whole face is readable and not one pixel of the backpack is visible.
```

## 2 · `vue-dessus-verticale` — De dessus, verticale

```
Elevation: 90 degrees. The camera is directly overhead, pointing straight down at the top
of the head.
Body: facing the BOTTOM of the screen.

VISIBLE
- The top of the hood, as a rounded dome occupying the middle of the silhouette.
- The rolled bedroll of the backpack, seen from above as a horizontal cylinder along the
  TOP edge of the whole silhouette.
- The tops of both shoulders and the cape spreading left and right of the hood.
- The two hands appearing at the lower left and lower right of the cape.
- The lantern below the right hand, in the RIGHT half of the frame, seen from above as a
  small bright square.
- The very tips of both boots, as two small stubs peeking out below the cape.

NOT VISIBLE
- The face: nothing of it. No eyes, no chin, no neck, no hood rim opening.
- The front of the tunic, the belt, the legs.
- The side of the hood or the side of the body.

FLOOR TILE
A perfect full square, seen flat, its four edges parallel to the frame edges. Same length on
all four sides. No thickness, no side face.

CHECK, three things, all three required: NO FACE AT ALL; the bedroll is the topmost thing in
the silhouette; and the square floor tile IS DRAWN, its four edges parallel to the frame.
```

## 3 · `vue-cote-plateforme` — De côté, plateforme

```
Elevation: 0 degrees. The camera sits at the character's chest height.
Body: strict profile, facing the RIGHT edge of the frame. Rotated exactly 90 degrees.

VISIBLE
- Exactly one eye, on the right side of the head.
- The profile of the hood, and the profile line of the nose area under its rim.
- The backpack in full profile, entirely behind the back, in the LEFT part of the
  silhouette, with the bedroll along its top.
- The near boot in full, and the far boot just behind it, drawn one shade darker.
- The lantern in the left hand, which is the ARM ON THE FAR SIDE of the body: draw that arm
  swung slightly forward so the lantern hangs clear of the chest, in the RIGHT half of the
  frame. Draw that arm one shade darker than the near arm.

NOT VISIBLE
- The second eye. The front of the face. Both cheeks at once.
- Any top surface: not the top of the hood, not the tops of the shoulders, not the top face
  of the tile.
- The chest seen frontally: the body must read as a pure silhouette from the side.

FLOOR TILE
Seen exactly edge-on, as a plain horizontal band under the boots: its height is at most one
twentieth of its width. No top face, no side thickness.

CHECK: one eye only, the backpack complete on the left, the lantern clear on the right.
```

## 4 · `vue-cote-defilement` — De côté, défilement

```
Elevation: 0 degrees. The camera sits at the character's chest height.

Body: START FROM THE STRICT SIDE VIEW, then turn the body only 25 degrees back toward the
viewer. **This is a side view that has been opened slightly, NOT a front view that has been
turned slightly.** The body stays about 65 degrees away from square to the screen, and the
walking direction stays unmistakably to the RIGHT. Concretely: the two boots are never side
by side at the same height — the far one is set back, behind and slightly to the left of the
near one — and the shoulders are never level, the near one being clearly wider and lower.

VISIBLE
- Both eyes, the far one partly cut by the hood rim, both pushed toward the right side of
  the head.
- Part of the chest and both shoulders, the far shoulder narrower than the near one.
- The backpack partly showing past the LEFT edge of the body, bedroll visible above it.
- Both boots, the far one set back and one shade darker.
- The lantern in the left hand — again the far arm — held forward and low, in the RIGHT
  half of the frame, clear of the body. That arm is one shade darker.

NOT VISIBLE
- Any top surface: no top of the hood, no tops of the shoulders, no top face of the tile.
- A body square to the screen: this is NOT a front view. If both eyes are evenly spaced and
  the chest is symmetrical, the image is wrong.

FLOOR TILE
Seen almost edge-on, as a horizontal band under the boots: its height is about one tenth of
its width — visibly taller than the strict profile's band, and nothing more.

CHECK: two eyes, but the body still clearly heads to the right.
```

## 5 · `vue-dessus-stricte` — De dessus, stricte

```
Elevation: 70 degrees — very nearly straight down, only 20 degrees short of overhead. This
is the camera of the original Legend of Zelda and of Hotline Miami. It is NOT the 45 degree
camera: if the result could pass for a 45 degree view, the image is wrong.
Body: square to the screen, facing the BOTTOM of the screen. No rotation to either side.

THE SILHOUETTE, TOP TO BOTTOM — this is the plan of the drawing
At this angle the standing body collapses to about ONE THIRD of its standing height, so the
head is most of what is left. Build the silhouette in these proportions:
- the top of the hood and the bedroll: the upper HALF of the whole silhouette;
- the shoulders and the arms, seen from above as lit horizontal planes: the next THIRD;
- the boots: two small stubs in the bottom SIXTH.
The silhouette is therefore WIDER THAN IT IS TALL. If it is taller than it is wide, the
camera has not been raised enough and the image is wrong.

VISIBLE
- The top of the hood, dominating the head.
- The face reduced to a narrow band under the hood rim: both dot eyes still present, small,
  low, squeezed against the bottom edge of the hood.
- The top surfaces of both shoulders, read as lit horizontal planes.
- The backpack as a wide bulge behind and above the shoulders, its bedroll clearing the top
  of the silhouette on both sides of the hood.
- Both boots as two small stubs at the very bottom, seen mostly from above.
- The lantern in the left hand, in the RIGHT half of the frame, seen mostly from above.

NOT VISIBLE
- The chin, the neck, the front of the tunic below the belt: they are foreshortened away.
- The legs: there are no legs at this angle, only boots directly under the cape.
- Any vertical face on the floor tile.

FLOOR TILE
A square seen from that same steep angle: a flat rectangle THREE times wider than it is
tall. Top and bottom edges perfectly horizontal AND exactly the same length. Side edges
vertical and exactly the same length. No taper, no thickness, no diamond.

CHECK, three things, all three required: the silhouette is WIDER THAN IT IS TALL; the boots
are two stubs with no legs above them; and the flat wide floor tile IS DRAWN under them. An
image with no floor tile is not finished — the tile is what tells the viewer which camera
this is.
```

## 6 · `vue-dessus-34` — De dessus, 3/4

```
Elevation: 45 degrees. The camera is high above, looking down.
Body: square to the screen, facing the BOTTOM of the screen. NOT rotated to the left or to
the right, at all.

VISIBLE
- The top of the hood, taking about the upper third of the head's height.
- The face in the LOWER half of the head, tucked under the hood rim, both dot eyes readable.
- The top surfaces of both shoulders, as lit horizontal planes.
- The backpack as a rounded bulge rising above and behind both shoulders, bedroll visible.
- The body vertically compressed to about two thirds of its standing height: short legs,
  boots reading as small stubs low in the silhouette.
- The lantern in the left hand, in the RIGHT half of the frame.

NOT VISIBLE
- A face as large and as frontal as in an eye-level view: if the head reads like the
  face-on thumbnail, the camera has not been raised and the image is wrong.
- Any rotation of the body: no shoulder nearer than the other, no cheek wider than the
  other.
- Any diamond, any taper, any vanishing point.

FLOOR TILE
A square seen from that same angle: a flat rectangle TWICE as wide as it is tall. Top and
bottom edges perfectly horizontal AND exactly the same length. Side edges vertical and
exactly the same length. No taper, no visible thickness, no diamond.

CHECK, three things, all three required: the tops of both shoulders AND the face are
readable in the same image — this is the only view where both are true; the body is
visibly squashed, not standing at full height; and the wide flat floor tile IS DRAWN under
the boots.
```

## 7 · `vue-oblique` — Oblique (cavalière)

```
Projection: parallel oblique — the CAVALIER projection of technical drawing, the one Ultima
and EarthBound use to draw their rooms, their crates and their walls. No vanishing point,
no convergence, no size reduction with distance.

THE ONE RULE, AND IT APPLIES TO EVERYTHING IN THE IMAGE
Draw the face-on eye-level view first. Then take every part of the drawing that lies BEHIND
the frontal plane and slide it UP AND TO THE LEFT along one single axis at exactly 45
degrees, at its FULL length — nothing shrinks with distance. Surfaces facing the viewer
keep their true shape and size; depth becomes that one slanted direction and nothing else.
Every horizontal surface therefore becomes the SAME parallelogram, tilted the same way by
the same amount: the floor tile, the top of the hood, the tops of the shoulders, the top of
the bedroll. They are ALL drawn, and they are ALL parallel to each other. This is not a
raised camera: nothing is seen from above by tilting the view, things read as horizontal
because their depth slides up-left.
Body: square to the screen, facing the viewer. Not rotated.

VISIBLE
- The whole face, centred, both dot eyes level — identical in size, shape and framing to
  the face-on eye-level view. The face is a frontal surface, so it is not distorted at all.
- The front of the tunic, the belt, both boots side by side — likewise undistorted.
- The top of the hood, as a small parallelogram sliding up and to the LEFT off the front of
  the hood.
- The backpack showing past the shoulders UP AND TO THE LEFT on that same axis, bedroll
  visible. It sits behind the body, so it slides; that slide is the only reason it can be
  seen at all.
- The lantern in the left hand, in the RIGHT half of the frame.

NOT VISIBLE
- Any convergence: two parallel edges must stay parallel across the whole image.
- Any foreshortening of the depth axis: a far edge is exactly as long as the near one.
- Any rotation of the body: no turned shoulder, no cheek wider than the other. If the
  figure is seen from a corner, this has become the isometric view and the image is wrong.
- A floor tile drawn as a flat horizontal bar under the boots. That is the face-on view,
  and it is wrong here: the tile MUST be a parallelogram.

FLOOR TILE — draw it corner by corner, in this order
1. A horizontal edge under the boots, from a point A on the left to a point B on the right.
2. From A, a straight line going UP AND TO THE LEFT at exactly 45 degrees, ending at C.
3. From B, a straight line going UP AND TO THE LEFT at exactly 45 degrees, THE SAME LENGTH
   as A-C, ending at D.
4. Close it: the edge C-D is horizontal and EXACTLY AS LONG as A-B.
The result is a parallelogram — a leaning rectangle. It is flat, with no visible side
thickness. It is NOT a trapezoid: if the far edge is shorter than the near edge, that is
perspective, which this projection does not have, and the image is wrong. It is NOT a
symmetrical shape either: both side edges lean the SAME way, to the left, never one to the
left and one to the right.

CHECK: the face reads exactly like the face-on thumbnail, AND the tile is a slanted
parallelogram, AND the top of the hood, the bedroll and the tile all slant the same way.
```

## 8 · `vue-isometrique` — Isométrique

```
Projection: parallel isometric, no vanishing point, no convergence, no size reduction with
distance.
Elevation: 30 degrees above the horizon.
Body: rotated 45 degrees, facing the LOWER-RIGHT corner of the frame — seen from a corner,
never square to the screen.

VISIBLE
- The face turned toward the lower right: both dot eyes, the near cheek wider than the far
  one, the hood rim cutting across at a slight angle.
- The top of the near shoulder, and the near side of the body, both nearer the lower right.
- The backpack past the FAR shoulder, in the upper LEFT of the silhouette, bedroll visible.
- Both boots, the near one lower and further right than the far one.
- The lantern in the left hand, in the RIGHT half of the frame, held clear of the body.

NOT VISIBLE
- A body square to the screen: if both shoulders are at the same height and the face is
  symmetrical, the image is wrong.
- Any vanishing point, any convergence, any perspective.
- Any visible thickness or side face on the floor tile.

FLOOR TILE
A diamond: exactly TWICE as wide as it is tall, its long axis horizontal, one corner at the
left, one at the right, one at the top, one at the bottom. All four edges exactly the same
length. Flat, no side thickness, no slab.

CHECK: the tile is a diamond and the body is seen from a corner.
```

---

## La recette, en une ligne par vue

| Vue | La question qui tranche |
|---|---|
| De face, fixe | voit-on tout le visage et **rien** du sac ? |
| De dessus, verticale | le visage a-t-il complètement disparu ? |
| De côté — plateforme | un seul œil, et le sac entier de profil ? |
| De côté — défilement | deux yeux, mais le corps part-il toujours vers la droite ? |
| De dessus, stricte | la silhouette est-elle **plus large que haute** ? |
| De dessus, 3/4 | le dessus des épaules **et** le visage, en même temps ? |
| Oblique (cavalière) | visage de face, et la dalle **et** le dessus de la capuche penchés du même biais ? |
| Isométrique | dalle en losange, corps vu par le coin ? |

Les paires à surveiller sont **1 et 6** — la caméra remonte-t-elle vraiment —, **3 et 4** —
le corps reste-t-il tourné vers la droite —, et **6, 7, 8** — trois dalles qui doivent être
trois formes franchement différentes.

## Où en est la production — contrôle du 1er septembre 2026

Les neuf tailles sont faites, les huit vues existent. Cinq sont bonnes ou récupérables sans
rien repayer, deux sont à refaire, une n'a jamais appliqué sa projection.

**Le détourage mange les dalles des vues du dessus, et c'est mesuré.** Trois images — de
dessus verticale, de dessus stricte, de dessus 3/4 — portent encore leur dalle *dans les
couleurs du fichier*, avec une transparence à zéro : le dessin est là, il a été effacé après
coup. Les comptes sont sans ambiguïté — quatre-vingt-six mille, cinquante-neuf mille et
trente-et-un mille pixels de sol rendus invisibles, contre un ou deux milliers sur les
autres, ce qui n'est que le bord adouci d'une dalle intacte.

La cause est de forme, pas de hasard. **Une dalle vue de côté est un trait sous les bottes,
collé à la silhouette ; une dalle vue de dessus est une surface autour des pieds.** Un
détourage qui garde *le sujet* garde la première et jette la seconde — elle ne fait pas
partie du personnage, elle l'entoure. Les vues qui ont conservé leur sol sont exactement
celles où il touche les bottes.

**Ce qui suit de ça : on ne regénère pas une dalle effacée, on rouvre la recette.** Sur ces
trois images, un détourage à la pipette sur le blanc garde le sol ; le détourage au modèle le
supprime. C'est gratuit et ça se défait d'un clic dans la table.

| La vue | Où elle en est |
|---|---|
| De face, fixe | **bonne** — visage entier, pas un pixel de sac, dalle en trait fin sous les bottes. Refaite le 1er septembre, et cette fois à la bonne résolution |
| De dessus, verticale | **dalle à récupérer** — aucun visage, tapis en tête de silhouette, mains et bouts de bottes : le contrat est tenu, et le carré du sol est dans le fichier, effacé |
| De côté — plateforme | **bonne** — un seul œil, sac entier de profil à gauche, lanterne dégagée à droite, trait de sol présent |
| De côté — défilement | **à refaire** — le corps est toujours de face après reprise. Deux yeux régulièrement espacés, torse symétrique, bottes côte à côte à la même hauteur : c'est précisément ce que le bloc déclare faux. Et les bottes sont rognées par le bord bas |
| De dessus, stricte | **dalle à récupérer, et un cran de caméra** — la dalle dessinée est un rectangle plat trois fois plus large que haut, exactement ce qui était demandé, et elle est effacée. Reste que la silhouette est encore 1,15 fois plus haute que large : la caméra n'est pas montée jusqu'au bout |
| De dessus, 3/4 | **dalle à récupérer** — capuche, visage lisible bas, sac au-dessus des épaules, corps écrasé : tout y est, le sol compris, mais effacé |
| Oblique (cavalière) | **à refaire** — c'est la vue de face avec un sac à gauche. Rien ne penche : le dessus de la capuche n'est pas dessiné, le tapis ne glisse pas en biais, et la dalle est un trapèze symétrique qui rétrécit vers le fond, c'est-à-dire de la perspective — la seule chose que cette projection n'a pas |
| Isométrique | **bonne** — sac par-dessus l'épaule éloignée, dalle posée. Le corps gagnerait à être vu davantage par le coin |

## Les deux blocs qui ne sortaient rien, et pourquoi

*Signalé par l'auteur le 31 août 2026 : « De dessus, stricte » et « Oblique (cavalière) »
ne donnaient pas l'image attendue, après plusieurs essais chacune. Réessayer ne pouvait pas
aider — dans les deux cas la consigne demandait une image impossible à satisfaire telle
qu'elle était écrite.*

**De dessus, stricte — le cadrage général contredisait la vue.** Le préambule exigeait un
personnage « occupant environ 70 % de la hauteur du cadre ». Or à cette caméra-là le corps
s'écrase à un tiers de sa hauteur debout : obéir aux deux revient à regrandir la silhouette
jusqu'à ce que l'écrasement ne se voie plus. Le modèle abandonnait alors l'écrasement — la
consigne la moins précise des deux — et rendait la vue à 45°, c'est-à-dire une copie du
bloc voisin. Le bloc n'énonçait d'ailleurs jamais l'écrasement en chiffre, seulement comme
une négation : *pas la hauteur debout*. Le bloc de 45°, lui, dit « deux tiers », et c'est
celui qui sortait juste. **Un modèle suit une mesure ; il ignore la négation d'une quantité
qu'on n'a pas donnée.** Les 70 % du cadre valent maintenant sur la plus grande dimension
quelle qu'elle soit, l'écrasement est chiffré, et le test tient en une question binaire :
la silhouette est-elle plus large que haute ?

**Oblique (cavalière) — le bloc interdisait ce qu'il réclamait trois lignes plus bas.** Il
écrivait « aucune surface n'est vue de dessus », puis demandait une dalle en
parallélogramme — qui est très exactement une surface horizontale vue de dessus. Dans une
projection cavalière, ou bien toutes les surfaces horizontales se penchent, ou bien aucune :
on ne peut pas garder la dalle et refuser le dessus de la capuche. Le modèle appliquait
l'interdiction, aplatissait la dalle avec le reste, et rendait la vue de face avec une barre
sous les bottes. Une seconde contradiction poussait dans le même sens : le sac devait se
voir alors que le corps est de face, position où le bloc « De face, fixe » exige qu'on n'en
voie *pas un pixel* — le seul moyen de tenir les deux est de tourner le corps, et l'image
devenait une isométrique ratée. La règle cavalière est maintenant énoncée une fois et
s'applique à tout ce qui est horizontal, et le sac se voit parce qu'il glisse, pas parce
que le corps a pivoté.

**Et une cause commune aux deux.** L'image de référence jointe est l'isométrique : sa
propre caméra tire chaque génération vers l'isométrie, et ce sont les deux vues les plus
éloignées d'elle qui en souffrent le plus. Le préambule demandait de garder le personnage
sans dire de jeter sa caméra ; il le dit maintenant.

**Et si l'oblique résiste encore, elle ne se génère pas : elle se monte.** C'est la seule
des huit dont le corps doit être *identique* à une autre — la vue de face —, et dont la
seule différence tient dans une dalle de quatre segments droits et un tapis roulé décalé en
biais. Repartir de `vue-face-fixe.png`, poser le parallélogramme à la main dans l'atelier et
glisser le tapis vers le haut-gauche donne le résultat juste du premier coup, sans appel
payant, et garantit le contrôle que la vue existe pour tenir : *la tête se lit exactement
comme celle de la vue de face*. Un modèle qui produit une dalle en fuite à chaque essai
coûte plus cher que quatre traits.

## Ce que l'application en fait

Les huit blocs sont des chaînes stables : l'assistant les concatène derrière le préambule
pour reproduire une vignette manquante, et l'identifiant de chaque vue (`vue-dessus-34`…)
est celui du réglage enregistré sur le projet.

**Les noms de fichier ne sont pas libres.** L'écran va chercher `/vignettes/<nom>.png` et
n'affiche « pas encore dessinée » que parce qu'il ne l'a pas trouvé — un fichier bien
dessiné mais mal nommé ne se distingue pas d'un fichier absent
(`interface/src/composants/Assistant.tsx`, le composant `Vignette`). Les dix-sept vont
toutes dans `interface/public/vignettes/`, et voici les dix-sept noms, à la lettre :

| Ce qu'elle montre | Le fichier attendu |
|---|---|
| De face, fixe | `vue-face-fixe.png` |
| De dessus, verticale | `vue-dessus-verticale.png` |
| De côté — plateforme | `vue-cote-plateforme.png` |
| De côté — défilement | `vue-cote-defilement.png` |
| De dessus, stricte | `vue-dessus-stricte.png` |
| De dessus, 3/4 | `vue-dessus-34.png` |
| Oblique (cavalière) | `vue-oblique.png` |
| Isométrique | `vue-isometrique.png` |
| Les neuf tailles | `taille-8.png`, `taille-16.png`, `taille-24.png`, `taille-32.png`, `taille-48.png`, `taille-64.png`, `taille-96.png`, `taille-128.png`, `taille-256.png` |

Ni espace, ni accent, ni `128x128` : c'est l'identifiant de la vue tel qu'il est écrit dans
`atelier/domaine/vue.py`, et pour les tailles le mot `taille`, un tiret, le nombre seul.
