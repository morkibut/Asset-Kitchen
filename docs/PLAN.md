# Plan : Asset Kitchen — ce qui reste à construire

> **PRD source** : `docs/PRD.md`. **Deux chantiers avancent depuis le 13 septembre 2026** :
> [l'atelier unifié](PLAN-atelier-unifie.md) ajoute des capacités, de la demande MCP de l'agent
> au sprite utilisé dans Godot ; [la remise à plat](PLAN-remise-a-plat.md) remet d'aplomb sur la
> maquette validée ce qui existe déjà. **La remise à plat passe devant** quand les deux touchent
> le même écran : ajouter une capacité à un écran en double, c'est la devoir deux fois.
>
> **L'auteur a validé toute la maquette interactive le 12 septembre 2026 et demandé son
> implémentation complète en autonomie.** ⚠️ **Validée ne veut pas dire implémentée** : le relevé
> du 13 septembre mesure 0 écran sur 26 tenu de bout en bout. Le détail est au tableau ci-dessous.
> Les critères de production restent ouverts jusqu'à leur vérification dans le produit.
> Les retours d'essai et leurs limites sont consignés dans la
> [couverture du prototype](maquettes-atelier-unifie/couverture.md).
> Les équipements complets sont obligatoires : AU15–AU17, après AU5.
> L'amendement RF est remplacé par cet ordre. La V4 reste le socle livré, avec les écarts
> relevés dans la revue ; ni elle ni RF ne constituent une seconde file d'exécution.
>
> Ce document fait foi sur **l'ordre de construction** et sur les **critères d'acceptation**.
> Il ne nomme ni fichier, ni fonction, ni route : comment c'est construit vit dans
> `docs/ARCHITECTURE.md`, à quoi ça ressemble dans `docs/DESIGN.md`, ce que ça doit faire dans
> `docs/PRD.md`, ce sur quoi on s'est déjà cassé les dents dans `docs/PIEGES.md`.
>
> **Dégraissé quatre fois.** Le 15 septembre 2026, ce que le plan gardait encore de la V3 —
> le pantin, la piste des poses par le moteur de la maison, le risque levé de la recette — est
> descendu dans `docs/archive/ordre-historique-jusqu-au-10-septembre.md`, avec la section
> d'`AGENTS.md` qui racontait le même ordre ; et l'amendement RF, remplacé depuis le
> 11 septembre, a quitté `docs/PLAN-carnet.md` pour `docs/archive/plan-carnet-amendement-rf.md`.
> Le 13 septembre 2026, l'ordre historique est descendu à son tour —
> cent soixante-dix lignes qui se disaient elles-mêmes remplacées depuis le 11 septembre.
> Le 2 septembre 2026, le détail des cinq premières versions livrées
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

**Deux chantiers sont actifs : l'atelier unifié et la remise à plat.** Ce tableau donne le sort
de chacun et rien de plus. Le détail vit ailleurs, toujours au même endroit : ce qu'une tranche a **appris en se
construisant** dans `docs/status/etat.md`, ses **critères cochés** dans le fichier que la
dernière colonne désigne — `docs/tranches/<code>.md` pour les versions tenues jusqu'à la V4,
le plan du chantier lui-même pour `AU` et `RP`.

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
| **V3.5** — `P1`, `P2` | Le dépliage généralisé : la planche se garde, son découpage se refait, et il s'ouvre aux objets | **close le 19 septembre 2026, deux sur deux** — `P1` le 18, `P2` le 19 après les trois décisions de l'auteur | ci-dessous ; modèles dans `PLAN-v35-affectation.md` |
| **V4** — le carnet | Refonte déjà largement livrée ; sa conformité et ses parcours restent à corriger | **socle conservé, suite réorientée vers AU** ; les cases historiques ne sont pas décochées. Le 15 septembre 2026, les restes de `C1` et `C8` sont constatés tenus par le bloc `D` ; il ne reste ouverte que la vérification au navigateur de `C9`. L'amendement RF est en archive | `docs/PLAN-carnet.md` ; détail du relevé antérieur dans `docs/archive/etat-carnet-2026-09-10.md` |
| **V5**, **V6** | Tuiles et son | **en construction dans AU13/AU14** — les tuiles se prolongent dans le chantier *Les jeux de tuiles*, le son dans le chantier *Le son*, ci-dessous | `docs/PLAN-atelier-unifie.md` |
| **Atelier unifié** — AU1 à AU20 | Production des assets et équipements combinables par l'auteur et l'agent Godot, sources locales et 3D | **dix-huit tranches sur vingt pleines** — les trois dernières, `AU18` à `AU20`, closes le 13 septembre 2026. Reste **un critère**, pas une tranche : `AU11` — le rendu 3D garde cadre, pivot et dimensions d'une direction à l'autre. Celui d'`AU13` — produire, juger, corriger et exporter un jeu de tuiles *avec l'agent* — est tenu depuis `TU10`, le 19 septembre 2026. Et une case de préparation : reporter les arbitrages dans le PRD, le design et le plan. ⚠️ Livrée n'est pas éprouvée : la qualité 3D réelle n'est pas vérifiée, et le relevé du 13 septembre mesure 0 écran sur 26 tenu de bout en bout — c'est le travail de la remise à plat | `docs/PLAN-atelier-unifie.md` |
| **Remise à plat** — RP1 à RP23 | Remettre d'aplomb sur la maquette validée ce qui existe déjà : le ménage, les doublons, les manques, les deux décisions — et, depuis le 15 septembre 2026, quatre manques de plus que l'usage a nommés : l'image de référence d'une fiche se choisit, une image ou une animation modifiée s'enregistre sous une autre pose ou direction, une planche découpée sur la toile devient une animation, et une table de l'atelier se défait, se remet à zéro et se voit avant d'enregistrer | **close le 16 septembre 2026 — vingt-trois tranches sur vingt-trois**. Quatre le 13 : `RP1` le code mort, `RP2` les quatre onglets des réglages et le cadre qui borne l'agent, `RP14` la découpe qui se règle, `RP15` le cadre du montage qui se règle. Quatre le 15 : `RP3` le vocabulaire de l'ossature fermé, `RP5` un seul écran d'import sur une fiche, `RP6` une seule grille de choix d'image, `RP19` l'image de référence d'une fiche qui se choisit. Quinze le 16 : `RP4` une seule préparation et une seule relecture, `RP7` une seule grille d'assets, `RP8` une seule fiche de sujet, `RP9` la toile qui donne du travail, `RP10` la livraison qui décide au lieu de bloquer, `RP11` la galerie qui se trie, se filtre et se regroupe, `RP12` comparer deux versions d'une même animation, `RP13` déclarer un mouvement et une direction là où on les regarde, `RP16` le tiroir de ce qu'on a laissé en plan, `RP17` une seule porte pour sortir un personnage, `RP18` les neuf routes sans écran, `RP20` enregistrer sous, `RP21` une planche découpée sur la toile qui devient une animation, `RP22` une table qui se défait, se remet à zéro et se voit avant d'enregistrer, `RP23` tester les animations comme dans le jeu — on s'y déplace, la caméra suit la vue, ce qui manque devient un rectangle. Une relecture croisée le même jour a corrigé les comptes, les cartes et les mots que les tranches avaient laissés en désaccord. Ce que chacune a livré est écrit sous son titre dans le plan du chantier. Reste ouvert : un critère de `RP2` (le cadre de l'agent ne borne pas encore la 3D ni le son), et ce que la relecture au navigateur (quinze gestes sur un atelier jetable, deux pannes réparées) a laissé à décider — `docs/status/etat.md` § La relecture croisée. | `docs/PLAN-remise-a-plat.md` |
| **Références d'un sujet** — RS1 à RS9 | Chaque référence promue porte un usage (toujours, planche, direction) et part quand elle sert ; une image fixe peut refaire une planche en gardant sa mise en page ; la fiche range ses références par usage ; l'outil de génération de l'agent et « Reprendre les réglages » portent le même drapeau, et l'agent vise maintenant un sujet et joint des références comme l'écran. Né d'une fabrication de Champy où la planche des quatre vues était partie comme « le même personnage » sous un texte qui exigeait un sprite seul. Depuis RS6–RS9, une planche refaite revient découpée en ses vues, chaque image rangée dans sa direction avec la recette du sujet | **neuf tranches sur neuf, le 18 septembre 2026** ; essai payé de `RS2` fait par l'auteur. Reste un essai payé de la découpe à l'arrivée | `docs/PLAN-references-du-sujet.md` |
| **Le son** — SN0 à SN12, SNM | Fabriquer en local tous les sons d'un jeu — bruitages, interface, ambiances, musique, chansons, voix —, les ranger par sujet et les caler sur les animations, les livrer à Godot en fichiers qu'il lit tels quels. Prolonge AU14, qui ne sait faire qu'**un** son flottant | **ouvert le 18 septembre 2026, fusionné dans `main` le 19** — `SN0` à `SN5`, `SN8` et la maquette `SNM` faits, serveur et écrans (19 septembre) ; le banc `SN0` a tourné et attend l'écoute de l'auteur ; `SN6` (les sons d'un sujet) fait ; `SN7`, `SN9`, `SN10` et `SN12` faits (19 septembre) ; `SN11` (les voix) reporté par l'auteur | `docs/PLAN-son.md`, `docs/archi-son.md` |
| **Les moteurs locaux** — ML1 à ML7 | Générer une image sur la carte graphique avec les 22 styles de sc-clone, qui prennent une image de référence et figurent dans la liste des modèles à 0 $ | **clos le 19 septembre 2026, sept sur sept** — ML1 à ML6 le 18, ML7 le 19 | `docs/PLAN-moteurs-locaux.md` |
| **Les styles de combat** — SC1 à SC4 | Comment un personnage donné attaque : un style par personnage ou par pièce, dont le texte remplace celui du mouvement dans ce qui part au modèle vidéo | **clos le 18 septembre 2026, quatre sur quatre** | `docs/PLAN-styles-de-combat.md` |
| **Les jeux de tuiles** — TUM, TU1 à TU13 | Fabriquer des sols, des chemins et des murs qui se raccordent, et les livrer à Godot, en reprenant le moteur validé de sc-clone : l'IA fabrique des matières, le code découpe les pièces. Prolonge AU13, qui ne sait partir que d'une image déjà faite | **douze tranches sur douze, le 19 septembre 2026, sur la branche `feat/tuiles`** — maquette validée par l'auteur ; l'écran « Les tuiles » fabrique un sol, un chemin, un mur (hauteur 1 à 8), un 15 ou un 17 pièces, avec des matières intégrées ou générées sur la machine, vérifie les bords et livre à Godot ; l'agent fait de même sans écran (Node), ce qui ferme le dernier critère d'AU13. La relecture croisée (TU11) a réparé la livraison des 17 pièces. La palette commune ne recolore plus les matières intégrées (corrigé le 19 septembre 2026, § TU6). **Deux tranches de plus, faites le 20 septembre 2026** : `TU12` les deux champs du texte se comprennent sans mode d'emploi (repères, exemple qui remplit les deux à la fois, blocage qui nomme le champ manquant, parts repérées dans le texte envoyé), `TU13` une image de référence par emplacement — le graphe local savait déjà la porter, le raccord tient avec elle, et l'agent la joint comme l'écran. Reste à voir au navigateur, et à éprouver sur un vrai tirage | `docs/PLAN-tuiles.md` |
| **Le coup de main** — CM1 à CM7 | Une aide qui connaît le produit : améliorer un texte de génération et le rendre en anglais, répondre à « comment on fait ça, ici », expliquer ce qui bloque. Une marque au bout d'un champ et une touche, rien d'autre à l'écran | **sept tranches sur sept, le 25 septembre 2026, en autopilote** — un adaptateur de texte à part (`deepseek/deepseek-v4-flash` par OpenRouter, en flux, coupé côté serveur à 15 s, silencieux sans clé) ; la fiche du produit (`docs/fiche-produit.md`) ; la marque « EN » sur tout champ de prompt (image, clip, son, négatif) qui propose l'anglais à côté du texte ; `Ctrl+/` qui ouvre une question là où l'on est, sur tous les écrans ; « pourquoi › » qui développe la raison d'un bouton grisé (posé sur « Relire avant l'envoi ») ; un plafond mensuel de 1 $ par défaut, tenu en rafale, et son compteur dans les dépenses. Relecture croisée : douze défauts aux coutures, tous corrigés. **Rien n'a encore parlé au vrai modèle** : l'identifiant et le tarif viennent de la documentation, et la qualité de la consigne « améliorer » attend un essai payé de l'auteur (seize appels, moins de 2 centimes estimés, protocole sous CM3). **Trois décisions laissées à l'auteur** dans le plan. Rien vu au navigateur | `docs/PLAN-assistant.md` |
| **Le rangement** — RG1 à RG8 | Qui est quoi, et ce que chacun peut avoir. Une nature de sujet déclare ses six capacités et l'écran n'affiche que ce dont la réponse est oui ; la fiche d'une image passe à trois zones ; la colonne des sujets sépare les familles de ce qui n'en est pas ; les **matières quittent les sujets** pour devenir une bibliothèque d'ingrédients, que l'agent sait lister. Né d'une séance d'usage du 19 septembre où les matières générées arrivaient détourées, sans que rien à l'écran ne le dise | **huit tranches sur huit, le 20 septembre 2026 ; fusionnée dans `main` le même jour** (commit `2127f71`, deux conflits tranchés sur les pièces). Le correctif qui a révélé le défaut (`bareme_complete`, `atelier/domaine/projet.py`) est commité : un barème relu reçoit les natures qui lui manquent. Les matières sont une bibliothèque du jeu que l'écran des tuiles et l'agent (`list_materials`) lisent ; une migration rejouable sort les anciennes matières de leurs sujets. Une relecture croisée a relevé dix-sept écarts, tous corrigés sauf ceux qui reviennent à l'auteur ; **restent à décider** (§ « Décisions laissées à l'auteur » du plan) : ranger une matière dans une collection, et le lien d'aide vers Réglages. Rien vu au navigateur. N'appelle aucun modèle et ne dépense rien | `docs/PLAN-rangement.md` |
| **Le guide** — GU1 à GU16 | Le volet `?` revu écran par écran : un résumé en tête, les réglages groupés par zone et repliés, le détail au clic. Une aide écrite à la main, gratuite, qu'un débutant lit en dix secondes | **close le 20 septembre 2026 — seize tranches sur seize**. Les 229 fiches à plat sont devenues **316 fiches sur 25 écrans du guide**, chacune dans un groupe qui nomme sa zone d'écran, chacun des 25 écrans avec son résumé en trois gestes ; neuf valeurs d'`ou` neuves (les tuiles, le son, les fabrications, l'envoi, la grille, comparer) et **le routage du volet réparé dans six tranches** — des écrans dont le `?` montrait le guide du voisin. Dix fiches mortes retirées et une en doublon, notées une par une. `aide.test.ts` tient les limites : 868 essais, un par fiche, écran et genre de lieu. L'essai au navigateur a ouvert les 25 écrans et corrigé quatre défauts de rendu, dont le volet invisible sous tout dialogue modal. Restent sept limites connues, écrites au relevé — elles tiennent au routage, pas au texte. N'a appelé aucun modèle et n'a rien dépensé | `docs/PLAN-guide.md`, relevé `docs/releves/guide-2026-09-20.md` |
| **Les retours du 20 septembre** — RT1 à RT9 | Voir avant de choisir, et ne lire que ce qui sert. L'étape « Son allure » montre le rôdeur sous chaque taille, chaque méthode de pixelisation et chaque nombre de couleurs, calculés sur la machine ; le réglage du fond disparaît et devient un calcul par demande, sur l'image de référence envoyée ; les phrases qui embrouillent un débutant partent, et le seul garde-fou qui comptait reparaît là où il sert. Plus trois défauts nommés à l'usage : une note collée sur la toile se corrige, « Les sons » rentre dans l'atelier au lieu d'un dialogue plein écran, et la porte « Les sujets » devient **Codex** | **close le 21 septembre 2026 — neuf tranches sur neuf**, sur la branche `feat/retours-du-20-septembre`. L'étape « Son allure » montre le rôdeur sous chaque taille, chaque méthode et chaque nombre de couleurs, calculés par le moteur de production et gardés sur le disque ; le fond s'élit à chaque demande sur les images de référence, avec le vert de studio en repli ; l'écran a perdu 137 lignes de texte pour 29, et le seul garde-fou qui comptait reparaît au changement de taille sur un jeu qui porte des images. Une note de la toile se corrige — le serveur le savait depuis `T9`, aucun écran ne le lui demandait. **Vérifié au navigateur** sur un atelier jetable (`essais/atelier_jetable_rt.py`, port 8424) : un défaut trouvé là, la case 512 qui restait blanche. **La relecture croisée a pris onze écarts**, dont deux écrans qui promettaient un fond du jeu qui n'existe plus, et **deux critères cochés à tort** — l'un réparé, l'autre décoché. N'a appelé aucun modèle et n'a rien dépensé. **Passe devant *Le coup de main***, décidé par l'auteur : ce sont des défauts vus à l'usage, sur l'écran que traverse tout nouveau jeu. Ne dépense rien. ⚠️ `RT3` change ce qui part au fournisseur et **invalide les comparaisons avec les tirages déjà payés** ; et elle renverse la décision du 2 septembre écrite en tête de `atelier/domaine/fond.py`, qu'elle doit réécrire | `docs/PLAN-retours-du-20-septembre.md`, retours dans `docs/remarques/voir-avant-de-choisir.md` |
| **La revue du 21 septembre** — RV0 à RV27 | Une action, un chemin ; et l'écran dit ce qui s'est passé, là où l'on a cliqué. Né d'une revue complète au navigateur sur une copie des données de l'auteur, avec trois générations locales réelles : une vidéo revenue toute noire rangée comme réussie, quatre formulaires pour animer la même pose, deux écrans de livraison qui ne voient pas le même dossier Godot, trois listes dans Fabrications, neuf écrans hors du style papier | **vingt-huit tranches sur vingt-huit, le 25 septembre 2026** — toutes faites et fusionnées ; `RV16` a remesuré la maquette le 24 : 1 écran sur 26 tenu, 22 en partie, 3 absents (`docs/releves/maquette-remesuree-2026-09-24.md`). Les dernières, en autopilote : `RV7` (le retour là où l'on a cliqué), `RV9` (une seule liste de fabrications, avec vignettes), `RV11`, `RV12` (fiche à quatre onglets), `RV15`, `RV17` (sous le ruban d'une animation), `RV18` (« Sa vue » dit vrai, en scène), `RV19`, `RV20` (copier un texte envoyé), `RV21` (« Modifier la fiche » en onglets), `RV22` (écarter ou supprimer ce qui n'est pas rangé, aussi par l'agent), `RV23` (Espace partout). Une relecture croisée a trouvé neuf défauts aux coutures, tous corrigés le 24. Suites entières vertes. **Peu vues au navigateur** : la séance d'usage de l'auteur reste à faire. **Quatre tranches ajoutées le 24 septembre** sur des retours de l'auteur : `RV24` la table « Couleurs » montre les couleurs de l'image (elle ne montrait que la palette du jeu), `RV25` le fond enfermé dans le sujet se voit et s'enlève, `RV26` l'agrandissement d'Espace passe devant les fenêtres, `RV27` la colonne des images de « Relire avant l'envoi » tient son texte — les quatre faites le 24, avec une seconde relecture croisée (quatorze défauts, tous corrigés). Ne dépense rien ; ⚠️ `RV3` change le fond envoyé quand la description nomme une couleur | `docs/PLAN-revue-du-21-septembre.md`, revue dans `docs/releves/revue-2026-09-21.html` |
| **La transparence native** — TN1 à TN8 | Quand le modèle sait rendre un fond vide (Qwen-Image 2.1, moteur local principal depuis le 22 septembre 2026), on le lui demande pour les personnages, les objets et l'interface, et le détourage s'endort au lieu de tourner. Le gain n'est pas le temps (0,13 s par image) mais le bord : plus de cape verte trouée sur fond vert (`RV3`), plus de liseré. Un banc de huit tirages le 22 a montré six sujets propres, une robe blanche trouée sur une planche et des débris autour d'un coffre en pixel art : d'où un contrôle des trous à l'arrivée, et les planches laissées de côté | **sept tranches sur sept, le 25 septembre 2026** — plan validé par l'auteur le 25 ; `TN1` était faite le 22. Sur Qwen, un personnage, un objet ou une interface part **sur fond vide** (consigne officielle, plus de couleur de fond ni de phrase interdite) ; l'image née transparente arrive **détourée par le modèle**, détourage en sommeil et réveillable, brume d'alpha nettoyée, pixel art en tout-ou-rien ; un trou dans le sujet est signalé avec « Refaire sur fond coloré », qui passe par la relecture et annonce le prix ; l'agent fait pareil. Décor, tuile, matière et planche : rien ne change. Relecture croisée : trois défauts aux coutures corrigés (texte repris qui gardait son fond, planche d'équipement, superposition). `TN7` : un texte repris ne nomme plus qu'un fond, celui de son appel. **`TN6`, le banc rejoué par l'atelier** avec le vrai ComfyUI (64 tirages locaux, 0 $, 22 min) : 48 sur 48 fond vide reçu et détourage endormi, aucun faux trou ; les seize planches mesurées sont propres, mais le troisième sujet demandé par l'auteur (un spectre au voile translucide, huit planches des directions) **ne l'est pas** : 6 fonds vides sur 8, débris jusqu'à 74 % — **`TN8` reste fermée**, les planches partent toujours sur fond coloré. Rien vu au navigateur | `docs/PLAN-transparence-native.md` |
| **De la toile au sujet** — TS1 à TS21 | Le début d'un jeu : ce que l'auteur pose sur la toile (texte, artwork, première version pixel) doit pouvoir devenir un sujet du Codex, puis la planche des directions du jeu d'où partiront les poses et les animations. Né d'un trou signalé par l'auteur le 22 septembre : créer un sujet ne prend aucune image, une carte de la toile n'est pas un asset, aucun chemin ne fabrique la **première** planche (RS2 ne sait que refaire une planche existante), et la carte du Codex montre la dernière image faite au lieu du portrait choisi | **vingt et une tranches sur vingt et une, le 24 septembre 2026, en autopilote** — le Codex montre le portrait ; créer un sujet depuis une carte ; la première planche et « C'est la référence » ; la barre « Fabriquer » de la toile façon Mixboard (image brute en 512 ou 1024, le texte sur la carte, prendre une carte en référence, « Développer ce sujet », Combiner, Encore, le lien visible) ; le sujet neuf dit quoi faire ensuite ; la première planche depuis une carte ; les palettes de la toile dans la retouche et sur la fiche. Relecture croisée : la planche entière devient la référence, la toile part vraiment brute, la palette suit les planches, le catalogue grise la première planche. Suites entières vertes. **Reste l'essai payé de `TS3`, par l'auteur**, et le passage au navigateur ; le temps local mesuré par taille reste à faire côté serveur. **Neuf tranches ajoutées le 24 septembre**, sur les retours de l'auteur à l'usage de la toile : `TS13` la toile revient après « Ambiances et couleurs », `TS14` la barre « Fabriquer » se replie, `TS16` « ouvrir sa palette » d'un îlot, `TS15` le détail d'une carte et d'un îlot dans la colonne de droite au lieu d'une fenêtre, `TS17` le choix du modèle montre d'abord les habitués (top 3 gratuits, top 3 payants, puis tout avec une recherche), `TS18` une carte s'ouvre dans l'atelier de retouche, `TS19` la planche des directions ne dessine pas un miroir, `TS20` refaire la planche des directions, `TS21` la Galerie fait d'une image la planche d'un sujet — toutes faites et fusionnées le 24, seconde relecture croisée comprise. **Restent** : le banc payé de `TS19` (`essais/banc_miroir_ts19.py`, environ 0,80 $, à la main), et le prix annoncé sur le bouton de `TS20`, non tenu | `docs/PLAN-de-la-toile-au-sujet.md` |
| **Les idées PixelLab** — PX1 à PX10, PX3bis | Trois gestes vus chez PixelLab : repeindre une zone peinte sans toucher au reste, laisser de la place autour du sujet avant un grand geste vidéo, finir une animation sur une image choisie. Né de l'analyse d'un tutoriel PixelLab le 25 septembre 2026 | **huit tranches faites, une interrompue, le 26 septembre 2026, en autopilote** — la zone repeinte tourne en local sur cinq familles de moteur (Qwen-Image 2.1, FLUX.2 Klein, Z-Image, FLUX.1, SDXL), gratuite, avec la recette non destructive trouvée par PX1 (`VAEEncode` + `SetLatentNoiseMask`, jamais `VAEEncodeForInpaint`) ; la fabrique « Repeindre » peint, écrit, choisit le modèle, garde/jette/recommence, et le calque se rouvre comme un calque d'équipement ; l'agent a `repaint_zone`. `part_sujet` (place autour du sujet) et `image_de_fin` (finir sur l'image de départ ou une autre) se règlent dans « 4. Le clip », se gardent avec le clip et se relisent à sa réouverture ; le modèle maison les honore par ses nœuds natifs, OpenRouter par son champ déclaré. `PX3bis` est **interrompue à la demande de l'auteur** : la couleur demandée n'obéit pas complètement (bleu 19 % à 26 % des pixels changés selon la force), et la force par défaut (0,9) n'a pas bougé — onze pistes d'amélioration, dont celle-ci, sont relevées dans `docs/releve-usage.md` pour que l'auteur choisisse. **La qualité entre les cinq moteurs n'a jamais été comparée**, comme demandé (PX7 ne vérifie que le fonctionnement). La relecture croisée (`PX6`) a corrigé un écart de tutoiement dans « Repeindre » (deux phrases en vouvoiement à côté du reste de l'écran, qui tutoie) ; relevé sans le corriger, `FabricationVideoLibre.tsx` (« Faire une vidéo libre ») partage la même route serveur que « 4. Le clip » mais n'en pose ni la marge ni la fin — une piste de plus, pas un critère manqué. **Laissé à l'auteur** : l'essai payé de l'image de fin chez OpenRouter (`OpenRouter:bytedance/seedance-1-5-pro`, environ 0,026 $), et le choix d'une piste d'amélioration parmi les onze. **Vu au navigateur** (PX6, atelier jetable sur le port 8427, fournisseur et ComfyUI doublés) : la fabrique « Repeindre » et, sur un personnage avec une pose, « Place autour du sujet » et les trois choix de « Fin de l'animation », y compris la boucle **PX9 et PX10 faites les 26 et 27 septembre 2026** : « Repeindre » va de A à Z avec trois décisions nommées ; le portrait d'un sujet n'a plus qu'une règle (le choix, sinon un repli qu'une arrivée ne déplace pas), un choix perdu se dit sur la fiche, et la molette zoome de nouveau dans l'agrandissement d'Espace | `docs/PLAN-idees-pixellab.md` |
| **Le catalogue des moteurs** — MOM, MO1 à MO8 | Chaque moteur d'IA décrit une seule fois (nom, ce qu'il sait faire, réglages, état) et lu par tous les outils ; une page « Moteurs » dans les Réglages. Né le 27 septembre 2026 : Qwen-Image 2.1 n'avait qu'un réglage dans « Repeindre » contre deux pour créer, parce que le même moteur était décrit à sept endroits | **ouvert le 27 septembre 2026, rien de fait** — l'auteur a choisi de tout ranger par étapes ; `PX11` y est reprise par `MO1` | `docs/PLAN-catalogue-des-moteurs.md` |

**226 critères d'acceptation cochés pour la V1 et la V2, 87 pour le lot U ; 3 879 essais de
serveur en 209 fichiers et 2 817 d'écran en 95** tiennent le dépôt — recomptés le 21 septembre
2026, et **aucun ne coûte un centime**.

**Ils se lancent en deux niveaux depuis le 20 septembre 2026 → `docs/essais.md`.** D'un seul
bloc, la suite serveur pèse 71 minutes de processeur, et une suite d'une heure ne se lance pas :
une largeur écrite dans un composant a fait échouer `tests/test_b0.py` trois séances durant sans
que personne le voie. `py essais/lancer_les_essais.py` la passe en **une dizaine de minutes sur
quatre processus** — quatre mesuré, pas choisi : à douze c'est à la fois plus lent et faux. Deux
marqueurs trient, `lent` pour les vingt-quatre essais qui lancent un processus extérieur et
`gardefou` pour les six qui balaient un dossier entier.

### Ce que la remise à plat a mesuré, le 13 septembre 2026

**Cinq relevés ont été faits le même jour**, et ils corrigent ce que la ligne « atelier unifié »
laissait croire. La maquette a bien été validée le 12 septembre ; **elle n'est pas implémentée**.

| Ce qu'on croyait | Ce qui est mesuré |
|---|---|
| la maquette est en place | **0 écran sur 26 tenu de bout en bout** — 22 en partie, 4 absents |
| *remesuré le 24 septembre 2026 (`RV16`)* | **1 écran sur 26 tenu** — 22 en partie, 3 absents ; sur les 39 surfaces, 4 / 32 / 4 au lieu de 1 / 32 / 6. Détail et écarts restants : `docs/releves/maquette-remesuree-2026-09-24.md` |
| les anciens écrans ont disparu | **30 écrans du produit** n'existent pas dans la maquette, et la plupart sont à garder |
| il y a peut-être des doublons | **4 paires d'écrans** font le même travail, et l'auteur atteint les deux côtés |
| certains écrans ne marchent plus | **2 fichiers morts**, 1 écran mort dans un fichier vivant, 7 morceaux morts |
| — | **80 désaccords de nom** entre la maquette et le produit |

Le serveur, lui, n'a aucun module mort : neuf routes sans écran et trois portes en double, c'est
tout. Le désordre est côté écran. Les preuves vivent dans les cinq relevés du 13 septembre
2026, listés en tête de `docs/PLAN-remise-a-plat.md`.

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
| Génération distante ou locale derrière des adaptateurs ; les workflows locaux restent dans des services externes configurés, sans modification implicite de leur installation. Le post-traitement courant reste CPU | révisé le 11 septembre 2026 |
| Une place de recette décrit **cette** image ; une fabrique en produit d'autres, et n'a pas d'état | E3 |
| Le carré d'une place se remplit quand elle **change l'image**, pas quand elle figure dans la recette | E3 |
| Une coordonnée ne voyage pas — ni cadre tracé, ni point de pipette, ni forme entourée, ni passage de la main | lot U |
| Une place s'éteint sans se vider : éteindre et vider ne sont pas le même geste | lot U |

### Le rangement

| L'invariant | Depuis |
|---|---|
| Les fichiers font foi, la base est un index reconstructible | T3 |
| **Une seule grille d'assets dans tout le produit** — la matrice d'une chose, la réserve, les dépenses et **la colonne des sœurs** n'en sont pas : ni recherche, ni filtres, ni sélection multiple | T3, *reformulé en E1, **amendé en `G12`** : la colonne des sœurs est une quatrième surface, et elle porte une sélection parce qu'elle est l'ensemble déjà sous les yeux ; **la toile est la cinquième, amendée en `RP9` pour la même raison*** |
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
| Une planche ne porte qu'une seule chose du jeu — **sauf quand la demande dit d'avance, case par case, quelle chose du jeu chaque case contient** : alors chaque morceau se range chez le sujet de sa case, ou se signale | E13, **révisé en `P2`** : la liste est la réponse ; sans elle, l'ancienne règle, inchangée |

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

## L'ordre historique → `docs/archive/ordre-historique-jusqu-au-10-septembre.md`

Cent soixante-dix lignes qui racontaient dans quel ordre l'existant a été construit, de `R6`
à la V3.1. Elles se disaient elles-mêmes remplacées depuis le 11 septembre 2026, et ce
document s'ouvre à chaque séance. **On les ouvre quand on veut savoir pourquoi une tranche
ancienne attendait une autre** — jamais pour décider de la suite.

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

> Différée par le cadrage du 11 septembre 2026, **ouverte par l'auteur le 18 septembre 2026**,
> une fois le chantier des références d'un sujet (RS1 à RS3) commité.
>
> Quel modèle sur quelle tranche : [PLAN-v35-affectation.md](PLAN-v35-affectation.md).

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

- [x] **Le premier dépliage reste automatique** : une planche qui revient bien ne demande aucun geste, ni avant ni après
- [x] **La géométrie s'écrit sur le pliage** au lieu d'être déduite du nombre de cases — sans quoi changer la formule redécouperait les planches anciennes de travers
- [x] Refaire un dépliage est un geste que l'auteur demande, et il repart des coupes proposées
- [x] Une coupe se déplace, s'ajoute et se retire à la main avant de valider un dépliage refait
- [x] Une planche se déplie plusieurs fois ; les dépliages coexistent sans se marcher dessus
- [x] Chaque image dit sa planche et son dépliage d'origine, et se remonte jusqu'à eux
- [x] Supprimer un dépliage n'emporte ni la planche ni les autres dépliages
- [x] Supprimer la planche demande confirmation et dit combien d'images en dépendent
- [x] Une planche reçue mais non dépliée à la fermeture se déplie seule au redémarrage, comme depuis `C2`
- [x] Aucun appel au fournisseur : déplier une planche déjà là marche réseau coupé

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

**Tranché par l'auteur le 18 septembre 2026, à l'ouverture de la version :**

- **Une case ratée se refait seule**, en image simple : les sept réussies ne sont pas repayées.
- **Les sujets se désignent par une liste numérotée**, dans l'ordre de lecture (« case 1 : …,
  case 2 : … ») ; un tirage payé la mettra à l'épreuve, prix annoncé d'abord.
- **Objets et équipement seulement** : des choses isolées, chacune dans sa case. Les décors et
  les tuiles qui se raccordent restent au chantier des tuiles.

Les trois questions telles qu'elles se posaient :

- **Ce que devient une case ratée** dans une planche de huit sujets. Refaire les huit, ou refaire
  la case seule dans une planche de un ?
- **Comment on désigne huit sujets en un texte** sans que le modèle les mélange. Le banc des
  planches a mesuré que *ce qu'on montre, le modèle le copie en entier* ; rien ne dit ce qu'il
  fait d'une liste de huit sujets différents.
- **Jusqu'où ça monte.** Les décors et les tuiles se raccordent entre eux, ce qui est le sujet de
  la V4. La frontière entre « huit objets sur une planche » et « des tuiles qui se raccordent »
  n'est pas tracée.

**Critères d'acceptation**

- [x] Une planche peut porter **plusieurs choses différentes du jeu**, et la demande dit d'avance ce que chaque case contient
- [x] Le découpage range chaque morceau à la place que la demande annonçait
- [x] Une case dont le sujet n'est pas celui annoncé **se signale** au lieu de se ranger de travers — *une case vide, en morceaux ou redessinée en quadrillage se signale seule ; un mauvais objet dans la bonne case, l'atelier ne le voit pas : c'est le geste « ce n'est pas le bon objet »*
- [x] Le prix par sujet s'affiche avant l'envoi, à côté du prix de la planche
- [x] L'ancienne règle continue de s'appliquer aux planches qui ne portent pas cette liste
- [x] Refaire le découpage d'une telle planche marche comme en `P1`

**Banc payé du 19 septembre 2026** (`docs/releves/2026-09-19-p2-planche-de-huit-objets.md`,
0,143 $) : huit planches de huit objets, 64 cases justes sur 64. Le modèle recentre une dernière
rangée incomplète une fois sur deux. **Tranché par l'auteur le même jour** : quand le calage par
centre rate mais que le compte est juste rangée par rangée, on range dans l'ordre de lecture.
L'écran de commande part désormais sur le défaut du jeu pour une planche, avec ses réglages.

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

**Ce que la V3 avait écarté ou laissé ouvert → `docs/archive/ordre-historique-jusqu-au-10-septembre.md`.**
Le pantin 2D et ses arguments, les outils de dessin remis à une version d'édition, la piste des
poses fixes par le moteur de la maison, et le risque de la recette d'animation — levé, réponse
négative, 141 planches et 6,03 $. Descendus le 15 septembre 2026 ; rien n'y est à faire.

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

