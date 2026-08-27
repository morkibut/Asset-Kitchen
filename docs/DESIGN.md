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
- **Grille d'assets** : `repeat(auto-fill, minmax(128px, 1fr))`, gouttière 9 px. Zoom 1× / 2× / 4× — un niveau indisponible à la largeur courante est **grisé, pas caché**.
- **Border radius** : `sm 2px · md 3px · lg 4px · full 9999px` (réservé aux pastilles de statut et aux points de la barre d'état). **La tuile d'asset est à 0.**

### Le rayon 0 sur la tuile

Le châssis a 2 px, la tuile a 0. Le bord de la tuile et le bord du sprite deviennent la même sorte
de ligne, et la grille se lit comme une planche contact plutôt que comme un fil d'actualité.
Corollaire obligatoire : **aucune ombre portée sur une tuile** — un rayon nul rend toute ombre
brutale. La profondeur se fait au fond (`--fond-0` sous `--fond-2`) et au bord, jamais à l'ombre.

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

**Les vignettes 1× / 2× / 4× sont les crans du zoom de la grille**, réemployés. Un seul
vocabulaire de taille dans tout le produit ; ce sont deux contrôles distincts sur deux
grilles distinctes, et ils ne se confondent pas parce qu'ils ne cohabitent jamais.

**La palette se montre en carrés de 20 px, sans nom.** C'est une vérification à l'œil —
« voir ce que la machine y a lu » (US-54) —, pas une liste à lire ; le code hexadécimal est
au survol, seul endroit du produit où une infobulle est permise parce qu'elle ne porte
aucune raison. Sans artwork, le bloc ne disparaît pas : il porte sa raison, comme tout
grisé du produit.

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
| 27/08/2026 | **La fiche s'ouvre en T2**, pas en T3 | La retouche a besoin d'une surface, et le § Layout en prévoit déjà une : la quatrième colonne, 380 px. L'ouvrir en T2 avec ce que T2 possède — visionneuse, recette, retour au brut — atteint le layout par étapes au lieu de le contredire ; la filiation et le favori l'y rejoignent en T3. Écarté : un écran de retouche plein cadre, qui ferait perdre la grille et le prompt — exactement ce que ce document refuse quand il écrit « la fiche est un panneau latéral, pas une page ». Écarté aussi : un dépliage sous la tuile, qui recomposerait la grille. **Coût** : l'écran passe à trois colonnes en cours de tranche, et l'arbre reste la seule case vide du layout. |
| 27/08/2026 | **Le curseur entre au châssis** — premier contrôle neuf depuis la création | Il n'entre pas pour l'apparence mais pour un comportement : « chaque réglage répond sans attente perceptible » (critère T2) suppose qu'on **fasse glisser** et qu'on regarde l'image suivre. Un champ de nombre demanderait de viser une valeur avant de voir ce qu'elle donne — l'inverse du geste. Il n'ajoute aucune couleur : rail `--bord`, poignée `--signal`, valeur en mono à droite comme toute mesure. Hauteur 26 px, la rangée de segment du § Spacing. **Coût** : un contrôle de plus à tenir dans les états, et la tentation d'en mettre partout — il reste borné à la fiche. |
| 27/08/2026 | La pastille **« réglé »** rejoint « interrompu » et « agent » sur la tuile | Le § La tuile prévoyait déjà les trois mots ; T2 en fait naître un pour de vrai. Un asset dont la recette a été touchée à la main est un **état subi** au sens de ce document : le système le constate, l'auteur ne l'a pas posé comme une marque. Il reste donc un mot en mono, en `--epingle`, et non une forme — la seule forme est le coin plein du favori. Cohérence de la couleur : « réglé à la main » est l'un des trois usages d'`--epingle` déjà nommés ici. |
| 27/08/2026 | La tuile montre le **rendu**, pas le brut, dès qu'une recette existe | La grille sert à juger, et juger sur le brut alors qu'on a détouré et remis sur grille ferait juger autre chose que ce qui partira dans le jeu. Le brut reste à un geste — la bascule de la fiche. **Coût** : deux images sous la même adresse selon l'état de l'asset ; l'empreinte de la recette voyage donc dans l'URL, sans quoi le navigateur resservirait celle d'avant. |
| 27/08/2026 | Les cinq étapes de la recette sont des **titres cliquables**, pas des cases à cocher | Cinq cases alignées dans un panneau de 380 px se lisent comme un formulaire ; ce panneau est un établi. L'état se dit par la couleur du titre et un carré de 9 px — la même grammaire que le segment choisi. Une étape indisponible garde le motif du § Le grisé : elle porte sa raison en ligne sœur, jamais une infobulle — c'est ce que fait la quantification tant qu'aucune palette n'existe. |
| 27/08/2026 | Le damier passe à **16 px en fiche**, contre 12 sur une tuile | Déjà écrit au § Le damier alpha, appliqué ici pour la première fois. La zone est quatre fois plus large : un carreau de 12 px y redeviendrait un motif que l'œil suit, ce que le damier ne doit jamais être. |
| 27/08/2026 | **L'écran Univers est un écran**, `380px · 1fr`, et il couvre l'Atelier | Le cadrage le classe déjà comme tel (`ARCHITECTURE.md` §6.2, « au début d'un projet, puis ponctuel »). 380 est la largeur de la fiche : *la* colonne de réglages du produit, jamais une troisième valeur pour la même sorte de chose. **Coût, et il a fallu le payer tout de suite** : couvrir l'Atelier rend sa barre d'état invisible, donc l'écran porte sa propre fente de refus — le motif ne change pas, son emplacement suit l'écran qui a provoqué le refus. |
| 27/08/2026 | La **carte a le rayon 2**, la tuile garde le rayon 0 | Seule différence de forme entre les deux grilles, et elle suffit : une tuile est un produit du travail et se lit comme une planche contact ; une carte est de la matière rassemblée, donc du châssis. « Une seule grille d'assets dans tout le produit » reste vrai — celle-ci n'en est pas une. Écarté : une bordure de couleur, qui aurait ajouté un ton à un système qui n'en veut pas. |
| 27/08/2026 | Le **sujet** est le seul contrôle que T4 ajoute à l'Atelier | Une nature de sujet porte sa famille *et* son occupation : la choisir décide des artworks envoyés, du modèle par défaut et de l'échelle, d'un seul geste. Deux taxonomies — l'une pour l'échelle, l'autre pour la famille — se paieraient deux fois par génération, et le PRD écarte explicitement la sélection manuelle des artworks. Le reste de l'univers n'est **jamais** montré ici : le bloc « Ce qui part » est en lecture seule, comme ce document le demandait déjà. |
| 27/08/2026 | Le bloc « Ce qui part » affiche un compte **calculé par le serveur** | Il l'affichait déjà pour le grisé ; T4 lui donne la même origine pour le nombre. L'écran tient les réinjections posées à la main, pas les artworks que l'application ajoute, ni le dédoublonnage entre les deux — deux comptes calculés à deux endroits se contredisent, et celui qui compte est celui qui part. **Vu en séance** : promouvoir un artwork ne rafraîchissait rien, parce que « la demande en cours » avait gagné une composante que l'écran ne pilote pas. |
