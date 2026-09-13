- dans l'onglet univers, les cartes de type texte doivent être améliorer : 
> déjà le texte doit être tronqué visuellement pour ne montrer que les premières lignes (en vue grille ou univers)
> en vue tuile, pour les cartes textes, il devrait y avoir un bouton pour afficher le texte complet qui ouvre une popup permettant de voir le texte complet et pouvoir l'éditer
> le texte doit supoorter et interprêter le markdown pour la mise en page. 
> dans la popup de visualisation et d'édition on doit avoir la possibilité de faire une recherche dans le texte. et d'afficher le résultat de la recherche en mettant en surbrillance le texte trouvé.


- dans les réglages, le "modèle d'exploration" n'est pas compréhensible. a quel moment il s'applique, a quoi sert cette option ? car la si on lit l'infobulle on comprend que ca impose un modèle quel que soit les réglages choisis. Et ca ne se reflète pas dans l'atelier quand on change un modèle (ca devrait indiqué clairement que cette option est active et qu'on peu pas choisir de modèle si c'est le cas) sauf si cette option intervient que quand on dépasse le plafon de la séance réglé dans les réglages. mais dans tout les cas ces deux options sont assez obscure et pas indiqué clairement. Surtout qu'un plafond par séance n'a pas trop de sens : fermer et reouvrir relance le plafond a zero... ca controle des dépense d'une manioère étrange et inutile. 


- plus tard j'aimerai quand même avoir le détail des couts par projet et pour toute l'app. pas un truc ultra détaillé mais qui permet de savoir combien le projet a couté a peu prés. 


- dans le projet "coeur de pierre - 01" j'ai importer mon propre asset (une image avec 4 postude de mon personnage). j'ai utiliser l'outil de découpe sur l'image balthazar start.jfif et en résultat j'ai 4 image dansl a grille mais sans visuel. comme si la découpe n'avais pas marché (problème de format don penser a ajouer un convertisseur ?). j'ai testé avec un jpeg c'est pareil. Par contre si je fait un détourage avant la ca marche sur le jpeg. bref a controler et tester.

- l'outil de découpe est trop cacher, c'est un outil plutot important qu'il faudrait bien voir sur une fiche. 

- l'outil pour générer "ce qu'on porte" sur un personnage est a améliorer (je pense qu'il n'est pas fini). mes remarques pour le moment : 
on peut pas choisir si c'est un calque ou un corps habillé. il manque l'outil pour créer le calque par différence avec retouceh manuelle. si on envoi une pose d'un personnage qui contient plusieurs direction, ca doit créer une planche avec les 4 directions de l'habit en une génération, la ca prend la dernière iamge seulement de la pose. deplus si l'objet générer ne rentre pas dans le cadre il est coupé, il faut donc avoyer une version avec des marge de sécurité peut-être ? 


---

## Séance du 1<sup>er</sup> septembre 2026 — quatre remarques de plus

*Relevées pendant que le lot « l'assistant refait » était en cours. À traiter en suivant :
analyse mesurée, maquette, propositions, puis développement.*

- ~~**Univers > toile — un mode édition sur une image posée.**~~ Quand on pose une image, on
  voudrait pouvoir la découper en plusieurs, la recadrer, détourer son fond, sans quitter la
  toile. Les tables de l'établi portent déjà tous ces outils ; il s'agit de pouvoir en employer
  un seul, isolément, ici. **Le cas réel** : un artwork importé contient trois personnages sur
  un fond ; on veut en faire trois artworks séparés, et on ne veut pas que le fond entre dans
  la palette quand on promeut l'image en artwork officiel.

  **Fait le 1<sup>er</sup> septembre 2026.** Maquette
  `docs/archive/maquettes-v2.1/06bis-decouper-une-carte.html`, construite le jour même. Le menu d'une
  carte gagne *Découper ›*, qui ouvre l'écran de découpe sur elle ; ses morceaux sont des
  cartes du même tableau, qui arrivent en réserve, non promues. Recadrer est la même découpe à
  un seul rectangle, avec une case — décochée — qui fait hériter le morceau de tout ce qui
  faisait l'originale et emporte celle-ci.

  **Le troisième verbe a été mesuré, et il n'a rien donné à construire.** Le fond n'entre
  *déjà* pas dans la palette : `palette_de()` détoure depuis toujours, et sur les six artworks
  officiels du dépôt il écarte de 30 à 60 % des pixels, à raison — sans lui, la palette du
  donjon passe de 6 à 34 couleurs presque noires. Ce qui pollue une palette, ce sont les
  **voisins** : un titre d'interface, une barre de vie, un second personnage dans le cadre.
  Il n'y a donc pas d'outil de gommage ; il y a une **fenêtre** — le pour-cent dans le menu de
  la carte, et l'image en magenta dans l'écran de découpe, qui montre ce qui est écarté.
  Contre-épreuve gardée avec : découper améliore la palette une fois sur deux, jamais
  systématiquement, et l'écran ne le promet pas.

- **Codex — des catégories pour ranger les choses du jeu.** Sur un jeu qui a beaucoup d'assets,
  la liste devient vite chargée. Regrouper les personnages par *héros*, *méchants*,
  *bestiaire*… Une famille dit déjà ce qu'une chose *est* ; ce qui manque est où l'auteur la
  range.

- **Le panneau « réglages de l'appel » ne se referme pas.** Ouvert, on ne le voit pas, et on ne
  sait pas où cliquer pour le refermer. **Et la remarque générale qui va avec** : l'interface
  manque de fluidité, beaucoup de choses sont trop textuelles et peu naturelles à trouver sans
  chercher.

- **Le prompt d'une pose ne tient pas la vue du jeu — c'est un défaut, pas une préférence.**
  Mesuré sur le jeu *Test v2*, vue *de dessus, verticale*. Le texte envoyé était :

  ```
  World: Royaume de tourbe et de fer, marais au nord, vieux chemins boueux, ruines médiévales
  Era: Haut Moyen Âge, avant la poudre
  Rendering technique: 2D pixel art on a 64x64 grid
  Line and shading: Contour brun d'1 pixel, aplats de couleurs, aucun dégradé
  Lighting: Lumière rasante, ambiance sombre, ombres portées courtes
  View and framing: strict top-down view seen from directly above
  Technical constraints: Sprite isolé sur fond plat, grille stricte 32×32 px, pas de perspective

  Cape verte sombre
  Tunique beige
  Bottes brunes
  Petit sac à dos
  Torche dans une main, idle stance, full body
  ```

  **Ce qui est sorti** : des vues de face, ressemblant à l'image de référence qui était de face.
  La consigne de vue est noyée en sixième position sur sept, entre deux lignes qui la
  contredisent — `Technical constraints` dit *pas de perspective* et une grille de 32 quand le
  réglage dit 64 —, et l'image de référence, elle, montre le contraire de ce que le texte
  demande. **Il faut que l'atelier écrive des prompts hiérarchisés et efficaces** : ce qui décide
  du cadrage et de la pose doit passer devant, pas derrière la couleur des bottes.

  *Trois pistes déjà visibles en lisant la donnée du jeu, à vérifier avant de dessiner :*
  l'ordre des sept cases est celui de la fiction vers le cadre, donc le cadre finit dernier ;
  la case `technique` de ce jeu est tapée à la main et contredit deux réglages ; et rien ne dit
  au modèle que l'image jointe est une **référence de style** et non une **référence de pose**.

---

## Séance du 2 septembre 2026 — le dépliage repasse sous la main de l'auteur

- **La planche doit se voir, se garder, et se déplier autant de fois qu'on veut.** Demandé
  par l'auteur le 2 septembre 2026, **à mettre en V3**, et c'est un changement de règle, pas
  un réglage de plus.

  **Ce que le produit fait aujourd'hui, et qui ne convient plus.** Une planche est *« une ruse
  d'appel, jamais un format de livraison »* (`docs/archi-versions.md` § Le pliage) : elle part,
  elle revient, l'atelier la découpe tout seul, les morceaux entrent en bibliothèque et **la
  planche n'existe nulle part**. Si le découpage tombe mal, il n'y a rien à reprendre — il faut
  repayer la planche.

  **Ce qui est demandé, et le mot est « contrôle absolu » :**
  - la planche **se voit dans la galerie**, comme n'importe quelle image ;
  - son dépliage se **refait**, autant de fois qu'on veut, et se **corrige à la main** —
    déplacer une coupe, en ajouter une, en retirer une ;
  - les images qui en sortent lui sont **rattachées** : on sait de quelle planche et de quel
    dépliage vient chaque morceau ;
  - et l'on peut **gérer le tout** — supprimer les images d'un premier dépliage sans toucher à
    la planche, en refaire un autre à côté.

  **Pourquoi c'est la V3 qui le rend impératif.** Le geste principal de la V3 est *commander
  plusieurs planches et garder la bonne* : il suppose qu'on **voie** les planches avant de
  choisir, et qu'on puisse en garder une étape ici et une étape là. Un dépliage automatique et
  sans retour rend ce geste impossible.

  **La moitié de la machinerie existe déjà** : le découpage manuel de T5 sépare exactement ces
  deux gestes — `proposer` des rectangles, `decouper` ceux qu'on lui donne — et l'asset porte
  déjà une filiation de découpe. Ce qui manque est que le **pliage** passe par ce chemin-là au
  lieu du sien.

  → **Tranche A1 du plan de la V3.**

---

## Séance du 3 septembre 2026 — après `D1`

- **L'étape « Le détourage de départ » est incomplète, et elle est au mauvais moment de
  l'usage.** Posée en `D1` le 3 septembre 2026, gardée telle quelle par décision de l'auteur, à
  reprendre.

  **Ce qu'elle ne laisse pas régler.** Quatre choses manquent, et deux d'entre elles sont
  contredites par ce que la tranche a livré ailleurs :
  - **quel modèle de silhouette** employer quand le moteur est *le modèle* — le champ existe
    dans le domaine (`Passe.modele`, `U13`), il n'est simplement pas offert ici ;
  - **la tolérance** et **le seuil de transparence** — écartés délibérément, sur la mesure « tu
    les as laissés à leur valeur livrée 96 fois sur 100 ». La mesure reste vraie ; ce que
    l'écran en a fait — les cacher entièrement — est un choix à rediscuter, parce que 4 fois sur
    100 n'est pas zéro et qu'il n'y a aucun autre endroit pour poser un *défaut* de tolérance ;
  - **le durcissement** *(le bord rongé)* : il **est** réglable, mais seulement une fois qu'un
    moteur a été choisi sur la ligne. Tant que la ligne dit « — », il n'y a rien à régler et rien
    ne le dit. L'auteur l'a lu comme absent, ce qui est le signe que l'écran le cache mal.

  **Et le vrai reproche, qui est ailleurs.** *Cet écran existe très tard dans l'usage.* Il est
  la onzième étape de l'Univers, c'est-à-dire un endroit où l'on passe en réglant son jeu — donc
  **avant** d'avoir fabriqué la moindre image. Or on ne sait quel détourage convient qu'**après**
  en avoir fait quelques-unes. Le geste naturel serait l'inverse : régler une image dans sa table,
  aimer le résultat, et dire *« garde ça comme défaut pour les personnages »* depuis l'image
  elle-même. L'écran de l'Univers deviendrait alors la **relecture** de ce qu'on a promu, et non
  l'endroit où l'on devine à froid.

  → **À reprendre : maquette d'abord.** Ce n'est pas un réglage à ajouter, c'est un geste à
  déplacer.

- **Deux astuces de détourage de la revue externe n'étaient dans aucune tranche**, retrouvées le
  3 septembre 2026 dans `revue-externe-2026-09-02/research/01-detourage-bords.md` : le
  **rongement conditionnel** (n'ôter que les pixels de bord plus proches du fond que de leur
  voisin intérieur, au lieu d'éroder en aveugle) et la **décontamination sans matting** (donner à
  un pixel de bord pollué la couleur de son voisin intérieur). Plus le **contour en croix à un
  pixel** et sa **couleur prise dans la palette du jeu**. → **Écrites dans `D4`** le même jour,
  avec leurs critères. Rien à faire ici.

---

## Séance du 3 septembre 2026, au soir — douze remarques en vrac

*Transcrites telles que l'auteur les a écrites, à chaud, sans rien reformuler ni trancher. Rien
n'est encore analysé ni arbitré : à reprendre une par une — analyse mesurée, maquette,
proposition, puis développement. La numérotation est celle de l'auteur. Une capture d'écran
accompagnait la remarque sur la toile de l'univers : le menu d'action d'une carte survolée, qui
déborde vers le bas hors de l'écran.*

2. → **Sortie du journal le 3 septembre 2026.** Son texte et son analyse vivent dans
   `docs/remarques/demarrer-premiere-pose.md`.

3. → **Sortie du journal le 3 septembre 2026.** Son texte et son analyse vivent dans
   `docs/remarques/zoom-des-tables.md`.

4. → **Sortie du journal le 3 septembre 2026.** Son texte et son analyse vivent dans
   `docs/remarques/recettes-nommees.md`, avec la remarque 5 — c'est le même panneau.

5. → **Sortie du journal le 3 septembre 2026.** Voir la remarque 4 :
   `docs/remarques/recettes-nommees.md`.

6. → **Sortie du journal le 3 septembre 2026.** Son texte et son analyse vivent dans
   `docs/remarques/concept-art-contre-artwork.md`.

7. → **Sortie du journal le 3 septembre 2026.** Son texte et son analyse vivent dans
   `docs/remarques/attente-du-detourage.md`.

- → **Sortie du journal le 3 septembre 2026.** *(les curseurs de taille qui dérivent)* Son texte et
  son analyse vivent dans `docs/remarques/curseurs-qui-derivent.md`.

- → **Sortie du journal le 3 septembre 2026.** *(les réglages de départ, et l'accueil qui manque)*
  Son texte et son analyse vivent dans `docs/remarques/reglages-de-depart-et-accueil.md`.

- le réglages de "l'allure", déjà le premier truc qui me choque c'est le texte :
- → **Sortie du journal le 3 septembre 2026.** *(les sept reproches faits à « l'allure »)*
  Son texte et son analyse vivent dans `docs/remarques/l-allure.md`.

- → **Sortie du journal le 3 septembre 2026.** *(le menu d'une carte qui déborde, et l'écran
  de l'univers à revoir)* Son texte et son analyse vivent dans
  `docs/remarques/menu-de-carte-et-ecran-univers.md`.

- → **Sortie du journal le 3 septembre 2026.** *(« ce que la palette lit » incompréhensible)*
  Son texte et son analyse vivent dans `docs/remarques/ce-que-la-palette-lit.md`.

* j'ai une idée qui me parait pas si bête : dans tout les écrans et interface du jeu, il faut afficher que ce qui est le plus utile et qui est facile a comprendre et a prendre en main, tout le reste, doit être masqué par défaut ouvrable avec des bouton de réglages avancés. Ca permettrait d'alléger visuellement cette interface hyper chargé qui assome d'infos technique etc...  Deplsu je pense qu'il va vraiment falloir faire une grosse passe de design pour ajouter des icones, des boutons, des feedbacks, bref tout ce qui pourrait moderniser et fluidifier l'experience utilisateur. c'set un gros chantier a voir bientôt car plus ca va plus on rajoute de choses et plsu ca va etre compliqué de tout repenser. a noter également : l'idée d'adapter les couleurs de l'interface a la palette du jeu ouvert (ce serait stylé et boosterai la créativité).


- **L'atelier ne demande jamais si le jeu est en pixel art — et c'est la première
  question de toutes.** Trouvé par l'auteur le 3 septembre 2026, en construisant D2.

  **Ce qui existe aujourd'hui.** Le seul endroit qui le dise est la *taille de pixel*
  du jeu, où « aucune » vaut « ce n'est pas du pixel art ». C'est la neuvième option
  d'un choix de tailles, à la troisième étape des réglages. Le code le sait :
  `interface/src/composants/Assistant.tsx`, étape « La taille », dit en toutes
  lettres *« elle est en tête parce qu'elle est la première question — ce jeu est-il
  en pixel art ? »*. Elle est en tête de la liste ; elle n'est pas posée.

  **Et elle est dite deux fois, sans que rien ne les accorde.** L'auteur écrit aussi
  « 2D pixel art » dans la case *rendu* de sa bible, en texte libre. Deux endroits
  disent la même chose, aucun ne vérifie l'autre — c'est exactement le motif que le
  dépôt refuse partout ailleurs (« deux vérités sur la même chose finissent par
  diverger »).

  **Ce que ça coûte, mesuré le même jour.** Les deux jeux du dépôt demandent tous
  les deux du pixel art et reçoivent deux choses différentes : *cœur de pierre*
  reçoit des **peintures détaillées** sans le moindre bloc, *test v2* reçoit du vrai
  faux pixel art à la grille visible. Ces deux cas ne se traitent pas du tout pareil
  — l'un se convertit, l'autre se retrouve — et **le produit ne sait pas dans lequel
  il est**. Il applique la même réduction aux deux, d'où la bouillie.

  **La bonne nouvelle : l'atelier peut le mesurer lui-même.** Le test du « peigne »
  — le contraste tombe-t-il sur les multiples du pas, ou n'importe où — sépare
  franchement les deux : **0,12 sur la peinture du nain, 0,69 sur le porteur de
  torche**, rien entre les deux. De quoi dire à l'auteur *« tu as demandé du pixel
  art, le modèle t'a rendu une peinture »*, ce que rien ne dit aujourd'hui.

  → **À reprendre en tête de D2**, et c'est un changement de forme, pas un réglage
  de plus : la question se pose **avant** la taille, elle décide de ce que la taille
  veut dire, et l'atelier vérifie ensuite sur l'image revenue si la réponse a été
  tenue.

---

## Séance du 3 septembre 2026 — pendant `D2`, sur la question des couleurs

Écrit par l'auteur au vu du banc de pixelisation, après avoir tranché la méthode et
les paliers de couleurs. **Ses mots, dans l'ordre :**

> Ca c'est une vrai question et ca se travaille en plusieurs points :
>
> - on doit indiqué qu'il n'y a pas d'artwork et proposer de choisir une image de
>   l'univers et indiquer un lien vers le guide qui doit avoir une explication dédié
>   a comment créer les artwork du'n personnage. (c'set un point a mettre en remarque,
>   car aujourd'hui on créer l'univers, mais si on a pas créer les personnages dans le
>   codex, on peut pas les attribuer, donc il faudra créer une mécanique pour créer une
>   entité depuis l'univers : a noter).
> - si l'utilisateur n'a pas d'artwork on doit proposer de créer un artwork avec le
>   générateur d'image, mais le user doit avoir la description du personnage quelque
>   part (ca peut être une carte de l'univers, la aussi il faudra créer une mécanique
>   dans la toile de l'univers pour générer des artwork a partir d'autre artwork ou
>   texte, pouvoir composer des prompt sur mesure et fournir différente référence pour
>   demander quelque chose : a noter).

**Ce que la mesure ajoute, le même jour.** Le banc a montré *pourquoi* ces trois
remarques comptent, et le chiffre est net : la quantification n'entre que s'il existe
une palette (`Univers.recette_de`), et la palette se déduit des artworks officiels.
**Sans artwork déposé, il n'y a donc aucune réduction de couleurs du tout** — le sprite
sort avec dix mille couleurs, et rien à l'écran ne le dit. Ce n'est pas un réglage mal
expliqué : c'est une étape entière du traitement qui ne s'exécute jamais, silencieusement.

Les trois remarques se tiennent donc en chaîne, et dans cet ordre :

1. **le dire** — annoncer qu'il n'y a pas de palette et ce que ça coûte ;
2. **pouvoir y remédier sur place** — choisir une image de l'univers, ou en générer une ;
3. **avoir de quoi la générer** — ce qui suppose une description quelque part, donc une
   entité créable depuis l'univers, donc une composition de prompt avec des références.

Le point 3 est le plus lourd et déborde largement `D2` ; les points 1 et 2 sont à la
portée de la tranche qui traitera les couleurs.

---

## Séance du 3 septembre 2026 — un défaut croisé en travaillant D2, hors de son périmètre

- **Le calage horizontal est effacé en silence dès qu'on repose une recette.** Trouvé en
  ajoutant la méthode de réduction à la charge de la grille, et **vérifié par la route**
  avant d'être écrit ici : un asset dont le décalage vaut 7 revient à **0** après un simple
  `PUT /api/assets/{id}/recipe`.

  **Pourquoi.** Le décalage n'est écrit que par le calibrage (`services/calibrage.py`), et
  la charge de l'écran — `CorpsGrille` dans `api/routes.py` — **ne le porte pas**. Elle
  porte la cible, l'occupation, l'ancrage. `en_recette()` reconstruit donc une grille sans
  décalage, et `poser_les_places` ne protège que la différence d'un calque et les passes.

  **Pourquoi personne ne l'avait vu.** Le calibrage est récent (E17), et il faut la
  séquence exacte — caler une image, puis toucher n'importe quel réglage de sa grille —
  pour le perdre. Rien ne le signale : l'image se recentre, ce qui ressemble à un rendu qui
  a bougé plutôt qu'à un réglage effacé.

  **La réparation est d'une ligne**, et elle est exactement celle qui protège déjà la
  différence : `poser_les_places` garde le décalage de l'asset quand la charge n'en parle
  pas. La docstring de cette méthode dit déjà le principe — *dire ici, une fois, de quoi
  cette charge-là parle*. C'est le même piège, une place plus loin.

  → Laissé tel quel **exprès** : c'est la tranche du calibrage, pas celle de la réduction,
  et corriger en passant un défaut qu'aucun essai ne couvrait aurait mêlé deux sujets dans
  la même livraison. À prendre en premier dans la tranche qui touchera la grille.



---

## Séance du 3 septembre 2026 — en étayant les recettes nommées

- **Un historique des retouches, pour revenir en arrière.** Demandé par l'auteur le 3 septembre
  2026, **pour bien plus tard**, en tranchant la pose d'une recette en lot : *« je me dis qu'on
  pourrait aussi plus tard implémenter un historique des retouches, qui permet de revenir en
  arrière »*.

  **Pourquoi c'est noté ici et pas ailleurs.** L'absence d'historique est ce qui rend la pose en
  lot dangereuse : il n'existe qu'un seul champ recette par image, et « revenir au brut » ramène
  à l'image nue, jamais au réglage d'avant. C'est écarté par écrit — `docs/PRD.md:407` range
  ensemble *« l'historique des recettes appliquées »* et *« le versionnement d'une recette
  nommée »*. Le jour où l'historique existe, la question « qu'arrive-t-il aux images déjà
  réglées à la main » cesse d'être irrattrapable, et le lot cesse d'avoir besoin de deux clics.

- **Et si la vidéo locale servait aussi à fabriquer les poses fixes ?** Idée de l'auteur, le
  3 septembre 2026, **à essayer après la V3**, pas pendant.

  **Le décor, pour qui prend le document en route.** Fabriquer une image d'asset sur la machine
  de la maison — gratuitement, sans passer par un fournisseur payant — a été tenté et n'a jamais
  donné un résultat qu'on puisse garder. C'est pour ça que les images passent aujourd'hui par des
  modèles payants, GPT Image 2 en tête. Mais la V3, celle qui est en cours, fait autre chose :
  elle **anime** un sprite en fabriquant une petite vidéo, et cette vidéo-là, elle, tourne
  gratuitement sur la carte graphique de la maison — le banc du 3 septembre l'a établi
  (`docs/archive/recherche-video-locale/rapport.md`, tranche `A11` du plan).

  **L'idée.** Si la machine sait animer un sprite gratuitement, elle sait produire des images de
  ce sprite **sous un autre angle ou dans une autre attitude**. Alors on n'aurait plus besoin de
  payer pour une pose fixe : on demanderait un clip — *tourne-toi*, *meurs*, *lève le bras* — et
  on **irait chercher la case** qui convient dedans. Un clip de dix secondes qui enchaîne
  plusieurs mouvements donnerait, en théorie, plusieurs poses d'un coup.

  **Pourquoi ça vaut d'être essayé même si c'est lent.** C'est long — dix à trente minutes le
  clip sur une carte de 8 Go —, mais c'est **gratuit**, et sur ce sujet c'est le seul chiffre qui
  compte : le payant ne coûte pas cher au clip, il coûte de **devoir compter**. Une pose fixe
  gratuite change la façon de travailler, pas la facture.

  **Ce qui reste à vérifier**, et qui n'est pas acquis : une case tirée d'une vidéo est-elle
  assez nette et assez fidèle au personnage pour tenir comme pose officielle, là où l'animation
  pardonne le flou parce que ça défile. C'est exactement la question que le banc animé n'a pas
  eu à poser.

  → **À ouvrir après la V3**, quand le moteur de la maison sera en place et payé de son temps de
  mise au point. Voisin de la question reportée du § 6a de [`l-allure.md`](l-allure.md) : les
  deux touchent à ce qui part au modèle pour une pose, et aucune des deux ne se tranche sans
  tirages.

  **Portée au plan le 3 septembre 2026** — `docs/PLAN.md`, section *Ce que ce plan ne couvre
  pas*, avec la question qui décidera : une case tirée d'une vidéo tient-elle comme pose
  officielle ?

- **Mettre une image de côté depuis l'écran de montage, pour en faire une pose.** Idée de
  l'auteur, le 3 septembre 2026, dans le prolongement direct de la précédente.

  **Le décor.** La V3 construit un écran — la tranche `A10`, *le montage* — où le clip payé
  s'ouvre en tournant en boucle, avec **toutes ses images posées côte à côte sur une pellicule**,
  et où un clic prend ou laisse chacune. Cet écran existe pour une seule chose : composer une
  **animation**, c'est-à-dire une suite d'images qui s'enchaînent.

  **L'idée.** Puisque l'auteur est déjà en train de regarder chaque image une par une, il devrait
  pouvoir en **mettre une de côté** sans quitter l'écran — non pas pour l'animation en cours,
  mais pour en faire **une pose fixe**, ou n'importe quel autre usage. Un second geste sur une
  image de la pellicule, à côté du geste qui la retient pour l'animation.

  **Pourquoi c'est petit et pourquoi ça vaut cher.** L'écran a déjà tout : les images sont
  extraites, la loupe est là parce qu'on ne distingue rien à sept pixels de large, et la chaîne
  du jeu — détourage, cadre commun, grille et palette du projet — tourne déjà sur l'aperçu de
  droite. Il ne manque qu'une **destination** : sortir une image seule vers la bibliothèque au
  lieu de la verser dans une bande. C'est aussi ce qui rend l'idée précédente utilisable en vrai
  — commander un clip pour en tirer une pose n'a de sens que s'il existe un geste pour attraper
  la bonne image.

  **Ce qui reste à décider** le jour où on l'ouvre : ce que devient l'image mise de côté — une
  image de la bibliothèque comme une autre, ou directement une pose rangée dans le plan de poses
  du personnage —, et comment elle dit d'où elle vient, puisque tout ce qui sort d'un clip porte
  déjà sa filiation.

  → **Après la V3**, comme la précédente, et pour la même raison : l'écran de montage doit
  d'abord exister et avoir servi. Mais celle-ci est **de loin la moins chère des deux**, et si
  elle se révèle facile pendant la construction de l'écran, elle mérite d'être reposée à ce
  moment-là plutôt qu'attendue.

  **Portée au plan le 3 septembre 2026** — `docs/PLAN.md`, sous la tranche `A10`, en encadré
  *la suite possible de cet écran* : écrite là où elle se jouera, sans case à cocher, donc sans
  élargir la tranche. Choix de l'auteur ce jour-là, entre trois emplacements possibles.

---

## Séance du 3 septembre 2026 — sur l'écran qui montre ce qui part, avant de payer

*Quatre remarques relevées dans la fenêtre de confirmation, en posant un équipement — un gros
sac de voyage — sur **une seule** pose du pèlerin. Le texte de l'auteur, mot pour mot ; les
paragraphes en gras sont des vérifications faites dans le code le jour même, et **rien n'est
tranché**.*

- quand on corrige un texte dans la fenetre de confirmation juste avant de payer la génération,
  a chaque lettre qu'on tape, ca freeze car ca recalcule ce qui part. il faut améliorer ca. on
  peut recalculer ce qui part que quand on valide le texte modifié en fermant (changer le lien
  fermer par un bouton "valider").

  **La cause est exactement celle que l'auteur décrit**, vérifiée le 3 septembre 2026. Chaque
  lettre tapée écrit dans le tri (`interface/src/composants/Envoi.tsx`, `corriger()`), le tri
  est une dépendance de l'effet qui redemande au serveur ce qui part
  (`interface/src/App.tsx`, l'effet *ce que l'écran de confirmation montre*), et cet
  aller-retour rapporte **le texte et le prix ensemble** — il ne peut donc pas être allégé,
  seulement espacé. Un mot de dix lettres, c'est dix appels.

- dans la fenetre de confirmation d'une commande juste avant de payer la génération, la section
  "les images jointes" qui parle en fait des références des images jointes est incompréhensible,
  ne devrait pas se trouver la mais relier a chaque image jointe dans la section des iamges
  jointe plus bas. d'ailleurs il y a un bug sur ca en bas. ca me propose un gabarit de grille en
  image jointe, et un artwork alors que loguiquement la vue que je génère un "equipement" sur
  une pose, je devrait avoir en référence la pose concerné (voir screen). et je ne peu pas
  deselectinoné ni voir ce fameux gabarit (que je n'ai jamais validé d'ailleurs...).

  **Le « gabarit » *est* la pose concernée — c'est l'écran qui la nomme mal.** Vérifié le
  3 septembre 2026 : le serveur compte cette image-là dès qu'il y a une pièce et au moins une
  case (`atelier/services/generation.py`, le calcul de `gabarit`), et son propre commentaire
  écrit noir sur blanc *« une planche d'équipement en envoie une aussi — et c'est la planche
  elle-même, pas un gabarit »*. L'écran, lui, n'a qu'un seul libellé pour les deux cas et
  affiche *« le gabarit de la grille, qui dit au modèle où poser les 1 sujets »*
  (`interface/src/composants/Envoi.tsx`). L'auteur cherche donc une image qu'il aurait validée,
  et ne la trouve pas : c'est son corps, redessiné à la volée depuis la bibliothèque, jamais
  enregistré nulle part — ce qui explique aussi qu'on ne puisse pas l'ouvrir. Reste entier :
  qu'elle ne se décoche pas (voulu), qu'on ne puisse pas la **voir** (pas voulu, juste absent),
  et que la légende des références vive tout en haut au lieu d'être accrochée à chaque image.

- tant qu'on est dans cette section de confirmation de génération, j'aurai quand même aimer
  avoir la possibiltié de rajouter une ou des images de référence a la volé. La si je veux le
  faire je dois quitter et perdre mes modifs...

- Pourquoi (voir screen toujours) on envoi une planche et on parle de case de la planche quand
  on demande pas une planche mais une seule génération d'une seule pose ? est-ce que c'est fait
  exprés et logique ?

  **Oui, c'est délibéré, et c'est écrit** — `atelier/services/equipement.py`, `plier()` :
  *« une seule pose suffit […] un calque ne se fabrique que par une planche, fût-elle d'une
  case »*. Une pose qu'on **crée** n'est jamais pliée en dessous de deux cases
  (`atelier/services/generation.py`, `_plier()` : *« rien en dessous de deux »*, pour ne pas
  payer un gabarit inutile) ; une pièce posée sur un corps l'est **toujours**, parce
  qu'habiller consiste à renvoyer *la même planche* avec la pièce en plus, et que le calque se
  fabrique par différence entre les deux. **Ce qui n'est pas voulu, c'est le texte qui en
  sort** : *« a sprite sheet of 1 sprites […] exactly 1 columns and 1 rows »*
  (`atelier/services/pliage.py`, `_habiller()`) est faux grammaticalement et parle de planche à
  un modèle qui reçoit une image seule. La question porte donc sur les mots, pas sur la
  mécanique — et l'écran a le même problème, qui parle de *cases de la planche* pour une case.

---

## Séance du 3 septembre 2026 — sur ce qu'un équipement laisse derrière lui

*Relevée dans la foulée de la précédente, sur le sac de voyage du pèlerin, une fois la
génération revenue. Le texte de l'auteur, mot pour mot ; les constats en gras sont des
vérifications faites dans le code le jour même, et **rien n'est tranché**.*

- lorsque je créer un equipement, je ne peux pas voir l'image générer, je vois directement le
  calque avec la superposition appliqué. et quand j'essai de reprendre la superposition ca marche
  pas du tout car ca par déjà du calque avec la superposition appliqué. moi j'aimerai pouvoir
  refaire ma superposition a la main si je le souhaite. Et le brut semble prendre souvent le
  calque déjà découpé. bref ca va pas

  **L'image générée existe, elle est sur le disque, et rien ne l'ouvre.** Vérifié le 3 septembre
  2026. Ce qui revient du modèle est la planche entière, gardée comme résultat de la génération
  — `atelier/services/equipement.py`, `recaler()`, refuse d'ailleurs de rejouer quoi que ce soit
  quand elle a disparu, en disant *« la planche qui a payé cette image n'est plus sur le
  disque »*. Mais elle n'entre **jamais en bibliothèque** : seuls les N calques y entrent. Il
  n'existe donc aucun geste pour la regarder, et c'est exactement ce que l'auteur décrit.

  **Et « le brut » d'un calque n'est pas le brut.** C'est écrit dans le code, sans détour —
  `atelier/services/equipement.py`, `_accueillir()` : *« un calque porte une `Difference` et son
  brut est la case ramenée dans le cadre du corps ; un corps habillé […] son brut est la case
  telle qu'elle est arrivée »*. Autrement dit, sur un calque, ce que l'atelier appelle *brut* a
  déjà été remis à l'échelle et recalé sur le corps ; sur un corps habillé, non. Deux images de
  la même planche, deux sens du mot *brut*. La soustraction elle-même, elle, n'est pas cuite
  dans le fichier — elle vit dans la recette et se recalcule à chaque rendu —, mais la mise à
  l'échelle et le calage, si.

  **Ce qui explique le troisième symptôme.** L'écran de superposition prend pour *dessus*
  l'image qu'on regardait (`interface/src/composants/Superposition.tsx`) — donc le calque. On ne
  refait pas une superposition à la main en repartant de son résultat.

  **Trois manques distincts, à ne pas confondre le jour où on les traite** : voir la planche
  revenue ; refaire le calage et la soustraction à la main à partir d'elle ; et un mot, *brut*,
  qui ne désigne pas la même chose selon l'image sur laquelle on l'a sous les yeux.

  **Portée au plan le 3 septembre 2026** — `docs/PLAN.md`, tranche `G16` de la V3.1, *« ce qui est
  revenu du modèle se voit, et se reprend à la main »*, **prise hors tour** à la demande de
  l'auteur : la V2.3 attend encore deux tranches et la V3 n'est pas ouverte. Trois choix tranchés
  le jour même — la planche entre **dans la galerie** comme une image ; la carte d'une pose
  d'équipement gagne une bascule *calque* / *brut* ; et refaire la superposition à la main
  fabrique un **second** vêtement à côté du premier, au lieu de le remplacer. Le troisième manque
  — le mot *brut* qui désigne deux choses — est **dit** à l'écran et non réparé : refaire le
  rangement pour que les deux bruts soient la même chose reste ouvert.

---

## Séance du 4 septembre 2026 — en découpant un calque à la main

*Trois remarques nées de l'usage de `G16`, le lendemain de sa livraison, sur l'écran de
superposition ouvert depuis la carte d'un vêtement. Le texte de l'auteur, mot pour mot ; les
paragraphes en gras sont des vérifications faites dans le code le jour même.*

- j'ai encore un petot soucis qu'il faudrait améliorer dans la superposition : je dois pouvoir
  zoomer autant que je veux. c'est un point que j'ai déjà demandé quelque part dans les remarque
  il me semble et qui a peut être même été planifié. car la c'est impossible de découper
  proprement un calque a la main. dans un si petit dessin.

  **Ce n'est pas le même défaut que celui déjà planifié, et c'est important.** `G10` — *le zoom
  des tables monte* — fait passer le plafond des **tables** de 250 % à une règle qui s'adapte à
  l'image. L'écran de superposition n'est pas une table : c'est une fabrique, à droite du trait
  de la barre, avec ses trois panneaux à elle. Vérifié le 4 septembre 2026 : **il n'a aucun zoom
  du tout**. Les deux images y sont posées en `object-contain`, c'est-à-dire ajustées au panneau
  et rien de plus. `G10` livrée n'y changerait donc rien.

  **Et il y a une seconde raison pour laquelle le découpage à la main est difficile là.** Le
  cadre de travail ajuste **chacune** des deux images à son panneau, alors que le serveur, lui,
  pose le dessus dans le cadre du dessous à l'échelle demandée. Tant que les deux images ont la
  même taille, les deux façons de faire coïncident ; depuis `G16`, le dessus peut être la case
  telle qu'elle est arrivée — 512 px contre 64 — et elles ne coïncident plus. Le rectangle qu'on
  trace, lui, reste juste : il est compté en pixels du dessous. C'est ce qu'on **voit** qui ment.

- Deplus, si je découpe et que j'applique ma superposition pour créer un calque, cela semble
  causé des problème ensuite car les images ne s'affiche pas.
  `GET /api/generations/32a2c95994fc4579bb50f7b6a674c301/slots/100/image HTTP/1.1" 400 Bad Request`

  **Reproduit et corrigé le 4 septembre 2026.** L'écran choisissait l'adresse d'une image selon
  une règle vraie depuis T3 et devenue fausse : *une image traitée se lit par son empreinte, une
  image sans recette se lit par son emplacement*. Or « sans recette » et « rang d'emplacement »
  ne vont ensemble que pour les images de C1 : **tout ce qui naît d'un dépliage, d'une découpe ou
  d'une superposition a un rang qui n'est l'emplacement de rien.** Une image née d'une
  superposition a la recette vide — voulu depuis `E6`, les deux images étaient déjà rendues — et
  un rang de dépliage : l'écran demandait donc l'emplacement 102 d'un appel qui n'a qu'un
  emplacement 0, et recevait un 400.

  **Le défaut date de `E6` ; `G16` l'a mis sur le chemin ordinaire.** Avant, il fallait aller
  chercher la table de superposition ; depuis, un bouton de la fiche d'un personnage y mène en un
  clic, et ce qui en sort se range dans la matrice, où on le regarde en grand. Mesuré : la
  vignette de la grille marchait — elle passe par l'adresse de l'asset —, c'est **l'aperçu** qui
  ne marchait pas.

  **Un second défaut sous le même symptôme, et c'était le pire des deux.** Trouvé en vérifiant
  le premier au navigateur, une fois la fusion de l'auteur terminée. Une superposition écrit son
  résultat dans le dossier de la **même génération**, au premier rang libre — donc au-dessus des
  cases, sans en remplir aucune. Or le rejeu du recalage et la case arrivée retrouvaient « leur »
  case en comptant les rangs du dossier : après **un seul** calque refait à la main, l'atelier
  lisait *« cinq images rangées pour quatre cases »* et refusait les deux gestes **sur toute la
  planche**, définitivement. Autrement dit : refaire un calque à la main cassait le geste qui
  l'avait fabriqué, et pour toutes ses sœurs.

  **Réparé en distinguant ce qui vient du dépliage.** Une image dépliée n'a ni parent ni
  superposition — elle sort d'une case, pas d'une autre image ; c'est la filiation qui répond,
  et non un drapeau de plus. Le rejeu du recalage était atteint aussi : le défaut attendait
  depuis que `E6` et `R5` se sont croisés sans se voir, et personne n'avait encore refait une
  superposition sur une planche d'équipement.

  **Et une lenteur, mesurée puis levée.** Afficher la case arrivée coûtait **2,5 s** : elle
  passait par la lecture qui aligne *chaque* case sur *son* corps, alors qu'elle rend la case
  **avant** tout ça. Le découpage seul suffit — **483 ms**, cinq fois moins. Le rejeu, lui, garde
  la lecture complète : il a besoin des alignements.

  **Un défaut voisin, trouvé au passage et pas corrigé.** Le calque qui sort d'une superposition
  porte une recette **vide**, et c'est `recette.calque` qui départage un calque d'un corps
  habillé. La fiche annonce donc *« corps habillé — il s'exporte, il ne s'empile pas »* sur une
  image qui est un calque. C'est cohérent avec `E6` et faux à l'usage ; ça touche à ce que le
  produit appelle un calque, et ça ne se répare pas en passant.

- autre point : je ne peux pas retoucher manuellement les pixel pour remettre ou ôter (la main)
  quand je fait une superposition. en fait c'est pas trop logique ni bien organiser cette partie
  du workflow.

  **Le fait, vérifié.** La main existe à deux endroits — la table *la main* d'une image, et les
  trois outils de la carte d'un vêtement, *zone · masque · retouche*, qui écrivent dans la
  différence du calque. La superposition, elle, porte bien un champ `main` dans son domaine, avec
  sa raison écrite : *si le réglage n'est vrai que de cette superposition, il va dans la
  superposition*. **Ce champ n'a aucun écran** : rien ne le pose, rien ne le montre.

  **Ce qui est à revoir n'est donc pas un bouton, c'est un partage.** Trois endroits fabriquent
  ou réparent un calque — la planche d'équipement qui le déduit, la carte qui l'affine à la main,
  la superposition qui le refait —, et ils ne se ressemblent pas : le premier n'a pas de zoom, le
  deuxième a la main mais pas le choix des images, le troisième a le choix des images et le
  calage mais ni la main ni le zoom. **À reprendre en entier**, pas à rapiécer.

---

## Séance du 4 septembre 2026 — deux images pour une case, et laquelle part

*Relevée en regardant la colonne d'un sac de voyage sur le pèlerin, où la pose « repos » portait
deux calques. Le texte de l'auteur, mot pour mot ; les paragraphes en gras sont des vérifications
faites dans le code le jour même.*

- je vois aussi un autre problème. je ne peux pas retirer un calque. ici par exemple j'en ai 2
  pour la même pose. comment je fait pour choisir le calque que je sélectionne comme bon (celui
  qui partirai theoriquement pour le jeu ?). Ou si je veux supprimer l'autre ?
  est-ce que c'est un oubli ? dans ce cas il faut le mettre en remarque et le coder dessuite, ou
  est-ce que c'est un bug ? Et en vrai c'est pareil pour les pose de base. je ne peux pas
  sélectionner celle que je veux "garder".

  **Un oubli d'écran, et la question posée était la bonne.** La règle existe et décide déjà : *le
  favori d'abord, sinon la plus récente*, écrite une seule fois dans tout le dépôt
  (`corps_retenu`) et lue par trois chemins — le corps qu'une planche d'équipement emporte, le
  calque qui sort à l'export vers le jeu, et le calibrage. Rien n'était cassé ; **rien ne se
  voyait non plus**. La fiche du personnage est le seul écran du produit qui montre des images
  concurrentes côte à côte, et c'était celui qui n'offrait pas la marque : ni coin de favori, ni
  suppression, ni la moindre indication de laquelle des deux gagnait. Le geste existait ailleurs
  — dans la galerie —, ce qui suppose de savoir que la règle existe et d'aller retrouver la bonne
  image dans un autre écran.

  **Et deux vrais défauts dedans, trouvés en vérifiant.** Le premier se chiffre : les mesures
  posées à droite de la rangée — *repeint 98,6 % · ajout 0,1 %* — décrivaient la **première image
  de la case** et non celle que la règle retient. Les deux coïncident tant que personne ne marque
  de favori, puisque la liste arrive la plus fraîche en tête ; dès qu'un favori plus ancien est
  posé, la rangée décrit un calque et l'export en sort un autre. Le second est plus large :
  **marquer un favori était le seul geste de la bibliothèque à ne prévenir personne**. La galerie
  s'en tirait parce qu'elle se recharge elle-même après l'appel ; la fiche du personnage n'a pas
  ce second chemin — elle écrit et elle reçoit —, et c'est précisément l'écran dont le favori
  décide de ce qui partira.

  **Construit le jour même, `M6`.** La matrice porte désormais, pièce par pièce, le calque que le
  serveur sortirait — calculé par la même fonction que l'export, jamais recomposé dans la page.
  Le retenu porte un liseré, **et seulement quand la case a le choix** : une marque répond à une
  question, et une case à une seule image n'en pose pas. Le coin plein en cyan se pose d'un clic
  sur les vignettes, calques comme corps, et la carte de droite reprend les deux mots de la
  galerie — *◤ favori* et *Supprimer cette image* —, précédés de la phrase qui dit lequel part.
  La croix qui vidait la case est descendue en bas de la vignette : les deux marques se
  disputaient le même angle, et c'est le coin qui ne peut pas déménager sans cesser d'être le
  même partout.

- autre problème que je vois, différent mais lié, si je clique sur "habiller" pour lancer la
  génération du sac de voyage pour la pose "marcher" par exemple, dans le prompt préparé, dans
  les images fournis la pose marché déjà générer pour ce personnage semble faire parti des images
  envoyé, mais on ne la vois pas contrairement aux deux autres, ce qui est contre intuitif.

  **Déjà relevé, déjà étayé, et traité ailleurs.** C'est la remarque du 3 septembre sur la légende
  des images jointes : la pose part bien — le code le dit noir sur blanc, *« une planche
  d'équipement en envoie une aussi, et c'est la planche elle-même, pas un gabarit »* —, mais
  l'écran de confirmation la range avec le gabarit de grille d'une génération ordinaire : une
  phrase, sans vignette. Voir `remarques/ce-qui-decrit-une-image-jointe.md`, qui note déjà que
  *« la voir n'a jamais été décidé — c'est un manque, pas un choix »*. **L'auteur l'a prise dans
  une autre séance** ; elle n'est pas redoublée ici.

---

## Séance du 4 septembre 2026, au soir — le calque qu'on ne peut ni reposer ni reprendre

*Deux remarques d'un même sujet : un calque fabriqué une fois ne sert qu'une fois. **Le texte de
l'auteur, mot pour mot ; rien n'est vérifié dans le code — elles sont en vrac.***

- pouvoir utiliser un calque sur plusieurs pose différente. Exemple : sur le projet 'le Marais du
  vieux moulin' sur le personnage du pélerin, j'ai créer un 'sac de voyage' sur la pose "repos".
  cet equipement sera le même pour les autres poses, mais je n'ia aucun moyen de choisir un calque
  ou une image pour une pose ou équipement sur la pose a part générer par IA.

- pouvoir ajouter un calque en référence d'une génération. Imaginons que je veux faire un 'sac de
  voyage' avec plusieurs niveau d'évolution. je voudrais donc générer un 'sac de voyage niveau 2'
  en repartant du premier sac et en ajoutant juste des détails en plus dans la génération.
  AUjourd'hui je ne peux pas le faire sauf en passant par la galerie pour trouver le calque et le
  reinjecter.
