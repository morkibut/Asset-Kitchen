# Asset Kitchen — Design System

> Écrit le 26 août 2026. Ce document fait foi sur **l'apparence** — et sur rien d'autre. Ce que
> fait un écran est tranché par `docs/PRD.md` ; comment c'est construit, par
> `docs/ARCHITECTURE.md`. Spécimen vivant : `docs/design-preview.html`.

---

## Product Context

- **Quoi** : atelier personnel de production d'assets 2D pour jeu. On définit l'univers d'un jeu une fois, on fabrique au cas par cas ce qui lui appartient. Voir `docs/PRD.md` § Solution.
- **Pour qui** : une personne — l'auteur du jeu, qui est aussi l'auteur de l'outil. Il juge la qualité à l'œil, mieux et plus vite qu'une machine, et n'a aucune envie qu'on la juge à sa place.
- **Espace** : outils de production créative à forte densité — Lightroom, Aseprite, Blender, Linear. Référence d'ergonomie explicite du projet : SpriteCook (`screen_spritecook/`, 30 captures).
- **Type** : **outil interne de production**. Ni site marketing, ni produit grand public. Aucune page d'accueil, aucun tunnel, aucun assistant.
- **Memorable thing** : *la table lumineuse* — le châssis est muet, les assets sont la seule chose colorée à l'écran.

**Écran large uniquement** — tranché par `docs/PRD.md` § Décisions d'implémentation, construit
par `docs/archi-versions.md` §6.2. La seule chose que ce document ajoute est la conséquence
d'apparence : **aucune media query, aucune valeur de repli, aucun style alternatif**. Les
largeurs de colonnes du § Layout sont donc absolues et sans condition.

---

## Aesthetic Direction

- **Direction** : **Brutally Minimal** pour le châssis, **Industrial / Utilitarian** pour la densité. La typographie et l'espace font tout le travail ; la densité est celle d'un instrument, pas d'une page.
- **Décoration** : **minimal**. Aucun dégradé, aucune ombre décorative, aucune icône illustrative, aucun coin arrondi de confort. **Une seule texture dans tout le produit — le damier alpha**, et elle est fonctionnelle : elle révèle la transparence d'un sprite détouré.
- **Mood** : froid, sec, silencieux. L'interface se retire pour que l'image passe devant. Le produit ne cherche jamais à être joli à côté du contenu — il cherche à disparaître derrière lui.
- **Références** : SpriteCook pour la fluidité du geste (prompt au-dessus de la grille, réglages dans un panneau) ; Lightroom et Aseprite pour la neutralité chromatique du châssis ; Linear pour la densité et la sobriété des états.

**Le principe unique dont tout découle** : *chaque décision retire une concurrence à la grille.*
Le froid retire la concurrence chromatique. Le rayon 0 retire la concurrence de forme. Le
monospace sur les mesures retire l'ambiguïté entre un fait et un libellé. L'absence de mouvement
retire la concurrence d'attention.

**Ce qui est écarté, et pourquoi** — la maquette `docs/maquette-atelier.html` du 26 août 2026 :
châssis ambre sur charbon (entre en concurrence avec le pixel art, qui sature déjà les ors et les
bruns), `system-ui` en display et en body (aucune décision typographique), et un châssis qui
exhibe le cadrage au lieu de servir le geste.

**Et la seule exception que ce document accorde : la grille montre, la toile range — et ranger est
un geste de châssis.** Écrite le 28 août 2026, après huit corrections qui allaient toutes dans le
même sens. Sur la grille d'assets, rien ne concurrence l'image : c'est là qu'on **juge**, et le
principe ci-dessus y vaut sans réserve. Sur la toile, il n'y a rien à juger — les images y sont
déjà retenues, on ne fait que les **placer** —, donc ce qui porte le geste a le droit de se voir :
les prises permanentes, le bandeau plein d'un îlot, les dix teintes lisibles.

L'exception est bornée à cette surface et elle s'écrit ici pour une raison précise : sans elle, la
prochaine relecture de ce document rendra la toile au silence en croyant appliquer la règle, et
rouvrira les huit points un par un. Une exception non écrite n'est pas une exception, c'est une
contradiction en attente.

---

## Typography

Trois familles, **trois rôles étanches**. Aucune ne sort de son rôle.

| Rôle | Police | Poids | Rationale |
|---|---|---|---|
| **Display** | **Instrument Serif** | 400, italique 400 | Le seul endroit où l'outil a un visage. Contraste total avec le pixel art et le monospace : la paire lit comme un choix, pas comme un défaut. |
| **Body** | **Instrument Sans** | 400 / 500 / 600 | Grotesque légèrement étroit : à densité égale il tient plus de français par ligne que Geist ou Source Sans, et les diacritiques restent nettes à 11 px. Même fonderie que le display. |
| **Data** | **JetBrains Mono** | 400 / 500 | `tabular-nums`, zéro barré, très lisible à 9,5 px. Porte **toute mesure**. |
| **Code** | **JetBrains Mono** | 400 | Une seule mono dans le produit : moins de fonte à charger, et le code est rare (payloads MCP, descriptif d'export). |

**Chargement** :

```
https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap
```

### Les deux règles d'emploi

**1 — Instrument Serif ne descend jamais sous 24 px, et n'entre jamais dans un contrôle.**
Trois usages seulement : le nom du produit dans la barre de tête (17 px, l'unique exception),
les titres d'écran, et les états vides. « Ta bibliothèque est vide. *Écris.* » en serif est une
invitation ; en sans, c'est un message d'erreur. Trois usages de trop et le produit bascule en
blog.

**Le Guide n'en ouvre pas un quatrième**, et c'est le refus qui vaut d'être noté : l'écran de
prose du produit garde son titre en serif — c'est un titre d'écran, le deuxième emploi — mais
ses titres de section sont en **sans 12,5 px majuscules**, la forme de l'en-tête de panneau.
Un sous-titrage en serif de 24 px sur la seule page de texte long est très exactement le
basculement que cette règle annonce (§ L'écran Guide).

**2 — Toute mesure est en JetBrains Mono, partout.** Coût réel, dimensions mesurées, taille de
pixel, nombre de références, compteur de l'agent, plafond, horodatage, durée. Dans ce produit un
nombre est toujours un fait mesuré, jamais un libellé — et les mesures deviennent scannables
comme une colonne même là où elles n'en forment pas une : sur une tuile, dans la fiche, dans la
barre d'état, dans le journal du projet. Corollaire : `font-variant-numeric: tabular-nums`
systématique, virgule décimale, espace fine avant l'unité (`4 px`, `$0,067`, `64×64`).

### Échelle

| px | Famille | Usage |
|---|---|---|
| 8,5 | mono | pastille d'état sur une tuile |
| 9,5 | mono | méta de tuile, en-tête de panneau (majuscules, `letter-spacing .11em`), en-tête de tableau |
| 10 | mono | barre d'état, pied de prompt, compteur d'arbre, raison sous un contrôle grisé, erreur de champ |
| 11 | mono / sans | valeur en fiche · libellé de réglage |
| 11,5 | sans | nom de tuile, bouton de segment, ligne de recette |
| 12 – 12,5 | sans | arbre, onglets, corps de tableau, bandeau |
| 13 | sans | bouton, champ |
| 13,5 | sans | le champ de prompt |
| 14 – 15 | sans | prose longue, nom en fiche |
| 17 | serif | nom du produit |
| 24 – 32 | serif | titre d'écran, état vide |
| 44 – 64 | serif | état vide plein écran |

---

## Color

**Approche : restrained.** Un seul accent, des neutres froids, des sémantiques sourdes.

**Le raisonnement, qui n'est pas une question de goût** : le pixel art de fantasy sature les
verts, les bruns, les ors et les pierres. Un châssis chaud entre en concurrence directe avec ce
qu'on lui demande de juger — et un fond clair remonte la luminance d'entourage, ce qui fausse le
contraste perçu d'un sprite. Le châssis est donc **sombre et froid par nécessité optique**.

### Le châssis

| Token | Hex | Usage |
|---|---|---|
| `--fond-0` | `#0B0D10` | la table — zone de grille, le plus profond de l'écran |
| `--fond-1` | `#111419` | panneaux, barre de tête, barre d'état |
| `--fond-2` | `#171B21` | champs, tuiles, cartes |
| `--fond-3` | `#1E242B` | survol, élément actif de l'arbre |
| `--bord` | `#252B33` | séparation par défaut, 1 px |
| `--bord-fort` | `#39424C` | champ de prompt, bouton secondaire |

### Le texte

**Tous les contrastes de ce document sont mesurés sur `--fond-2` `#171B21`**, et non sur le fond
le plus sombre : c'est le fond le plus clair sur lequel du texte est réellement posé — champs,
tuiles, cartes. Mesurer sur `--fond-0` donnerait des chiffres plus flatteurs et faux à l'usage.

| Token | Hex | Contraste sur `--fond-2` | Usage |
|---|---|---|---|
| `--texte` | `#E6EAEE` | 14,3 : 1 | le contenu |
| `--texte-2` | `#98A2AC` | 6,7 : 1 | libellés, secondaire |
| `--texte-3` | `#5E6771` | 3,0 : 1 | **le grisé** — indisponible, méta, raison |

`--texte-3` est en dessous de 4,5 : 1 délibérément. Il ne porte jamais d'information dont
l'absence bloquerait — il porte le grisé, la méta et la raison, tous redondants avec une autre
marque. Toute information nécessaire est en `--texte-2` ou au-dessus.

### Le signal et la sémantique

| Token | Hex | Contraste sur `--fond-2` | Usage |
|---|---|---|---|
| `--signal` | `#49B3CE` | 7,1 : 1 | **le seul accent** — générer, favori, actif, jauge |
| `--signal-clair` | `#8ED8E8` | — | survol du signal, texte de pastille agent |
| `--signal-sourd` | `rgba(73,179,206,.13)` | — | fond d'un segment actif, anneau de focus |
| `--lumiere` | `#EAF4F8` | — | sélection et focus. C'est la lampe de la table. |
| `--ok` | `#5FA871` | 6,0 : 1 | réussi, en ligne, remis à jour |
| `--epingle` | `#C8A03C` | 7,0 : 1 | réglé à la main, interrompu, **catalogue servi de repli** |
| `--echec` | `#CB6C65` | 4,8 : 1 | appel raté, suppression, refus |

`--echec` porte du texte sur `--fond-2` — c'est la raison d'un appel raté, l'erreur d'un champ,
la tuile en échec. Le rouge brique `#C4635C` n'y vaut que 4,35 : 1, sous le seuil AA ; `#CB6C65`
le remonte à 4,8 : 1 sans déplacer la teinte.

**`--info` `#7E8AA0` est retiré** — 27 août 2026. Il n'avait qu'un usage dans tout le produit, le
repli hors ligne, et le repli est passé en `--epingle` (`docs/design-motifs.md`, *Le revers*). Un token
sémantique qui nomme un état et ne colore plus rien est un piège : il ré-autorise un second gris
neutre le jour où quelqu'un cherchera « la couleur d'une information ». Le châssis n'a donc que
trois sémantiques — `--ok`, `--epingle`, `--echec` — plus l'accent `--signal` et la lampe
`--lumiere`.

Le cyan est choisi **contre le contenu** : c'est la seule famille chromatique qu'un asset de
fantasy ne produit presque jamais. Un accent ambre — celui de la maquette écartée — se noierait
dans une grille de tonneaux et de clés.

### Les teintes d'îlot

Ajoutées le 27 août 2026 avec la toile (`PLAN.md` T8-T9), et c'est le **seul endroit du produit
où une couleur ne veut rien dire**. Un îlot ou une note en porte une parce que l'auteur l'a
choisie, jamais parce qu'un état la commande — l'inverse exact des quatre sémantiques ci-dessus,
et il faut donc que rien ne les confonde.

**Dix depuis le 28 août 2026**, contre six à l'origine — et la saturation passe de 20 à 30 %,
le fond de 8 à 16 %. Le motif de la demande était « plus de couleurs, et qu'on les voie » ; ce qui
a été rendu est la seconde moitié, entière, et la première dans les limites que la sémantique
laisse. Les six noms d'origine ne bougent pas d'une teinte de roue : seule leur saturation monte.

| Token | Hex | Teinte | Contraste sur `--fond-2` |
|---|---|---|---|
| `--ilot-ardoise` | `#6686AD` | 212° | 4,6 : 1 |
| `--ilot-pervenche` | `#7781B6` | 231° | 4,6 : 1 |
| `--ilot-iris` | `#847DB9` | 247° | 4,6 : 1 |
| `--ilot-lavande` | `#9577B6` | 269° | 4,6 : 1 |
| `--ilot-prune` | `#A76FB2` | 291° | 4,6 : 1 |
| `--ilot-mauve` | `#B16DA4` | 311° | 4,6 : 1 |
| `--ilot-bruyere` | `#B2708F` | 332° | 4,6 : 1 |
| `--ilot-mousse` | `#788B4B` | 78° | 4,6 : 1 |
| `--ilot-lichen` | `#678F4D` | 96° | 4,6 : 1 |
| `--ilot-paille` | `#878748` | 60° | 4,6 : 1 |

**Quatre disciplines, et aucune ne se négocie.** *Une* — la saturation est plafonnée à **30 %**,
quand les quatre sémantiques vivent entre 40 et 55 % : une teinte d'îlot reste la couleur la plus
sourde de l'écran, et c'est ce qui la fait lire comme un rangement plutôt que comme un état.
*Deux* — elles ne colorent que des **surfaces de la toile** : cadre d'îlot, bandeau d'îlot, fond
d'îlot, fond de note. Jamais une marque sur une carte, jamais un contrôle ; le coin plein en
`--signal` reste le seul vocabulaire de marque du tableau. *Trois* — la liste est **fermée**, et il
n'existe aucun sélecteur libre : le premier îlot rouge vif se lirait comme un échec. *Quatre* —
**deux arcs de la roue sont interdits, et ce sont ceux des sémantiques** : 345–55°, où vivent
`--echec` (4°) et `--epingle` (43°), et 120–200°, où vivent `--ok` (140°) et `--signal` (192°). Une
onzième teinte ne peut naître que dans ce qui reste.

C'est la quatrième qui a tranché la demande de « couleurs primaires » du 28 août 2026, et elle
l'a tranchée **contre** : une primaire est par définition au milieu d'un arc, et les trois arcs
qu'on demandait sont les trois qui sont fermés. Le rouge se lit *ça détruit*, le vert franc *c'est
passé*, l'ambre *c'est réglé à la main* — trois phrases que le produit dit ailleurs et qu'un
rangement ne doit jamais prononcer. Ce que la demande voulait vraiment, *qu'on voie la couleur
qu'on a posée*, est rendu par le fond à 16 % et par le bandeau plein (§ Le bandeau d'îlot dans
`docs/design-motifs.md`), qui ne coûtent rien à la sémantique.

Les dix sont posées à la même **clarté perçue**, 4,6 : 1 sur `--fond-2` — au-dessus du seuil AA,
sous le contraste de toutes les sémantiques. La clarté HSL de chacune diffère donc (40 à 61 %) :
c'est le contraste qui est la discipline, pas le nombre. Sur un bandeau plein, le nom se pose en
`--fond-0`, qui y vaut 5,2 : 1 sur les dix.

**Deux paires sont proches, et c'est le coût nommé** : ardoise/pervenche (18° d'écart) et
iris/lavande (22°). Elles se distinguent côte à côte et pas isolées — ce qui est payable parce
qu'**une teinte n'identifie pas un îlot : son nom le fait**, et le nom est sur le bandeau. La
teinte range à l'œil, elle ne nomme pas. Dix est le plafond de ce qui reste distinguable ; au-delà
on ne choisit plus une couleur, on choisit une nuance.

### Le damier alpha

| Token | Hex |
|---|---|
| `--damier-a` | `#191E24` |
| `--damier-b` | `#14181D` |

Carreaux de 12 px sur une tuile, 16 px en fiche. Écart volontairement faible entre les deux tons :
le damier doit signaler la transparence sans jamais devenir un motif que l'œil suit.

### Mode clair

**Il n'y en a pas, et c'en est une décision.** Le produit a un seul utilisateur, sur un seul écran,
pour juger des images. Le mode clair fausserait ce jugement (§ raisonnement ci-dessus) et
doublerait la maintenance des états. Aucun token n'est défini deux fois.

---

## Spacing

- **Base** : 4 px.
- **Densité** : **compacte**. C'est un outil personnel sur écran large : l'espace se dépense en information, pas en respiration.
- **Échelle** : `2xs 2 · xs 4 · sm 8 · md- 12 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64`

### Hauteurs de contrôle — la vraie grille de densité

| Élément | Hauteur |
|---|---|
| Rangée d'arbre | 26 px |
| Bouton de segment, champ de recherche | 26 – 28 px |
| Bouton, champ | 32 px |
| Bouton compact (`btn-xs`) | 24 px |
| En-tête de panneau | 30 px |
| Barre d'outils de grille | 38 px |
| Barre de tête | 44 px |
| Barre d'état | 26 px |
| Champ de prompt | 62 px (min) |

Gouttière de grille d'assets : 9 px. Padding de panneau : 8 px. Padding de zone centrale : 16 px.

---

## Layout

- **Approche** : **grid-disciplined**, sans exception. Il n'y a pas de section marketing dans ce produit, donc aucune raison de casser la grille nulle part.
- **Grid de l'Atelier** : `240px · 300px · minmax(0,1fr) · 380px` — arbre · réglages · prompt + grille · fiche. Largeurs absolues, sans condition.
- **Grid de l'Univers** : `380px · minmax(0,1fr)` en mode grille, `380px · minmax(0,1fr) · 380px` en mode toile — réglages · tableau, ou réglages · toile · réserve. La troisième colonne n'introduit **aucune largeur nouvelle** : c'est la 380 de la fiche, réemployée pour ce qu'elle nomme déjà, la colonne de ce qu'on manipule. Ajouté le 27 août 2026 avec la toile (`PLAN.md` T8).
- **Les deux colonnes de 380 de l'Univers se replient par choix**, exactement comme celles de l'Atelier (US-97) : même bascule dans la barre de tête, même case de grille qui tombe à zéro, mêmes 160 ms. Repliées toutes les deux, la toile tient la largeur de l'écran — c'est la surface de composition, et l'écran large est la ressource du produit. **Replier n'est pas fermer** : les deux panneaux restent montés, et la réserve garde ses 380 px sous une case qui les rogne, parce que c'est cette grille-là que l'aimant de la largeur libre mesure. La bascule de la réserve ne paraît **qu'en toile** — en grille, elle n'a pas de colonne, et une bascule pour une colonne absente mentirait sur ce que l'écran contient. Ajouté le 28 août 2026, à l'usage.
- **La colonne de 240 px porte trois choses, et c'est le même sujet vu de trois hauteurs** : où ça se range (projets, collections), ce que ça coûte (le total du projet ouvert), et **ce qui a raté** — le journal, sous l'arbre. Ajouté le 27 août 2026 avec la bibliothèque : un appel raté a coûté de l'argent sans produire d'image, donc il n'a sa place ni dans la grille, qui ne montre que ce qu'on peut réutiliser, ni nulle part, puisqu'il faut pouvoir expliquer une facture. Le journal ne paraît que s'il y a eu un raté.
- **Max content width** : **aucune**, à une exception nommée. L'écran large est la ressource du produit, on la dépense, et la grille d'assets remplit ce qui reste. L'exception est la colonne de prose de l'écran Guide, bornée à **72 caractères** : la règle a été écrite pour la chose qui *gagne* à s'étaler, et la prose est la seule matière du produit qui perde à recevoir de la largeur (§ L'écran Guide). Aucune autre surface n'a le droit de s'en réclamer.
- **Grille d'assets** : `repeat(auto-fill, minmax(128px, 1fr))`, gouttière 9 px. Zoom 1× / 2× / 4× — le cran donne la **largeur minimale d'une tuile** : 128, 256, 512. Un niveau indisponible à la largeur courante est **grisé, pas caché**.
- **Un cran est disponible quand deux tuiles y tiennent côte à côte**, gouttière et padding compris — pas une. Ajouté le 27 août 2026 en ouvrant l'atelier : `minmax(512px, 1fr)` accepte une colonne unique et l'**étire** jusqu'au bord, et 4× rendait une tuile de 1028 px sur une colonne de 1060. Huit fois la taille de repos pour un contrôle qui en annonce quatre. Une grille d'une colonne n'est plus une planche contact, c'est une visionneuse. **1× reste toujours disponible** : c'est l'état de repos, et quelque chose doit se rendre.
- **Le cran choisi reste choisi, même devenu indisponible** — c'est la règle du modèle du catalogue (US-9), et il n'y a aucune raison d'en avoir deux. Mais une grille doit rendre quelque chose : elle rend au plus grand cran qui tienne, et la barre d'outils le **dit**, dans la fente et la forme des autres — `— 4× ne tient pas ici, rendu en 2×`. Le seul endroit du produit où l'on rend autre chose que ce qui est choisi, et il ne le fait jamais en silence.
- **Border radius** : `sm 2px · md 3px · lg 4px · full 9999px` (réservé aux pastilles de statut, aux points de la barre d'état et — depuis le 28 août 2026 — à la poignée de lien de la toile). **La tuile d'asset est à 0.**

### Sur la toile, deux échelles — et tout objet déclare la sienne

Écrit le 28 août 2026. **Ce qui se lit est en pixels d'écran ; ce qui se mesure est en pixels de
plan.** L'image, la carte, la note, la boîte d'un îlot sont des **places** : elles suivent le zoom,
sans quoi la toile mentirait sur ce qu'elle range. Le nom d'un îlot, son compte, le mot d'un trait
et les trois prises sont des **lectures et des cibles** : ils gardent leur taille d'écran à tous
les crans, parce qu'un nom illisible à 0,3× et une poignée de 30 px à 2,5× sont la même panne vue
par ses deux bouts.

C'est la seule surface du produit qui ait besoin de la règle — partout ailleurs il n'y a qu'une
échelle, et l'écran *est* le plan. **Coût, et il est structurel** : tout objet neuf de la toile
doit désormais déclarer à laquelle des deux il appartient, et l'oubli est silencieux — il ne se
voit qu'en zoomant. La question se pose donc au dessin, pas à la relecture.

### Le rayon 0 sur la tuile

Le châssis a 2 px, la tuile a 0. Le bord de la tuile et le bord du sprite deviennent la même sorte
de ligne, et la grille se lit comme une planche contact plutôt que comme un fil d'actualité.
Corollaire obligatoire : **aucune ombre portée sur une tuile** — un rayon nul rend toute ombre
brutale. La profondeur se fait au fond (`--fond-0` sous `--fond-2`) et au bord, jamais à l'ombre.

### Un panneau est borné par l'écran, jamais par son contenu

Écrit le 27 août 2026, après avoir mesuré au navigateur ce que trois colonnes sur quatre
faisaient depuis le début : **elles rognaient en silence**. À 1280 × 720, l'arbre tenait ses
193 px, les réglages en demandaient 950 pour 650 offerts, la fiche 1310 — la filiation entière
hors d'atteinte, et aucune barre nulle part pour le dire. Le seul panneau qui défilait était
celui de l'écran Univers, et il ne le devait qu'à un accident de construction : son parent est
une boîte `flex`, donc il était étiré ; ceux de l'Atelier vivent dans des cases de grille, donc
ils prenaient la hauteur de leur propre contenu et n'avaient jamais rien à contraindre.

**La hauteur d'un panneau est celle de l'écran, moins la barre de tête et la barre d'état.** Ce
qui dépasse défile. L'en-tête de 30 px ne défile jamais : il porte le nom du panneau et, dans la
fiche, sa fermeture — les deux doivent rester atteignables depuis le fond d'un défilement.

**Un bloc ne s'écrase jamais pour tenir.** Dans une colonne qui défile, un enfant se comprime
avant de sortir : en bornant les panneaux à la main, la liste des modèles est tombée à **0 px**
et a disparu entièrement, sa section passant de 330 à 34. Un contrôle écrasé ment sur son état ;
il vaut mieux qu'il sorte de l'écran et qu'une barre le dise.

**La barre est visible dès qu'il y a plus, et elle ne déplace rien en paraissant.** Elle garde
ses 9 px — la gouttière de la grille d'assets, un seul vocabulaire de largeur dans le produit —
mais sa poignée passe de `--bord` à **`--bord-fort`** : sur `--fond-1`, le trait de séparation du
châssis est sous le seuil où l'œil le trouve, et une barre qu'on ne voit pas ne dit pas « il y a
plus ». Gouttière réservée partout où ça défile, panneaux **et** grille d'assets : 9 px qui
apparaissent peuvent retirer une colonne entière d'un `auto-fill`, et recomposer la planche
contact au moment où l'on y cherchait quelque chose.

C'est la seule pièce du châssis qui a le droit de se faire remarquer, et elle ne paraît que quand
elle a quelque chose à dire.

---

## Motion

- **Approche** : **minimal-fonctionnel**. Un outil ouvert une demi-heure par jour ne doit pas faire attendre à la dixième fois.
- **Easing** : entrée `cubic-bezier(.2,0,0,1)` · sortie `ease-in` · déplacement `ease-in-out`
- **Durées** : micro 80 ms · court 160 ms · moyen 240 ms. **Rien au-dessus de 240 ms.**

### La liste close de ce qui bouge

Rien d'autre ne s'anime. Les survols et les changements d'état sont instantanés (80 ms de
transition de couleur au maximum, jamais de transformation).

| Ce qui bouge | Durée | Ce que le mouvement dit |
|---|---|---|
| Jauge de génération | continue, **déterminée** | ça travaille, et voilà où ça en est |
| Arrivée d'un asset dans la grille | fondu 120 ms + 1 px de levée | quelque chose de neuf est apparu — c'est ce qui permet de garder l'œil sur ce que l'agent produit sans notification |
| Annulation après suppression | entrée 160 ms, sortie 160 ms | il reste un instant pour revenir en arrière |
| Repli / dépliage d'un panneau | 160 ms sur la largeur | tu n'as pas perdu ta place |
| Ouverture / fermeture de la fiche | 160 ms sur la largeur | idem |
| **Ce qui paraît sans clic** — menu de carte, infobulle | fondu 80 ms + 2 px de levée | c'est venu se poser par-dessus, la grille n'a pas bougé |

La dernière rangée porte **deux locataires, et n'en accepte pas un troisième sans repasser
par la règle d'admission** : elle est réservée à ce qui paraît sans qu'un geste ait dit
qu'on le demandait. Un menu qui s'ouvre au clic n'y entre pas — le clic l'a déjà annoncé.

**La règle qui garde la liste close**, posée le 27 août 2026 en refusant d'y ajouter le repli hors
ligne : *un mouvement n'entre dans la liste que si la chose qui arrive n'a aucun autre moyen d'être
remarquée.* Un asset qui atterrit au milieu de tuiles identiques n'en a aucun — d'où le fondu. Le
repli en a un : il arrive dans la seule couleur chaude du châssis. Il reste donc instantané.

**Le repli d'un bloc n'y entre pas non plus**, par la même règle et le 27 août 2026 : on a
cliqué, donc on sait que ça s'ouvre, et les blocs voisins qui descendent le disent une seconde
fois. Ne pas confondre avec le repli d'un **panneau**, qui garde ses 160 ms — celui-là touche la
grille des colonnes, et c'est la place de tout l'écran qui bouge.

---

## Motifs → `docs/design-motifs.md`

Les motifs transversaux — la tuile, l'emplacement, le grisé qui porte sa raison, la fente,
le menu qui sort du flux, les quatre écrans — vivent dans **`docs/design-motifs.md`**, qui a
la même autorité que ce fichier. Ils y sont sortis parce qu'ils pèsent trois fois le système
lui-même et qu'on ne les consulte qu'en dessinant un écran.

**Un motif ne redéfinit jamais un token** : il applique ce qui est décidé ci-dessus. En cas
de contradiction, les sections ci-dessus l'emportent.

---

## Ce que le design n'affiche pas, et pourquoi

L'Atelier ne montre que ce qu'on touche **à chaque** génération : le sujet, le modèle, le nombre
de variations — plus un bloc en lecture seule qui répond d'avance à « qu'est-ce qui part avec ? »
(références, famille, palette, grille imposée, bible active).

Résolution, format, champs de bible dépliés, sélecteur de rôle de réinjection, barre d'état
à quatre blocs : tous ces réglages existent dans le produit. Ils sont repliés, tenus par un défaut
du projet, ou vivent dans l'écran Univers. **Une décision du cadrage peut être respectée par le
code sans être affichée** — c'est la leçon de la maquette écartée.

---

## Decisions Log → `docs/design-decisions.md`

Le journal complet — 108 décisions datées avec leur rationale et leur coût — vit dans
**`docs/design-decisions.md`**. Il ne tranche rien : il explique. On l'ouvre pour rouvrir une
décision, pas pour connaître le système.

**Toute décision nouvelle s'écrit là-bas**, en bas du tableau, y compris quand elle vient de
`/design`. Ne pas la réinstaller ici : c'est ce qui avait porté ce fichier à 140 Ko.
