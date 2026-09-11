# Asset Kitchen — Architecture

> Établi le 26 août 2026, **tenu à jour au 2 septembre 2026**, à partir de l'analyse de
> SpriteCook (`Anatomie de SpriteCook.html`, captures dans `screen_spritecook/`)
> et de l'état des trois projets qui précèdent : `_DEV/game-asset-generator` (GAG),
> `_DEV/MySpriteAi`, `_DEV/game-asset-generator/texel-studio`.
>
> **Ce document fait foi sur la construction** : les décisions de cadrage, le squelette, le
> modèle d'objets, les risques. Ce que le produit doit faire, à l'usage : `docs/PRD.md`. Dans
> quel ordre on le construit : `docs/PLAN.md`. Le détail d'une version :
> `docs/archi-versions.md` pour la V1, la V2 et la V3, `docs/archi-fournisseur.md` pour les
> fournisseurs. **Ce que les bancs de la V3 ont mesuré : `docs/bilan-v3.md`.**

---

## 1 · Ce que c'est

Un atelier personnel de production d'assets 2D pour jeu. On y définit **l'univers**
d'un jeu une fois, puis on fabrique au cas par cas les personnages, objets, décors
et interfaces qui lui appartiennent. **Tout ce qui est produit entre en bibliothèque
de lui-même** ; juger, c'est marquer favori ou supprimer, et ce qui est jugé l'est
avant de partir dans le jeu, pas avant d'entrer dans la bibliothèque
(`docs/PRD.md` fait foi sur ce point).

**Cap révisé le 11 septembre 2026 : API et modèles locaux, derrière des adaptateurs.**
Le MCP existant est le point d'entrée de l'IA qui développe le jeu Godot ; l'interface
desktop supervise les mêmes services. Les capacités locales déjà livrées et celles restant
à intégrer sont distinguées dans [l'architecture de l'atelier unifié](archi-atelier-unifie.md).
Les limites mesurées d'un ancien modèle ne constituent plus une exclusion générale du local.

**Payante n'en est plus une condition, depuis `F1`** : le produit connaît plusieurs
fournisseurs, dont un qui ne demande ni compte ni clé. Sur une machine où rien n'a été déposé,
une image arrive. Ce qui reste vrai : les univers, eux, partent chez le fournisseur payant —
le gratuit n'accepte aucune image en entrée, donc aucune référence.

## 2 · Ce que ce n'est pas

| | |
|---|---|
| **GAG** | fabrique de la quantité, en lot, la nuit, avec des modèles locaux. Asset Kitchen fabrique peu et bien, à la main. Les deux vivent côte à côte, ils ne fusionnent pas. |
| **MySpriteAi** | outil local, ComfyUI au centre, tout dans le navigateur. Asset Kitchen n'embarque pas ComfyUI. |
| **Un produit** | usage personnel. Pas de comptes, pas de crédits, pas de multi-utilisateur, pas de distribution, pas de galerie communautaire. |

Les moteurs locaux tournent dans des services externes : ComfyUI pour les workflows,
asset3d pour la fabrication et le rendu 3D. L'atelier les pilote et conserve leurs résultats.
Il ne fusionne pas les dépôts ni leurs environnements. L'import reste une voie complète.

## 3 · Décisions de cadrage

| Sujet | Décision | Pourquoi |
|---|---|---|
| Socle | Nouveau dépôt. Récupération ciblée, pas de fork. | Paradigme opposé à GAG, moteur opposé à MySpriteAi. |
| Moteur d'image | **API ou workflow local configuré**, extension décidée le 11 septembre 2026. | Les capacités et la qualité se vérifient par méthode ; les mesures historiques restent des résultats datés. |
| Fournisseur | **Plusieurs adaptateurs depuis F1**, et OpenRouter reste celui qui porte les univers. Un modèle se nomme par son fournisseur **et** par son nom, les deux ensemble. | *Révisé le 1<sup>er</sup> septembre 2026.* La décision de départ tenait tant que la question était la couverture : 48 modèles de 11 éditeurs derrière un seul jeu de paramètres, et écrire trois adaptateurs pour ça aurait coûté trois fois le travail pour le même résultat. Elle est tombée sur une autre question — **le prix** : six relances en trente-deux minutes ont emporté le quart de tout l'argent dépensé ici, et un fournisseur qui ne demande ni compte ni clé change ce que ce geste coûte. Ce qui ne change pas : **aucun repli automatique de l'un sur l'autre**, et aucun mélange dans un même appel. |
| Comptabilité | **Aucun compteur de crédits maison**, et ça n'a pas bougé. Mais le produit enregistre **ce que chaque appel a consommé, dans l'unité du fournisseur**, le totalise par projet, et tient son propre écran des dépenses depuis `E18`. | *Précisé le 1<sup>er</sup> septembre 2026.* Ce qui est écarté, c'est la **comptabilité parallèle** — recompter les crédits d'un fournisseur à sa place. Ce qui ne l'a jamais été, c'est enregistrer ce qu'on a soi-même dépensé : un tarif de catalogue mentait de plus du double, $0,019 annoncés contre $0,042 facturés. La réserve d'un fournisseur se lit chez lui quand il la dit, se compte ici quand il ne la dit pas, **et l'écran dit toujours lequel des deux**. |
| Modèles locaux | **Services externes pilotés**, avec file et provenance ; modèle de segmentation CPU toujours facultatif. | La coordination GPU devient un travail explicite du nouveau plan ; la retouche courante reste indépendante des générations. |
| Détourage | **Quatre moteurs**, et le remplissage depuis le bord reste le défaut : le **remplissage**, la **pipette** pour ce que le bord n'atteint pas, le **modèle** de segmentation — trois modèles au catalogue depuis `U13`, du rapide à l'intermédiaire au lourd —, et la **sélection magique** arrivée en V2.1, où l'on entoure grossièrement un sujet et l'atelier va chercher son bord dedans. Passes multiples dans les quatre cas. **Depuis `D1`, chaque moteur porte le durcissement qu'il demande** — zéro pour le remplissage, un pour la pipette, deux pour le modèle — et ce durcissement suit l'auteur quand il change de moteur, sans jamais réécrire une valeur qu'il a posée lui-même. | *Révisé le 27 août 2026, à la mesure ; le durcissement rattaché au moteur le 3 septembre 2026.* Le durcissement ne corrige pas un goût, il corrige une frange : le remplissage est binaire par construction et n'en laisse aucune, le modèle en laisse sur 95 % du sujet. Mesuré sur les 123 détourages du dépôt — à moteur égal, la nature de l'image ne décide presque rien. Tout ce que l'atelier produit arrive sur un fond plat : le remplissage suffit sur 44 images de six modèles, en 130 ms, sans modèle, sans téléchargement et hors ligne. Faire du modèle la dépendance par défaut aurait fait payer 180 Mo et un premier lancement en ligne pour un résultat que personne ne distinguerait. |
| Post-traitement | Local, CPU, jamais sur le GPU. | Reprise de AD-9 de GAG. Un curseur doit répondre instantanément. |
| Univers | Bible écrite à la main + planches de référence + palette extraite par calcul. | La palette sert **en entrée** (contrainte de quantification), pas en contrôle. |
| Conformité | **Aucun refus automatique sur la qualité.** Les mesures s'affichent toutes — ressemblance, corps repeint, échelle au retour — et n'empêchent jamais de garder ; **seul un compte d'images *insuffisant* refuse** — `R6`, close le 3 septembre 2026, a réécrit la règle : un sujet en trop ne se jette plus, il se choisit, et un sujet qui remplit presque toute sa boîte arrête la planche pour le dire au lieu d'entrer en silence. | Écarté volontairement : l'auteur juge mieux. *Et c'est désormais mesuré plutôt que supposé* — la mesure automatique d'une planche d'animation a été confrontée aux notes de l'auteur le 2 septembre 2026 et s'est révélée **sans rapport avec elles**. Un écran de tri montre des images animées, pas des chiffres. |
| Forme | Serveur Python local + interface web dans le navigateur. | Pillow, numpy et le SDK MCP imposent Python ; l'ergonomie impose le web ; le navigateur donne les outils de développement, qu'une WebView cache. |
| Toile de composition | **`@xyflow/react`**, ajoutée en T8 — la seule dépendance d'exécution que l'interface ait gagnée depuis React. | *Décidé le 27 août 2026.* Le plan, la conversion écran → plan, la sélection et le confinement d'une carte dans un îlot sont du code de bibliothèque, éprouvé et sous licence MIT ; les réécrire coûterait des semaines pour reproduire ce qui existe. Ce qu'elle ne fournit pas — la carte, la persistance, le classement, l'annulation — reste entièrement au produit : §6.5 fait la part exacte. |
| Style | **Le pixel art est le défaut, plus une limite.** La taille de pixel d'un univers accepte **« aucune »** depuis `R2`, et la bible a gagné la vue et la technique de rendu. | *Révisé le 28 août 2026.* L'écart n'était pas là où ce document le plaçait : rien du style ne part dans le prompt, mais le **post-traitement** imposait l'apparence sans qu'on l'ait demandée — la remise sur grille est systématique, la quantification s'allume dès qu'un artwork existe. La case « aucune » suffit à rendre la grille facultative, et un mode HD à part entière est écarté pour ça. ~~*Limite acceptée* : la quantification reste liée à l'existence d'une palette.~~ **Levée en D2, le 3 septembre 2026, et ce n'était pas une limite mais une panne** : liée à la palette, la quantification ne s'exécutait *jamais* sur un projet sans artwork — mesuré, 905 couleurs sur un sprite de 64 carrés, et rien à l'écran ne le disait. Ce qui la commande est désormais **la taille de case**, c'est-à-dire le fait de faire du pixel art ; la palette, quand elle existe, s'impose en plus. **Et la réduction elle-même devient un choix** entre quatre méthodes, au projet et par image : c'était un parti pris de style écrit dans le code, et le plus brutal des quatre. |
| Validation | Manuelle, systématique. | C'est le principe du produit, pas une limite. |
| **La planche** | **C'est un objet du produit**, plus le brut jetable de sa génération : elle se voit dans la galerie et elle y reste. **Son découpage reste automatique** — une planche qui revient bien ne demande aucun geste —, et il **se refait à la main** autant de fois qu'on veut. | *Tranché le 2 septembre 2026.* Renverse « le pliage est une ruse d'appel, jamais un format de livraison ». Ce qui l'impose est mesuré : une planche d'animation revient bonne **une fois sur dix**, donc on en commande plusieurs et l'on garde la bonne — ce qui suppose de pouvoir la **juger** avant de choisir, donc de la voir. Voir `docs/archi-versions.md` §7 et §8. |
| **Le squelette** | **Dans le périmètre**, en fin de V3 : un pantin articulé fabriqué depuis **une seule** image déjà validée, qui rend une bande sans un appel payant. Ce qui sort vers le jeu, ce sont les **images _et_ le pantin**, dans des formats existants qu'on n'invente pas. | *Tranché le 2 septembre 2026.* Renverse « squelette, os, interpolation : c'est l'animation, pas le personnage ». C'est le seul chemin qui **supprime** la loterie au lieu de la subir : rien n'est redessiné, donc le personnage ne peut plus changer de taille entre deux étapes. Limite écrite d'avance : il ne fait bouger que ce qui est **déjà dessiné**. |
| **Le fond de génération** | **Un réglage du projet**, choisi par l'auteur, visible, et corrigible à la main juste avant de payer. L'atelier **propose** une couleur que rien du jeu ne porte ; il ne l'impose jamais. | *Tranché le 2 septembre 2026, par l'auteur.* Le fond était une phrase enterrée dans le code, et c'était un gris que le sujet porte aussi — d'où le découpage à reprendre sur presque chaque image. C'est un morceau du texte qui part : il appartient à l'auteur comme le reste. |

## 4 · Architecture

```
                 navigateur (React + Vite + Tailwind)
                              │  HTTP + SSE
                 ┌────────────┴─────────────┐
                 │   API locale — FastAPI   │
                 └────────────┬─────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   fournisseurs          traitement            bibliothèque
   d'image (API)     (Pillow + numpy,       (SQLite + fichiers)
                     rembg en option)
                              ▲
                              │
                     serveur MCP (même processus,
                      mêmes fonctions que l'API)
```

Cinq règles qui tiennent l'ensemble :

1. **Le fournisseur est derrière un port.** Le vocabulaire d'un fournisseur ne franchit
   pas son adaptateur : ni `gpt-image-2`, ni `gemini-*`, ni le nom d'un paramètre
   maison ne remontent dans le domaine. Reprise de AD-11 et AD-28 de GAG.
2. **Le MCP n'a pas de logique propre.** C'est une façade sur les fonctions que
   l'interface appelle déjà. Deux chemins, une seule implémentation.
3. **Les fichiers font foi, la base est un index reconstructible.** Si la base
   SQLite disparaît, on la reconstruit en relisant le disque — aucun asset n'est
   perdu. Reprise de AD-5 de GAG.

   Deux conséquences, tirées en T3 et qui tiennent l'invariant vivant : le schéma
   de l'index **n'a aucune migration** — quand il change, l'index est jeté et le
   démarrage le refait depuis les fichiers, si bien que la reconstruction sert au
   moins une fois par évolution du schéma ; et **le fichier s'écrit avant
   l'index**, jamais l'inverse, pour qu'une coupure laisse l'index en retard sur
   le disque plutôt que le disque en retard sur l'index.
4. **Le post-traitement ne touche jamais le GPU.** Il est CPU, pur, et ses étapes
   s'appliquent dans un ordre fixe : détourage, **différence**, recadrage, grille,
   quantification, bords, contours, **retournement**, la main. Aucune ne se
   réordonne — six des neuf n'ont pas de sens avant celle qui les précède.

   > **Neuf places, pas huit, et la deuxième ne se voit pas.** La *différence* est la
   > place qui fabrique un calque d'équipement, posée par la V2 : elle est dans la
   > liste du code au même titre que les autres, mais elle ne paraît que sur un calque
   > — sur une image ordinaire elle n'a rien à faire. Ce document l'a longtemps omise en
   > comptant les places « qu'on voit », ce qui est une bonne façon de croire qu'un
   > traitement en compte huit quand il en applique neuf. **Le produit, lui, dit
   > huit** — c'est le compte de ce qu'un auteur voit et règle, et c'est celui
   > qu'emploient les tables, le guide et les fiches de classe.

   **Sept places depuis la V2.1, et les deux dernières sont arrivées par le même
   raisonnement que les cinq premières** — écrit le 31 août 2026. Les *contours*
   tracent le trait de bord du sujet, et ils viennent après la grille parce que
   tracé avant, le trait serait rééchantillonné comme le reste : la panne qu'on
   veut justement éviter. Ils viennent après la quantification parce qu'un noir pur
   tracé avant ressortirait au plus proche de la palette, c'est-à-dire pas noir.
   *La main* est la retouche au pixel et elle est **la dernière** : rien ne se
   rejoue après un geste fait à la main, sans quoi le geste serait effacé par la
   machine.

   **Le retournement est arrivé en `B1`, le 6 septembre 2026, en avant-dernier.**
   C'est le miroir gauche-droite, et il n'a pas de rang naturel : `Retouche.dc.html`
   le voulait avant le recadrage, `atelier-retourner.dc.html` à la fin de la
   chaîne, et `docs/PLAN-carnet.md` a tranché pour la fin. **L'arbitrage ne coûte
   rien à l'image** — un miroir pur ne déplace aucun pixel dans sa colonne, et le
   recadrage se fait sur la boîte opaque, qui se retourne avec le sujet : les deux
   rangs rendent le même fichier. Ce qu'il achète est que le retournement soit la
   dernière chose que la machine fasse avant la main, donc la plus facile à lire
   sur l'image finie.

   **Il a posé au passage une règle qui vaut pour toute place à venir : une place
   vide ne s'écrit pas dans l'empreinte.** Sans elle, une place de plus changeait
   le JSON canonique de toutes les recettes du disque — donc leur empreinte, donc
   le nom de leur rendu — et tout le cache se recalculait. Les 61 recettes
   distinctes du dépôt sont figées dans `tests/recettes-avant-b1.json` avec leur
   empreinte d'avant, et un essai les compare à chaque passage.

   **Son pinceau est carré depuis le 1<sup>er</sup> septembre 2026** (`U11`), et
   c'est le seul changement de forme qu'une place ait connu. Le disque était le
   choix de C4, où la main affinait un masque de différence sur une image de
   mille pixels ; elle est depuis la dernière place, donc un outil qu'on emploie
   sur le sprite fini, et un disque de rayon deux sur soixante-quatre pixels de
   côté ne fait pas un bord net — il fait un escalier que personne n'a dessiné.
   **Le prix est nommé et il se paie une fois** : un calque peint avant ce jour
   ne se redessine plus à l'identique, douze pixels de plus par point de rayon
   deux, mesuré. C'est la seule entorse jamais faite à la règle 5 ci-dessous, et
   elle est datée pour qu'on ne la refasse pas sans le dire.

   **Une place peut dormir, et dormir veut dire sans effet** — pas presque sans
   effet (`U4`, 1<sup>er</sup> septembre 2026). La recette porte la liste des
   places en veille : elles gardent tous leurs réglages et cessent d'agir. C'est
   l'exact contraire de les vider, et **éteinte et vide sont deux états**.
   L'ordre ne bouge pas d'un cran pour autant : une place endormie est sautée là
   où elle se serait appliquée. La liste entre dans l'empreinte de la recette —
   donc le rendu se refait —, elle voyage avec le reste, et l'agent la lit et la
   pose comme n'importe quel autre réglage.

   **La promesse se vérifie et ne se suppose pas** : une image traitée avec une
   place en veille sort *identique au pixel près* à la même sans cette place du
   tout. Le prix à payer est qu'aucun chemin du dépôt n'a le droit de lire les
   réglages d'une place sans lui demander d'abord si elle dort — le cache du
   détourage et la grille, qui regarde le détourage pour décider si le sujet vit
   dans une case, ont tous les deux fui à la première écriture.

   **Ce qui règle une image et ce qui en fabrique d'autres sont deux choses, et la
   V2.1 les sépare formellement.** Les huit places ci-dessus décrivent *cette*
   image : elles ont un état — posée, vide — et le rendu les rejoue toutes à
   chaque fois. Les deux **fabriques** — le *découpage*, qui coupe une image en
   plusieurs, et la *superposition*, qui en pose deux l'une sur l'autre — écrivent
   des fichiers neufs et ne posent rien sur l'image courante ; elles n'ont donc pas
   d'état à porter dans la recette. C'est ce critère qui a sorti le calque par
   différence de la recette : il nomme deux images en entrée et il en produit une
   troisième, ce qu'aucune place de recette ne fait
   (`docs/v21-arbitrages.md` A-18).

   **Le détourage par défaut ne demande aucun modèle**, et c'est une mesure, pas
   un principe : un remplissage depuis le bord — un pixel n'est du fond que s'il
   est *relié au bord* par une chaîne de pixels proches de la couleur de
   bordure — rend une silhouette propre sur les 44 images des bancs, squelette
   blanc sur fond gris clair et fioles translucides compris (`essais/essai_pixel.py`,
   27 août 2026). `rembg` reste **en troisième moteur, facultatif** — il embarque
   180 Mo de réseau de neurones et il est là pour les images qui ne viennent pas
   d'ici, donc sans fond plat. Absent, il est grisé avec sa raison, et rien du
   geste courant ne s'arrête.

   **Le deuxième moteur, lui, ne coûte rien : c'est le même remplissage, amorcé
   ailleurs** (E3). La pipette part d'un point désigné dans l'image au lieu des
   quatre bordures, et c'est toute leur différence — les graines sont un argument
   de la fonction, pas une seconde implémentation. Elle existe pour ce que le
   premier ne peut pas atteindre *par construction* : une poche de fond
   entièrement enfermée par le sujet n'est reliée à aucune bordure, donc aucune
   valeur de tolérance ne l'efface. Ce que la recette en garde est un **point**,
   jamais un identifiant de tache, et la couleur qu'il désigne est une mesure —
   voir `atelier/domaine/recette.py`, sur `Passe`.

   **Les quatre moteurs, depuis le 1<sup>er</sup> septembre 2026** (`U12` et
   `U13`, `docs/prd-decisions.md` § Les décisions des cinq capacités). Le
   troisième est la **sélection magique** : on entoure grossièrement ce qu'on
   veut garder, et le remplissage part du liseré de la forme sans droit d'en
   sortir — le tracé **borne** la recherche au lieu de la lancer, et rien ne
   bouge au-dehors. C'est encore le même remplissage, amorcé une troisième fois
   ailleurs. Le quatrième est le moteur par modèle, qui a cessé d'être un nom
   écrit en dur pour venir d'un **catalogue** : trois modèles, du plus rapide au
   plus lourd, choisis passe par passe, le rapide restant le défaut. Rien de
   l'ordre fixe n'a bougé — les deux se sont posés à cet endroit précis, comme
   annoncé.

   **Et une passe qui vient après une autre ne traverse plus ce qui est déjà
   effacé** (`U10`). Effacer un pixel ne change pas sa couleur, seulement sa
   transparence : le fond retiré restait un chemin coloré et invisible, par où
   la pipette d'une seconde passe ressortait ailleurs dans l'image. Reproduit et
   chiffré avant d'être corrigé — `essais/essai_pipette_seconde.py`.
5. **Le traitement est non destructif.** On garde l'image brute et la **recette** — la
   liste ordonnée des étapes et leurs réglages. Le fichier traité est un rendu, écrit sur
   disque comme cache, effaçable sans rien perdre. Recalculer coûte des millisecondes ;
   regénérer coûte de l'argent et ne rend jamais la même image. Corollaire gratuit : un
   preset *est* une recette nommée, et changer la palette d'un projet la réapplique à tous
   ses assets sans un seul appel payant.

   **Et une recette qui voyage ne porte que des réglages** — décidé le
   1<sup>er</sup> septembre 2026, en cadrant `U5`. `nommer` retire déjà la
   différence d'un calque et le décalage du calibrage, chacun avec sa raison
   écrite au-dessus de la ligne qui l'enlève : *c'est une coordonnée, pas un
   réglage*. La règle se généralise et devient la promesse du produit — le
   cadre de recadrage tracé, le point de la pipette, la forme entourée et les
   passages de la main s'y ajoutent. **Le prix se paie une fois** : une recette
   nommée emporte les passages de main aujourd'hui, elle cessera de les
   emporter.

   *Tenue le 1<sup>er</sup> septembre 2026 (`U5`).* La règle est **une fonction
   du domaine**, `voyage`, et elle a trois portes : coller d'une image à
   l'autre, enregistrer une recette nommée, rappeler une recette nommée. La
   troisième n'est pas une redite des deux autres — le disque porte des recettes
   écrites avant que la règle existe, et celles-là doivent se rappeler **sans
   lever**, en annonçant ce qu'elles perdent au lieu de le poser.

   **Elle rend ce qu'elle a laissé, en clair.** « Une place privée de ce qui la
   désignait arrive sans effet et le dit » : le dire suppose de le savoir, et le
   savoir suppose que le domaine le rende — un écran qui recalculerait la liste
   de son côté serait la seconde implémentation qu'on refuse partout ailleurs.
   Ce qui reste, reste entier : on retire la coordonnée, jamais la place qui la
   portait. Le recadrage garde sa marge, la passe garde sa tolérance.

### Squelette du dépôt

```
gag2/
├─ AGENTS.md                 écrit au fur et à mesure, jamais après coup
├─ docs/PLAN.md
├─ atelier/                  paquet Python
│  ├─ __main__.py            lance le serveur, ouvre le navigateur
│  ├─ api/                   FastAPI — les routes
│  ├─ mcp/                   serveur MCP — façade, aucune logique propre
│  ├─ services/              les gestes du produit
│  ├─ domaine/               objets et règles, aucune dépendance sortante
│  ├─ fournisseur/           le port + un adaptateur par fournisseur
│  ├─ image/                 mesures, détourage, grille, quantification, découpe, PNG
│  └─ depot/                 SQLite + fichiers
├─ interface/                React + Vite + Tailwind
├─ donnees/                  projets et assets — hors Git
└─ pyproject.toml
```

**Une seule frontière formelle : `fournisseur/`.** L'hexagone complet de GAG protège d'un
remplacement ; or il n'y a qu'une base, qu'un disque, qu'une interface, et aucun des trois
ne changera. Le fournisseur, lui, changera. Partout ailleurs : des modules à responsabilité
claire, comme `server/` dans MySpriteAi.

**Et derrière cette frontière, deux ports depuis A9** — un fournisseur d'images, un
**animateur** qui rend des clips. Le même adaptateur peut porter les deux, et c'est le cas :
OpenRouter sert les deux avec un compte, une clé et une facture. Le produit, lui, ne les
confond jamais, parce que leurs gestes ne se recouvrent pas.

| | Le fournisseur d'images | L'animateur |
|---|---|---|
| Le geste | un appel, une image, dans la même requête | on soumet, on attend, on télécharge |
| La durée | quelques secondes | deux minutes, et **l'atelier peut fermer entre-temps** |
| Ce qui est joint | trois rôles, tous facultatifs, tous cèdent devant le plafond du modèle (F6) | **une image de départ, obligatoire, qui ne cède jamais** |
| Ce qui revient | une image, que la chaîne mesure | un conteneur vidéo, qu'aucune chaîne d'images ne sait lire |
| Ce qui se refuse d'avance | un nombre d'images de référence | une durée, une résolution, **et un prix qu'on n'a pas pu relire** |

**Un port de plus n'est pas un modèle de plus**, et chacune de ces cinq lignes casse quelque
chose si on l'ignore. La plus coûteuse est la dernière du milieu : un fichier vidéo passé par
la mesure d'image lève « illisible », et le rattrapage enregistre alors un échec **à zéro
dollar** — un clip payé qui disparaît du journal du projet.

**Depuis A11, le port animateur a deux adaptateurs, et c'est le premier port du produit qui en
a plusieurs à la fois.** L'un parle à un fournisseur payant, l'autre à une application ouverte
sur la machine de l'auteur. Deux conséquences, et la première est un piège :

- **Ce qui manque à un fournisseur ne dit rien de l'autre.** Avec un seul adaptateur, *ce qui
  manque au fournisseur* pouvait griser tous les modèles sans conséquence. Avec deux, la même
  formule griserait **le seul modèle qui ne dépense rien** parce qu'une clé manque ailleurs. Le
  routage se fait donc **par le nom du fournisseur**, déjà porté par chaque modèle — pas par un
  second registre, qui finirait par ne plus s'accorder avec le premier.
- **Un adaptateur peut n'avoir aucun secret**, et le produit doit le supporter sans cas
  particulier : `secrets()` rend un tuple vide, le tiroir n'affiche rien pour lui, et rien ne le
  grise pour une clé qu'il ne demande pas.

**`mcp/` est le voisin de `api/`, pas son client.** Les deux appellent `services/`, aucune ne
réimplémente rien. C'est ce qui garantit que ce qu'un agent peut faire est exactement ce que
l'écran peut faire.

**Pas de noyau détaché** (contrairement à GAG) : utile pour un lot de nuit de huit heures,
inutile pour une génération de dix secondes qu'on regarde.

**Nommage — un tiers le lit → anglais, sinon → français.** Les noms d'outils MCP en anglais
(ils sont lus par des modèles entraînés en anglais ; `generer_asset` dégraderait le
déclenchement) et les chemins de routes HTTP par convention. Domaine, services, traitement
d'image, colonnes SQL, interface : en français.

## 4 bis · Fournisseur et modèles → `docs/archi-fournisseur.md`

Trois décisions tiennent ici, et le relevé qui les a dictées vit dans
**`docs/archi-fournisseur.md`** — deux bancs payés, leurs tableaux de coût et de qualité,
les pièges de fournisseur vérifiés par appel, le contrat de génération et les seize outils
du serveur MCP. Le numéro y est conservé : un renvoi `§4 bis` reste valide.

- **Un adaptateur par fournisseur, et son vocabulaire ne franchit pas son fichier** — c'est la
  règle 1 du §4, et elle n'a pas bougé d'un pouce quand ils sont devenus deux en F1. Ce qui a
  changé est que le produit ne dit plus *le fournisseur* mais **celui de ce modèle-là** :
  `atelier/services/fournisseurs.py` tient la liste, et lui seul. **Aucun repli automatique de
  l'un sur l'autre** — c'est une relance, et une relance appartient à l'auteur.
- **Un modèle se nomme par son fournisseur et par son nom, les deux ensemble** —
  `OpenRouter:openai/gpt-image-2`. Instauré en F1, parce que deux fournisseurs peuvent proposer
  le même nom : Cloudflare héberge les modèles de Leonardo. C'est cette chaîne-là qui
  s'enregistre sur une génération, et un nom seul ne dirait plus qui a fait l'image.
- **Le catalogue décide, jamais une liste en dur.** Il est relu au démarrage, **fournisseur par
  fournisseur** ; un modèle qui ne peut pas honorer la demande est **grisé avec sa raison**,
  jamais proposé puis rejeté en 400. SpriteCook code ses limites en dur, et plafonne sous
  les modèles. Depuis F1, chacun garde **sa** photo datée, et la fiche d'un modèle dit d'où
  elle vient — relue chez lui, ou relevée ici à telle date.
- **Un seul modèle par défaut : `openai/gpt-image-2` en `quality: low`.** Et la leçon qui a
  coûté deux bancs : *ne jamais conclure d'un banc dont le protocole n'est pas le geste réel
  du produit* — le classement s'est inversé dès qu'on est passé d'un sujet à un univers.
  **Un défaut dont le fournisseur est grisé n'en est pas un** (F1) : sur une machine sans
  aucune clé, il glisse tout seul vers celui qui n'en demande pas.
- **Ce qui est enregistré est ce que l'appel a consommé, dans l'unité du fournisseur** — F2, et
  c'est la révision n°2 de la V2.2. Des dollars quand c'en est, un jeton quand c'en est un.
  *On n'enregistre jamais un chiffre annoncé* n'a pas changé de fond ; seule l'unité a changé.
  **Un fournisseur déclare son compte** — son unité, ce qu'il alloue, d'où le chiffre viendra,
  sa cadence — et le produit le remplit : le plafond y est **facultatif**, parce qu'aucun des
  deux fournisseurs n'en annonce, et *ce qui reste* vaut alors `null`, qui n'est pas zéro.
- **Un total en argent ne compte que de l'argent** (F2), et c'est tenu par construction :
  `cout_usd` est **déduit** de la quantité et de son unité, et vaut zéro dès que l'unité n'est
  pas celle de l'argent. Aucune des sommes du dépôt n'a eu à apprendre qu'il en existe d'autres.
- **Un fournisseur déclare les places qu'il demande ; il ne les lit jamais lui-même** — F3.
  L'adaptateur dit *quelles places existent et comment on en parle* (`atelier/domaine/secret.py`) ;
  ce qu'il y a dedans se lit dans `atelier/reglages.py`, **à chaque appel**, pour qu'une valeur
  déposée serve au premier appel suivant sans redémarrer — règle de T1, étendue au pluriel
  plutôt que réécrite. Un fournisseur peut en demander **zéro, une, ou deux** : Cloudflare veut
  un compte *et* un jeton, et la phrase de ce qui manque **dit lequel**. C'est la même phrase
  qui grise ses modèles, écrite une seule fois — trois rédactions finiraient par dire trois
  choses.
- **Ce que le produit ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a
  joint ne cède jamais** — F6. Un modèle gratuit n'accepte aucune image d'entrée, et refuser
  l'appel entier rendait le brouillon gratuit inutilisable sur tout jeu ayant **un seul**
  artwork officiel. Ce qui cède le fait du plus large au plus étroit — l'artwork du jeu, puis
  l'image que l'ambiance apporte, puis le concept art désigné pour cette chose-là —, et le
  gabarit d'une planche ne cède pas : il *est* la demande. **Rien ne se perd en silence** : le
  grisé d'un modèle se compte sur ce qui ne cède pas, l'écran de confirmation marque ce qui ne
  partira pas, le prix ne compte que ce qui part, et la génération enregistre ce qu'elle a
  laissé au sol pour que la fiche de l'image le dise des mois plus tard.
- **Le modèle imposé à l'agent est gratuit, et son repli l'est aussi** (F6). Un garde-fou posé
  pour ne rien dépenser qui se replierait sur le défaut du catalogue — le meilleur modèle du
  banc, donc un payant — coûterait de l'argent en silence, ce qui est pire que pas de
  garde-fou. Le défaut du catalogue ne sert qu'en dernier recours, quand l'atelier est composé
  sans aucun fournisseur gratuit.
- **Le produit n'écrit que dans une place qu'un fournisseur a déclarée** (F3). Les routes de
  dépôt et de retrait refusent tout autre nom : sans cette garde, un navigateur pourrait écrire
  n'importe quoi dans le fichier de configuration de l'auteur. Et **rien n'y touche à
  `donnees/`** — *retirer une clé grise ses modèles et n'efface ni une image ni une dépense*
  est tenu par ce qui n'est pas écrit, non par une précaution à retenir.

## 5 · Modèle d'objets → `docs/archi-objets.md`

**Les objets du produit et ce que chacun porte** vivent dans `docs/archi-objets.md`.
*Descendu en annexe le 6 septembre 2026* — la section pesait **28 %** de ce document. Le texte
n'a pas bougé d'un mot.

On l'ouvre avant de toucher à un objet du domaine. ⚠️ **La V4 en modifie quatre** : la pièce
d'équipement déclare qui la porte, la collection devient un groupe libre de sujets, la bande se
range comme une image, le clip entre en bibliothèque (`docs/PLAN-carnet.md`).


## 6 à 10 · Les versions → `docs/archi-versions.md`

**Ce que chaque version contient, et par quel mécanisme, vit dans
`docs/archi-versions.md`** — §6 la V1 et ses briques, §7 la V2 avec le pliage, le calque
par différence et le risque de la version, §8 l'animation — **réécrite le 2 septembre 2026,
elle est désormais mesurée et non plus supposée** —, §9 et §10 les tuiles et le son. Les
numéros y sont conservés : un renvoi `§7` ou `§6.2` reste valide, seul le fichier change.

**Trois versions n'y ont pas de section, et c'est voulu** : la **V2.1** est décrite ci-dessus,
§5 ; la **V2.2** dans `docs/archi-fournisseur.md` ; et la **V2.3** n'a que son plan, parce
qu'elle ne pose aucune brique neuve — elle répare des briques existantes. L'ordre réel des
versions est **V1, V2, V2.1, V2.2, V2.3, V3, V4, V5**, **plus une version d'édition sans rang
fixé** — le dessin à la main, décidé le 2 septembre 2026 et non découpé.

On l'ouvre quand on travaille *dans* une version. Ce qui tient l'ensemble — les cinq
règles, le squelette, le modèle d'objets, les risques — reste ici.

## 11 · Risques, et quand les lever → `docs/archi-risques.md`

**Les risques de l'architecture, et le moment où chacun se lève**, vivent dans
`docs/archi-risques.md`. *Descendu en annexe le 6 septembre 2026.*

On l'ouvre quand on ouvre une version, pour savoir ce qu'elle doit lever — pas au démarrage
d'une session.


## 12 · Ce qu'on récupère

| Source | Pièce | Usage |
|---|---|---|
| GAG | `gag/domaine/direction.py` | extraction de palette, luminance, saturation |
| GAG | `gag/ports/`, `gag/adaptateurs/` | la forme du port fournisseur, allégée |
| GAG | AD-5, AD-9, AD-11, AD-28 | index jetable, post-traitement hors GPU, vocabulaire confiné |
| MySpriteAi | `src/lib/pixelPipeline.ts` | **porté en T2**. Les décisions dedans étaient durement acquises et elles sont reprises telles quelles : durcir l'alpha à 128 **avant** la réduction, et ne jamais forcer l'alpha à 255 en quantifiant — les deux moitiés du même liseré clair. Écarté au passage : le k-means++ de la palette, qui tire son initialisation au sort et rendrait deux images différentes pour une même recette nommée |
| MySpriteAi | `src/lib/audioPipeline.ts` | V5 |
| MySpriteAi | `workflows/audio/txt2sfx.api.json` | V5, si le local reste au menu |
| SpriteCook | captures `screen_spritecook/` | référence d'ergonomie, écran par écran |
| **Le pantin articulé libre** | l'**algorithme** de déformation du maillage, pas le dépôt | **V3, tranche `A8`.** Code et poids sous une licence qui ne pose aucune condition, et — c'est ce qui change la taille de la tranche — **sa partie animation ne dépend d'aucun modèle lourd** : si l'atelier fournit lui-même la silhouette et la position des articulations, ce qu'il sait déjà faire, toute la chaîne tourne sur les deux bibliothèques de calcul déjà installées. Il n'y a **aucun poids d'attache à calculer** : les articulations sont de simples épingles. ⚠️ **On recopie, on ne dépend pas** — le dépôt est archivé depuis septembre 2025, son calcul déborde numériquement au-delà d'un millier de points, et son affichage passe par la carte graphique, à ne pas reprendre |
| **Les corpus de mouvements** | des mouvements nommés, réutilisables commercialement | **V3, tranche `A6`.** Un cycle de marche complet, une fois ramené à des angles à plat, tient en **quarante-huit nombres**. Une bibliothèque maison se paie une fois en travail et devient gratuite pour tous les personnages suivants |
| **Les formats de sortie** | le descriptif d'une planche de sprites, et le format de squelette | **V3, tranches `A4` et `A8`. On n'invente aucun format** : celui que les moteurs lisent le plus est connu et ses clés sont relevées, et le format de squelette de référence existe. Un moteur ouvre alors la planche sans la remesurer |

## 13 · Hors périmètre, et pourquoi

| Écarté | Raison | Réversible ? |
|---|---|---|
| Modifier implicitement l'installation de ComfyUI | l'atelier doit préserver les autres workflows de l'auteur | le pilotage HTTP est dans le périmètre ; installation et mises à jour restent des gestes explicites |
| Contrôle de conformité automatique | l'auteur juge mieux et plus vite | oui, la palette mesurée est déjà là |
| Description du style par un modèle de vision | l'auteur décrit mieux son propre univers qu'un modèle ne le devine, et une bible est une décision, pas une observation | oui, le port existe dans GAG. *Raison réécrite le 2 septembre 2026 : « c'est de l'analyse d'image, écartée avec le reste » n'est plus vrai comme énoncé général — la V2.3 en fait, pour **retrouver la vraie taille de bloc** d'une image. Ce qui est écarté, c'est de faire **juger** par une machine, pas de faire **mesurer**.* |
| UI Kit + éditeur 9-slice | 8 étapes, taxonomie, extraction — un produit à lui seul | oui, mais ce sera un chantier |
| Paquets pour tous les moteurs | le besoin confirmé est Godot via l'agent de développement | le pont Godot entre dans le plan du 11 septembre ; les autres moteurs restent ultérieurs |
| Pack d'assets par genre | fabrique de la quantité — c'est le métier de GAG | non souhaitable |
| Comptes, crédits, distribution | outil personnel | non souhaitable |
| ~~Génération non-pixel-art~~ | — | **revenue dans le périmètre le 28 août 2026, et livrée.** La taille de pixel d'un univers accepte « aucune », la bible a gagné la vue et la technique de rendu, et le prompt exact se voit et se reprend |
| **Réécrire la demande d'animation** | **mesuré mort** : trente-et-un réglages sur trois bancs, cinq réécritures de fond pour **zéro bonne planche sur vingt**, les planches à quatre cases pour **zéro sur seize** | non — *« une demande de plus au même modèle ne donnera rien : ce n'est plus une opinion, c'est six dollars de mesures »* |
| **Corriger le bord d'un détourage par calcul de transparence** | **mesuré inutile ici** : cherché sur quarante vraies images, le halo vaut **80 pixels sur 138 465**, un millième. Le produit génère sur fond plat et découpe par inondation, et le moteur par défaut ne rend **aucun** pixel à demi transparent | oui, et à deux lignes : la bibliothèque est installée et jamais appelée. Le jour où le moteur par modèle deviendrait le défaut |
| **Dégrossir une animation chez un fournisseur gratuit avant de payer le bon** | structurel : le modèle gratuit **n'accepte aucune image en entrée**, donc pas le personnage. Ce ne serait pas un brouillon, ce serait un autre personnage | oui, le jour où un gratuit accepterait des références |
| **Faire du pantin la sortie principale du produit** | on ne sait pas encore s'il tient sur nos images, et bâtir la livraison sur une chose non vérifiée est le contraire de la règle du dépôt | oui, si `A0` et `A8` rendent mieux qu'espéré |
| **Un format de livraison inventé ici**, pour la planche comme pour le squelette | les formats les plus lus existent et s'écrivent tels quels | non souhaitable |
