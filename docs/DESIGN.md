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
- **La colonne de 240 px porte trois choses, et c'est le même sujet vu de trois hauteurs** : où ça se range (projets, collections), ce que ça coûte (le total du projet ouvert), et **ce qui a raté** — le journal, sous l'arbre. Ajouté le 27 août 2026 avec la bibliothèque : un appel raté a coûté de l'argent sans produire d'image, donc il n'a sa place ni dans la grille, qui ne montre que ce qu'on peut réutiliser, ni nulle part, puisqu'il faut pouvoir expliquer une facture. Le journal ne paraît que s'il y a eu un raté.
- **Max content width** : **aucune**. L'écran large est la ressource du produit, on la dépense. La grille d'assets remplit ce qui reste.
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

**`380px · 1fr`, et pas une troisième largeur.** L'univers à gauche, le tableau à droite.
380 est la largeur de la fiche asset : c'est *la* colonne de réglages du produit, et lui
donner une troisième valeur ferait un troisième vocabulaire de largeur pour la même sorte
de chose. La grille reste disciplinée, comme partout.

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
supplémentaire n'entre dans le tableau.

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
