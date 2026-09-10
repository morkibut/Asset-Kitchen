# Plan : Asset Kitchen — ce qui reste à construire

> **PRD source** : `docs/PRD.md`. **Ce qui se construit en ce moment** : la V4, dans
> `docs/PLAN-carnet.md`.
>
> Ce document fait foi sur **l'ordre de construction** et sur les **critères d'acceptation**.
> Il ne nomme ni fichier, ni fonction, ni route : comment c'est construit vit dans
> `docs/ARCHITECTURE.md`, à quoi ça ressemble dans `docs/DESIGN.md`, ce que ça doit faire dans
> `docs/PRD.md`, ce sur quoi on s'est déjà cassé les dents dans `docs/PIEGES.md`.
>
> **Dégraissé deux fois.** Le 2 septembre 2026, le détail des cinq premières versions livrées
> est descendu dans `docs/archive/plan-versions-tenues.md`. Le 6 septembre, le plan était
> remonté à **386 Ko dont 340 racontaient du travail fini ou périmé**, et il s'ouvre à chaque
> séance : `R6` à `V3.1` sont descendues à leur tour, dans deux fichiers selon leur sort — ce
> qui est construit d'un côté, ce que le carnet périme de l'autre. **Aucun mot n'a changé**, et
> `py essais/essai_docs.py` l'a prouvé en nommant les dix-sept renvois que la descente cassait,
> tous redirigés dans la foulée.
>
> Ce qui ne descend jamais avec une version : **ses invariants**. Un invariant instauré vaut
> pour toutes les tranches suivantes, y compris celles d'une version qui n'existe pas encore.

---

## Où en est le dépôt

**Onze blocs tenus ou clos, un seul ouvert.** Ce tableau donne le sort de chacun et rien de
plus. Le détail vit ailleurs, toujours au même endroit : ce qu'une tranche a **appris en se
construisant** dans `docs/status/etat.md`, ses **critères cochés** dans
`docs/tranches/<code>.md`, son **plan** dans le fichier que la dernière colonne désigne.

| Bloc | Ce qu'il a apporté | Sort | Où lire le plan |
|---|---|---|---|
| **V1** — `T1` à `T10` | La première image, le traitement non destructif, la bibliothèque, l'univers, la découpe, l'export, l'agent, la toile | **tenue** | `archive/plan-versions-tenues.md` § V1 |
| **V2** — `C1` à `C5` | Le personnage, son plan de poses, le lot plié, la pièce et le calque, la main, la sortie | **tenue** — `C5` écrite mais pas encore usée | idem, § V2 |
| **Reprises** — `R1` à `R5` | Le réglage qui se voit, ce qui décide de l'apparence, l'import depuis l'écran, l'infobulle, le calque qui se recale | **tenues** | idem, § reprises |
| **V2.1** — `E0` à `E20` | L'interface refaite : trois lieux au lieu de sept surfaces, le codex, l'établi, la galerie | **tenue** | idem, § V2.1 |
| **Lot U** — `U1` à `U13` | Treize reprises de deux séances d'usage, le même soir | **tenues** — 87 critères cochés | idem, § U |
| **V2.2** — `F0` à `F6` | D'autres fournisseurs, dont un qui ne demande ni compte ni clé | **close à 5 sur 6** — `F4` (Cloudflare) **retirée le 8 septembre 2026** : l'auteur ne souhaite plus l'utiliser ni l'intégrer | idem, § V2.2 |
| **Reprises** — `R6` à `R9` | La planche de travers, le texte qui part en trois parties, la fiche d'une chose, le calibrage | **closes le 3 septembre 2026, hors version** | `archive/plan-r6-a-v3.02.md` |
| **V2.3** — `D1` à `D5` | Le traitement cesse d'être à refaire : le réglage de départ, la réduction et la grille retrouvée, le fond du jeu, les moteurs et le contour net, les tailles | **close le 3 septembre 2026, cinq sur cinq** | idem |
| **V2.4** — `M1` à `M7` | Ce qui est cassé se répare avant qu'on anime, et le coin où l'on fabrique un calque se redessine | **close le 4 septembre 2026, sept sur sept** — ouverte et close le même jour | idem |
| **V3** — `A0` à `A13` | L'animation **par la vidéo et le découpage** : un clip payé devient plusieurs bandes et l'écran dit ce que chacune a coûté ; le même clip se refait **gratuitement** sur la carte de la maison ; la matrice d'un personnage se lit sur deux calques ; une bande sort en planche de sprites | **close le 5 septembre 2026** | idem |
| **V3.02** | Le clip a une fiche, comme une image | **close le 5 septembre 2026** | idem |
| **V2.5**, **V3.01**, **V3.03**, **V3.1** | Quatre blocs ouverts quand la V4 est entrée. Ce qui y a été livré tient : le relevé `N1`, le tiroir qui relit ce qui part, les trois quarts de l'atelier d'une animation aux tables, `G1` et `G16` | **périmés par le carnet** — les écrans qu'ils réparaient sont redessinés, donc le reste ne se reprend pas tel quel. ⚠️ Les quatorze tranches `G` de la V3.1 nomment des défauts réels, et **se relisent avant de clore la V4** | `archive/plan-perime-par-la-v4.md` |
| **V3.5** — `P1`, `P2` | Le dépliage généralisé : la planche se garde, son découpage se refait, et il s'ouvre aux objets | **non ouverte** | ci-dessous |
| **V4** — le carnet, `D0` et `B0` à `B27` | **La refonte de l'interface**, relevée sur les planches de `docs/pistes-2026-09-04/carnet/` : les trois onglets tombent, un carnet de 300 px les remplace, la surface n'a plus que quatre présentations. Ce n'est pas un habillage — quatre chantiers touchent le modèle, et 58 items de retouche manquent, dont une dizaine remplacent une génération payée | ⚠️ **rouverte le 10 septembre 2026 — 29 tranches closes, et la refonte à 30 %.** Elle avait été déclarée close le 9 septembre sur ses 29 tranches ; elle ne l'était pas. La promesse de la première ligne de cette case — *les trois onglets tombent* — **n'appartenait à aucune tranche** : `B0` avait posé le châssis neuf « à côté de l'ancien » comme une étape, et rien n'a jamais été chargé de refermer cette parenthèse. Relevé du 10 septembre, fichier par fichier : **21 écrans en papier (17 889 lignes), 33 écrans restés sur l'ancien châssis (41 059 lignes)**, quatre doublons vivants, et le carnet lui-même renvoie encore vers deux racines anciennes. Les tranches qui manquaient sont écrites : **`C1` à `C9`, la sortie de l'ancien châssis**, dans `docs/PLAN-carnet.md`. La règle qui en sort, et qui vaut pour les versions suivantes : *une tranche qui écrit un écran neuf nomme, dans ses critères, le fichier ancien qu'elle retire*. — le déménagement de la retouche avait déjà rouvert la version avec `B23` à `B27`, pour la même raison et à plus petite échelle. `B1` le miroir, `B2` les clips payés qui attendent, `B3` les huit états, `D0` le système de design réécrit, `B0` le socle du carnet, `B4` l'ouverture, `B5` le tableau de bord, `B6` la barre, `B7` le guide en volet, **`B9` la grille d'une famille** — ses sept morceaux tenus le 8 septembre : le compte groupé, la route paginée avec ses collections, l'écran à trois vues, le glisser-déposer vers les collections, les trois filtres et le panneau de réglages —, **`B10` la page d'un sujet** : on arrive sur la chose et non sur son atelier, ses images se rangent en rangées avec la retenue en tête, et la matrice descend d'un cran plutôt que de disparaître — elle porte encore huit fonctions que `B11`, `B12` et `B19` n'ont pas reprises. **`B8` tenue** — le modèle de l'adhésion, la table de jointure, les sujets qui entrent dans l'index, les gestes qui rangent, retirent et suppriment, la recherche en deux groupes qui fait enfin lire cet index, et le vocabulaire du serveur qui parlait d'« assets » pour une collection : six morceaux. **`B11` ses animations, et le départage, tenue le 9 septembre** — le report de `favori`/`rang`/`supprime_le` sur `Bande`, qui ne les portait pas, et l'onglet *Ses animations* : mêmes rangées que les images, mais les écartées s'y voient (`bandes_ecartees`, absent côté images) et écarter la retenue promeut la plus récente des gardées — un geste que les images n'ont pas besoin de faire, faute d'un `corps_retenu` pour une bande. **`B13` la grille du jeu, et comparer, tenue le 8 septembre** — deux écrans en lecture seule accrochés au bandeau d'onglets de `PageDuSujet.tsx` : la grille pose le sujet sur sa case avec ses voisins par type et le plafond réel d'occupation (`occupationMax`, déjà écrit et testé — aucune ligne de domaine neuve) ; comparer met deux sujets, ou deux images d'un même sujet, côte à côte, avec quatre écarts chiffrés sur des nombres déjà réels (taille rendue, contour, couleurs) et leur correction, gratuite en retouche ou au dernier coût réel. Le relevé y a trouvé, en vérifiant au navigateur plutôt qu'en lisant seulement les essais : une couleur écrite en clair dans un `style` en ligne, un écart de contour qui ne comptait pas quand un seul des deux côtés en portait un, et un bouton *La retoucher* sans effet quand l'écart appartenait au second sujet comparé — les trois corrigés. **`B14` les règles du jeu, tenue le 9 septembre** — commencer un jeu en quatre pas (son nom, son allure, sa vue, son monde), et **le même parcours rouvert *est* l'écran des règles** : un fichier, deux modes, un seul chemin d'écriture. Le relevé y a trouvé **trois** sources de consigne de caméra là où la planche en annonçait deux ; `rendu` et `vue` deviennent des cases que l'atelier écrit seul, la liste `_REDITES` tombe de vingt mots à quatre, et un essai mesure la disparition **sur l'envoi réel** — pas sur un texte d'écran. **`B15` l'installation, tenue le 9 septembre** — ce qu'on branche une fois sur cette machine : la clé, ComfyUI, le dossier de travail, ce que le disque porte, en quatre étapes et deux modes. ⚠️ **On choisit un dossier, on ne déménage rien** : poser une adresse que l'atelier lit au démarrage suivant, plutôt que déplacer des gigaoctets sous une base SQLite ouverte — trois essais mesurent les absences, et **aucune route d'installation n'efface**, lu sur la table de routage. ⚠️ **L'adresse de ComfyUI ne se changeait pas du tout** : un commentaire promettait `ATELIER_COMFY` depuis six jours et rien ne la lisait ; elle prend maintenant effet sans redémarrer. Trois des six critères étaient déjà tenus et déjà mesurés par `F1` et `F3` — cités, pas redoublés. Le navigateur a trouvé **six** défauts qu'aucun essai ne voyait, dont un chemin affiché sous l'origine d'un autre. **`B16` les tables dans la grammaire du carnet, tenue le 9 septembre** — la chaîne de retouche redessinée, **sans aucun moteur neuf** : huit tables dans l'ordre du domaine, un trait, deux fabriques ; les réglages hors de l'image, la jauge dessous, le témoin dessus. La logique est empruntée à ce qui existe (`useRecette`, `valeur`, `indisponible`, la courbe de la jauge) pour qu'il n'y ait **qu'une vérité par fait**. La vraie tranche était les **six contradictions**, tranchées comme des décisions de produit : huit tables et non sept (les planches sont d'avant `B1`) ; on n'annule pas un calcul, on annule un réglage (la route est synchrone, couper le fil n'arrête rien) ; **la marge se grisait sur une condition fausse** — descendue dans le domaine, où la neutralisation a lieu ; **un seuil de nettoyage à zéro faisait une recette non vide**, donc un rendu calculé et un asset épinglé pour une image identique au brut ; on ne demande pas la famille, on regarde l'alpha de cette image-là ; et la couleur déclarée du jeu est un moteur qui manque, dit là où ça mord plutôt que branché en douce. **Le plafond avait deux moitiés** : monter la borne de la route ne servait à rien tant que la table ne proposait que les tailles du pixel art — un jeu en dessin réglé sur 1 024 n'avait aucun cran à cliquer. Le navigateur a trouvé **cinq** défauts qu'aucun essai d'écran ne voyait, dont une raison de grisé enfermée dans une infobulle et un grossissement affiché qui n'était pas appliqué. **`B19` le vestiaire, tenue le 9 septembre** — la relation qui manquait vraiment au modèle : une pièce d'équipement n'appartenait à personne, et les trois écrans qu'elle débloque (la page d'une pièce et de ses emplois, la page d'un emploi et de ses poses, *Son vestiaire* dans la fiche d'un sujet). ⚠️ **Une clé absente n'est pas une clé vide** : `emplois is None` veut dire *jamais déclaré* — les porteurs se déduisent alors des calques déjà sur le disque —, `emplois == ()` veut dire *déclaré vide*, et plus rien ne s'y déduit ; `en_json` omet la clé quand elle est absente, donc un projet d'avant la tranche fait un aller-retour **identique à l'octet**, et l'adoption ne se fait qu'à l'écriture, jamais à la lecture. ⚠️ **La perte silencieuse n'était pas dans la lecture** mais dans `regler_piece`, qui reconstruisait une pièce champ par champ : un champ oublié y disparaissait au premier renommage. ⚠️ **La « matrice de 24 calques » de la planche n'existe pas** — un calque ne porte de direction nulle part dans le code ; la matrice d'un emploi est une rangée par pose, et l'axe des directions revient à `B20`. Le navigateur a trouvé **trois** défauts qu'aucun essai ne voyait, dont une carte « équipements portés » qui comptait les pièces des calques et contredisait le vestiaire juste en dessous. **`B17` les moteurs qui remplacent une génération, tenue le 10 septembre** — quatre traitements gratuits qui faisaient repayer une image, et **aucune place neuve** pour les porter : les planches les rangent dans deux tables qui existent, et le relevé a compté **dix-sept phrases du dépôt qui citent un rang de place**, qu'une place insérée aurait toutes fait mentir. `B1` avait posé *une place neuve ne change pas l'empreinte* ; `B17` descend la règle à **une clé neuve dans une place existante** — huit clés arrivent, aucune ne s'écrit tant qu'elle vaut son neutre, et les 61 recettes du corpus figé rendent le même JSON canonique caractère pour caractère. Le magenta ne reste plus sous la transparence (3 px de la couleur du sujet, en fin de chaîne, sans être le réglage de personne) ; une cape change de couleur **au pixel près la même silhouette**, là où trois générations en rendaient trois ; les quatre curseurs passent **avant** la réduction, pour que les 24 couleurs cessent de décrire une image mal exposée ; et le grain de couleur accroché au sujet — le morceau `[HARD]` — se juge sur ses huit voisins, avec une **majorité franche à cinq sur huit** qui désarme le moteur tout seul sur une image non réduite plutôt que d'écrire une dépendance entre deux places. Trois défauts trouvés, aucun par les essais de la tranche : le lit de couleur cassait l'involution du miroir (attrapé par les essais de `B1`, sans qu'un pixel visible ne bouge), **toute image gratuite du produit s'affichait « miroir · gratuit » depuis `B1`** — le serveur omet la clé, l'écran testait `!== null` —, et **la table d'échange était inutilisable**, le bouton qui l'ouvre posant une paire vide que le serveur refusait : chaque moitié était juste toute seule, et un essai d'écran figeait même le défaut. **Une relecture critique en a trouvé six autres**, tous réparés sauf un assumé : la matrice de teinte mêlait les constantes du filtre du W3C à la luma de Rec. 601 et **n'était plus une rotation** — remplacée par l'identité, 86 essais sur 87 restaient au vert, donc rien ne mesurait ce qu'elle calcule ; les deux moteurs qui balaient l'image coûtaient 2,2 s et 7,4 s (avec 1,78 Go) sur un dessin de 2 048, ramenés à 188 ms et 400 ms sous 101 Mo ; trois essais ne mesuraient rien, dont un qui vérifiait qu'un tableau d'octets tient entre 0 et 255. **Ce qui reste à faire à la main** : le lit change ce que la chaîne produit sans changer l'empreinte — c'est le critère n° 4 qui l'exige —, donc les rendus déjà calculés gardent leur fichier ; un `del` sur les `<rang>-rendu.png` à la fusion les refait, gratuitement et sans perte (`T2`). **`B12` l'essai, tenue le 10 septembre** — le quatrième onglet de la page d'un sujet, et **le seul endroit du produit où quelque chose bouge parce qu'on appuie sur une touche** : le personnage à la taille du jeu, `Z Q S D` pour se déplacer, `Maj` pour courir, `Espace` pour attaquer, `1` à `6` pour jouer une pose, une scène qu'on règle et un second sujet posé à côté. ⚠️ **La vitesse n'était pas `cadence`, et les trois lecteurs d'avant se trompaient dessus** : le format d'accompagnement compte en millièmes de seconde **entiers**, et `duree_en_ms` est le seul endroit qui arrondit — `Apercu.tsx`, `AtelierDeBande.tsx` et `Montage.tsx` jouent tous `1000/cadence`, donc un rythme que rien n'exporte. ⚠️ **Et l'arrondi de JavaScript n'est pas celui de Python** : `Math.round` monte un demi, Python le pousse au pair — à 16 images par seconde, 62,5 ms devient 63 d'un côté et 62 de l'autre, et seize est une cadence d'animation ordinaire. `dureeImageMs` reproduit celui du serveur, et `tests/test_b12.py` fait tourner la vraie fonction TypeScript sous Node pour les comparer sur 123 cadences plutôt que de tenir deux tables à la main. **Mesuré au navigateur** : 62,0 ms sur 80 images pour les 62 du descriptif. ⚠️ **Le troisième piège n'est apparu qu'au navigateur** : le métronome était un `requestAnimationFrame`, et dans le volet de l'atelier `document.visibilityState` vaut `visible`, `document.hidden` vaut `false`, et rAF est appelé **zéro fois par seconde** — l'animation figée, et rien qui le dise. Le battement est passé sur `setInterval`, l'horloge restant `performance.now()` pour que la moyenne ne dérive pas. Une animation qui manque laisse le personnage **au repos** et le dit, sans jamais jouer celle d'à côté ; la scène ne fait partir aucun appel réseau ; et la barre qui paie se retire sur cet onglet, parce qu'il porte sa propre porte vers la dépense et qu'il n'y a qu'un rouille par écran  **`B21` la sortie, tenue le 10 septembre** — un seul écran là où quatre boutons vivaient à quatre endroits, et **trois sous-systèmes qui n'existaient nulle part** : prévoir sans écrire, comparer à la fois d'avant, un catalogue par moteur. Le plan est **un générateur lu deux fois**, par l'aperçu et par l'écriture : les deux ne peuvent pas nommer deux listes différentes, et aucun des deux ne garde plus d'un fichier en mémoire — l'archive d'aujourd'hui, elle, se construit entièrement en mémoire avant de partir. ⚠️ **Le diff se lit sur le dossier, pas sur une mémoire** : *ce qui est là fait foi* est déjà l'invariant de l'export, si bien qu'un fichier abîmé dehors se dit « remplacé » sans que rien n'ait bougé dans l'atelier. La sortie précédente est gardée quand même — un JSON à la racine, pas une table — et ne sert qu'à ce que le dossier ne sait pas trancher : **quels fichiers de là-bas sont les nôtres**, pour qu'« effacer ce qui ne sort plus » ne touche jamais au décor que l'auteur a peint à la main. ⚠️ **Écraser est un paramètre de `ServiceAgent.deposer`, pas un second écrivain** — « un second endroit qui écrirait dans le dossier du jeu serait un second endroit où oublier la deuxième règle » —, et le défaut reste la numérotation. ⚠️ **La direction entre enfin dans le nom du fichier** : la planche appelle ça *le piège le plus cher du sujet*, l'export d'un personnage n'emportant qu'une image par pose sans dire laquelle des quatre. **Deux lots de la planche n'existent pas** — *les terrains*, qui n'est pas une famille, et *les calques d'équipement*, qui ne sont pas un lot mais ce qui accompagne un corps, « une pose sans corps ne sort pas, ses calques compris ». **Ce qui reste sur la planche** : le gabarit de nom à jetons (`{famille}/{sujet}_{pose}`), et le bouton *Choisir…* — aucun navigateur ne donne le chemin d'un dossier à une page web, et l'écran le dit plutôt que de le dessiner. Le navigateur a trouvé **deux** défauts qu'aucun essai d'écran ne voyait, dont un reste rangé dans un sous-dossier qui s'affichait par son seul nom, à côté d'un fichier prévu portant le même nom 22` la galerie connaît les clips, tenue le 8 septembre 2026** — un clip gardé se relit désormais du dépôt (`GET /api/clips` scope maintenant par projet, `Base.generations_du_projet`), sa couverture est fabriquée par le serveur sur la première frame déjà écrite au disque, jamais un fichier vidéo téléchargé à l'ouverture de la galerie ; le survol rejoue la planche contact déjà servie au montage (`A10`), en pourcentages plutôt qu'en pixels pour tenir dans une grille `auto-fill` dont la largeur des cases n'est jamais connue d'avance ; un filtre « clips » existe, distinct des six familles. Le relevé y a trouvé un troisième trou, plus profond que les deux annoncés par la planche : `GET /clips` bornait sa fenêtre aux générations les plus récentes de *tous* les jeux confondus, et un jeu resté tranquille perdait son clip dès qu'un autre avait été actif depuis — précisément ce qui rendait un clip invisible après la fermeture de son lot. **`B18` le reste des moteurs, tenue le 8 septembre 2026** — une file de huit ateliers indépendants (Détourer, Recadrer, Pixéliser, Découpe, Retourner, Contour, Nettoyer, Couleurs), quarante-quatre moteurs neufs au total, chacun avec sa mesure de temps et son réglage câblé à l'écran. ⚠️ **Une relecture Opus dédiée** — la règle qui prime sur `docs/PLAN-carnet-affectation.md` : le relecteur d'une tranche `[HARD]` est toujours Opus — **a trouvé un vrai défaut de mémoire** dans Couleurs : `_plus_proches` ne bornait qu'un seul de ses deux axes, et le retour à la couleur réelle montait à 9,7 Go sur un rendu de 2 048 px sans grille posée ; réparé et mesuré à moins de 400 Mo. Trois réglages de la réduction restent figés dans le code, documentés plutôt que traités — hors du périmètre des huit ateliers confiés. **`B23` les trois surfaces déménagent, tenue le 9 septembre 2026** — les quatre gestes qui se posent **sur l'image** (le rectangle de recadrage et sa boîte réellement gardée, le point de la pipette, la forme entourée, le pinceau de la main) entrent dans l'écran neuf. C'est le déménagement que `B16` avait annoncé et que `B17`/`B18` n'ont pas fait : les deux tranches ont câblé leurs moteurs dans les deux écrans sans jamais retirer le premier, et `Retouche.tsx` renvoyait encore six fois vers `Places.tsx`. ⚠️ **On déménage, on ne réécrit pas** : les quatre surfaces sont désormais déclarées dans `Retouche.tsx` et **l'ancien écran les lui emprunte** — une seule implémentation, `rectangleDeLImage` compris, et c'est l'ancien qui importe le neuf parce que c'est lui qui s'en va en `B26`. Deux implémentations d'un même geste finiraient par ne plus viser le même pixel, et c'est l'invariant que `B18` a payé sur `palette.py`. **Aucune ligne de Python n'a bougé, aucune clé n'est entrée dans le domaine** : la tranche déplace l'endroit où l'on règle des clés qui existent déjà. La preuve du déménagement est un chiffre partagé : les essais des deux écrans posent le même geste sur une surface de 512 px pour une image de 1 024 et attendent tous les deux `[128, 256]` — le jour où les deux calculs divergent, l'un des deux essais tombe. Trois choses ont dû venir avec les surfaces, faute de quoi elles n'auraient rien eu à poser : les deux boutons qui **arment** la pipette et la forme entourée, la **pile de la main** entière (calques, opacité, sens, diamètre, couleur, *Défaire le dernier* et son `Ctrl + Z`), et les **trois réglages du retournement** — l'angle, la moitié gardée du repli, les zones protégées. **Un refus réfléchi** : la fiche rangeait « une main pour peindre les zones protégées » sous la toile de la main ; elle n'est pas livrée, parce que les points d'une zone sont des coordonnées **au rang du retournement** et non du rendu qu'on regarde — un quart de tour en amont suffit à les décaler, et les peindre sur l'image affichée aurait posé un geste qui ne vise pas le pixel qu'il montre. **`B24` ce qui restait dans les murs, tenue le 9 septembre 2026** — les cinq autres locataires de `Tables.tsx` reportés dans l'écran neuf : la colonne des sœurs (régler la même place sur plusieurs attitudes sans refermer la table), le presse-papier et les recettes nommées, promouvoir un détourage en défaut du projet avec sa portée choisie et jamais devinée, les deux fabriques (découpe, superposition) qui s'ouvrent sans repasser par l'ancien écran, et le grossissement libre entre 1 et 250 %. ⚠️ **La fusion avec `B23` a demandé un arbitrage** : les deux tranches réparaient le même débordement d'image à deux endroits différents, et le pour cent affiché se mesure désormais sur la surface de dessin posée, pas sur l'image « brut/rendu », pour ne pas rouvrir le coin inatteignable que `B23` avait fermé. Une relecture Opus sur le diff seul a trouvé quatre défauts de mise en page invisibles à `jsdom` — le zoom, le témoin par-dessus, la mesure du cadre après une fabrique, la découpe qui refermait l'écran — tous corrigés et mesurés au navigateur. La fusion a aussi révélé 18 tailles hors des listes fermées de `docs/DESIGN.md`, reprises telles quelles de l'ancien écran : 16 réutilisent une valeur déjà déclarée, 2 sont entrées dans la liste avec leur justification. **`B25` une seule porte, tenue le 9 septembre 2026** — les six portes de la retouche mènent toutes à `Retouche.tsx`, et `EcranTables` n'est plus monté nulle part. Les genres de lieu `"case"` et `"tables"` fondent dans `"retouche"`, et **`App.tsx` n'a plus qu'un seul chemin d'écriture** dans la pile pour cet écran (`ouvrirLaRetouche`) — la panne que `B0` avait payée sur `decoupeOuverte` était sept écritures à `null` et pas une porte. La septième porte, qui n'existait pas, existe : une image de la galerie **que personne n'a adoptée** s'ouvre en retouche, avec ses voisines de la grille pour sœurs, là où l'asset n'était relu que dans les cases d'un sujet. Le bandeau *La retouche ›* ouvre enfin **l'image qu'on regarde** et non la référence du sujet. ⚠️ **La cinquième porte était déjà fermée** : `B24` avait monté les deux fabriques dans le cadre la veille du relevé. ⚠️ **Un montage unique démonte la page qui était derrière**, et deux états remontent d'un cran pour que remonter d'un cran revienne d'où l'on venait — l'onglet ouvert d'un sujet et sa matrice ; la colonne de la matrice et le panneau d'un calque, eux, ne sont pas rattrapés. `App.test.tsx` passe de 828 à 715 essais : 39 rejoués mécaniquement, une trentaine adaptés, **28 retirés parce qu'ils mesuraient une pièce qui n'existe plus** — et les seize gestes que le déménagement laisse derrière (le champ d'un curseur, vider une place, la fabrique du miroir, masquer une passe, le catalogue des modèles, le PNG de la table, les poches une par une, l'échantillon d'occupation, la grille du modèle, la source des couleurs, la liste des taches, deux lectures du contour, trois du recadrage, ce que rend chaque méthode de pixélisation, la molette, le réveil au toucher) sont **listés en `B27`**, à trancher un par un plutôt qu'à oublier. **`B26` l'ancien châssis sort de la retouche, tenue le 9 septembre 2026** — `Places.tsx` et `Tables.tsx` (plus de 5 000 lignes à eux deux) quittent le dépôt : leur vocabulaire partagé (47 symboles, extraits au caractère près) migre dans `interface/src/recette.ts`, module sans écran, et `AtelierDeBande.tsx` règle désormais les mêmes moteurs que la retouche via les postes exportés de `Retouche.tsx` plutôt que les six panneaux de l'ancien châssis. ⚠️ **Six capacités ont été rattrapées, pas assumées comme perdues** — le catalogue des modèles de détourage, masquer une passe (règle U10), l'échantillon de l'occupation, ce que rend chaque méthode de pixélisation, la source des couleurs, la provenance de la couleur du contour — chacune reprise de son calcul d'origine, vérifiée sur le fil plutôt qu'à l'œil, et désormais couverte par onze essais de comportement neufs. Une relecture Opus a trouvé au passage trois critères déjà cochés de `D4` qui ne tenaient plus que par l'ancien panneau du contour, corrigés. Deux secondes implémentations nées de la tranche restent à traiter en `B27` : `BlocPasse` (orphelin, à retirer) et `EchantillonDeHauteur`/`EchantillonDeLaHauteur` (deux lecteurs vivants, à fondre en une seule pièce). **`B27` les garde-fous rattrapent la refonte, tenue le 9 septembre 2026 — dernière tranche du déménagement (`B23`-`B27`)** — `BlocPasse` retiré de `Fiche.tsx` (386 lignes), `EchantillonDeHauteur`/`EchantillonDeLaHauteur` fondus en une seule pièce (`chassis.tsx`, réglage `palette`) que `Assistant.tsx` et `Retouche.tsx` montent tous les deux, six renvois morts vers `Places.tsx`/`Tables.tsx` corrigés plus quatre trouvés en refaisant le grep, trois phrases périmées (« l'écran double l'ancien ») corrigées avec leur renvoi à `B23`-`B26`, et le garde-fou d'import qui aurait évité tout ce chantier (`essais/essai_imports.py`) posé avec quatre exceptions nommées — deux de plus que prévu, chacune justifiée. En aparté, non demandé par les critères : la colonne ouverte de la matrice et le panneau d'un calque survivent désormais au montage de la retouche, sur le patron que `B25` avait posé pour l'onglet | **`docs/PLAN-carnet.md`** |
| **V5**, **V6** | Les tuiles qui se raccordent, le son | **non découpées** — décalées d'un cran le 6 septembre 2026 par l'entrée de la V4 | `docs/archi-versions.md` §9 et §10 |

**226 critères d'acceptation cochés pour la V1 et la V2, 87 pour le lot U ; 1 874 essais de
serveur et 1 160 d'écran** tiennent le dépôt — comptés le 10 septembre 2026, et **aucun ne coûte
un centime**.

---

## Les invariants du produit

**Un invariant instauré ne se renégocie plus** : chaque tranche suivante le conserve, et c'est
un critère d'acceptation de chacune. Les versions qui en ont révisé un l'ont écrit noir sur
blanc, et la révision figure ici à la place de l'ancienne règle.

### L'argent et l'appel

| L'invariant | Depuis |
|---|---|
| L'identifiant de génération est unique — deux soumissions ne facturent qu'une fois | T1 |
| Ce qui est enregistré est ce que l'appel a **consommé**, dans l'unité du fournisseur, jamais un chiffre annoncé | T1, *élargi en F2 : l'unité change, la règle ne change pas* |
| Un total en argent ne compte que de l'argent | F2 |
| Un chiffre de réserve dit toujours s'il est relevé chez le fournisseur ou compté ici | F2 |
| **Rien n'est jamais relancé automatiquement** | T1 — la règle la plus ancienne du produit |
| Aucun repli automatique d'un fournisseur sur un autre — ce serait une relance, et elle appartient à l'auteur | F1 |
| Une dépense ne s'efface jamais — une image supprimée change l'état de son appel, jamais sa ligne | E18 |
| Le texte montré avant de payer est demandé par le chemin même que l'envoi emprunte | E14 |
| Une correction faite avant de payer vaut **pour cet appel seulement** ; garder est un second geste écrit | E14 |
| Une seule barre de saisie dans tout le produit, et deux lieux seulement d'où l'argent part | E2 |

### Ce qui décide, et ce qui refuse

| L'invariant | Depuis |
|---|---|
| Le catalogue décide, jamais une liste en dur — **l'adaptateur répond, et jamais de mémoire** | T1, *révisé en F1 : soit il relit le fournisseur, soit il sert une fiche datée, et l'écran dit laquelle* |
| Les dimensions mesurées font foi, jamais celles demandées | T1 |
| Ce qui est indisponible est grisé avec sa raison, jamais proposé puis refusé | T1, *déplacé en E3 : ça s'ouvre quand même et porte sa raison à la place de ses réglages* |
| **Un compte d'images *insuffisant* est le seul refus automatique du produit** — toute autre mesure informe, et arrête au plus la planche pour demander un regard | C2, *devenu littéralement vrai en V2.1 ; **réécrit en R6** : un sujet en trop ne refuse plus, il se choisit ; un carré plein ne s'accepte plus en silence, il se signale* |
| L'auteur déclare, l'application enregistre — jamais l'inverse | C3, et partout depuis |

### Le traitement des images

| L'invariant | Depuis |
|---|---|
| Le traitement est **non destructif** : image brute + recette, le rendu est un cache effaçable | T2 |
| Le post-traitement ne touche jamais la carte graphique, et n'appelle jamais le fournisseur | T2 |
| Aucun modèle **génératif** local. Un modèle de *segmentation* sur processeur est admis comme moteur de détourage **facultatif**, grisé avec sa raison quand il n'est pas là ; le geste courant n'en demande aucun | T1, précisé en T2 |
| Une place de recette décrit **cette** image ; une fabrique en produit d'autres, et n'a pas d'état | E3 |
| Le carré d'une place se remplit quand elle **change l'image**, pas quand elle figure dans la recette | E3 |
| Une coordonnée ne voyage pas — ni cadre tracé, ni point de pipette, ni forme entourée, ni passage de la main | lot U |
| Une place s'éteint sans se vider : éteindre et vider ne sont pas le même geste | lot U |

### Le rangement

| L'invariant | Depuis |
|---|---|
| Les fichiers font foi, la base est un index reconstructible | T3 |
| **Une seule grille d'assets dans tout le produit** — la matrice d'une chose, la réserve, les dépenses et **la colonne des sœurs** n'en sont pas : ni recherche, ni filtres, ni sélection multiple | T3, *reformulé en E1, **amendé en `G12`** : la colonne des sœurs est une quatrième surface, et elle porte une sélection parce qu'elle est l'ensemble déjà sous les yeux* |
| Tout ce qui ne demande pas le fournisseur fonctionne **réseau coupé** | T3, reconduit partout |
| Écrire un nom crée la chose, sur-le-champ, sans formulaire et sans rien payer | C1, généralisé en E2 |
| Une case est prise dès qu'une image la porte, pas parce que l'image est bonne | E2 |
| Une jauge ne compte que ce qu'on peut fabriquer maintenant | E12 |
| Le manque n'a aucune couleur d'alerte, et rien ne réclame jamais rien | E2 |
| Aucun écran n'est obligatoire : l'assistant se saute à n'importe quelle étape | E19 |

### Le personnage, la planche et le calque

| L'invariant | Depuis |
|---|---|
| Le corps naît dans l'atelier et nulle part ailleurs | C1, *reformulé en E2 : une seule barre de saisie, deux lieux qui paient* |
| Le plan appartient au projet, jamais au personnage | C1 |
| **Le pliage est une fonction générale de l'atelier** — habiller ou transformer N images d'un seul appel | C2 |
| ~~Le pliage est une ruse d'appel, jamais un format de livraison~~ | C2, **renversé en G16** : une planche entre en bibliothèque, s'y regarde et s'exporte. `P1` en garde la seconde moitié — elle se déplie autant de fois qu'on veut |
| Rien n'est ajouté à l'image envoyée pour aider le recalage — ni ancre, ni mire, ni silhouette | C3 |
| Le corps d'origine n'est jamais modifié : le calque est rangé à côté de l'image payée | C3 |
| **Un calque est solidaire de sa pose** — il en faut un par pose, et c'est le pliage qui en divise le prix | C3 |
| Une planche ne porte qu'une seule chose du jeu | E13 |

### Les fournisseurs

| L'invariant | Depuis |
|---|---|
| Un modèle se nomme par son fournisseur **et** par son nom ; les deux ensemble, jamais l'un seul | F1 |
| Un fournisseur injoignable grise ses modèles et n'en efface aucun autre | F1 |
| **Aucune image de l'auteur n'est publiée à une adresse lisible par un tiers** pour servir de référence | F1 |
| Retirer une clé grise, et n'efface jamais ni une image ni une dépense | F3 |
| Ce que le produit ajoute de lui-même cède devant le plafond du modèle ; ce que l'auteur a joint ne cède jamais | F6 |
| ~~La clé du fournisseur est le seul préalable dur du produit~~ | T1, **tombé en F1** : sur une machine où rien n'a été déposé, une image arrive |

### L'écran

| L'invariant | Depuis |
|---|---|
| Aucune largeur ni hauteur inventée — hauteurs `44 · 38 · 34 · 30 · 26`, largeurs `380 · 300 · 240` | E1 |
| Un onglet ne se recouvre pas : trois lieux, et l'établi est une profondeur, pas un quatrième onglet | E1 |
| Le total affiché dit toujours de quoi il est le total, et il est cliquable | E1 |
| La barre d'espace montre en grand n'importe quelle vignette, partout, sans exception | E0 |
| Le MCP n'a aucune logique propre : il appelle les services de l'écran | T7 |
| **Une explication ne se recopie jamais** : ce qu'un écran écrit à demeure pour dire à quoi sert un réglage est **lu dans le recueil**, jamais retapé dans l'écran | R4, *étendu en `R8` : la règle valait pour la bulle et le guide, elle vaut désormais pour la ligne écrite sous un titre — et `R9` l'a employée le lendemain sur le calibrage, dont l'explication dormait écrite depuis six jours* |
| **Une explication écrite pour un réglage est atteignable depuis ce réglage** — l'autre bout de la règle du dessus, et un essai le tient | `G3` — 23 entrées sur 122 étaient écrites et accrochées à rien |
| **Un curseur envoie ce qu'on a lâché, pas ce qu'on a traversé** — et un essai le tient | R4 *écrit le 27 août, non tenu quatre fois ; devenu vérifiable en `G4`* |
| **Une bascule se pose contre ce qu'elle commande** | `G7`, *révise la règle d'`E1` qui les regroupait toutes dans la barre du haut : la raison était qu'un geste unique se cherche à un endroit unique, l'usage a dit le contraire* |
| **L'assistant s'ouvre sur un jeu qui n'a rien** — le premier comme le cinquième | `G8`, *révise `E19`, qui refermait la porte à la création d'un second jeu* |
| ~~Sur la toile, un menu ne se borne pas : on déplace la carte ou on dézoome~~ | *`E1`, **tombé en `G6`** : le plan est infini, le regard ne l'est pas — et l'objection du zoom a été levée par l'ancre d'écran* |

---

## Couverture des user stories

**518 user stories écrites**, dont **508 portées par une tranche**, dans `docs/user-stories.md`.
Le détail par tranche des versions tenues est dans l'archive.

| Bloc | User stories | Nombre |
|---|---|---:|
| V1 — T1 à T10 | 1 à 114 | 114 |
| V2 — C1 à C5 | 115 à 157 | 43 |
| Reprises R1 à R5 | 158 à 173 | 16 |
| V2.1 — E0 à E20 | 174 à 308 | 135 |
| V2.2 — F0 à F6 | 309 à 333 | 25 *(2 sans objet, F5 retirée)* |
| Les cinq capacités du lot U | 334 à 366 | 33 |
| **R6** | **367, 368** | **2** |
| **V2.3 — D1 à D5** | **407 à 430**, plus **476 à 481** | **30** |
| **R7** | **431 à 433** | **3** |
| **R8** *(la fiche d'une chose)* | **462 à 468** | **7** |
| **R9** *(le calibrage)* | **469 à 475** | **7** |
| **V2.4 — M1 à M7** *(ce qui est cassé, et le coin redessiné)* | `US-504`, `US-505` | **2** *(les deux sont de `M6`. Les six autres n'en ouvrent aucune : `M1` rend son sens à `US-503`, écrite pour `G16` ; `M3` tient `US-296`, `M4` et `M5` tiennent `US-126`, `M7` tient `US-407` à `US-412` — écrites pour `D1` —, et `M4` ferme une phrase du genre de `G1` ; `M2` est une maquette, et une maquette n'a pas d'utilisateur qui la demande — c'est le cas d'`E0`, `F0` et `A0`)* |
| **V2.5 — N1…** *(le design reprend la main)* | **aucune** | **0** *(`N1` est un relevé, comme `E0`, `F0` et `A0`)* |
| **V3 — A2, A4 à A7, A9 à A13** *(l'animation)* | **376, 379 à 388, 390 à 400, 434 à 461, 482 à 490** | **59** |
| **V3.1 — G1 à G16** *(l'atelier tient ce qu'il dit)* | **495 à 501**, plus **369** *(reprise à `P1`)* et **502, 503** | **10** *(les quarante-trois autres changements tiennent des stories déjà écrites)* |
| **V3.5 — P1, P2** *(le dépliage généralisé)* | **370 à 374, 491 à 494** | **9** *(`369` est partie en `G16` le 3 septembre 2026)* |
| **V3.02 — V3.02.1** *(la fiche d'un clip)* | **506 à 509** | **4** |
| **V3.03 — V3.03.1 à 4** *(l'atelier d'une animation au niveau des tables)* | **510 à 518** | **9** |
| *Retirées le 3 septembre 2026, dépassées par l'écran de montage et par `D4`* | *375, 377, 378, 389* | *4* |
| *Sorties du plan avec le pantin* | *401 à 406* | *6* |
| | **Total écrit** | **518** |

*Les numéros suivent le jour où la story a été écrite, jamais l'ordre de construction* : la
V2.3 se construit avant la V3 et porte pourtant les numéros d'après. C'est déjà vrai des
reprises R1 à R5, et ça évite de renuméroter un catalogue que des critères citent.

**Ce que le recadrage du 3 septembre 2026 a changé à ce tableau.** Les stories `369` à `406`
formaient un seul bloc « V3 » ; elles se répartissent maintenant entre trois destinations, parce
que la version ne fait plus qu'animer. **Treize stories neuves** — `482` à `494` — portent ce que
l'auteur a demandé ce jour-là : couvrir toute la matrice d'un personnage en animation, attraper
une image d'un clip pour s'en servir ailleurs, et ouvrir le dépliage à plusieurs sujets.

*Et le total annoncé ici était faux de six depuis le début : le tableau disait 475 là où ses
propres lignes en comptaient 481. Corrigé en passant, sans qu'aucune story bouge.*

**Ce que la V3.1 ajoute à ce tableau, et pourquoi c'est si peu.** Neuf stories neuves pour seize
tranches, plus une reprise à `P1` : c'est la marque de cette version. **Elle ne promet presque rien de neuf** — elle tient
ce qui avait déjà été promis, construit ou décidé. Les quarante-trois autres changements
n'ouvrent aucune story parce qu'ils en servent d'anciennes que le produit avait cessé d'honorer :
`G2` sert `US-6` et `US-13`, `G3` sert `US-268`, `G5` sert `US-352`, et `G9` **rouvre `US-189`**,
comptée livrée alors que son geste n'existait pas.

**`G16` est la seule exception à cette économie, et elle s'explique** : c'est la seule tranche de la
version qui **reprend une story à une autre** — `US-369`, *retrouver la planche entière dans la
galerie*, écrite pour `P1` et livrée ici parce que l'auteur en a besoin trois versions plus tôt.
Ses deux stories neuves — `502` et `503` — sont ce que `P1` ne prévoyait pas : **voir la case telle
qu'elle est revenue**, et **refaire son calage à la main**.

**A0 ne porte aucune user story**, et c'est la troisième du dépôt dans ce cas — après E0 et
F0 : c'est un relevé, et un relevé n'a pas d'utilisateur qui le demande.

---

## L'ordre de ce qui reste, et les deux endroits où il se resserre

```
R6  ✔ close le 3 septembre 2026 — hors version
 │
 ▼
V2.3  ┌ D1  le réglage de départ  ✔ close ┐  ✅ close, cinq sur cinq,
      ├ D2  la réduction ✔ · la grille ✔ │  le 3 septembre 2026
      ├ D3  le fond              ✔ close  │  D3 n'a pas coûté de banc :
      ├ D4  les moteurs, le contour ✔     │  deux mesures l'ont remplacé
      └ D5  les tailles          ✔ close  ┘  D4 attendait D2, qui était close
 │
 ▼
V2.4  ┌ M1  le découpage du coin ✔ close   ┐  ✅ close, sept sur sept, ouverte
      │ M2  la maquette du coin ✔ dessinée │  et close le 4 septembre 2026.
      │ M3  l'écran ne fige plus ✔ close   │  M2 dessine, les autres réparent,
      │ M4  la planche dit vrai ✔ close    │  et aucune n'en bloquait une autre.
      │ M5  la référence retrouvée ✔ close │  La tranche qui bâtit l'écran de
      │ M6  laquelle part      ✔ close     │  M2 ne s'écrit qu'après elle.
      └ M7  le détourage complet ✔ close   ┘
           ▲ M5 après M4, qui refait la
             liste où son geste se pose    M3, M4 et M5 sont le même écran,
                                           pris par trois bouts : ce qu'il
                                           fait, ce qu'il dit, ce qu'il perd.
                                           M4 seule change ce qui part au
                                           modèle, et le plan l'écrit.

                                           M6 est ailleurs : la matrice de la
                                           fiche, où aucune des cinq n'entre.
                                           Close le jour où elle est née — la
                                           règle existait, seul l'écran
                                           manquait.
 │
 ▼
V2.5    N1  l'audit de design repris        ouverte le 4 septembre 2026.
                                            N1 est un relevé : il ne touche
        N2… ne s'écrit qu'après N1          aucun écran, et il bloque tout
                                            le reste de la version.
 │
 ▼
V3    A6  le mouvement, dit une fois pour toutes
       │                                     A2  le cadre qui ne dérive pas
       ▼                                      │   n'attend rien et n'est attendue
      A9  commander un clip, et l'attendre    │   que par A10 : à faire quand on
       │   ← close le 4 septembre 2026        │   veut, de front avec A6 ou A9
       │                                      │
       │                                      │
       ├──► A11  le moteur de la maison       │
       │         ← close le 4 septembre 2026  │
       ▼         c'est lui qui rend A12 tenable
      A10 le montage — le cœur de la version ◄┘
       │   ← close le 4 septembre 2026
       ├──► A12  toutes les poses, en animation   ← l'objectif de la version
       │         ← close le 4 septembre 2026
       ├──► A13  l'image attrapée au vol
       │         ← close le 4 septembre 2026
       ├──► A4   la bande sort de l'atelier       ← la version devient livrable
       │         ← close le 4 septembre 2026
       ├──► A5   le contour qui ne bout pas       (D2 l'attendait, elle est close)
       │         ← close le 4 septembre 2026
       └──► A7   reprendre une image sans refaire la bande
                 ← close le 5 septembre 2026 — la dernière de la version

      A0  clos le 2 septembre 2026 — son verdict est plus haut

 │
 ▼
V3.01  ① le tiroir de la commande        ✔ close le 5 septembre 2026
       ② la liste des modèles se plie    à construire

 │
 ▼
V3.02  ① la fiche d'un clip — la galerie s'ouvre au clic    ✔ close le 5 septembre 2026

 │
 ▼
V3.03  l'atelier d'une animation au niveau des tables       ouverte, 3 closes sur 4
       ① le montage redevient brut, chaque frame a sa recette  ✔ close
       ② les tables sur une sélection  ✔ close
       ③ la bande se monte au clip  ✔ close
       ④ la main sur une frame

 │
 ▼
V3.1  ① G1   les phrases devenues fausses  ✔ close ┐  quinze tranches, et
                                                    │  aucune n'en bloque une
      ② G2   la barre d'attente revient             │  autre. L'ordre des
        G3   les 23 explications s'accrochent       │  familles est celui de
        G4   les curseurs posent au relâchement     │  la thèse, pas une
        G5   le geste qu'on ne trouve pas           │  contrainte : on peut
                                                    │  entamer par ④ si
      ③ G6   le menu ne sort plus de l'écran ──┐    │  l'usage le réclame
        G7   l'écran de l'univers se refait ◄──┘    │
        G8   l'accueil s'ouvre sur chaque jeu neuf  │  G6 est jetée par G7,
                                                    │  et c'est assumé
      ④ G9   démarrer la première pose              │
        G10  le zoom des tables monte               │  G11 est le seul point
        G11  éteindre un type d'objet               │  qui touche au disque
        G12  une recette sur plusieurs images       │
                                                    │  G13-G15 s'arbitrent
        G13  le modèle « lourd » ne détoure rien    │  avant d'être
        G14  le calage effacé en silence            │  construites
        G15  aucune couleur réduite, sans le dire   ┘

      ⑤ G16  ce qui est revenu du modèle se voit ✔ close le 3 sept. 2026,
             et se reprend à la main               prise hors tour : elle est
                                                   passée devant la V2.3 et la
                                                   V3, sans rien déplacer
 │
 ▼
V3.5  P1  la planche se garde, son découpage se refait   ← ex-A1, sortie de la V3
       │
       ▼
      P2  une planche pour plusieurs choses

R7  le texte en trois parties  ✔ close le 3 septembre 2026 — hors version
R8  la fiche d'une chose       ✔ close le 3 septembre 2026 — hors version
R9  le calibrage               ✔ close le 3 septembre 2026 — hors version
```

**Deux resserrements, et ils ne sont pas négociables.**

1. **La V2.3 passe entièrement avant la V3**, et le passage à la vidéo rend cette règle **plus
   contraignante, pas moins**. Le geste principal de la V3 est *découper plusieurs bandes dans un
   clip*, et l'écran de montage montre en direct la bande **passée par la chaîne du produit** :
   détourage, grille, palette. Un traitement qu'il faut refaire à la main sur chaque image
   transforme ce geste en corvée, et une bande mal ramenée sur sa grille n'est **pas jugeable du
   tout**. *Tranché avec l'auteur le 2 septembre 2026.*
2. **La V3 ne s'ouvre pas avant que la V2 serve pour de vrai** — même règle que la V2, qui n'a
   commencé qu'une fois la V1 tenue.

*Le troisième resserrement — `R6` d'abord — est levé : elle est close depuis le 3 septembre 2026.*

**La V3.1 n'en ajoute aucun, et c'est délibéré.** Elle répare ce qui existe : aucune de ses quinze
tranches n'attend une autre, et aucune ne bloque la V3.5. Sa place après la V3 vient de l'objectif —
l'animation d'abord —, pas d'une dépendance. *Si une gêne devient insupportable à l'usage, sa
tranche se prend seule, sans rien déplacer.* Les deux seuls liens internes sont écrits dans le
diagramme : `G6` disparaît avec `G7`, et `G12` réclame une réparation avant elle.

**Le critère de découpage ne bouge pas**, celui des cinq versions précédentes, mot pour mot :
*chaque tranche est utilisable à sa livraison, et on ne passe à la suivante que lorsque la
précédente sert vraiment.*

> ⚠️ **Une exception assumée, et la seule de la version — refermée le 4 septembre 2026.** `A9` a
> eu **son serveur écrit avant son écran**, et pendant cet intervalle la tranche n'était
> démontrable que par ses essais. C'était le bon ordre — le port asynchrone et l'écriture de la
> dépense sont ce qui pouvait faire perdre de l'argent, et il valait mieux les tenir d'abord.
>
> **Et l'intervalle a coûté ce qu'un intervalle coûte.** Les trois défauts trouvés en posant
> l'écran étaient dans le serveur, et deux d'entre eux étaient graves — l'atelier ne redémarrait
> plus, la galerie était vide au rechargement. Aucun essai ne pouvait les voir : ils montent un
> atelier neuf et ne le rouvrent jamais. **Écrire un serveur sans écran, c'est écrire sans le
> seul endroit d'où l'on voit ce qu'il fait.**

**Et un critère de plus, propre à la V3 : chaque tranche rend une animation plus facile ou moins
chère à obtenir.** C'est l'ordre dans lequel elles sont rangées. `A6` et `A2` préparent le
terrain, `A9` et `A10` fabriquent la première animation, **`A11` en amène le prix à zéro**, `A12`
la répète sur toute la matrice, et les quatre dernières la rendent bonne et sortable.

**`A11` ne remplace aucune des autres**, elle change l'échelle : un moteur gratuit ne dispense ni
de recadrer d'un seul tenant, ni de découper, ni de faire sortir. Ce qu'il change, c'est que
*lancer plusieurs clips et garder le bon* cesse d'être un arbitrage de dépense — et sans ça,
couvrir vingt-quatre cases se compte en dollars à chaque essai raté.

---

## Le détail des versions closes → `docs/archive/plan-r6-a-v3.02.md`

`R6`, `R7`, `R8` et `R9`, la **V2.3**, la **V2.4**, la **V3** et la **V3.02** — le détail de
sept blocs finis, descendu le 6 septembre 2026 sans qu'un mot change. Le tableau *Où en est le
dépôt* en garde une ligne chacune, et **les invariants qu'ils ont posés sont restés ici**.

---

## Les tranches périmées par la V4 → `docs/archive/plan-perime-par-la-v4.md`

La **V2.5**, la **V3.01**, la **V3.03** et la **V3.1** étaient ouvertes quand la V4 est entrée.
Le carnet refait l'interface qu'elles réparaient : elles ne se reprennent pas telles quelles.
Ce qui a été livré sous ces codes tient, et le fichier dit où passe la ligne — **les quatorze
tranches `G` de la V3.1 s'y relisent avant de clore la V4**, parce qu'elles nomment des défauts
que redessiner un écran ne corrige pas tout seul.

---

## V3.5 — Le dépliage généralisé

*Née le 3 septembre 2026 du recadrage de la V3. Elle ne fabrique rien de neuf : **elle divise le
prix de tout ce que le produit fabrique déjà.***

**Ce qu'elle est, en clair.** Demander huit images à un modèle coûte huit appels. Demander **une
grande image qui en contient huit** coûte un appel, et l'atelier la découpe. C'est le pliage, et
il existe depuis `C2`. Ce qui manque n'est pas le pliage : c'est **le retour en arrière** quand le
découpage tombe mal, et **l'ouverture** de la technique aux objets, aux décors et à tout ce qui
viendra.

**Pourquoi après la V3.** *Tranché par l'auteur le 3 septembre 2026.* L'animation est l'objectif
de la V3 et le dépliage n'y sert plus. Il ne bloque rien et ne dépend de rien : il se prend en
entier dès la V3 tenue.

**Ce qu'elle hérite de la V3.** Le gain mesuré au banc des planches, qui ne sert plus l'animation :
une grille de **quatre colonnes sur deux rangées** bat le 3×3 à case vide. Avec sa précaution —
**la géométrie devra s'écrire sur le pliage le jour où la formule change**, sinon toutes les
planches anciennes se redécouperaient sur une grille sur laquelle elles n'ont pas été dessinées.

---

### P1 · La planche se garde, et son découpage se refait
*5 US (370–374)* · **ex-`A1`, sortie de la V3 le 3 septembre 2026**

> **Tranché par l'auteur le 2 septembre 2026, et ça reste vrai.** Le dépliage **reste
> automatique** : une planche revient, elle est découpée toute seule, les images entrent en
> bibliothèque — exactement comme aujourd'hui, et sans un geste de plus. Ce qui s'ajoute, c'est le
> **retour en arrière**. *Le coupable n'a jamais été « automatique », c'était « sans retour ».*

> **La première moitié de sa phrase d'ouverture est déjà livrée**, par `G16`, le 3 septembre
> 2026 : la planche entre en bibliothèque et s'y regarde. Ce qui reste — et c'est le vrai sujet de
> la tranche — est **le retour en arrière** sur son découpage. `US-369` est partie avec.

**Ce qu'on livre.** Ce qui a été payé cesse d'être jeté après usage. La planche entre dans la
bibliothèque et **elle y reste** — *fait en `G16`*. Son premier découpage se fait tout seul. Quand il tombe mal — et
c'est le cas qui coûte cher —, l'auteur le **refait** : l'atelier repropose ses coupes, l'auteur
les corrige — déplacer, ajouter, retirer un rectangle —, et valide. Autant de fois qu'il veut.
Chaque image sortie porte de quelle planche et de quel découpage elle vient, et l'on peut
supprimer les images d'un découpage sans toucher ni à la planche, ni aux autres.

**Le geste ordinaire ne coûte rien de plus qu'aujourd'hui** : refaire un découpage est un geste
**qu'on demande**, jamais une étape qu'on traverse. Un écran de validation posé sur chaque planche
revenue aurait fait payer à toutes les générations le prix des rares qui tombent mal.

**La moitié de la machinerie existe déjà**, et c'est ce qui rend la tranche courte : le découpage
manuel sépare exactement ces deux gestes — proposer des rectangles, couper ceux qu'on lui donne —,
et l'asset porte déjà une filiation de découpe. Ce qui manque est que le **pliage** emprunte ce
chemin-là au lieu du sien.

**Et la reprise au redémarrage ne change pas.** Une planche payée et reçue que la fermeture a
laissée non dépliée se déplie au démarrage, gratuitement et sans rien demander — c'est la règle de
`C2`.

**Critères d'acceptation**

- [ ] **Le premier dépliage reste automatique** : une planche qui revient bien ne demande aucun geste, ni avant ni après
- [ ] **La géométrie s'écrit sur le pliage** au lieu d'être déduite du nombre de cases — sans quoi changer la formule redécouperait les planches anciennes de travers
- [ ] Refaire un dépliage est un geste que l'auteur demande, et il repart des coupes proposées
- [ ] Une coupe se déplace, s'ajoute et se retire à la main avant de valider un dépliage refait
- [ ] Une planche se déplie plusieurs fois ; les dépliages coexistent sans se marcher dessus
- [ ] Chaque image dit sa planche et son dépliage d'origine, et se remonte jusqu'à eux
- [ ] Supprimer un dépliage n'emporte ni la planche ni les autres dépliages
- [ ] Supprimer la planche demande confirmation et dit combien d'images en dépendent
- [ ] Une planche reçue mais non dépliée à la fermeture se déplie seule au redémarrage, comme depuis `C2`
- [ ] Aucun appel au fournisseur : déplier une planche déjà là marche réseau coupé

**Bloquée par** — aucune. *`R6` l'attendait ; elle est close depuis le 3 septembre 2026.*

---

### P2 · Une planche pour plusieurs choses
*4 US (491–494)* · **et un invariant à lever d'abord**

**Ce qu'on livre.** La planche cesse de ne servir qu'un seul sujet. On commande **huit objets
différents en un appel** — des potions, des clés, des pièces d'équipement, des tuiles de décor —,
et l'atelier les découpe et les range chacun à sa place. C'est ce qui divise par huit le prix d'un
inventaire.

> ⚠️ **Un invariant du produit s'y oppose aujourd'hui, et il faut le lever explicitement.** *Une
> planche ne porte qu'une seule chose du jeu*, posé en `E13`. Il avait une raison : une planche
> qui mélange les sujets rend le rangement ambigu — on ne sait plus quelle case chaque morceau
> remplit. **Cette tranche ne le lève qu'en apportant la réponse** : la demande dit d'avance ce
> que chaque case contient, dans l'ordre, et le découpage s'y réfère. Sans cette liste, on garde
> l'ancienne règle.

**Ce qui reste à trancher, et qui se décidera à l'ouverture de la version** — écrit ici pour que
personne ne croie la question réglée :

- **Ce que devient une case ratée** dans une planche de huit sujets. Refaire les huit, ou refaire
  la case seule dans une planche de un ?
- **Comment on désigne huit sujets en un texte** sans que le modèle les mélange. Le banc des
  planches a mesuré que *ce qu'on montre, le modèle le copie en entier* ; rien ne dit ce qu'il
  fait d'une liste de huit sujets différents.
- **Jusqu'où ça monte.** Les décors et les tuiles se raccordent entre eux, ce qui est le sujet de
  la V4. La frontière entre « huit objets sur une planche » et « des tuiles qui se raccordent »
  n'est pas tracée.

**Critères d'acceptation**

- [ ] Une planche peut porter **plusieurs choses différentes du jeu**, et la demande dit d'avance ce que chaque case contient
- [ ] Le découpage range chaque morceau à la place que la demande annonçait
- [ ] Une case dont le sujet n'est pas celui annoncé **se signale** au lieu de se ranger de travers
- [ ] Le prix par sujet s'affiche avant l'envoi, à côté du prix de la planche
- [ ] L'ancienne règle continue de s'appliquer aux planches qui ne portent pas cette liste
- [ ] Refaire le découpage d'une telle planche marche comme en `P1`

**Bloquée par** — `P1`.

---

## Ce que ce plan ne couvre pas

Les **tuiles qui se raccordent** et le **son** sont décrites dans `docs/archi-versions.md` §9
et §10, et ne sont pas découpées ici. *Leurs numéros y datent d'avant le décalage du
6 septembre 2026 : le carnet a pris la V4, et elles sont descendues d'un cran.*

**Deux versions de plus sont cadrées et non découpées → `docs/cadrage-fil-et-3d.md`.** Le
**fil** — discuter avec un modèle pour mettre un prompt au point, puis retoucher l'image
revenue jusqu'à ce qu'elle convienne — et le **pantin 3D** — animer par un maillage riggé au
lieu d'une vidéo, en recopiant le prototype `asset3d`. **Rien ne s'en construit avant que la V4
soit close**, relevés compris ; c'est tranché avec l'auteur le 6 septembre 2026, et le fichier
enregistre ses quatre décisions, les quatre invariants à lever, et les deux relevés qui
décident du découpage. Le fil passe avant le pantin 3D : c'est lui qui construit la brique
image→image dont le 3D dépend.

### Le pantin — sorti de la V3 le 3 septembre 2026, arguments intacts

*Ex-`A8`, 6 US (401–406), aucune ligne écrite. **Tranché par l'auteur** : la V3 ne fait qu'une
chose, animer par la vidéo, et le pantin est une seconde façon de faire la même chose.*

> ⚠️ **Il revient en 3D, et sa limite fatale tombe avec.** Ce qui l'a écarté est écrit trois
> paragraphes plus bas : *« il ne fait bouger que ce qui est déjà dessiné »* — pas de demi-tour,
> pas de main qui se retourne. Un maillage riggé fait les trois, et le prototype `asset3d`
> mesure 2 min 17 pour le maillage et 8 s pour le squelette, sur cette machine et sans un
> centime. **La suite est cadrée dans `docs/cadrage-fil-et-3d.md`** ; ce qui est écrit
> ci-dessous garde sa valeur de constat sur le pantin 2D, qui, lui, ne se reprend pas.

**Ce que c'était.** On obtient les pièces d'un personnage à partir d'une de ses images, l'atelier
y pose un squelette tout seul, on applique un mouvement de la bibliothèque, et l'on obtient une
bande **sans payer un seul appel**. Les pixels de chaque image sont ceux du sprite d'origine,
déplacés : le personnage ne peut donc pas changer de taille d'une image à l'autre, et il n'y a
plus de tirage.

**Pourquoi il sort, et ce n'est pas parce qu'il est mauvais.** Il était la finale de la version
tant qu'il était **le seul moyen d'animer sans payer**. `A11` l'est aussi, sur la même machine,
sans squelette, sans maillage et sans découpage en pièces. Ce qui reste en propre au pantin :
**la même bande redemandée revient identique à l'octet**, et **une animation de plus ne coûte
rien du tout, pas même deux minutes d'attente**. C'est vrai, et ça ne vaut pas six chantiers dans
une version dont l'objectif est d'animer par la vidéo.

**Ce qu'il faudrait savoir avant de le reposer**, et les deux questions ne coûtent rien : *un
membre plié survit-il à la réduction en pixels ?* et *à quelle amplitude le pantin casse-t-il ?*
La seconde peut supprimer la moitié du travail — si une marche et une attaque de profil passent
sans découvrir de zone cachée, toute la décomposition en pièces devient facultative.

**Et trois choses acquises qu'il ne faut pas reperdre.** L'ordre des opérations est décidé —
**déformer en grand format, pixeliser à la fin** —, trois preuves indépendantes le disent, et le
problème n'est pas la rotation mais **quantifier la géométrie trop tôt**. Le dépôt de référence
libre est **archivé depuis septembre 2025** : on recopie l'algorithme, on n'en fait pas une
dépendance. Et le squelette a un **format éprouvé à reprendre** — seize articulations, trois
champs chacune (`docs/bilan-v3.md` § 4). *Ce qu'il ne remplacera jamais, et c'était écrit
d'avance : il ne fait bouger que ce qui est déjà dessiné. Une marche de profil, oui ; un
demi-tour, une main qui se retourne, un visage qui change d'expression, non.*

**Et une version d'édition viendra, sans rang fixé.** Le dessin à la main reste jusque-là ce
qu'il est : un pinceau d'un seul pixel. *Tranché par l'auteur le 2 septembre 2026 — « on ne les
fait pas, il y aura plus tard une version avec éditeur. »* Le trait droit, le rectangle, le pot
de peinture et la symétrie avaient été proposés comme un ajout léger à la table de retouche ; ils
sont **écartés du plan actuel**, et pour une raison qui vaut d'être gardée : chacun paraît petit
isolé, et les prendre un par un fabriquerait un demi-éditeur que personne n'aurait décidé.
**Aucune tranche du plan ne présuppose leur existence.**

**Et une piste ouverte par la V3 elle-même, à essayer après elle : fabriquer les poses fixes
avec le moteur de la maison.** *Idée de l'auteur, 3 septembre 2026, notée dans
`docs/remarques/journal.md`.*

Fabriquer une image d'asset en local n'a jamais donné de résultat gardable — c'est pour ça que
les images passent par des modèles payants. Mais `A11` établit qu'**animer** en local marche et
ne coûte rien (`docs/recherche-video-locale/rapport.md`). Or une machine qui sait animer un
sprite sait produire des images de ce sprite **sous un autre angle ou dans une autre attitude** :
on demanderait un clip — *tourne-toi*, *meurs*, *lève le bras* —, et l'on irait y **prélever la
case** qui convient. Un clip de dix secondes qui enchaîne plusieurs mouvements donnerait, en
théorie, plusieurs poses pour un seul temps de calcul.

**C'est lent — dix à trente minutes le clip sur une carte de 8 Go — et c'est précisément le
point** : sur ce sujet, le seul chiffre qui compte est que ce soit gratuit. Le payant ne coûte
pas cher au clip, il coûte de **devoir compter**.

**Ce qui n'est pas acquis, et qui décidera** : une case tirée d'une vidéo est-elle assez nette et
assez fidèle au personnage pour tenir comme pose officielle, là où l'animation pardonne le flou
parce que ça défile ? C'est la question que le banc animé n'a pas eu à poser. **Aucune tranche du
plan ne présuppose la réponse**, et l'ouvrir demande que le moteur de la maison existe et ait
servi. **Sa moitié utilisable est devenue une tranche, et elle est livrée** : depuis le
4 septembre 2026, `A13` donne le geste pour attraper une image d'un clip et la faire entrer en
bibliothèque, traitée par la chaîne du jeu et avec sa filiation. ⚠️ **Ce qui reste ouvert n'est
plus le geste, c'est la qualité** — une case tirée d'une vidéo tient-elle comme pose officielle —,
et la tranche ne l'a pas tranchée : elle s'est construite sur un clip d'essai écrit à la main,
sans une seconde de carte graphique. La réponse viendra de l'usage.

**Et seize questions de la V2.1 restent ouvertes**, chacune avec ce qui manque pour y répondre
et l'étape où elle se pose : `docs/v21-arbitrages.md` § B. Aucune n'empêche d'ouvrir l'étape qui
la porte — ce sont des questions qui se tranchent **à l'usage**, et c'est délibéré : les
trancher d'avance, c'est décider sans mesure.

**Quinze choix tranchés seuls pendant le lot U attendent l'auteur** dans
`docs/questions-du-lot-U.md`.

### Les trois risques encore ouverts

Aucune tranche ne les présuppose.

- **La différence trouve ce qui s'ajoute, et manque ce qui se substitue.** C'est le risque de
  méthode qui reste en V2. Une pièce qui déborde de la silhouette est trouvée entière ; une
  pièce qui remplace ce qu'il y avait à sa place — un casque sur une chevelure, même empreinte,
  valeurs voisines — est effacée avec le bruit que la comparaison de couleur est faite pour
  absorber. Le cadrage oppose *contenue* et *qui agrandit* ; ce qui décide est *ajoute* contre
  *substitue*, et les deux découpes ne se recouvrent pas.
  *(**C4 l'a rattrapé sans le supprimer** : la retouche au pixel ramène ce que la mesure n'a pas
  vu. Ce qui reste ouvert est la **détection** — le produit ne dit toujours pas d'avance qu'une
  pièce va se substituer. Le risque a changé de gravité, pas de nature : il coûte désormais un
  geste, plus une image illisible.)* — `docs/releve-usage.md`.
- **La quantification reste liée à la palette.** Un projet qui choisit « aucune » comme taille
  de pixel reçoit encore ses images ramenées sur la palette dès qu'un artwork officiel existe :
  pour qu'elle se taise, il faut n'en promouvoir aucun. Limite acceptée le 28 août 2026 plutôt
  qu'oubli. Si une séance montre qu'un projet veut la palette **sans** la quantification, c'est
  un réglage de plus dans le même bloc, pas une tranche.
- **Le coût croît avec le nombre de références chez certains fournisseurs et pas chez
  d'autres.** Le regroupement par famille limite l'envoi, mais un univers riche renchérit quand
  même et peut inverser le classement des modèles par coût. Le pliage tire dans l'autre sens. À
  surveiller dès les premières séances réelles.

### Un risque qui est levé, et il faut le dire

**La recette d'animation** était le risque de la V3. **Il est levé, et la réponse est
négative** : trois bancs payés les 1ᵉʳ et 2 septembre 2026 — 141 planches, 6,03 $ —, puis six
essais de plus le 2 au soir — 2,29 $ —, toutes les planches notées une par une par l'auteur.
**La façon de demander est épuisée comme levier**, y compris en rangeant le texte au lieu de le
récrire, et le texte du produit ne bouge pas.

**Mais le risque chiffré qui en découlait a changé de forme, et c'est le fait de la journée.**
*Une bonne planche sur dix* était le prix d'une version bâtie sur la planche. La V3 n'est plus
bâtie dessus : elle commande un clip et le découpe. **Le risque n'est donc plus le taux, c'est
l'ignorance** — combien de clips pour une bande utilisable, personne ne le sait. **`A10` le
mesure sans banc supplémentaire** : son écran affiche le prix par bande de chaque clip et le voit
baisser à chaque bande gardée, si bien que le chiffre se prend à l'usage. Tout est dans
`docs/bilan-v3.md` pour les planches, et dans `essais/verdict-essais.json` pour la refonte.

**Et un second risque s'ouvre avec le recadrage, qu'il faut nommer** : *une seule direction a été
essayée.* Tous les clips mesurés partent du profil, et l'objectif de la version est d'animer
**toutes** les cases d'une matrice — donc aussi la face et le dos. Rien ne dit ce qu'un modèle
vidéo fait d'un sprite vu de face. **`A12` a livré l'endroit d'où on le verra, et pas la réponse** :
la matrice se lit désormais case par case sur son calque animé — *pas encore animée vers est,
ouest* s'y écrit —, mais la tranche s'est construite sans une seconde de carte graphique. ⚠️ **Le
risque reste entier**, et c'est délibéré : la question ne se mesure qu'en couvrant une matrice à
l'usage, pas en tirant un clip de plus ni en écrivant un écran.
