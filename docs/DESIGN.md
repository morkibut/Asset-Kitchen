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
par `docs/ARCHITECTURE.md` §6.2. La seule chose que ce document ajoute est la conséquence
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
repli hors ligne, et le repli est passé en `--epingle` (§ Motifs, *Le revers*). Un token
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

| Token | Hex | Contraste sur `--fond-2` |
|---|---|---|
| `--ilot-ardoise` | `#7086A0` | 4,6 : 1 |
| `--ilot-iris` | `#847FAA` | 4,6 : 1 |
| `--ilot-prune` | `#9D77A4` | 4,6 : 1 |
| `--ilot-bruyere` | `#A4778C` | 4,6 : 1 |
| `--ilot-lichen` | `#708C5D` | 4,6 : 1 |
| `--ilot-paille` | `#87875A` | 4,6 : 1 |

**Trois disciplines, et aucune ne se négocie.** *Une* — la saturation est plafonnée à 20 %, quand
les quatre sémantiques vivent entre 40 et 55 % : une teinte d'îlot est toujours la couleur la plus
sourde de l'écran, et c'est ce qui la fait lire comme un rangement plutôt que comme un état.
*Deux* — elles ne colorent que des **surfaces de la toile** : cadre d'îlot, titre d'îlot, fond de
note. Jamais une marque sur une carte, jamais un contrôle ; le coin plein en `--signal` reste le
seul vocabulaire de marque du tableau. *Trois* — la liste est **fermée**, et il n'existe aucun
sélecteur libre : le premier îlot rouge vif se lirait comme un échec.

Les six sont posées à la même clarté, à 4,6 : 1 sur `--fond-2` — au-dessus du seuil AA, sous le
contraste de toutes les sémantiques. Aucune ne reprend la teinte de `--signal` (192°) ni celle de
`--echec` (4°), les deux qu'il serait coûteux de mal lire. `--ilot-paille` (60°) et
`--ilot-lichen` (95°) sont les plus proches voisines de `--epingle` (43°) et `--ok` (140°) : elles
s'en séparent par la saturation et par le rôle, et ne se posent jamais sur le même objet.

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
- **La colonne de 240 px porte trois choses, et c'est le même sujet vu de trois hauteurs** : où ça se range (projets, collections), ce que ça coûte (le total du projet ouvert), et **ce qui a raté** — le journal, sous l'arbre. Ajouté le 27 août 2026 avec la bibliothèque : un appel raté a coûté de l'argent sans produire d'image, donc il n'a sa place ni dans la grille, qui ne montre que ce qu'on peut réutiliser, ni nulle part, puisqu'il faut pouvoir expliquer une facture. Le journal ne paraît que s'il y a eu un raté.
- **Max content width** : **aucune**, à une exception nommée. L'écran large est la ressource du produit, on la dépense, et la grille d'assets remplit ce qui reste. L'exception est la colonne de prose de l'écran Guide, bornée à **72 caractères** : la règle a été écrite pour la chose qui *gagne* à s'étaler, et la prose est la seule matière du produit qui perde à recevoir de la largeur (§ L'écran Guide). Aucune autre surface n'a le droit de s'en réclamer.
- **Grille d'assets** : `repeat(auto-fill, minmax(128px, 1fr))`, gouttière 9 px. Zoom 1× / 2× / 4× — le cran donne la **largeur minimale d'une tuile** : 128, 256, 512. Un niveau indisponible à la largeur courante est **grisé, pas caché**.
- **Un cran est disponible quand deux tuiles y tiennent côte à côte**, gouttière et padding compris — pas une. Ajouté le 27 août 2026 en ouvrant l'atelier : `minmax(512px, 1fr)` accepte une colonne unique et l'**étire** jusqu'au bord, et 4× rendait une tuile de 1028 px sur une colonne de 1060. Huit fois la taille de repos pour un contrôle qui en annonce quatre. Une grille d'une colonne n'est plus une planche contact, c'est une visionneuse. **1× reste toujours disponible** : c'est l'état de repos, et quelque chose doit se rendre.
- **Le cran choisi reste choisi, même devenu indisponible** — c'est la règle du modèle du catalogue (US-9), et il n'y a aucune raison d'en avoir deux. Mais une grille doit rendre quelque chose : elle rend au plus grand cran qui tienne, et la barre d'outils le **dit**, dans la fente et la forme des autres — `— 4× ne tient pas ici, rendu en 2×`. Le seul endroit du produit où l'on rend autre chose que ce qui est choisi, et il ne le fait jamais en silence.
- **Border radius** : `sm 2px · md 3px · lg 4px · full 9999px` (réservé aux pastilles de statut et aux points de la barre d'état). **La tuile d'asset est à 0.**

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

## Motifs

Les motifs transversaux qui *sont* le design — chacun est une décision d'apparence ; le
comportement qu'ils rendent visible est tranché par `docs/PRD.md`.

### La tuile

L'objet central du produit. Structure fixe : zone image carrée sur damier alpha, pied à deux
lignes — nom (11,5 px sans, tronqué) puis méta (9,5 px mono : `64×64 · 4 px · $0,067`).

| Marque | Forme | Ce qu'elle porte |
|---|---|---|
| **Coin plein** haut-droit, `--signal`, 13 px | triangle | favori — **la seule marque visuelle**, parce que c'est la seule que l'auteur pose lui-même |
| **Anneau** `--lumiere` 2 px | box-shadow externe | sélectionné — la lampe de la table |
| **Pastille** mono 8,5 px, fond `rgba(11,13,16,.82)` | texte | un état subi : `réglé`, `agent`, `parent supprimé` |

La hiérarchie est volontaire : ce que tu poses est une forme, ce que le système constate est un
mot. Aucune couleur supplémentaire n'entre dans la grille.

### Le grisé porte sa raison — jamais une infobulle

Un contrôle indisponible est rendu en `--texte-3` sur `--fond-2`, bordure `--bord`, et **une ligne
sœur permanente** juste dessous : mono 10 px, `--texte-3`, précédée d'un tiret de 8 px, avec un
lien en `--signal` quand il y a un endroit où aller.

```
[ Générer ]
 — aucune clé OpenRouter — Réglages ›
```

La raison n'est jamais au survol : le produit interdit de proposer puis refuser, l'apparence doit
donc dire pourquoi sans qu'on ait à chercher. Même traitement pour un modèle du catalogue qui ne
peut pas honorer la demande, un niveau de zoom trop grand pour la largeur, la quantification sans
palette, et l'export d'une sélection vide.

**Dans une barre de 38 px, la ligne sœur se pose à côté et non dessous.** La forme ne change pas —
tiret de 8 px, mono 10 px, `--texte-3` — seule la direction change, parce qu'aucune hauteur neuve
n'est disponible là (§ Spacing). C'est déjà ce que fait `— 4× ne tient pas ici` ; l'export grisé de
la barre d'outils est le second locataire de cette variante, et les deux ne cohabitent jamais avec
un troisième.

### Le revers — l'actif qui porte son risque

Le repli hors ligne est le **seul endroit du produit où l'on propose puis refuse** : le catalogue
est une photo, générer reste actif, et l'échec ne survient qu'au moment du clic (`docs/PRD.md`
US-95). C'est donc l'exception au motif ci-dessus, et elle se rend **dans la même fente, avec la
même forme** — tiret de 8 px, mono 10 px, lien `--signal` pour le geste. Ce qui change est le
mot : le grisé dit *pourquoi c'est fermé*, le revers dit *ce qui va casser*.

**Où ça se pose : dans une fente qui existe déjà.** Aucun bandeau, aucune rangée, aucune hauteur
neuve sur une colonne qui compte 44 px en tête et 26 px en pied. Sous le bouton Générer, alignée
à droite, il y a une ligne mono 10 px qui a déjà deux locataires : `Ctrl + Entrée` au repos, et la
raison quand générer est grisé. **Le repli est le troisième, et les trois ne coexistent jamais.**

```
   au repos                                    [ Générer 3 variations ]
                                                         Ctrl + Entrée

   hors ligne                                  [ Générer 3 variations ]
                                    — seul générer échouera   Réessayer ›

   jamais reçu                                         [ Générer ]
                             — le catalogue n'a jamais été reçu   Réessayer ›
```

**La fente prédit, elle ne raconte pas.** Elle porte deux choses — **ce qui échouera** et **le
geste** — plus, dans un seul mot, **ce qui marche encore** : `seul` borne la panne, et une panne
bornée dit son complément. Coût assumé : « écrire, régler, choisir un modèle » n'est pas écrit en
toutes lettres. Le champ prend le texte, le panneau répond, la bibliothèque est là — l'écran le
démontre pendant qu'on le lit, et § *Ce que le design n'affiche pas* a déjà tranché qu'une
décision peut être respectée sans être affichée.

**La date, elle, n'est pas dans la fente — et c'est une correction.** Elle y a été posée le
27 août, puis retirée le jour même : à l'ouverture de l'atelier le prompt est vide, donc le refus
« aucun prompt » occupe la fente, donc la date n'était lisible **nulle part tant que l'auteur
n'avait pas tapé un caractère**. Or c'est exactement au démarrage que le catalogue doit dire son
âge (US-93, et le critère T1 « le démarrage n'affiche aucune erreur, le catalogue affiche sa date
en clair »).

La règle qui l'a corrigée est celle du motif lui-même : **une date est un fait sur le monde, pas
sur le clic à venir.** Elle vit donc dans la barre d'état, seul élément rendu en permanence. Et
cette répartition rend l'ordre des trois locataires *juste* plutôt que subi : tant que la demande
n'est pas composée, le refus tient la fente, et il n'y a aucune prédiction à faire puisqu'il n'y a
pas encore de geste possible.

**Variante — catalogue jamais reçu.** Aucun modèle, donc générer redevient grisé, donc c'est le
motif ordinaire qui reprend la main, dans la même fente, sans machinerie supplémentaire et sans
rien d'autre à dire : il n'y a pas de date à porter, et rien qui marche encore à nuancer. La barre
d'état se tait alors sur le catalogue — elle n'a rien à dater — et dit seulement `hors ligne`.
Que la fente passe du revers au grisé selon le nombre de modèles revenus est **la preuve de
l'emplacement** : un seul fait, « le catalogue n'est pas frais », une seule fente, deux mots selon
la gravité. Deux traitements à deux endroits, c'est ce que le bandeau imposait.

**Deux altitudes, deux métiers, une seule occurrence de « hors ligne ».** La barre d'état (26 px)
porte **l'état du monde**, en permanence, qu'on la regarde ou non : le point `--epingle`, la
phrase de liaison, **la date** de la photo servie, et — quand le port a su la dire en français —
**la cause**. Elle ne prédit jamais.

```
 ● hors ligne · catalogue du 26/08 14:02 · aucune connexion au fournisseur · 2 modèles · clé …a1b2
```

**Chacun de ces trois faits est un segment à lui**, et c'est ce qui les rend robustes : la phrase
de liaison est disputée — une génération refusée ou un flux rompu la prennent, et à juste titre,
c'est plus grave. Fondre la date dedans la ferait disparaître au moment où elle compte le plus.
La date et la cause survivent donc à la phrase, et la couleur du point suit la chose la plus grave.

La fente sous Générer porte **la conséquence pour le prochain geste**, et seulement hors ligne ;
elle ne raconte jamais l'état du réseau. Le doublon d'avant — le bandeau et la barre d'état
disaient « hors ligne » dans les mêmes mots — n'était pas une redondance voulue mais un
symptôme : deux éléments qui disent la même chose à deux altitudes, et aucun des deux n'est
l'autorité.

**La cinquième chose, et pourquoi elle est en bas.** Le port traduit toute panne de transport en
une phrase du produit — « aucune connexion au fournisseur », « le fournisseur n'a pas répondu à
temps ». C'est une information réelle : elle dit à l'auteur si c'est son réseau ou celui d'en face.
Mais ce n'est **pas** une conséquence du prochain clic, donc elle ne monte pas dans la fente : elle
reste en bas, en `--texte-3`, dans la bande qui rapporte l'état du monde.

Le bouton **Catalogue** de la barre de tête reste : c'est le geste permanent, disponible en ligne
comme hors ligne. `Réessayer ›` n'en est pas un doublon mais la règle du motif — *un lien
`--signal` quand il y a un endroit où aller* — appliquée là où la panne est nommée. Un nom, un
verbe : on rafraîchit un catalogue, on réessaie une panne.

**Une seule voix par bande.** La fente sous Générer, le pied de prompt, la méta de tuile et la
barre d'état sont en **mono de bout en bout, phrases comprises** — pas seulement leurs mesures. Ce sont
les bandes où la machine rapporte ; le sans est ce que l'auteur écrit et choisit. Corollaire de la
règle 2 du § Typography, et raison pratique : accorder deux familles sur une ligne de 10 px coûte
plus qu'il ne rapporte.

**La couleur : `--epingle`, pas `--info`.** Les trois usages d'`--epingle` — réglé à la main,
interrompu, catalogue de repli — partagent une définition : *arrêté à un instant, que le système
ne bougera pas tout seul, et que seul un geste de l'auteur relance*. C'est mot pour mot l'invariant
« rien n'est jamais relancé automatiquement ». `--info` `#7E8AA0` échouait deux fois : à 10 px il
ne se distingue pas de `--texte-2` `#98A2AC`, donc il ne lit pas comme une couleur ; et c'est un
bleu-gris posé à côté du cyan, ce qui coûte à l'accent son exclusivité. Il est retiré (§ Color).
Les deux emplois du jaune restent **hors de la grille** — le pied de l'écran, et la bande de
prompt au-dessus des tuiles — donc ce point chaud n'est jamais posé à côté d'un sprite.

**Rien ne bouge.** L'apparition n'entre pas dans la liste close du § Motion : le fragment arrive
dans la seule couleur chaude du châssis, il n'a pas besoin d'un fondu pour se faire voir. Et
l'état peut battre plusieurs fois dans une séance — un fragment qui entre et sort en fondu dans
une bande relue avant chaque clic devient un clignotement. Seule s'applique la tolérance générale
du § Motion : 80 ms de transition de couleur sur le point de la barre d'état, `--ok` →
`--epingle`.

### L'infobulle explique, elle n'excuse jamais

Écrit le 27 août 2026, sur un constat de l'auteur : *« même si c'est mon app perso, je suis
un peu perdu dessus encore — le champ `groupe` sur un concept art, il sert à quoi ? »* La
question est juste, et l'écran ne peut pas y répondre : `groupe` et `famille` sont deux
champs voisins du même menu, l'un ne fait **rien** à la génération et l'autre décide de ce
qui part en référence *et* de ce que ça coûte. Rien à l'écran ne les distingue.

Les deux motifs ci-dessus interdisent l'infobulle. **Ils l'interdisent toujours, et cette
section dit exactement pourquoi ils ne mordent pas ici.** Ce qu'ils protègent est *la
raison* : ce qui refuse un geste ne se survole jamais, parce qu'on est bloqué maintenant.
Une explication n'a pas cette propriété — on génère très bien sans savoir ce que `groupe`
fait, on ignore seulement ce qu'on a gagné.

**Le test, et il est binaire** : *son absence empêche-t-elle un geste ?* Oui — fente
permanente, jamais un survol : « aucune clé OpenRouter », « la quantification demande une
palette », « 4× ne tient pas ici ». Non — survol, jamais une fente : ce que fait un réglage,
d'où sort son défaut, ce que remplir un champ entraîne. La règle ancienne n'est pas
assouplie, elle gagne son revers : **la fente permanente est réservée à ce qui bloque, le
survol à ce qui n'a jamais bloqué personne.** Une infobulle qui porte une raison est un bug,
pas un arbitrage.

**Le libellé est la cible — aucun glyphe neuf.** Le produit compte trois glyphes (`+` de
l'arbre, triangle plein du favori, carré de 9 px d'une étape) et le § Le bloc repliable a
déjà refusé le chevron pour ne pas en ouvrir un quatrième. Trente points d'interrogation
posés dans les panneaux seraient ce quatrième glyphe, multiplié — c'est-à-dire la maquette
écartée, qui mettait « des options partout ». Le nom du réglage est déjà à l'écran, déjà
placé, et c'est déjà le nom de la chose : il devient sa propre poignée. **Rien n'est ajouté
au repos, ni une rangée, ni une hauteur, ni une couleur.**

**La marque est un souligné pointillé `--bord-fort`, `underline-offset: 3px`.** Même token
que la poignée de barre de défilement, et pour exactement le même métier : *il y a plus
ici*. `--bord` est sous le seuil où l'œil le trouve (§ Layout, mesuré), `--bord-fort` est
au-dessus quand on cherche et en dessous quand on travaille. C'est aussi le trait que le
navigateur pose sous `<abbr>` depuis toujours — la seule décoration du produit qui se
comprenne sans être apprise.

**Elle s'ouvre vers le centre, jamais vers le bord.** Corollaire du menu de carte — *jamais
sur l'image qu'il règle* — appliqué un cran plus loin : le panneau se pose du côté de la
grille, seule surface assez large et seule chose que personne ne lit au moment où il lit une
explication. Depuis la fiche (colonne de droite) il part à gauche, depuis les réglages
(colonne de gauche) il part à droite. Et il est **borné par l'écran, jamais par son
contenu** — la règle du § Layout, qui vaut pour tout ce qui se pose.

**Fond `--fond-1`, bord `--bord-fort`, rayon 2, largeur 280 px.** Le menu de carte se
contente de `--bord` parce qu'il tombe toujours sur `--fond-0` ; une infobulle peut se poser
sur un panneau, où `--bord` disparaît. Un seul token d'écart, et c'est l'argument déjà payé
sur la barre de défilement. Aucune couleur neuve n'entre : le produit a trois sémantiques,
il en garde trois.

#### Trois lignes, toujours les mêmes trois

```
  ┌────────────────────────────────────────┐
  │ Un nom libre pour ranger les cartes    │  ce que c'est
  │ du tableau. Vide = hors groupe.        │  sans 12 px · --texte
  │                                        │
  │ Rien à la génération. Ce qui décide    │  ce que ça change
  │ des références envoyées, c'est         │  sans 12 px · --texte-2
  │ artwork officiel + famille.            │
  │                                        │
  │ toi · aucun défaut      Le guide ›     │  d'où ça sort
  └────────────────────────────────────────┘  mono 10 px · --texte-3
```

La troisième ligne est en mono parce que l'origine d'un défaut est **un fait sur le monde** —
le projet, l'univers, le catalogue, une mesure, ou toi — et que ce produit rend tout fait en
mono (§ Typography, règle 2). Elle porte le lien `--signal` vers le guide, par la règle du
§ Le grisé : *un lien quand il y a un endroit où aller*.

**Aucune explication ne saute la deuxième ligne.** Un réglage qui ne change rien en aval
doit l'écrire dans ces mots-là — `Rien à la génération.` C'est le gabarit qui produit la
réponse, pas la bonne volonté de celui qui rédige : sans ligne obligatoire, `groupe` aurait
reçu trois phrases sur le rangement, et la question de départ serait restée entière. Mise à
l'épreuve sur les deux champs qui l'ont provoquée :

| Champ | Ce que ça change |
|---|---|
| `groupe` | **Rien à la génération.** C'est un rangement pour l'œil. |
| `famille` | Seuls les artworks de la famille du sujet partent en référence, plus ceux marqués « tous ». **Le nombre de références change le coût.** |

Deux champs voisins, deux lignes qui ne se ressemblent pas : c'est tout ce que l'écran
n'arrivait pas à dire.

#### Un nom qui vit dans un `placeholder` n'est pas un nom

Trouvé en branchant le motif, le 27 août 2026, et c'est **la moitié de la réponse à la
question qui l'a lancé**. Dans le menu d'une carte, `groupe` et `note` n'avaient aucun
libellé : leur seul nom était le texte gris du champ vide, qui disparaît dès qu'on tape
dedans. Un champ rempli n'avait donc plus de nom du tout — impossible à identifier en le
relisant, et impossible à expliquer, puisque le motif accroche l'explication au libellé.

C'étaient les deux seuls champs du produit dans ce cas ; leurs voisins de la même colonne —
*Taille*, *Artwork officiel*, *Famille* — en avaient un. Ils en ont un maintenant, et le
`placeholder` redevient ce qu'il doit être : la valeur vide (`aucun`, `—`), pas l'identité du
champ.

**La règle qui en sort** : un contrôle dont le nom disparaît quand on s'en sert n'a pas de
nom. Le pointillé n'est donc pas seulement une marque d'aide — il est le test qui a révélé
le trou, parce qu'il n'avait nulle part où se poser.

#### Le survol révèle, le clic retient

La grammaire est celle du menu de carte, réemployée sans un réglage de plus : 200 ms de
repos pour paraître — assez long pour traverser un panneau sans rien déclencher, assez court
pour battre le clic —, 150 ms de grâce en partant, `Échap` ou un second clic sur le libellé
pour lâcher l'épingle. Le clic épingle parce qu'une explication de quatre lignes se lit sans
que la main reste immobile, et parce qu'on peut vouloir en copier un mot.

**Le fondu de 80 ms n'ajoute pas de ligne à la liste close du § Motion — il en rejoint une.**
C'est la même entrée que le menu de carte, pour la même raison d'admission : la chose paraît
**sans clic**, donc sans geste qui dise qu'on l'a demandée, et les 80 ms sont ce qui la fait
lire comme posée par-dessus plutôt que comme une grille qui vient de se recomposer. Un
second locataire d'une entrée existante, pas une entrée de plus.

**Le clavier n'est pas un rattrapage** : le libellé prend le focus, `Entrée` épingle,
`aria-describedby` relie le panneau au contrôle. Un réglage qu'on atteint au clavier doit
pouvoir s'expliquer au clavier.

#### Ce qui est écarté

**Un mode d'aide** — une bascule dans la barre de tête, éteinte par défaut, qui allumerait
les marques. Le calme au repos serait parfait, mais on n'est jamais perdu *avant* d'ouvrir un
panneau : on l'est en le regardant, et il faudrait alors sortir du geste pour aller allumer
une lampe. Un mode, c'est aussi un état de plus à tenir dans un produit qui en compte déjà
beaucoup, pour économiser un pointillé.

**Un texte plus long, ou une image dans l'infobulle.** Le panneau est borné à trois lignes
parce qu'au-delà c'est le guide qu'on veut, et le guide est à un clic — même partage que la
tuile et la fiche : *une tuile porte un nom, trois mesures et deux marques ; au-delà, c'est
la fiche qui prend le relais.*

**Une explication sur un contrôle grisé.** Elle existe — le libellé garde son pointillé —
mais elle ne remplace ni ne déplace la raison, qui reste dans sa fente, permanente. Les deux
cohabitent parce qu'elles ne disent pas la même chose : *pourquoi c'est fermé* n'est pas
*à quoi ça sert*.

#### Un seul corpus, deux rendus

**L'infobulle et le guide sont le même texte.** Le panneau rend les trois lignes d'une
entrée du guide ; l'écran Guide rend toutes les entrées à la file, avec le contexte autour.
Ce n'est pas une commodité de construction, c'est la règle que ce document a déjà appliquée
deux fois — *deux comptes calculés à deux endroits se contredisent* (bloc « Ce qui part »),
*deux éléments qui disent la même chose à deux altitudes, et aucun des deux n'est l'autorité*
(le bandeau hors ligne). Une explication recopiée dans deux fichiers diverge en trois
semaines, et c'est celle qui est sous les yeux au moment du doute qui sera la fausse.

**Un réglage sans entrée n'a pas de pointillé, et rien ne casse.** Aucune infobulle vide,
aucun `à documenter` dans le châssis. C'est le **guide** qui tient la liste de ce qui lui
manque, dans sa dernière section — un manque de guide est un fait sur le guide, et il se
range là où les guides vivent. Même partage que le journal des ratés : hors de la grille,
dans la colonne qui parle déjà de ça.

#### Le corpus est complet, et « complet » a un sens précis

Écrit le 27 août 2026, au bout du chantier. Le motif était branché sur dix-neuf entrées et
la dernière section du guide en listait **six manques**. Les combler a demandé de trancher
ce que « un réglage » veut dire, et trois réponses en sont sorties — chacune a déplacé une
frontière, pas seulement rempli une case.

**Quarante-six entrées, quatre écrans.** Le groupe *Dans la découpe* entre à cette
occasion, et c'est un **écran, pas un thème** : quand on cherche une explication, on se
souvient d'où l'on était, pas de quelle famille conceptuelle relevait le curseur. Ranger
les lignes et les colonnes sous *la retouche* au motif qu'elles viennent après la
génération aurait été un classement juste pour le rédacteur et faux pour le lecteur. Les
comptes : univers 20, atelier 4, retouche 18, découpe 4.

**Une étape de recette est un réglage, et c'est le plus structurant de tous.** Elle décide
qu'une des cinq places est occupée. Documenter `tache minimale` sans documenter
*Nettoyage des bords* aurait laissé le parent plus opaque que son enfant — le contraire de
ce qu'on cherche, puisque c'est le nom du bloc qu'on lit d'abord. Les cinq titres portent
donc leur pointillé, et leurs entrées disent l'ordre fixe : *rien ne peut se recadrer avant
qu'un alpha dise où est le sujet.*

**Un contrôle grisé s'explique — et `disabled` l'en empêchait.** Le § Ce qui est écarté
promettait déjà que le libellé d'un contrôle refusé garde son pointillé, parce que
*pourquoi c'est fermé* n'est pas *à quoi ça sert*. Un `<button disabled>` ne dispatche
aucun événement de souris, **pas même sur ses enfants** : l'explication d'une étape grisée
aurait donc été la seule du produit à ne jamais s'ouvrir, et c'est précisément celle qu'on
va chercher à ce moment-là. La rangée passe à `aria-disabled`, avec le clic gardé par une
condition. Le refus est entier — le clic ne pose rien —, la raison reste dans sa fente
juste dessous, et l'explication s'ouvre par-dessus. C'est un cas où **la règle du motif a
corrigé le code**, et pas l'inverse.

**Le seuil de la jauge de retouche sort de la liste des manques, et n'y est pas remplacé.**
Les 240 ms sous lesquelles rien ne paraît ne sont pas un réglage : personne ne peut les
toucher, et aucun libellé de l'écran ne pourrait porter leur pointillé. Ils vivent au
§ Motion, là où les décisions de mouvement se tranchent. **Une liste de manques qui garde
un item impossible à combler cesse d'être une liste de travail** — c'est la même hygiène
que le tramage retiré du corpus le même jour, par l'autre bout : là un réglage qu'on ne
peut pas atteindre, ici un manque qu'on ne peut pas écrire.

**Il reste un manque, et il est structurel** : les réglages qu'un modèle déclare en propre.
Le catalogue les nomme, et il change d'un jour à l'autre — 47 modèles le 26 août, 48 le 27.
Aucune entrée écrite d'avance ne peut les couvrir, et c'est exactement pour ça que le guide
tient une liste plutôt qu'une promesse.

#### Deux règles de rédaction que le remplissage a fait apparaître

**Deux entrées d'un même écran ne portent jamais le même nom.** Le guide rend les entrées à
la file, groupées par écran, et le nom est le titre de chacune : deux « famille » à la suite
dans *Dans l'univers* — celle d'une carte, celle d'une échelle du barème — et le lecteur ne
sait plus laquelle il lit. C'est la seule collision que le regroupement ne rattrape pas,
puisqu'il **est** le regroupement. Le même mot dans deux écrans différents, lui, est
correct : c'est le même mot à l'écran.

**Un libellé peut s'éteindre, et c'est la seule variante permise.** Les cinq champs de la
bible descendent en `--texte-3` quand ils ne portent rien. Le gabarit de libellé prend donc
un état *éteint* plutôt qu'un second gabarit : **un second endroit où poser le pointillé
est un endroit où l'oublier**, et c'est la panne que ce motif ne peut pas se permettre —
elle est silencieuse. Un test la couvre désormais, en confrontant toute clé branchée à
l'écran au corpus : une clé mal tapée ne lève pas, elle rend le réglage muet.

#### Ce qui n'a pas d'ancrage à l'écran, et pourquoi c'est correct

Trois entrées vivent dans le guide seul — `famille d'une échelle`, `occupation d'une
échelle`, `se détoure / plein cadre`. Les trois contrôles sont **répétés sept fois**, une
fois par échelle du barème, et aucun ne porte de libellé : chacun montre sa valeur, ce qui
suffit à le nommer. Vingt-et-un pointillés dans un bloc de sept rangées seraient la maquette
écartée et ses « options partout » ; inventer une rangée de légende pour les porter serait
inventer un motif pour un cas. Le bloc *Barème d'échelles*, lui, porte le sien, et son
entrée nomme les trois choses qu'une échelle transporte. `Le guide ›` mène juste au-dessus
des trois entrées longues.

La même chose vaut pour `provenance`, qui n'est pas un réglage mais un fait — l'adresse
gardée au collage. **Une entrée sans ancrage est permise ; un ancrage sans entrée ne l'est
pas** : le premier laisse une explication à un clic de plus, le second laisse un réglage
muet.

**Et un contrôle a gagné un nom au passage** : le moteur de détourage. Ses trois voisins de
la passe — tolérance, seuil alpha, durcissement — en portaient un ; celui-ci se lisait sur
ses deux segments, « bord » et « modèle », c'est-à-dire sur ses **valeurs**. Même famille
que `groupe` et `note`, dont le nom vivait dans un `placeholder` : *un contrôle qui n'est
nommé que par ce qu'il vaut n'a nulle part où accrocher son explication.* Le pointillé n'a
pas seulement documenté le produit, il a servi une troisième fois de détecteur.

### L'annulation se pose dans une fente, jamais dans un bandeau

Le § Motion réserve 160 ms à « l'annulation après suppression », et ne dit pas où elle se
pose. La réponse est venue du même raisonnement que le repli hors ligne, le même jour :
**un bandeau est du châssis en travers de la grille**, et une suppression n'en mérite pas
plus qu'une panne de réseau.

Elle se pose donc dans la **barre d'outils de la grille** — 38 px qui existent déjà —, à
droite, et **dans la forme exacte de la fente sous Générer** : tiret de 8 px, mono 10 px,
`--epingle` pour le fait, lien `--signal` pour le geste. Le décompte est celui que le
serveur a annoncé, jamais un délai recompté à l'écran : c'est lui qui refuse au-delà, et
deux délais écrits à deux endroits finiraient par se contredire.

```
   Chercher   [Favoris]   12 images            — 3 supprimés · 6 s   Annuler ›
```

**La couleur est `--epingle`, et c'est la même définition que ses deux autres emplois** :
*arrêté à un instant, que le système ne bougera pas tout seul, et que seul un geste de
l'auteur relance*. Une suppression en sursis est exactement cela.

### La barre d'outils ne perd jamais son filtre

Une sélection **ajoute** des gestes à droite du compteur ; elle ne prend pas la place de la
recherche ni du filtre favoris. La règle a été écrite après l'avoir violée : ouvrir une
fiche sélectionne, donc la barre basculait en mode sélection, donc le filtre posé
disparaissait de l'écran — et « fermer le panneau remet exactement où l'on était » (US-37)
devenait faux sans que rien ne l'ait dit.

**Et l'anneau `--lumiere` n'a qu'un sens : sélectionné.** La fiche n'est pas un état de
plus — c'est la sélection quand elle vaut un. Deux images sélectionnées ferment la fiche et
laissent la barre d'outils faire le travail de lot ; une seule la rouvre.

### L'emplacement

Au moment où la génération part, N tuiles paraissent **à leur taille définitive**, avec la jauge
en pied de zone image et le compteur en mono (`1 / 3`, `00:08`). La tuile devient l'image, ou
devient l'échec — fond `rgba(196,99,92,.05)`, bordure `rgba(196,99,92,.45)`, la raison en clair à
la place du sprite et `Relancer` à la place de la méta.

**La grille ne se recompose jamais entre le départ et l'arrivée.** L'œil reste exactement où il
était, et l'échec atterrit à l'endroit précis où le succès serait arrivé.

### Densité de l'information sur une tuile

Une tuile porte au maximum : un nom, trois mesures, une marque de favori et une pastille d'état.
Au-delà, c'est la fiche qui prend le relais. C'est la règle qui empêche la grille de redevenir la
maquette écartée.

---

### La visionneuse ne défile pas — et le curseur envoie ce qu'on a lâché

Écrit le 27 août 2026, en réglant un détourage pour de vrai. Trois faits mesurés au navigateur,
bout en bout, PUT compris, sur une image dont le brut fait 1024 px :

| Le geste | Ce que ça coûte |
|---|---|
| Occupation, ancrage, marge — **la queue de la recette** | **29 ms** |
| Recadrage recalculé | 204 ms |
| Un cran de tolérance — **le détourage repasse** | **1 492 ms** |
| Le moteur `modèle` | **1 840 – 2 255 ms** |

« Chaque réglage répond sans attente perceptible » était vrai de la première ligne et faux des
deux dernières. Tout ce document en découle.

**La visionneuse est le sujet du panneau, pas son premier bloc.** Elle sort donc du défilement et
se pose sous l'en-tête de 30 px, comme lui fixe. On règle un détourage *en regardant ce qu'il
fait* ; avec l'image en tête de défilement, un curseur posé six cents pixels plus bas obligeait à
remonter à chaque cran pour voir ce qu'on venait de faire, ce qui n'est pas un réglage mais un
aller-retour.

**Ce qui bouge quand on règle reste sous les yeux ; ce qui ne bouge pas descend.** L'image, la
bascule rendu/brut et les dimensions restent — les dimensions changent avec le recadrage et la
grille, c'est un fait qu'on surveille. Le sujet de la génération descend dans le défilement : on
le lit une fois, il ne bougera plus.

**Carrée, large comme le panneau, bornée en largeur par la hauteur de l'écran.** `max-width: 46vh`
et non `max-height` : `aspect-ratio` cède devant `max-height` — le navigateur rabote la hauteur
sans redéduire la largeur, et le damier cesse d'être carré. C'est la leçon déjà payée sur le cadre
de l'écran Découpe, et la borne ne mord que sous 760 px de haut, où l'image cède au calcul plutôt
qu'aux contrôles.

**Un curseur envoie ce qu'on a lâché, pas ce qu'on a traversé.** Un cran de segment est un choix,
il part ; un cran de curseur est un point de passage, et personne n'a demandé à le voir. Ce n'est
pas une économie de confort : le serveur sérialise les retouches, donc un glissement de la
tolérance sur vingt crans, c'était **vingt appels de 1,5 s à la file** — une demi-minute pendant
laquelle l'image défilait des valeurs intermédiaires. Vérifié après : vingt-et-un crans, **zéro
appel** ; un relâchement, **un appel**. La valeur sous le curseur, elle, suit la main sans
attendre — c'est elle qui rend le contrôle vivant, pas le rendu.

### La jauge de la fiche — la même barre, deux réglages

**Une seule jauge dans tout le produit.** Celle d'une tuile en génération et celle d'une retouche
sont le même composant, les mêmes 2 px, la même courbe asymptotique qui n'atteint jamais le bout.
Elle se pose au bord bas de la zone image, à l'endroit exact où une tuile porte la sienne.

Deux réglages, parce que les deux attentes du produit n'ont pas la même échelle :

- **Pas de compteur.** Une génération court dix à vingt secondes et on peut quitter l'écran : son
  `00:08 / ~00:15` dit s'il faut attendre. Une retouche court une à deux secondes, la main encore
  sur le curseur — un nombre qui change deux fois n'apprend rien.
- **Un seuil de 240 ms**, la borne haute des durées du § Motion, réemployée. Sous ce seuil, rien
  ne paraît du tout : la queue de la recette répond en 29 ms, et y faire clignoter une jauge
  serait pire que de ne rien montrer. Vérifié : sur un cran d'occupation, la jauge n'apparaît à
  aucun instant.

**L'attente s'apprend au lieu d'être écrite.** Le serveur publie une durée attendue pour une
génération — la médiane de ce modèle-là — mais rien pour une retouche. L'écran garde donc ce que
la dernière du même genre a mis, sur cette machine et sur cette image, avec les valeurs de la
mesure en amorce. Il n'y a que deux genres, et c'est le serveur qui les sépare : les passes ont
bougé, ou seulement la queue.

**L'image ne se vide pas et ne se grise pas pendant.** Elle reste le rendu d'avant, entier et
jugeable — on compare toujours à quelque chose, et c'est la jauge qui dit que ce n'est pas encore
le bon.

### Le bloc repliable — un bloc replié ne se tait pas

Ajouté le 27 août 2026, en même temps que la règle qui borne les panneaux, et pour la raison
inverse : borner un panneau le fait défiler honnêtement, mais un panneau de 1471 px qui défile
reste un panneau de 1471 px. La question n'était pas de cacher, c'était de **résumer**.

> **Un bloc replié porte son réglage, en mono, à droite de son titre.**

C'est la seule ligne qui compte. Le repli cesse d'être un rangement et devient un résumé : la
recette d'un asset se lit en cinq rangées sans rien ouvrir, et le panneau de l'univers devient la
fiche de l'univers. **Un panneau plié se lit mieux que déplié** — sans ça, le mécanisme ne serait
pas dans ce document.

```
 Détourage             bord · 28        posé      → --signal
 Recadrage             marge 0 px
 Grille                64 px · 100 %
 Quantification                         grisé     → sa raison, tiret de 8 px
  — aucune palette : elle se déduit des artworks
 Nettoyage des bords                    pas posé  → le carré vide le dit déjà

 Bible                          —       rien de posé → --texte-3
 Taille de pixel            96 px
```

**La marque de repli est la valeur elle-même.** Replié, l'en-tête porte le réglage ; ouvert, il se
tait — la valeur est dans le bloc, sous les yeux, et rien ne s'écrit deux fois. **Aucun glyphe
neuf n'entre dans le produit**, et ce n'est pas une coquetterie : les deux candidats évidents sont
pris. Le `+` en bout de rangée d'en-tête veut dire *nouvelle entrée* dans l'arbre, le triangle
plein veut dire *favori* sur une tuile. Un chevron serait un quatrième glyphe dans un produit qui
en compte trois. L'affordance tient au survol de la rangée — `--fond-3`, 80 ms, le survol du
produit — et à la valeur en `--signal`, qui se lit comme quelque chose qu'on va éditer.
**Coût assumé** : si au bout de deux jours d'usage on clique à côté, c'est raté, et il faudra le
chevron.

**La rangée fait 26 px** — celle de l'arbre, au § Spacing. Aucune hauteur neuve, comme aucune
couleur neuve.

**Ce qui se replie**, et c'est une règle à deux conditions : ce qui coûte plus de place qu'un rang
de segments, **et** ce qui porte un choix qui se dit en une ligne. Un contrôle qui tient sur 26 px
ne se replie pas — le repli lui coûterait un clic pour ne rien rendre.

| Panneau | Ne se replie jamais | Se replie | Mesuré |
|---|---|---|---|
| **Réglages** `300` | Proportions, Variations, Sujet, les options du modèle, *Ce qui part* | Modèle — la liste vaut 280 px à elle seule | 950 → 620, il tient |
| **Fiche** `380` | la visionneuse, la rangée du jugement, Réinjecter | les 5 passes de la recette, Filiation | recette 522 → 192 |
| **Univers** `380` | — | Bible, Palette, Taille de pixel, Barème, Modèle par famille | 1471 → 130 |
| **Arbre** `240` | tout | rien | — |

L'arbre est le cas qui explique la règle : ses sections sont de la **navigation**, chaque projet
s'ouvre déjà par sa rangée, et le `+` de son en-tête a déjà un sens. Réinjecter est l'autre : une
rangée de gestes n'a pas de valeur à résumer, donc rien à dire une fois repliée.

**La recette est le cas particulier, et sa rangée porte deux actes.** Une étape de recette avait
déjà un état — *posée* ou *pas posée* —, et il ne se confond pas avec *montrée* ou *pas montrée* :
le premier change l'asset, le second ne change que l'écran. Le carré de 9 px garde le premier, le
titre prend le second, et une étape qui n'est pas posée n'a rien à replier — toute sa rangée la
pose, comme avant. **Poser une étape l'ouvre** : c'est le même geste, on demande ses contrôles en
la posant.

**Trois règles pour que ça ne dérive pas.** Replié par défaut, partout — un panneau neuf affiche
son état complet, et l'auteur ouvre ce qu'il vient toucher. L'état de repli est **global et par
bloc** : il survit au changement d'asset et à la fermeture du panneau, ce qui est déjà la promesse
d'US-37, et personne ne veut gérer deux cents états de repli. **Rien ne s'ouvre tout seul** — sauf
une étape qu'on vient de poser : l'en-tête dit déjà l'état, donc rien n'a besoin de s'ouvrir pour
se faire remarquer.

**La droite de la rangée dit toujours un fait sur le bloc**, et les deux locataires ne cohabitent
jamais : replié c'est la valeur, ouvert c'est ce que le bloc veut garder sous les yeux pendant
qu'on le règle — `48 au catalogue` pendant qu'on choisit un modèle, `déduite des artworks` quand
la palette est vide. Même fente, même mono 9,5 px, `--texte-3` pour le fait et `--signal` pour la
valeur.

---

### L'écran Univers, et la carte qui n'est pas une tuile

Ce document ne portait rien sur le tableau d'inspiration ni sur l'univers — ils arrivent en
T4, et l'écran est dérivé des motifs transversaux plutôt qu'inventé. Ce qui suit est ce que
la dérivation a tranché, écrit ici parce qu'une décision d'apparence qui ne vit que dans le
code finit par contredire ce document.

**`380px · 1fr` en grille, `380px · 1fr · 380px` en toile.** L'univers à gauche, le tableau — ou
la toile — au milieu, la réserve à droite quand la toile est ouverte. 380 est la largeur de la
fiche asset : c'est *la* colonne de réglages du produit, et lui donner une **valeur** de plus
ferait un troisième vocabulaire de largeur pour la même sorte de chose. Une **colonne** de plus,
non : réécrit le 27 août 2026 avec la toile, parce que la phrase d'origine — « et pas une
troisième largeur » — interdisait un nombre et se lisait comme interdisant une colonne. La
réserve reprend la 380 telle quelle, pour ce qu'elle nomme déjà : ce qu'on manipule. La grille
reste disciplinée, comme partout.

**C'est un écran, pas un panneau — et c'est le cadrage qui le dit** (`docs/ARCHITECTURE.md`
§6.2 : « Univers · au début d'un projet, puis ponctuel »). Il couvre donc l'Atelier au lieu
de s'y ajouter. La contrepartie est exacte : l'Atelier ne montre que ce qu'on touche **à
chaque** génération, l'Univers tout ce qu'on pose **une fois** et qui s'applique ensuite
tout seul.

**Corollaire obligatoire : il porte sa propre fente de refus.** Une raison envoyée à la
barre d'état de l'Atelier serait rendue *derrière* lui — donc invisible au moment précis où
elle compte. Elle se pose dans la barre de tête de 44 px, dans la forme des autres : tiret
de 8 px, mono 10 px, `--echec` pour un refus. Le motif ne change pas, seul son emplacement
suit l'écran qui l'a provoqué.

**La carte a le rayon 2 du châssis, la tuile garde le rayon 0.** C'est la seule différence
de forme entre les deux grilles, et elle suffit à dire ce qu'elles sont : une tuile est un
produit du travail, et le rayon nul la fait lire comme une planche contact ; une carte est
de la matière rassemblée, donc du châssis. « Une seule grille d'assets dans tout le
produit » reste vrai — celle-ci n'en est pas une, et se voit tout de suite comme telle.

**Une carte porte au maximum : une image ou un texte, une provenance, un mot de pied et une
marque.** La même règle de densité que la tuile, et le même vocabulaire de marque : le coin
plein en `--signal` dit **artwork officiel** — ce que l'auteur pose est une forme —, le mot
du pied dit la famille ou le groupe — ce que le système constate est un mot. Aucune couleur
supplémentaire n'entre dans le tableau — et sur la toile, la couleur se pose sur l'îlot et sur la
note, jamais sur la carte (§ Color, *Les teintes d'îlot*).

#### Le menu d'une carte — le survol révèle, le clic retient

Écrit le 27 août 2026, en promouvant des artworks pour de vrai. Le menu vivait **dans** la carte :
elle grandissait de 300 px en s'ouvrant, la rangée entière suivait, et les voisines devenaient des
rectangles vides. Une grille qui se recompose parce qu'on regarde une carte, c'est exactement ce
que le produit refuse déjà pour la grille d'assets — *l'œil reste exactement où il était*.

**Le menu se pose par-dessus, jamais dans le flux.** Absolu, au-dessus des voisines. La grille ne
bouge plus d'un pixel : vérifié aux deux extrémités du tableau, position et hauteur de chaque
carte identiques avant et après ouverture.

**Sous la carte, ou au-dessus d'elle, jamais dessus.** C'est la réponse à « le menu est plus grand
que la vignette » : il fait 300 px pour une carte 1× qui en fait 190, donc il déborde
nécessairement — mais sur les **voisines**, et jamais sur l'image qu'il règle, ce qui serait
absurde puisque c'est elle qu'on regarde en réglant. Largeur : celle de la carte, et **au moins
240 px** — une carte 1× est trop étroite pour la rangée des familles, qui y passerait à cinq
lignes.

**La place se mesure autour de la carte, jamais autour du menu.** Écrit d'abord dans l'autre sens,
et faux : le menu rendu sous la carte, on regardait la place au-dessus de *lui*, qui comprend la
carte entière. Il basculait donc vers le haut en croyant tenir, et se posait deux cents pixels
au-dessus du cadre visible. La carte est l'ancre ; c'est autour d'elle qu'on compte.

**Et un menu est borné par l'écran, jamais par son contenu** — la règle du § Layout, un cran plus
bas. Quand il ne tient ni dessus ni dessous, il prend exactement ce qui est offert et défile en
dedans. **Sans plancher, exprès** : un plancher le rendait plus haut que la place, donc rogné par
le cadre du tableau, donc son pied inatteignable. Un menu court qui défile vaut mieux qu'un menu
complet dont on ne peut pas atteindre `Retirer`.

**Le survol révèle, le clic retient.** 200 ms de repos font paraître le menu — assez long pour
traverser la grille sans rien déclencher, assez court pour battre le clic, ce qu'il doit gagner
sur lui pour servir à quelque chose. Le pointeur qui quitte la carte *et* son menu l'efface après
150 ms de grâce, le temps de traverser la gouttière de 9 px sans le perdre.

Le clic, lui, n'est pas remplacé : il **épingle**. La carte reste choisie, anneau `--lumiere`
comme partout ailleurs, et le menu ne s'efface plus. Ce n'est pas du confort — ce menu porte
`groupe` et `note`, deux champs de saisie, et un menu qui s'évapore parce que le pointeur a dérivé
pendant qu'on tape une note est inutilisable. Corollaire : **on ne vole pas un menu à un clavier
en train de s'en servir.** Survoler une autre carte déplace le menu, sauf si un champ du menu
épinglé a le focus.

**Le fondu de 80 ms entre dans la liste close du § Motion**, et par sa propre règle d'admission.
Le menu paraît **sans clic**, donc sans geste qui dise qu'on l'a demandé : les 80 ms sont ce qui
le fait lire comme une chose venue se poser par-dessus, plutôt que comme une grille qui vient de
se recomposer — ce que le produit passe justement son temps à ne pas faire. Les 2 px de levée sont
ceux de l'arrivée d'un asset dans la grille, à un pixel près : même vocabulaire pour la même
chose, *quelque chose est là qui n'y était pas*.

**Les vignettes 1× / 2× / 4× sont les crans du zoom de la grille**, réemployés. Un seul
vocabulaire de taille dans tout le produit ; ce sont deux contrôles distincts sur deux
grilles distinctes, et ils ne se confondent pas parce qu'ils ne cohabitent jamais.

**La palette se montre en carrés de 20 px, sans nom.** C'est une vérification à l'œil —
« voir ce que la machine y a lu » (US-54) —, pas une liste à lire ; le code hexadécimal est
au survol, seul endroit du produit où une infobulle est permise parce qu'elle ne porte
aucune raison. Sans artwork, le bloc ne disparaît pas : il porte sa raison, comme tout
grisé du produit.

#### La toile, la réserve et les îlots

Écrit le 27 août 2026, au cadrage de T8, après une séance d'essai sur le produit tenu : la grille
montrait tout d'un coup d'œil et ne permettait d'organiser rien. Le tableau gagne une seconde vue,
et ce qui suit est ce qui, d'elle, relève de l'apparence.

**La règle est une phrase, et l'écran ne doit rien dire d'autre : la toile montre ce qui est
classé, la réserve contient ce qui reste à classer.** Tout en découle — pourquoi la réserve n'est
pas une grille de plus (c'est *la* grille du tableau, filtrée sur ce qui n'a pas de place),
pourquoi une carte sans groupe n'est jamais sur le plan, pourquoi tirer est le seul geste à
apprendre.

**L'interrupteur de vue est dans la barre du tableau**, à côté des crans de vignette, dans la
forme des segments existants : `grille` et `toile`. Un troisième contrôle de barre, et non un
onglet — l'écran ne se dédouble pas, c'est la même matière regardée autrement.

**L'îlot est du châssis, pas un objet dessiné.** Cadre de 1 px dans sa teinte, rayon 2 comme la
carte, fond de la même teinte à 8 % — sous le seuil où l'œil la trouve seule, assez pour
délimiter. Son titre est le nom du groupe, en mono 10 px comme toute mesure du produit : c'est un
fait sur ce qu'il contient, pas une légende ; il porte à côté le nombre de cartes, qui est un fait
de la même sorte.

**Sa teinte est arrivée en T9, et l'absence de teinte reste le châssis** — `--bord-fort` pour le
cadre, `--fond-1` à 40 % pour le fond. Ce n'était pas un provisoire : un îlot sans teinte est
exactement ce que la phrase ci-dessus décrit, du châssis, et c'est pourquoi la rangée de pastilles
en compte **sept** — les six, plus celle qui montre le châssis. La septième n'est pas une septième
couleur : c'est l'absence, montrée plutôt que dite, et elle évite un huitième glyphe en forme de
croix. La liste close du produit ne bouge donc pas d'un nom. Écrit le 28 août 2026, en livrant T8,
complété en livrant T9.

**Le nom de l'îlot est la poignée de son menu, et c'est la seule surface vivante qu'il ait.** Un
îlot n'a pas d'identité, il a un nom — et depuis T7, *le libellé est la cible*. La bande de son
titre passe en `pointer-events: auto` sous un nœud qui reste en `none` ; l'argument est géométrique
et il se mesure : la boîte de l'îlot part **au-dessus** de la boîte englobante de ses membres, donc
ces 20 px ne recouvrent aucune carte, par construction. Une surface qui ne recouvre rien ne prend
rien à personne, là où rendre la *boîte* vivante aurait volé chaque prise de carte. Ce qu'on perd
est 20 px de plan par îlot pour le déplacement du plan, et ça se dit. **Il ne se saisit toujours
pas.**

**Le menu s'ouvre au-dessus de la bande, et le nœud monte à `z-index: 10` en s'ouvrant.** Sans quoi
il se rendrait **sous** les cartes qui entourent l'îlot — c'est-à-dire sous exactement ce qu'il
décrit —, l'îlot étant posé à 0 et les cartes à 1. Il redescend en se refermant : un îlot resté
élevé volerait les clics de ses propres membres.

**Il ne se saisit pas.** On le traverse pour prendre une carte, et pour déplacer le plan. C'est le
corollaire visuel de « l'îlot *est* le groupe » : ce qui n'a pas d'existence propre n'a pas de
poignée. Déplacer un rangement, c'est déplacer ce qu'il contient.

**La poignée de largeur est de 10 px, au coin bas-droit, et elle ne paraît qu'au survol de la
carte.** Même règle que le menu — *le survol révèle* —, même vocabulaire que le châssis : rayon 2,
cadre `--bord-fort`, fond `--fond-3`, aucune couleur neuve. Elle est à l'échelle du plan comme la
carte qu'elle règle, et la carte **suit la main pendant qu'on tire** : la largeur est une place
occupée, et une place ne se juge qu'en la voyant prise.

**Une carte sur la toile est la carte du tableau, sans un pixel de différence.** Même rayon 2,
même menu au survol, même coin plein pour l'artwork officiel. Une seconde forme de carte ferait
une troisième grille dans un produit qui n'en veut qu'une.

**La largeur libre s'aimante sur les trois largeurs de vignette du tableau** — celles qu'une carte
1×, 2× et 4× prend dans la grille, mesurées à l'ouverture et jamais écrites en dur. C'est le seul
endroit du produit où une mesure est continue ; l'aimant est ce qui l'empêche d'être arbitraire, et
le cran cesse d'être la seule valeur possible pour redevenir un repère.

**Rien ne se recompose tout seul sur la toile.** Aucun alignement automatique, aucune
distribution, aucune mise en page qui reflue quand une carte arrive : c'est *l'œil reste
exactement où il était* appliqué à la surface dont c'est la raison d'être. La liste close du
§ Motion ne s'allonge pas — le plan qui se déplace sous le geste n'est pas une animation, c'est le
geste.

**Et l'annulation ne se pose nulle part.** Le § Motifs a tranché qu'une annulation vit dans une
fente et jamais dans un bandeau, parce que le geste qu'elle rattrape est rare et explicite. Sur la
toile, le geste risqué est le déplacement — c'est-à-dire le geste permanent : une fente qui
clignote à chaque glissement serait du bruit. Ctrl+Z, sans surface, et la pile meurt en quittant
l'écran.

#### Le trait, la note, et la couleur qui entre

Écrit le 28 août 2026, en livrant T9. Trois choses s'ajoutent à la toile, et **aucune n'ajoute un
glyphe** : le produit garde les siens.

**Le trait est droit, en `--bord-fort` au repos, `--texte-2` au survol.** Droit et non courbe :
`PLAN.md` dit « un trait nu », et une courbe de Bézier ferait lire l'écran comme un outil de
diagrammes. `--bord-fort` et pas `--bord` parce qu'un lien n'est pas une séparation, c'est du
contenu — et `--bord` est sous le seuil où l'œil le trouve seul (§ Layout, mesuré). Il passe
**derrière** ce qu'il relie, comme un îlot est derrière ses cartes. Il ne prend **aucune teinte** :
la liste des surfaces colorables reste close à trois, et un trait coloré ferait un septième
vocabulaire de couleur sur un écran qui en compte déjà six qui ne veulent rien dire.

**Un lien qui a un mot se survole par son mot ; un lien muet se survole par sa bande.** C'est ce qui
rend le défaut muet payable : un trait de 1 px ne se survole pas, et la zone d'écoute de 20 px que
la librairie pose le long du tracé est de la surface, donc de son ressort. Le mot se pose au milieu
du trait, en **mono 10 px** sur une pastille `--fond-0` pour que le trait ne le traverse pas — c'est
un fait sur ce qui est là, comme le nom d'un îlot, pas une légende. Un lien muet n'a pas de cible au
clavier : c'est la contrepartie assumée du défaut muet, et elle se dit.

**Son pavé de réglage est le menu d'une carte, en plus court** — `--fond-1`, cadre `--bord`,
rayon 2, le fondu `paraitre` de 80 ms, le survol qui révèle et le clic qui épingle. Posé **sous** le
milieu du trait, à la gouttière de 9 px : jamais sur ce qu'il règle, la règle du menu de carte
appliquée. Trois rangées et rien de plus : `Mot`, un champ écrit au relâchement du focus comme
`groupe` et `note` ; `Pointe`, un bouton qui **est la phrase de son état** — `sans pointe` /
`pointe à l'arrivée`, le motif du bouton `silhouette` du barème ; et `Couper`, traité exactement
comme `Retirer` dans le menu d'une carte — mono 10 px, `--texte-3` qui vire à `--echec`. Il ne se
borne pas : un plan n'a pas de bord contre lequel se cogner, et une hauteur en pixels d'écran serait
fausse au premier cran de zoom.

**Il n'y a pas de troisième état de pointe, et pas de retournement.** Le sens vient du tracé — on
tire du départ vers l'arrivée, et la pointe ne fait que rendre visible ce que le geste a décidé.
Retourner un lien, c'est le couper et le retirer dans l'autre sens : deux gestes rares plutôt qu'un
contrôle permanent sur chaque trait.

**Une note s'écrit au double-clic sur le plan nu**, et le champ paraît à l'endroit exact du clic, à
la largeur d'une carte 1×, anneau `--lumiere`. C'est « créée là où elle s'applique » pris à la
lettre : un contrôle de barre aurait posé la note à sept cents pixels de l'endroit qui la demande,
et il aurait fallu ensuite l'y tirer. Le champ n'est pas encore la note — quitté vide, il ne crée
rien, et `Échap` l'abandonne : **le geste s'essaie sans rien casser**, ce qui est la moitié de sa
découverte. L'autre moitié est le corpus, par le `long` de *Vue*, dont le pointillé est à huit
pixels du segment qu'on vient de cliquer pour entrer dans la toile.

**Les sept pastilles ont la forme du carré de palette de l'écran Univers** — `h-5 w-5`, rayon 2,
cadre `--bord` —, parce qu'une pastille n'est pas une marque : c'est la couleur montrée, et c'est
la même défense que la palette, « une vérification à l'œil, pas une liste à lire ». La choisie prend
l'anneau `--lumiere`, qui ne veut dire que *choisi*. Elles vivent dans le menu de l'îlot pour un
îlot, dans le menu de la carte pour une note — jamais les deux au même endroit : deux champs voisins
dont l'un règle la carte et l'autre autre chose, c'est le constat `groupe` contre `famille` qui a
fait naître tout le corpus.

**Ce que la teinte colore, et ce qu'elle ne colore pas.** Îlot : cadre en teinte pleine à la place
de `--bord-fort`, fond de la même teinte à 8 %, nom en teinte à la place de `--texte-2`. Note : fond
à 8 %, et le bord passe de `--bord` à la teinte. **L'anneau `--lumiere` d'une carte choisie prend le
bord, jamais le fond** — les deux ne se disputent que le bord, et le bord suffit à dire *choisi*.
Faire céder les deux rendait la teinte invisible tant que la carte restait choisie, c'est-à-dire à
l'instant précis où on vient de la choisir, puisqu'on choisit la pastille depuis le menu de la
carte. Mesuré à l'atelier lancé le 28 août 2026.

---

### L'écran Découpe, et le cadre qui est l'image

**`1fr · 380px`, et l'image passe à gauche.** L'écran Univers met ses réglages à gauche
parce que l'univers *est* son sujet ; ici le sujet est la planche, et c'est elle qui prend la
largeur. 380 reste la colonne de réglages du produit — la troisième largeur qu'on s'interdit
d'inventer.

**Un écran, pas un panneau, et c'est le geste qui le dit.** On dessine des rectangles sur une
image de mille pixels ; la fiche en fait 380. Il couvre donc l'atelier, comme l'écran Univers,
et **porte sa propre fente de refus** pour la même raison : une raison envoyée à la barre
d'état de l'atelier serait rendue derrière lui, invisible au moment précis où elle compte.

**Il s'ouvre depuis la fiche, jamais depuis la barre d'outils.** On découpe **une** image,
pas une sélection — et le geste vit donc là où vivent les gestes d'une image seule. Dans la
rangée du jugement, en mono 10 px, entre le coût et Supprimer : rien ne permet de savoir
d'avance qu'une image est une planche, donc rien ne doit paraître ou disparaître selon ce
qu'on croit deviner.

**Le cadre de la planche est mis à l'échelle par calcul, pas par le CSS.** Un seul facteur —
celui qui fait entrer la planche dans la place —, et le cadre **est** l'image, au pixel près.
Décidé le 27 août 2026 en mesurant : `aspect-ratio` cède devant `max-height`, le navigateur
rabote la hauteur sans redéduire la largeur, et un cadre de 1388 × 874 pour une image carrée
décale de vingt pixels tout ce qui est posé dessus en pourcentage.

**Les rectangles reprennent la grammaire de la tuile, sans y ajouter une couleur.** Anneau
`--lumiere` pour « choisi », bord `--signal` sinon, et le numéro en mono 8,5 px sur le même
fond `rgba(11,13,16,.82)` que la pastille d'une tuile. Ce numéro est un fait mesuré — c'est
l'ordre de lecture, et c'est celui que la découpe garde.

---

### L'écran Guide, et la seule prose du produit

**C'est un écran, et le cadrage le dit comme il l'a dit pour les deux autres.** Univers est
« au début d'un projet, puis ponctuel » ; le Guide l'est davantage — on l'ouvre quand on ne
sait pas, on le ferme quand on sait. Il couvre donc l'Atelier au lieu de s'y ajouter, comme
Univers et Découpe, et pour la même raison : rien de ce qu'il porte ne se règle en
regardant la grille.

**Il n'a pas de fente de refus, et c'est la preuve qu'on a compris la règle.** Univers et
Découpe en portent une parce qu'ils couvrent la barre d'état et qu'un refus provoqué chez
eux serait rendu derrière eux. Le Guide ne provoque aucun refus : il ne demande rien au
serveur, ne dépense rien, ne peut pas échouer. Le motif ne s'applique pas faute de déclencheur,
et on ne pose pas une fente vide pour la symétrie.

**Sa place dans la barre de tête est à droite, après le seul écart du produit.** Univers,
Catalogue et le nom du projet parlent du travail en cours ; le Guide parle de l'outil. Il
est donc séparé — un `lg` de 24 px, la seule respiration d'une barre de 44 px — et il est le
seul élément de cette barre qui ne change jamais d'état. `?` l'ouvre au clavier, `Échap` le
ferme, comme partout.

#### `240px · 1fr`, et la seule largeur maximale du produit

240 est la colonne de l'arbre, réemployée sans discussion : c'est *où ça se range*, et un
sommaire n'est rien d'autre. Aucune troisième largeur n'est inventée, comme le § Layout et
l'écran Univers l'ont déjà tranché.

**La prose est bornée à 72 caractères, et c'est une exception assumée au § Layout.** « Max
content width : aucune. L'écran large est la ressource du produit, on la dépense » a été
écrit pour la grille — la chose qui *gagne* à s'étaler. La prose est la seule matière du
produit qui **perde** à recevoir de la largeur : à 1 600 px une ligne de français fait
190 signes, et le retour à la ligne suivante devient une recherche. La règle visait la
planche contact ; le guide est son contraire exact, et c'est le seul endroit où l'exception
vaut.

**Et l'unité n'est pas `ch` — mesuré au navigateur, pas déduit.** `72ch` rend **671 px**, soit
88 signes de français : `ch` vaut l'avance du zéro, et le chiffre d'Instrument Sans est bien
plus large que ses bas-de-casse. La valeur juste est **`36em`**, soit 504 px pour une avance
moyenne mesurée à 6,77 px — **74 signes par ligne**. C'est la même erreur de famille que
`aspect-ratio` cédant devant `max-height` sur le cadre de la planche : une unité qui a l'air
de dire ce qu'on veut, et qui mesure autre chose.

**La colonne de prose est calée à gauche, jamais centrée**, et la place qui reste à droite
reste **vide**. Centrer désalignerait le texte de son sommaire pour rien, et remplir la
marge de notes, de figures ou de rappels serait recommencer la maquette écartée sur le seul
écran qui pouvait s'en passer. Le Guide est la seule surface calme d'un produit dense : ce
vide *est* ce qui dit qu'on est sorti de l'atelier.

#### La typographie ne gagne aucun usage

**Instrument Serif reste à trois emplois.** Le titre de l'écran est un titre d'écran — le
deuxième emploi, inchangé. Les titres de section du guide, eux, **ne sont pas en serif** :
ils reprennent la forme de l'en-tête de panneau, déjà dans le produit — sans 12,5 px,
majuscules, `letter-spacing .11em`, `--texte-3` —, séparés du texte précédent par 48 px.

C'est un refus, et il est délibéré. Une hiérarchie de sous-titres en serif de 24 px, sur la
seule page de prose du produit, est *exactement* le basculement en blog que la règle 1 du
§ Typography annonce en toutes lettres : « trois usages de trop et le produit bascule en
blog ». La hiérarchie est portée par l'espace, ce que la direction esthétique demande depuis
la première ligne — *la typographie et l'espace font tout le travail*.

**Le corps est à 15 px, interligne 1,65** — le haut de la ligne « prose longue » de
l'échelle, aucune valeur neuve. Les mesures et les noms de fichiers y restent en mono, par
la règle 2 : un guide qui écrirait `$0,067` ou `donnees/cartes.json` en sans mentirait sur
ce qu'ils sont.

#### Quatre parties, et la troisième est le corpus des infobulles

| Partie | Ce qu'elle porte |
|---|---|
| **Le geste** | La boucle quotidienne dans l'ordre où on la fait : écrire, générer, juger, garder. Une page, aucune option. |
| **Les écrans** | Atelier, Univers, Découpe, Bibliothèque — ce que chacun est *pour*, et pourquoi c'est un écran séparé plutôt qu'un panneau de plus. |
| **Les réglages** | Un par un, **groupés par écran** — univers, atelier, retouche, découpe. C'est le même texte que les infobulles, rendu à la file : les trois lignes, plus le contexte que le panneau de 280 px ne peut pas porter. Le groupe est un écran et non un thème : quand on cherche une explication, on se souvient d'où l'on était. |
| **Ce qui n'est pas encore écrit** | La liste des réglages sans entrée. Un manque de guide est un fait sur le guide — et **rien d'autre n'y entre** : un seuil interne que personne ne peut toucher n'est pas un manque, c'est une décision, et elle vit au § Motion. |

**Le sommaire est l'arbre, sans en être un.** Rangées de 26 px, actif sur `--fond-3`, comme
la colonne de gauche de l'Atelier — mais sans `+`, sans repli et sans menu : il n'y a rien à
créer dans un guide. Une seule grammaire de liste dans le produit, et elle sait déjà se
taire quand on ne lui demande que de conduire.

**Une infobulle mène ici, et le guide n'en porte aucune.** Le lien `Le guide ›` de la
troisième ligne ouvre l'écran à l'ancre du réglage. En sens inverse rien ne survole : la
forme longue *est* déjà l'explication, et un pointillé sur un texte qui explique serait la
promesse d'un troisième niveau qui n'existe pas.

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

## Decisions Log

| Date | Décision | Rationale |
|---|---|---|
| 26/08/2026 | Création initiale — direction « la table lumineuse » | `/design`. Outil personnel de production, écran large, forte densité, la grille d'assets est l'objet central. Chaque décision retire une concurrence à la grille. |
| 26/08/2026 | Châssis sombre et **froid**, un seul accent cyan | Le pixel art de fantasy sature verts, bruns et ors ; un châssis chaud entre en concurrence avec ce qu'on juge. Un fond clair fausserait le contraste perçu d'un sprite. |
| 26/08/2026 | Instrument Serif + Instrument Sans + JetBrains Mono | Même fonderie pour la paire serif/sans — la paire lit comme un choix. Grotesque étroit pour la densité du français. Une seule mono. |
| 26/08/2026 | **Toute mesure en monospace**, partout | Dans ce produit un nombre est toujours un fait mesuré. Coût : `$0,067` est plus large en mono, et deux familles sur une ligne demandent d'accorder taille et ligne de base. |
| 27/08/2026 | L'annulation d'une suppression **dans la barre d'outils**, pas dans un bandeau | Même raisonnement que le repli hors ligne le même jour : un bandeau est du châssis en travers de la grille. Une fente de 38 px existe déjà et ne coûte aucune hauteur. |
| 27/08/2026 | Le **journal des ratés** sous l'arbre, dans la colonne de 240 px | Un appel raté n'entre pas dans la grille (US-23) mais doit rester lisible avec son coût (US-24). La colonne du projet est la seule qui parle déjà d'argent. |
| 27/08/2026 | La barre d'outils **garde** recherche et filtre quand une sélection existe | Ouvrir une fiche sélectionne : faire basculer la barre effaçait le filtre posé, et contredisait « se retrouver exactement où l'on était » (US-37). |
| 27/08/2026 | L'anneau `--lumiere` ne veut dire que **sélectionné** ; la fiche est la sélection quand elle vaut un | Deux états pour la même chose divergent. Constaté à l'écran : deux clics rapprochés se contredisaient. |
| 26/08/2026 | **Rayon 0 sur la tuile**, 2 px sur le châssis | La grille se lit comme une planche contact. Coût : aucune ombre n'est possible sur une tuile. |
| 26/08/2026 | Instrument Serif borné aux titres et aux états vides, ≥ 24 px | Le seul endroit où l'outil a un visage. Coût : règle dure à tenir — trois usages de trop et ça bascule en blog. |
| 26/08/2026 | **L'emplacement persistant** : la grille ne se recompose jamais | L'échec atterrit là où le succès serait arrivé. Coût : des trous dans la grille pendant 10 à 20 s, qui peuvent se lire comme des images cassées si la jauge n'est pas assez lisible. |
| 26/08/2026 | Le grisé porte sa raison en ligne sœur permanente, jamais en infobulle | Rend visible la règle du produit « indisponible avec sa raison, jamais proposé puis refusé ». Coût : chaque contrôle désactivé a besoin d'un emplacement de raison. |
| 26/08/2026 | Aucun mode clair | Un utilisateur, un écran, un usage. Double maintenance d'états pour un mode qui fausserait le jugement. |
| 26/08/2026 | Contrastes mesurés sur `--fond-2`, et `--echec` porté à `#CB6C65` | Le fond le plus clair où du texte est posé. `#C4635C` n'y valait que 4,35 : 1, sous AA — il était mesuré sur le fond qui le flattait. |
| 26/08/2026 | `docs/maquette-atelier.html` définitivement écartée comme base | Châssis ambre en concurrence avec le contenu, `system-ui` en display et body, et un écran qui exhibe le cadrage au lieu de servir le geste. |
| 27/08/2026 | **Aucun bandeau hors ligne** — le repli se pose dans la fente sous Générer | Un bandeau pleine largeur est du châssis permanent en travers de la grille, dans un système dont le principe unique est « chaque décision retire une concurrence à la grille » ; et il introduit une quatrième hauteur sur une colonne qui compte déjà 44 px en tête et 26 px en pied. La fente sous le bouton Générer existe déjà, en mono 10 px, et porte déjà `Ctrl + Entrée` au repos et la raison quand générer est grisé. Argument décisif : sans aucun modèle, générer **est** grisé et c'est le motif de la raison qui reprend la main — deux traitements du même fait à deux endroits selon le nombre de modèles revenus, c'est exactement ce que le bandeau imposait. **Coût** : à 10 px sous un bouton, la ligne se rate plus facilement qu'un bandeau ; on paie ça d'un échec au clic, ce que l'US-95 accepte explicitement. |
| 27/08/2026 | Ce n'est **pas un motif à part** : c'est le revers de « Le grisé porte sa raison » | Le déclencheur est inversé — rien n'est grisé, tout marche, et le risque est le contraire du refus — mais c'est la même fente, la même forme et le même lien. Écrit dans ce motif-là plutôt qu'à côté, pour que la règle et son unique exception se lisent d'un seul tenant. |
| 27/08/2026 | Le repli en `--epingle` ; **`--info` retiré de la palette** | `--epingle` = arrêté à un instant, que seul un geste de l'auteur relance : les trois usages coïncident, et le troisième était déjà « catalogue daté ». `--info` échouait deux fois — il ne se distingue pas de `--texte-2` à 10 px, donc il ne lit pas comme une couleur ; et son bleu-gris posé près du cyan coûte à l'accent son exclusivité. Retiré : le repli était son seul usage, et un token sémantique sans usage ré-autorise un second gris neutre plus tard. **Coût** : un point chaud de plus dans un châssis froid — tenu hors de la grille, jamais à côté d'un sprite. |
| 27/08/2026 | **Une seule voix par bande** : les bandes machine sont en mono, phrases comprises | Corollaire de la règle 2 du § Typography, écrit dans le motif plutôt que dans § Typography pour ne pas réécrire la section. Pied de prompt, ligne de raison, méta de tuile, barre d'état : le sans mélangé au mono demanderait d'accorder deux familles à 10 px pour rien. La date reste en mono parce que c'est une mesure ; la phrase aussi, parce que c'est la machine qui parle. |
| 27/08/2026 | **La date du catalogue vit dans la barre d'état**, pas dans la fente — *corrigé le jour même* | Posée d'abord dans la fente, avec les trois autres choses, pour que les quatre se lisent d'un tenant. Une relecture a montré que ça ne tenait pas : à l'ouverture le prompt est vide, donc le refus « aucun prompt » occupe la fente, donc la date n'était lisible **nulle part** avant que l'auteur ne tape un caractère — or c'est au démarrage que le catalogue doit dire son âge (US-93, critère T1). La règle qui tranche est celle du motif : *une date est un fait sur le monde, pas sur le clic à venir*. La barre d'état est le seul élément rendu en permanence, donc elle la porte. **Ce que ça rachiète** : l'ordre des trois locataires devient juste et non subi — tant que la demande n'est pas composée, il n'y a rien à prédire. **Coût** : les quatre choses ne se lisent plus sur une seule ligne, elles se répartissent sur deux bandes. |
| 27/08/2026 | La **cause** du repli reste dans la barre d'état, elle ne monte pas dans la fente | Le port traduit déjà toute panne de transport en une phrase du produit, et elle dit à l'auteur si c'est son réseau ou celui d'en face — donc elle s'affiche. Mais ce n'est pas une conséquence du prochain clic : la fente porte ce qui va casser, la barre d'état porte ce qui est. Corollaire : la cause **s'ajoute** à la date, elle ne la remplace pas — la barre d'état porte les deux côte à côte, chacune dans son segment, et la fente n'en porte aucune. |
| 27/08/2026 | L'apparition du repli **n'entre pas** dans la liste close du § Motion | Règle posée à cette occasion : un mouvement n'entre dans la liste que si la chose qui arrive n'a aucun autre moyen d'être remarquée. Le fragment arrive dans la seule couleur chaude du châssis — il en a un. Et l'état peut battre plusieurs fois par séance : un fondu dans une bande relue avant chaque clic deviendrait un clignotement. |
| 27/08/2026 | **Le menu d'une carte sort du flux** : survol pour révéler, clic pour épingler | Il vivait dans la carte, qui grandissait de 300 px : la rangée suivait et les voisines devenaient des rectangles vides — la recomposition de grille que le produit refuse partout ailleurs. Posé en absolu **sous** la carte, jamais dessus : il déborde sur les voisines, pas sur l'image qu'il règle. Le clic n'est pas remplacé, il devient l'épingle — le menu porte deux champs de saisie, et un menu qui s'évapore sous les doigts est inutilisable ; d'où aussi « on ne vole pas un menu à un clavier en train de s'en servir ». **Coût** : deux durées de plus à tenir (200 ms de repos, 150 ms de grâce) et un survol qui peut surprendre la première fois — c'est le prix de battre le clic en vitesse, ce qui était la demande. |
| 27/08/2026 | La place d'un menu se mesure **autour de la carte**, et il se borne comme un panneau | Deux erreurs payées à l'écran le même jour. Mesurer la place au-dessus du *menu* plutôt qu'au-dessus de la *carte* le faisait basculer vers le haut en croyant tenir, et se poser 200 px hors du cadre. Puis un plancher de hauteur le rendait plus haut que la place offerte, donc rogné par le cadre, donc son pied inatteignable — retiré : un menu court qui défile vaut mieux qu'un menu complet dont on ne peut pas atteindre « Retirer ». C'est la règle du § Layout appliquée un cran plus bas, et elle vaut pour tout ce qui se pose. |
| 27/08/2026 | **La visionneuse sort du défilement** de la fiche | On règle un détourage en regardant ce qu'il fait. L'image en tête de défilement obligeait à remonter à chaque cran — ce n'est plus un réglage, c'est un aller-retour. Règle générale qui en sort : *ce qui bouge quand on règle reste sous les yeux, ce qui ne bouge pas descend* — les dimensions restent (elles changent avec le recadrage et la grille), le sujet de la génération descend (on le lit une fois). **Coût** : 403 px de tête fixe sur un panneau de 620, donc un défilement plus long pour les contrôles ; borné par `max-width: 46vh` pour qu'un écran court fasse céder l'image et non les contrôles. |
| 27/08/2026 | **Un curseur envoie ce qu'on a lâché, pas ce qu'on a traversé** — et « sans attente perceptible » est corrigé | Mesuré au navigateur : la queue de recette répond en 29 ms, mais un cran de tolérance coûte **1 492 ms** et le moteur modèle **2 255**. Le critère T2 était vrai de la première et faux des deux autres. Un appel par cran, c'était vingt appels sérialisés par glissement — une demi-minute de file pendant laquelle l'image défilait des valeurs que personne n'a demandé à voir. Vérifié après : vingt-et-un crans, zéro appel ; un relâchement, un appel. **Coût** : le rendu ne suit plus le glissement, ce que la promesse de T2 laissait espérer — mais elle ne pouvait pas être tenue à 1,5 s le cran, et la valeur sous le curseur, elle, suit toujours la main. |
| 27/08/2026 | **La jauge quitte la tuile pour le châssis**, avec un seuil et un compteur facultatif | Une seule jauge dans tout le produit, comme il n'y a qu'un vocabulaire de taille et qu'une grille d'assets. Les deux attentes n'ont pas la même échelle : la génération garde son compteur (on peut quitter l'écran), la retouche prend un seuil de 240 ms à la place (la main est encore sur le curseur, et la queue de recette répond en 29 ms). **L'attente s'apprend** faute d'être publiée : l'écran garde ce que la dernière retouche du même genre a mis. **Coût** : la première retouche d'une séance trace une jauge contre une amorce, pas contre une mesure. |
| 27/08/2026 | **Un panneau est borné par l'écran, jamais par son contenu** | Mesuré au navigateur, pas déduit : trois colonnes sur quatre rognaient en silence — 300 px coupés dans les réglages, 660 px dans la fiche, la filiation entière hors d'atteinte. Le seul panneau qui défilait le devait à un accident de construction. Corollaire indissociable : **un bloc ne s'écrase pas pour tenir** — borner les panneaux sans ça faisait tomber la liste des modèles à 0 px. **Coût** : la poignée de barre passe de `--bord` à `--bord-fort`, soit une pièce du châssis qui a le droit de se faire remarquer, et 9 px de gouttière réservée en permanence sur chaque zone qui défile. |
| 27/08/2026 | **Le bloc repliable**, et sa marque est la valeur elle-même | Borner un panneau le fait défiler honnêtement ; ça ne raccourcit rien. La ligne qui justifie le mécanisme est *un bloc replié porte son réglage à droite de son titre* — sans elle, le repli cacherait au lieu de résumer, et un panneau plié se lirait moins bien que déplié. Aucun glyphe neuf : le `+` veut déjà dire *nouvelle entrée* dans l'arbre, le triangle plein *favori* sur une tuile ; un chevron serait le quatrième glyphe d'un produit qui en compte trois. **Coût** : l'affordance tient au survol et à la couleur de la valeur — si l'usage montre qu'on clique à côté, il faudra le chevron. |
| 27/08/2026 | La rangée d'une **étape de recette porte deux actes**, le carré et le titre | *Posée* n'est pas *montrée* : le premier change l'asset, le second ne change que l'écran. Les fusionner en un seul clic obligeait à choisir entre garder une étape posée et la subir dépliée — cinq étapes posées tenaient 522 px dans une colonne qui en offre 620. Le carré de 9 px garde une cible de 26. **Coût** : deux cibles sur une rangée, distinguées par 22 px de large ; une étape pas encore posée n'en a qu'une, ce qui rattrape le cas le plus fréquent. |
| 27/08/2026 | Le repli est **global et par bloc**, pas par asset | « Fermer le panneau remet exactement où l'on était » (US-37) vaut aussi d'une image à l'autre : rouvrir cinq blocs à chaque asset regardé serait le contraire. Conséquence directe : l'état vit dans le châssis et non dans un écran, donc il survit au démontage de la fiche — et les essais d'écran le remettent à zéro comme ils remettent le flux. |
| 27/08/2026 | **La fiche s'ouvre en T2**, pas en T3 | La retouche a besoin d'une surface, et le § Layout en prévoit déjà une : la quatrième colonne, 380 px. L'ouvrir en T2 avec ce que T2 possède — visionneuse, recette, retour au brut — atteint le layout par étapes au lieu de le contredire ; la filiation et le favori l'y rejoignent en T3. Écarté : un écran de retouche plein cadre, qui ferait perdre la grille et le prompt — exactement ce que ce document refuse quand il écrit « la fiche est un panneau latéral, pas une page ». Écarté aussi : un dépliage sous la tuile, qui recomposerait la grille. **Coût** : l'écran passe à trois colonnes en cours de tranche, et l'arbre reste la seule case vide du layout. |
| 27/08/2026 | **Le curseur entre au châssis** — premier contrôle neuf depuis la création | Il n'entre pas pour l'apparence mais pour un comportement : viser une valeur dans un champ de nombre avant de voir ce qu'elle donne est l'inverse du geste. *Révisé le 27 août 2026, à la mesure* : « chaque réglage répond sans attente perceptible » (critère T2) ne vaut que pour la queue de la recette — le détourage coûte 1,5 s le cran, donc le curseur pose au relâchement et non en glissant. Un champ de nombre demanderait de viser une valeur avant de voir ce qu'elle donne — l'inverse du geste. Il n'ajoute aucune couleur : rail `--bord`, poignée `--signal`, valeur en mono à droite comme toute mesure. Hauteur 26 px, la rangée de segment du § Spacing. **Coût** : un contrôle de plus à tenir dans les états, et la tentation d'en mettre partout — il reste borné à la fiche. |
| 27/08/2026 | La pastille **« réglé »** rejoint « interrompu » et « agent » sur la tuile | Le § La tuile prévoyait déjà les trois mots ; T2 en fait naître un pour de vrai. Un asset dont la recette a été touchée à la main est un **état subi** au sens de ce document : le système le constate, l'auteur ne l'a pas posé comme une marque. Il reste donc un mot en mono, en `--epingle`, et non une forme — la seule forme est le coin plein du favori. Cohérence de la couleur : « réglé à la main » est l'un des trois usages d'`--epingle` déjà nommés ici. |
| 27/08/2026 | La tuile montre le **rendu**, pas le brut, dès qu'une recette existe | La grille sert à juger, et juger sur le brut alors qu'on a détouré et remis sur grille ferait juger autre chose que ce qui partira dans le jeu. Le brut reste à un geste — la bascule de la fiche. **Coût** : deux images sous la même adresse selon l'état de l'asset ; l'empreinte de la recette voyage donc dans l'URL, sans quoi le navigateur resservirait celle d'avant. |
| 27/08/2026 | Les cinq étapes de la recette sont des **titres cliquables**, pas des cases à cocher | Cinq cases alignées dans un panneau de 380 px se lisent comme un formulaire ; ce panneau est un établi. L'état se dit par la couleur du titre et un carré de 9 px — la même grammaire que le segment choisi. Une étape indisponible garde le motif du § Le grisé : elle porte sa raison en ligne sœur, jamais une infobulle — c'est ce que fait la quantification tant qu'aucune palette n'existe. |
| 27/08/2026 | Le damier passe à **16 px en fiche**, contre 12 sur une tuile | Déjà écrit au § Le damier alpha, appliqué ici pour la première fois. La zone est quatre fois plus large : un carreau de 12 px y redeviendrait un motif que l'œil suit, ce que le damier ne doit jamais être. |
| 27/08/2026 | **L'écran Univers est un écran**, `380px · 1fr`, et il couvre l'Atelier | Le cadrage le classe déjà comme tel (`ARCHITECTURE.md` §6.2, « au début d'un projet, puis ponctuel »). 380 est la largeur de la fiche : *la* colonne de réglages du produit, jamais une troisième valeur pour la même sorte de chose. **Coût, et il a fallu le payer tout de suite** : couvrir l'Atelier rend sa barre d'état invisible, donc l'écran porte sa propre fente de refus — le motif ne change pas, son emplacement suit l'écran qui a provoqué le refus. |
| 27/08/2026 | La **carte a le rayon 2**, la tuile garde le rayon 0 | Seule différence de forme entre les deux grilles, et elle suffit : une tuile est un produit du travail et se lit comme une planche contact ; une carte est de la matière rassemblée, donc du châssis. « Une seule grille d'assets dans tout le produit » reste vrai — celle-ci n'en est pas une. Écarté : une bordure de couleur, qui aurait ajouté un ton à un système qui n'en veut pas. |
| 27/08/2026 | Le **sujet** est le seul contrôle que T4 ajoute à l'Atelier | Une nature de sujet porte sa famille *et* son occupation : la choisir décide des artworks envoyés, du modèle par défaut et de l'échelle, d'un seul geste. Deux taxonomies — l'une pour l'échelle, l'autre pour la famille — se paieraient deux fois par génération, et le PRD écarte explicitement la sélection manuelle des artworks. Le reste de l'univers n'est **jamais** montré ici : le bloc « Ce qui part » est en lecture seule, comme ce document le demandait déjà. |
| 27/08/2026 | Le bloc « Ce qui part » affiche un compte **calculé par le serveur** | Il l'affichait déjà pour le grisé ; T4 lui donne la même origine pour le nombre. L'écran tient les réinjections posées à la main, pas les artworks que l'application ajoute, ni le dédoublonnage entre les deux — deux comptes calculés à deux endroits se contredisent, et celui qui compte est celui qui part. **Vu en séance** : promouvoir un artwork ne rafraîchissait rien, parce que « la demande en cours » avait gagné une composante que l'écran ne pilote pas. |
| 27/08/2026 | **L'écran Découpe est un écran**, `1fr · 380px`, et l'image passe à gauche | On dessine des rectangles sur une planche de mille pixels : la fiche en fait 380. Même raisonnement que l'écran Univers le même jour, et même contrepartie — il couvre l'Atelier, donc il porte sa propre fente de refus. La largeur passe à l'image parce que c'est **elle** le sujet ; 380 reste la colonne de réglages du produit. Écarté : une rubrique de la fiche, qui aurait demandé de viser un rectangle au tiers de sa taille. |
| 27/08/2026 | Découper vit dans la **rangée du jugement**, en mono 10 px | Rien ne permet de savoir d'avance qu'une image est une planche : un geste qui paraîtrait ou disparaîtrait selon ce qu'on croit deviner serait faux la moitié du temps. Il coûte une ligne, la même densité que le § La tuile impose à la grille. |
| 27/08/2026 | Un cran de zoom tient quand **deux** tuiles y tiennent, pas une | `minmax(cran, 1fr)` accepte une colonne unique et l'étire jusqu'au bord : 4× rendait 1028 px sur une colonne de 1060, huit fois le repos pour un contrôle qui annonce quatre. Vu en ouvrant l'atelier, jamais au banc. Coût : sur un écran étroit, 4× est grisé alors qu'« une » tuile y tiendrait — c'est le prix pour que le cran veuille dire ce qu'il dit. |
| 27/08/2026 | Le **cadre de la planche est calculé**, la mise à l'échelle n'est pas déléguée au CSS | `aspect-ratio` cède devant `max-height` : le navigateur rabote la hauteur sans redéduire la largeur, et un cadre de 1388 × 874 pour une image carrée décale de vingt pixels tout ce qui est posé dessus en pourcentage. Un seul facteur, et le cadre **est** l'image. Coût : une largeur mesurée de plus à tenir à jour. |
| 27/08/2026 | **L'infobulle entre au produit**, et un test binaire la borne | Demandée par l'auteur, perdu dans sa propre application sur un cas exact : `groupe` et `famille` sont voisins dans le même menu, l'un ne fait rien à la génération, l'autre décide des références envoyées **et** du coût — et rien à l'écran ne les distingue. La règle « jamais une infobulle » n'est pas assouplie : elle protégeait *la raison*, et la raison bloque un geste maintenant. Une explication ne bloque rien. D'où le test, et il ne se discute pas au cas par cas : *son absence empêche-t-elle un geste ?* Oui → fente permanente. Non → survol. **Coût** : l'interdit devient conditionnel, donc argumentable plus tard ; le test est écrit comme un test et non comme une permission, et une infobulle qui porte une raison est déclarée bug, pas arbitrage. |
| 27/08/2026 | **Le libellé est la cible** — souligné pointillé `--bord-fort`, aucun glyphe neuf | Trente points d'interrogation dans les panneaux seraient le quatrième glyphe d'un produit qui en compte trois, multiplié — c'est-à-dire la maquette écartée et ses « options partout ». Le nom du réglage est déjà à l'écran, déjà placé, et c'est déjà le nom de la chose. Le pointillé reprend le token de la poignée de barre de défilement pour le même métier — *il y a plus ici* : `--bord` est sous le seuil où l'œil le trouve, `--bord-fort` au-dessus quand on cherche et en dessous quand on travaille. C'est aussi le trait de `<abbr>`, seule décoration du produit qui se comprenne sans être apprise. **Écarté** : un mode d'aide à bascule — on n'est jamais perdu *avant* d'ouvrir un panneau, et il faudrait sortir du geste pour aller allumer une lampe. **Coût** : cinq à douze pointillés visibles par écran, contre zéro aujourd'hui. |
| 27/08/2026 | **Trois lignes fixes, et la deuxième est obligatoire** | *Ce que c'est · ce que ça change · d'où ça sort.* La deuxième porte tout le poids : un réglage qui ne change rien en aval doit l'écrire dans ces mots-là — `Rien à la génération.` C'est le gabarit qui produit la réponse et non la bonne volonté du rédacteur ; sans ligne obligatoire, `groupe` aurait reçu trois phrases sur le rangement et la question de départ serait restée entière. La troisième est en mono parce que l'origine d'un défaut est un fait sur le monde (§ Typography, règle 2). **Coût** : un gabarit rigide produit parfois une ligne plate ; c'est le prix pour qu'aucun réglage inerte ne passe pour actif. |
| 27/08/2026 | Le fondu de 80 ms **prend un second locataire**, il n'ouvre pas une entrée | Menu de carte et infobulle partagent la même rangée de la liste close, parce qu'ils partagent la raison d'admission : ils paraissent **sans clic**, donc sans geste qui dise qu'on les a demandés. La rangée est écrite comme réservée à cette classe, ce qui la rend refusable au troisième candidat sans rediscuter le principe. |
| 27/08/2026 | **L'écran Guide est un écran**, `240px · 1fr`, et il ne porte pas de fente de refus | Même cadrage qu'Univers et Découpe — on l'ouvre quand on ne sait pas, on le ferme quand on sait —, donc il couvre l'Atelier. 240 est la colonne de l'arbre réemployée : un sommaire, c'est *où ça se range*, et aucune troisième largeur n'est inventée. **L'absence de fente est la preuve de la règle et non un oubli** : les deux autres écrans en portent une parce qu'ils couvrent la barre d'état et provoquent des refus ; le Guide ne demande rien au serveur, ne dépense rien, ne peut pas échouer. On ne pose pas une fente vide pour la symétrie. |
| 27/08/2026 | **La prose du Guide est bornée à 72 caractères** — la seule largeur maximale du produit | « Max content width : aucune » a été écrit pour la grille, la chose qui *gagne* à s'étaler. La prose est la seule matière du produit qui perde à recevoir de la largeur : à 1 600 px une ligne de français fait 190 signes et le retour à la ligne devient une recherche. Calée à gauche et non centrée — centrer la désalignerait de son sommaire pour rien — et la place restante reste **vide** : remplir cette marge de notes et de figures serait recommencer la maquette écartée sur le seul écran qui pouvait s'en passer. **Mesuré au navigateur** : l'unité n'est pas `ch` — `72ch` rend 671 px, soit 88 signes, parce que `ch` vaut l'avance du zéro et que le chiffre d'Instrument Sans est bien plus large que ses bas-de-casse. La valeur juste est `36em` : **468 px**, avance moyenne 6,51 px, **72 signes par ligne** — remesuré sur l'atelier lancé le 27 août, et c'est bien la valeur que le titre de cette ligne annonce. Le « 504 px / 74 signes » écrit ici d'abord résolvait `em` contre 14 px ; l'`<article>` qui porte la borne hérite de **13 px**, et `em` se résout toujours contre la taille de l'élément qui l'écrit — pas contre celle de la prose qu'il contient, qui fait 15 px. Deux fois la même famille d'erreur dans la même décision, donc, et la seconde a survécu au constat de la première : `ch` valait l'avance du zéro, `em` vaut la taille du porteur. Même famille encore qu'`aspect-ratio` cédant devant `max-height` sur le cadre de la planche — *une unité relative se résout contre une référence qu'il faut aller lire, jamais contre celle qu'on a en tête*. **Coût** : une exception nommée dans une règle écrite comme absolue ; elle est bornée à cette colonne, et le § Layout le dit. |
| 27/08/2026 | Les titres de section du Guide **ne sont pas en serif** | Instrument Serif reste à trois emplois. Le titre de l'écran en est un (titre d'écran) ; les sections reprennent la forme de l'en-tête de panneau — sans 12,5 px, majuscules, `letter-spacing .11em` — et la hiérarchie est portée par 48 px d'espace. Un sous-titrage serif de 24 px sur la seule page de texte long est très exactement le « bascule en blog » que la règle 1 du § Typography annonce en toutes lettres. **Ce que ça achète** : le guide ressemble au produit et non à un article posé dedans. |
| 27/08/2026 | **Le guide et les infobulles sont un seul corpus**, deux rendus | Le panneau de 280 px rend les trois lignes d'une entrée, l'écran les rend toutes à la file avec le contexte autour. C'est la règle déjà appliquée deux fois par ce document — *deux comptes calculés à deux endroits se contredisent*, *deux éléments qui disent la même chose à deux altitudes et aucun n'est l'autorité*. Une explication recopiée diverge en trois semaines, et c'est celle qui est sous les yeux au moment du doute qui sera la fausse. Corollaire : un réglage sans entrée n'a **pas** de pointillé, aucune bulle vide, aucun `à documenter` dans le châssis — c'est le guide qui tient la liste de ses manques, dans sa dernière section, comme le journal des ratés vit hors de la grille. |
| 27/08/2026 | **`groupe` et `note` n'avaient pas de libellé** — leur nom vivait dans un `placeholder` | Trouvé en branchant le motif, et c'est la moitié de la réponse à la question qui l'a lancé : un champ dont le nom est le texte gris du champ vide perd son nom dès qu'on tape dedans. Il n'était donc ni identifiable en relecture, ni explicable, puisque le motif accroche l'explication au libellé. Les deux seuls champs du produit dans ce cas ; leurs voisins de la même colonne en avaient un. **Règle générale** : un contrôle dont le nom disparaît quand on s'en sert n'a pas de nom, et le `placeholder` redit la valeur vide (`aucun`, `—`), jamais l'identité. **Coût** : deux rangées de 11 px dans un menu qui en comptait déjà quatre — payées, parce qu'un menu qui se borne à l'écran et défile peut se les offrir. |
| 27/08/2026 | Le fondu de l'infobulle **réemploie `.paraitre`**, la classe du menu de carte | Écrit d'abord en JS — un état `posé` basculé par `requestAnimationFrame` — puis remplacé le jour même par la classe CSS qui existait déjà. Deux raisons, et la seconde est un défaut réel : un `requestAnimationFrame` ne se déclenche pas dans un onglet qui ne compose pas ses images, donc la bulle serait restée à `opacity: 0` au lieu de paraître. La première est le document lui-même — « deux locataires, une entrée » n'est vrai que si les deux jouent la **même** animation ; deux keyframes identiques écrites à deux endroits sont deux entrées qui divergeront. |
| 27/08/2026 | Le **tramage retiré du corpus** : il n'est pas réglable à l'écran | `quantification.tramage` existe dans le domaine et dans l'API, avec deux valeurs, mais aucun contrôle ne l'expose — l'interface pose toujours « aucun ». Une entrée de guide décrivant un réglage qu'on ne peut pas atteindre est le même mensonge que le `bayer` déclaré et non implémenté que `recette.py` a retiré le jour où il a été écrit, et il se réveille de la même façon : des mois plus tard, devant quelqu'un qui cherche le curseur. Retirée. |

| 27/08/2026 | **Le corpus passe de 19 à 46 entrées**, et gagne un quatrième groupe : la découpe | Les six manques que le guide listait sont comblés. Le groupe est un **écran et non un thème** — quand on cherche une explication, on se souvient d'où l'on était, pas de quelle famille conceptuelle relevait le curseur ; ranger lignes et colonnes sous *la retouche* aurait été juste pour le rédacteur et faux pour le lecteur. Comptes : univers 20, atelier 4, retouche 18, découpe 4. **Coût** : la troisième partie du guide fait désormais quarante-six sections, ce qui rend le sommaire indispensable plutôt que confortable. |
| 27/08/2026 | **Une étape de recette est un réglage**, et les cinq titres prennent le pointillé | Elle décide qu'une des cinq places est occupée : c'est le réglage le plus structurant du panneau. Documenter `tache minimale` sans documenter *Nettoyage des bords* laissait le **parent plus opaque que son enfant**, alors que c'est le nom du bloc qu'on lit d'abord. Leurs entrées portent l'ordre fixe, qui n'était écrit nulle part que l'auteur puisse lire. |
| 27/08/2026 | Une rangée d'étape passe à **`aria-disabled`**, parce que le motif l'exige | Le § Ce qui est écarté promettait qu'un contrôle grisé garde son pointillé — *pourquoi c'est fermé* n'est pas *à quoi ça sert*. Or un `<button disabled>` ne dispatche aucun événement de souris, **pas même sur ses enfants** : l'explication d'une étape grisée aurait été la seule du produit à ne jamais s'ouvrir, et c'est celle qu'on va chercher à ce moment-là. Le refus reste entier (le clic ne pose rien) et la raison reste dans sa fente. **Vérifié en réintroduisant le défaut** : l'essai tombe. **Coût** : la rangée redevient focalisable au clavier — ce qui est plutôt le bon comportement, la raison étant juste dessous. |
| 27/08/2026 | Le **seuil de la jauge sort de la liste des manques**, et n'y est pas remplacé | Les 240 ms sous lesquelles rien ne paraît ne sont pas un réglage : personne ne peut les toucher, et aucun libellé de l'écran ne pourrait porter leur pointillé. Ils vivent au § Motion. **Une liste de manques qui garde un item impossible à combler cesse d'être une liste de travail** — même hygiène que le tramage retiré le même jour, par l'autre bout : là un réglage inatteignable, ici un manque inécrivable. Il reste un seul manque, et il est structurel : les réglages qu'un modèle déclare en propre, que le catalogue nomme et qui changent d'un jour à l'autre. |
| 27/08/2026 | **Deux entrées d'un même écran ne portent jamais le même nom** | Le guide rend les entrées à la file, groupées par écran, et le nom est le titre de chacune : deux « famille » à la suite dans *Dans l'univers* — celle d'une carte, celle d'une échelle — et le lecteur ne sait plus laquelle il lit. C'est la seule collision que le regroupement ne rattrape pas, puisqu'il **est** le regroupement. Le même mot dans deux écrans reste correct : c'est le même mot à l'écran. Un essai le tient. |
| 27/08/2026 | Le gabarit de libellé prend un état **éteint**, plutôt qu'un second gabarit | Les cinq champs de la bible descendent en `--texte-3` quand ils ne portent rien. **Un second endroit où poser le pointillé est un endroit où l'oublier**, et cette panne-là est silencieuse : une clé absente ne lève pas, elle rend le réglage muet. D'où aussi l'essai qui confronte toute clé branchée à l'écran au corpus — vérifié en introduisant une faute de frappe. |
| 27/08/2026 | **Une entrée sans ancrage est permise ; un ancrage sans entrée ne l'est pas** | Trois entrées vivent dans le guide seul — les trois contrôles d'une échelle du barème, répétés sept fois et nommés par leurs seules valeurs. Vingt-et-un pointillés dans un bloc de sept rangées seraient la maquette écartée et ses « options partout » ; inventer une rangée de légende serait inventer un motif pour un cas. Le bloc porte le sien, et son entrée nomme les trois choses qu'une échelle transporte. L'asymétrie est le bon sens du motif : le premier cas laisse une explication à un clic de plus, le second laisse un réglage muet. **Tranché par l'auteur**, contre les deux autres branches proposées — une rangée de légende (une forme que le produit n'a nulle part ailleurs) et un pointillé par rangée (vingt-et-un dans un seul bloc). |
| 27/08/2026 | **Le moteur de détourage n'avait pas de nom** — troisième trou révélé par le pointillé | Ses trois voisins de la passe en portaient un ; celui-ci se lisait sur ses deux segments, « bord » et « modèle », c'est-à-dire sur ses **valeurs**. Même famille que `groupe` et `note`, dont le nom vivait dans un `placeholder` : *un contrôle qui n'est nommé que par ce qu'il vaut n'a nulle part où accrocher son explication.* Il gagne un libellé `moteur` au gabarit de la fiche ; la raison du grisé reste sous la rangée, sur toute la largeur, parce qu'elle parle du modèle indisponible et non du réglage. |
| 27/08/2026 | **La toile libre entre dans le produit**, à côté de la grille et sans la remplacer | Écartée au PRD par choix d'ergonomie, renversée par la première séance d'essai : la grille montre tout et n'organise rien, et `groupe` n'était qu'une étiquette sans forme à l'écran. La grille reste ce qui montre, la toile devient ce qui range. |
| 27/08/2026 | L'écran Univers passe à **trois colonnes** en mode toile — `380 · 1fr · 380` | « Pas une troisième largeur » interdisait un troisième *nombre*, pas une troisième *colonne*. La réserve reprend la 380 de la fiche, qui nomme déjà la colonne de ce qu'on manipule ; l'Atelier vit à quatre colonnes, l'Univers à trois n'est pas une rupture de grammaire. |
| 27/08/2026 | **L'îlot est le groupe** — une seule notion de rangement, jamais deux | Un cadre libre indépendant du champ `groupe` aurait fait coexister deux appartenances, et posé la question sans réponse « pourquoi cette carte est dans l'îlot *Nord* alors que son groupe dit *marais* ? ». Corollaire assumé : hors îlot, pas de groupe. |
| 27/08/2026 | **Six teintes d'îlot**, fermées et sourdes, sans aucune sémantique | Premier endroit du produit où une couleur ne veut rien dire. Un sélecteur libre aurait produit l'îlot rouge vif qui se lit comme un échec ; saturation plafonnée à 20 % et emploi limité aux surfaces de la toile les tiennent à distance des quatre sémantiques. |
| 27/08/2026 | **Ctrl+Z sur la toile**, sans fente ni bandeau | L'annulation d'une suppression tient dans une fente parce que ce geste-là est rare. Sur la toile le geste risqué est le déplacement, donc le geste permanent : une fente qui clignote cent fois par séance est du bruit, et « hors îlot, pas de groupe » exige pourtant un rattrapage. |
| 27/08/2026 | **L'écran Réglages tient les trois questions dans un panneau**, pas dans un quatrième écran plein | US-96 demande *un seul endroit* pour la clé, les garde-fous et les dossiers. Les trois autres écrans du produit — Univers, Découpe, Guide — couvrent l'Atelier parce qu'on y **travaille** ; celui-ci ne fabrique rien, on l'ouvre pour poser un réglage et on le referme. Il garde donc la forme qu'il avait en T1, 520 px posés sur l'atelier, et gagne deux blocs. Aucune typographie neuve : les titres de bloc reprennent l'en-tête de panneau — mono 9,5 px, majuscules, `letter-spacing .11em` —, déjà le troisième emploi de cette forme. **Coût mesuré** : 772 px de haut avec les trois blocs, donc un défilement en dessous d'environ 900 px de hauteur utile. La couche le porte déjà, rien n'est inatteignable, et découper les trois questions en trois écrans coûterait très exactement ce que la user story refuse. |
| 27/08/2026 | La pastille **« agent »** naît pour de vrai, en `--signal-clair`, et passe **avant « réglé »** | Le § La tuile prévoyait le mot depuis l'origine et le § Palette lui réservait déjà sa teinte — « texte de pastille agent » — ; T7 le fait paraître. Une tuile ne porte qu'une pastille, donc l'ordre *est* la décision : devant une image qu'on ne reconnaît pas, « à qui parler » (US-39) se cherche avant « sa recette a été touchée », qui se lit dans la fiche. Aucune couleur neuve — `--signal-clair` est déjà le survol du signal —, et aucune forme : la seule forme reste le coin plein du favori, que l'auteur pose lui-même. |
| 27/08/2026 | Le **compteur de l'agent est dans le bloc qui le fait relever**, pas dans la barre d'état | US-90 demande « discret », et la barre d'état l'aurait rendu permanent — un chiffre qui ne bouge pas pendant des heures et qu'on cesse de voir, occupant la place d'un fait sur le travail en cours. Il vit donc au-dessus des deux garde-fous, dans une grille de mesures en mono 10 px, la même forme que le bloc « Ce qui part » : *ce qu'on lit au moment où on décide*. **Coût** : il faut ouvrir les Réglages pour le voir, ce qui est exactement le geste qu'on fait quand on se demande s'il faut relever le plafond. |
| 27/08/2026 | L'interrupteur d'un garde-fou est **celui d'un champ de bible**, repris tel quel | Le produit a déjà un interrupteur — le carré de 26 px, ●/○, `--signal` allumé — et « un second gabarit serait un second endroit où l'oublier ». Un garde-fou est de la même nature qu'un champ de bible actif : *ce que je laisse partir*. Rien de neuf n'entre au châssis pour cette tranche, et c'est le résultat visé. |
| 28/08/2026 | **Le corpus passe de 50 à 55 entrées**, et n'ouvre aucun écran neuf | Les cinq de T9 vivent toutes dans *l'univers*, qui est l'écran où la toile se compose. Deux d'entre elles ont dû être **renommées avant d'être écrites** : « teinte d'une note » et « teinte d'un îlot » plutôt que « Teinte » deux fois, parce que le guide rend les entrées à la file, groupées par écran, et que deux titres identiques à la suite ne se distinguent plus. C'est la même panne que `groupe` contre `famille`, prise à l'écriture au lieu d'être prise à l'usage. |
| 28/08/2026 | **Le nom d'un îlot devient la poignée de son menu** — et il reste la seule surface vivante qu'il ait | Un îlot n'a pas d'identité, il a un nom, et *le libellé est la cible* depuis T7. L'argument se **mesure** : sa bande part au-dessus de la boîte englobante de ses membres, donc elle ne recouvre aucune carte, par construction — une surface qui ne recouvre rien ne prend rien à personne. Rendre la *boîte* vivante aurait volé chaque prise de carte. **Coût** : 20 px de plan par îlot pour le déplacement du plan, et un `z-index` qui monte à 10 en s'ouvrant, sans quoi le menu se rend sous les cartes qu'il décrit. |
| 28/08/2026 | **Une note s'écrit au double-clic sur le plan**, et le zoom au double-clic de la librairie s'éteint pour ça | « Créée là où elle s'applique » pris à la lettre : un contrôle de barre pose la note à sept cents pixels de l'endroit qui la demande. Le double-clic ne peut pas à la fois zoomer et écrire, et le perdant serait toujours celui qu'on voulait ; la molette et le plan couvrent déjà le zoom. Sa découverte tient à ce qu'il s'essaie sans rien casser — un champ quitté vide ne crée rien — et au `long` de *Vue*, à huit pixels du segment qui ouvre la toile. |
| 28/08/2026 | **Sept pastilles, pas six** : la septième est le châssis, montré | Un îlot sans teinte porte celle du châssis, et ce document dit que c'est *ce qu'il est*, pas un réglage manquant. La montrer évite un huitième glyphe en forme de croix, et la liste close du domaine ne bouge pas d'un nom — le vide y était déjà une valeur. |
| 28/08/2026 | **L'anneau d'une carte choisie prend le bord, jamais le fond** | Première écriture : *choisi* est un état, un état l'emporte sur un rangement, donc la teinte cédait entière. Or on choisit une pastille **depuis le menu de la carte**, qui n'est ouvert que parce qu'elle est choisie : on cliquait une couleur et rien ne changeait jusqu'à ce qu'on clique ailleurs. Les deux ne se disputent que le bord, et le bord suffit. **Vu à l'atelier lancé.** |
| 28/08/2026 | **Un trait ne prend aucune teinte** | La liste des surfaces colorables reste close à trois — cadre d'îlot, nom d'îlot, fond de note. Un trait coloré ferait un septième vocabulaire de couleur sur un écran qui en compte déjà six qui ne veulent rien dire, et un lien dit déjà tout ce qu'il a à dire par son mot et sa pointe. |
| 28/08/2026 | **L'îlot ne se saisit pas, et il n'a pas encore de teinte** | Ce qui n'a pas d'existence propre n'a pas de poignée : un îlot *est* son groupe, et déplacer un rangement c'est déplacer ce qu'il contient. On le traverse donc pour prendre une carte comme pour déplacer le plan. Sa teinte arrive avec le reste de la couleur en T9 ; d'ici là il porte celle du châssis — `--bord-fort`, `--fond-1` à 40 % —, ce qui est exactement ce que ce document dit qu'il est. **Pas un provisoire, une conséquence.** |
| 28/08/2026 | La carte **suit la poignée pendant qu'on tire**, et pas seulement au relâchement | Le § Le curseur avait déjà tranché cette forme en T2 — *la valeur suit la main, l'écriture suit le relâchement* — et la moitié « suit la main » manquait ici : on tirait une poignée de 10 px devant une carte immobile, et la place occupée ne se voyait qu'une fois lâchée, c'est-à-dire trop tard pour la juger. Sur une toile, la largeur **est** une place occupée ; une place ne se règle qu'en la voyant prise. **Vu à l'atelier lancé.** |
