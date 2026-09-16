# Carte du serveur — 13 septembre 2026

Ce relevé décrit ce que le serveur (`atelier/`) sait faire : ses routes HTTP, ses outils pour l'agent Godot (MCP), et ce qui, chez lui, ne sert plus. Il ne touche pas à l'interface ni à `docs/maquettes-atelier-unifie/` — d'autres relevés couvrent ces sujets.

## En un coup d'œil

| | Nombre |
|---|---|
| Routes HTTP | **316** *(318 avant `RP18` puis `RP17`, le 16 septembre 2026)* |
| Outils MCP | 87 *(`RP17` retire `export_assets` et `export_character`, ajoute `preview_output` et `write_output` ; `RP20` avait déjà ajouté `save_render_as` et `preview_save_render_as`)* |
| Routes que l'interface n'appelle pas | **1** — `POST /strips/{id}/layer/align` (+ `/health`, à part — voir plus bas) |
| Doublons de capacité | 2 *(`RP17` a refermé le troisième)* |
| Modules plus importés (services/ + domaine/) | 0 |

Deux essais tombent pour une raison d'environnement, pas de code — voir la dernière section.

## Comment lire ce document

Le serveur a deux visiteurs : l'écran (par HTTP, préfixe `/api`) et l'agent qui code le jeu (par MCP, un protocole à part, monté sur `/mcp` dans le même programme). Une capacité écrite une fois côté service peut être servie aux deux, à un seul, ou avoir deux chemins différents pour le même effet — c'est ce que ce document trie.

Colonne « Appelée par l'interface ? » : vérifiée par lecture complète de `interface/src/api.ts` (7082 lignes) et des douze fichiers `interface/src/api-*.ts`, plus une recherche systématique dans le reste de `interface/src/` et dans `essais/`.

Colonne « Outil MCP équivalent ? » : un nom d'outil quand le même service est appelé des deux côtés ; « — » quand la route ne sert qu'à l'écran (le plus souvent : une image, un fichier binaire, ou un geste trop fin pour l'agent — l'agent travaille par gestes complets, pas par réglage de curseur).

## Les routes

### Le cœur : état, clé, installation, catalogue, générations, assets, recettes (`routes.py`, 57 routes depuis RP18)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /health | Dit si le serveur répond | Non — utilisée par le lanceur au démarrage | — |
| GET /status | Tout l'état de l'atelier, pour dessiner l'écran à l'ouverture | Oui | — |
| GET /events | Flux d'évènements en direct (génération, catalogue, chantier) | Oui | — |
| GET /settings/keys | Le tiroir à secrets, une place par fournisseur | Oui | — |
| PUT /settings/keys/{nom} | Dépose une clé de fournisseur | Oui | — |
| DELETE /settings/keys/{nom} | Retire une clé (les images restent) | Oui | — |
| GET /settings/agent | Les garde-fous et la consommation de l'agent | Oui | — |
| PUT /settings/agent | Change les garde-fous de l'agent, champ par champ | Oui | — |
| GET /install | Les quatre étapes de l'installation, en un aller-retour | Oui | — |
| POST /install/workspace/check | Vérifie si un dossier convient, sans rien écrire | Oui | — |
| PUT /install/workspace | Choisit le dossier de travail (effet au redémarrage) | Oui | — |
| POST /install/workspace/create | Crée un dossier vide | Oui | — |
| PUT /install/comfy | Change l'adresse de ComfyUI (effet immédiat) | Oui | — |
| DELETE /install/comfy | Revient à l'adresse de ComfyUI par défaut | Oui | — |
| POST /install/done | Marque le tour d'installation comme fait | Oui | — |
| POST /install/check/{fournisseur} | Vérifie qu'un compte fournisseur répond | Oui | — |
| GET /models | Le catalogue de modèles, grisé et raison compris, prix estimé | Oui | list_models |
| POST /models/refresh | Redemande le catalogue aux fournisseurs | Oui | refresh_models |
| POST /generations | Lance une génération payante, rend l'identifiant tout de suite | Oui | generate_asset (même service, entrée différente) |
| POST /prompt/preview | Le texte exact qui partirait, avant de lancer | Oui | — |
| POST /outgoing | Tout ce que l'écran de confirmation montre (texte, prix), sans rien payer | Oui | — |
| GET /outgoing/sheet | L'image du gabarit de planche joint à l'appel | Oui | — |
| GET /generations | Liste des générations récentes et le total dépensé | Oui | — |
| GET /generations/{id} | Une génération, avec ses emplacements | Oui | check_generation (même service) |
| POST /generations/{id}/slots/{rang}/retry | Relance un seul emplacement raté | Oui | — |
| POST /generations/{id}/slots/{rang}/unfold | Déplie une planche : garde certains sujets, écarte les autres | Oui | — |
| GET /generations/{id}/slots/{rang}/image | L'image brute d'un emplacement | Oui | — |
| GET /generations/{id}/slots/{rang}/download | Télécharge l'image en PNG | Oui | — |
| POST /assets/import | Fait entrer un fichier local (chemin disque) comme asset | Oui | import_asset (même service — voir doublons) |
| POST /assets/upload | Fait entrer une image envoyée par le navigateur | Oui | — (mêmes octets, même service que ci-dessus) |
| GET /assets | La grille de la bibliothèque, filtres et recherche. **Depuis RP11** : `tri` (`recent` · `ancien` · `nom`), `role` (`tous` · `origine` · `derivee` · `calque` · `equipement` · `seule`), `jugement` (`tous` · `favori` · `non-juge`) et `groupe`, qui ajoute `groupes` à la réponse. Une valeur hors liste retombe sur le défaut. `favoris=true` dit exactement `jugement=favori` | Oui | list_assets — mêmes valeurs, aux noms anglais `sort` · `role` · `judgement` · `group` |
| GET /assets/{id} | La fiche d'un asset | Oui | get_asset |
| GET /assets/{id}/imposed | Ce que le projet impose à cette image (taille, palette) | Oui | — |
| GET /assets/{id}/spots | Les zones mesurées sur l'image, pour le découpage | Oui | — |
| PUT /assets/{id}/recipe | Pose la recette de retouche d'un asset | Oui | edit_asset (grain plus fin côté écran) |
| POST /assets/{id}/recipe/preview | Aperçu d'un brouillon de recette, rien n'est enregistré | Oui | — |
| POST /assets/{id}/reset | Revient à l'image brute | Oui | — |
| POST /assets/{id}/apply/{nom} | Applique une recette nommée à cet asset | Oui | — |
| POST /assets/{id}/paste | Colle la recette copiée sur une autre image (filtrée) | Oui | — |
| GET /assets/{id}/image | L'image rendue (recette appliquée) ou brute | Oui | — |
| GET /assets/{id}/incoming | L'image telle qu'elle est arrivée du modèle | Oui | — |
| GET /assets/{id}/vignette | Miniature pour la grille | Oui | — |
| GET /assets/{id}/download | Téléchargement de l'asset | Oui | — |
| GET /assets/{id}/slices | Propose un découpage de l'image en plusieurs assets | Oui | — |
| POST /assets/{id}/slices | Découpe réellement l'image selon les boîtes données | Oui | slice_asset |
| GET /assets/{id}/mirror | Propose une direction de retournement | Oui | — |
| POST /assets/{id}/mirror | Retourne l'image, crée un nouvel asset | Oui | — |
| GET /assets/{id}/overlay | Ouvre la superposition de deux images | Oui | — |
| GET /assets/{id}/overlay/fit | Recale automatiquement deux images superposées | Oui | — |
| POST /assets/{id}/overlay/inherit | Hérite du détourage de l'image posée dessous | Oui | — |
| POST /overlay/preview | Aperçu d'une superposition, rien n'est enregistré | Oui | — |
| POST /overlay | Fabrique les images superposées, pour de vrai | Oui | — |
| PUT /assets/{id}/overlay | Rejoue une superposition avec de nouveaux réglages | Oui | — |
| DELETE /assets/{id}/overlay/saved | Oublie les réglages de superposition enregistrés | Oui | — |
| GET /recipes | Les recettes nommées, enregistrées par l'auteur | Oui | — |
| PUT /recipes/{nom} | Enregistre une recette sous un nom | Oui | — |
| DELETE /recipes/{nom} | Oublie une recette nommée | Oui | — |
| ~~GET /presets~~ | ~~Les jeux de réglages de génération nommés~~ | **retirée le 16 septembre 2026** (`RP18`) | — |
| ~~PUT /presets/{nom}~~ | ~~Enregistre un jeu de réglages sous un nom~~ | **retirée le 16 septembre 2026** (`RP18`) | — |
| ~~DELETE /presets/{nom}~~ | ~~Oublie un jeu de réglages~~ | **retirée le 16 septembre 2026** (`RP18`) | — |

### La bibliothèque (`bibliotheque.py`, 18 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /library | L'arbre : projets, collections, comptes, totaux | Oui | — (list_projects couvre une partie) |
| POST /library/rebuild | Relit tout le disque et refait l'index | Oui | rebuild_library |
| GET /journal | Le journal des appels d'un projet | Oui | — |
| GET /spending | Les dépenses, toutes générations confondues | Oui | get_budget (partiel) |
| POST /projects | Crée un nouveau jeu | Oui | — (aucun outil ne crée de projet, seulement list_projects) |
| PUT /projects/current | Change le jeu ouvert | Oui | — |
| PUT /projects/{id} | Renomme un jeu | Oui | — |
| DELETE /projects/{id} | Détache un jeu (les images restent sur le disque) | Oui | — |
| POST /collections | Crée une collection (dossier libre) | Oui | — |
| DELETE /collections/{id} | Supprime une collection (les sujets restent) | Oui | — |
| PUT /collections/{id}/members | Range un sujet dans une collection | Oui | — |
| DELETE /collections/{id}/members/{jeu}/{sujet} | Retire un sujet d'une collection | Oui | — |
| PUT /assets/arrangement | Range une sélection d'assets dans un projet | Oui | — |
| PUT /assets/favorite | Marque des assets favoris | Oui | — |
| POST /assets/delete | Supprime une sélection d'assets (annulable un temps) | Oui | — |
| POST /assets/restore | Annule une suppression récente | Oui | — |
| POST /exports | Exporte une sélection d'assets en archive ZIP | Oui | — *(`export_assets` retiré par `RP17`)* |
| GET /assets/{id}/lineage | D'où vient cet asset, et ce qui en descend | Oui | — |

### Le tableau d'inspiration et l'univers du projet (`univers.py`, 37 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /board | Le tableau entier : cartes, groupes, liens, teintes | Oui | — |
| POST /board/paste | Colle une image sur le tableau | Oui | — |
| POST /projects/{p}/board/assets/{asset} | Pose un asset de la bibliothèque sur le tableau | Oui | — |
| POST /projects/{p}/board/clips/{clip} | Pose un clip du jeu sur le tableau | Oui | — |
| POST /board/url | Colle une adresse web (l'image arrive par le flux) | Oui | — |
| POST /board/text | Crée une carte texte (note) | Oui | — |
| POST /board/links | Tire un lien entre deux objets du tableau | Oui | — |
| PUT /board/links/{lien} | Règle le mot et la pointe d'un lien | Oui | — |
| DELETE /board/links/{lien} | Coupe un lien | Oui | — |
| PUT /board/groups/tint | Teinte un îlot (groupe de cartes) | Oui | — |
| PUT /board/groups/move | Déplace un îlot entier, en un seul geste | Oui | — |
| POST /board/{carte}/retry | Relance une récupération d'image échouée | Oui | — |
| GET /board/{carte}/slices | Propose un découpage d'une carte | Oui | — |
| POST /board/{carte}/slices | Découpe une carte en plusieurs cartes | Oui | — |
| GET /board/{carte}/palette | Ce qu'une carte apporte à la palette du jeu | Oui | — |
| GET /board/{carte}/palette/image | Image de la carte, en magenta ce que la palette écarte | Oui | — |
| PUT /board/{carte} | Groupe, annote, redimensionne ou déplace une carte | Oui | — |
| PUT /board/{carte}/official | Promeut une carte en artwork officiel du jeu | Oui | — |
| DELETE /board/{carte} | Retire une carte du tableau | Oui | — |
| GET /board/{carte}/image | L'image d'une carte | Oui | — |
| GET /universe | La bible, le barème, la palette, les défauts du projet | Oui | — |
| PUT /universe | Change les réglages de l'univers (style, taille, couleurs, modèles) | Oui | — |
| GET /universe/views | Les vues et tailles de l'assistant de démarrage | Oui | — |
| GET /universe/consequences | Ce qu'un changement de taille casserait, avant de le faire | Oui | — |
| GET /labels | La base d'étiquettes (tous projets confondus) | Oui | — |
| POST /labels | Crée une étiquette | Oui | — |
| POST /labels/{id}/used | Compte un emploi d'étiquette | Oui | — |
| DELETE /labels/{id} | Oublie une étiquette (ce qu'elle a écrit reste) | Oui | — |
| POST /universe/realign | Réapplique la palette et la grille du projet, sans appel payant | Oui | realign_project |
| GET /moods | Les ambiances et palettes nommées du jeu | Oui | — |
| POST /palettes | Crée une palette nommée | Oui | — |
| PUT /palettes/{id} | Règle une palette (sources, nombre de couleurs, retouches) | Oui | — |
| DELETE /palettes/{id} | Supprime une palette | Oui | — |
| GET /palettes/{id}/preview | Aperçu d'une palette posée sur de vraies images | Oui | — |
| POST /moods | Crée une ambiance | Oui | — |
| PUT /moods/{id} | Règle une ambiance (palette, références, éclairage) | Oui | — |
| DELETE /moods/{id} | Supprime une ambiance (ce qui s'en servait retombe sur le jeu) | Oui | — |

### Les personnages, poses, directions, le vestiaire (`production.py`, 56 routes depuis RP17)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| POST /characters/poses | Ajoute une pose au plan du projet | Oui | — |
| PUT /characters/poses/{pose} | Renomme une pose ou change sa consigne | Oui | — |
| DELETE /characters/poses/{pose} | Retire une pose (les images faites restent) | Oui | — |
| GET /characters/directions | Les directions du jeu | Oui | — |
| POST /characters/directions | Ajoute une direction | Oui | — |
| POST /characters/directions/reset | Revient aux directions proposées par la vue du jeu | Oui | — |
| GET /characters/directions/proposal | Ce que déclarer des directions coûterait | Oui | — |
| POST /characters/directions/proposal | Ramène à une image les poses que la proposition nomme | Oui | — |
| DELETE /characters/directions/proposal | Annule la baisse : chaque pose retrouve ce qu'elle demandait | Oui | — |
| PUT /characters/directions/{direction} | Renomme une direction ou corrige sa consigne | Oui | — |
| DELETE /characters/directions/{direction} | Retire une direction du jeu | Oui | — |
| PUT /characters/poses/{pose}/directions/{direction} | Range ou dérange une direction pour une pose | Oui | — |
| GET /characters/{id}/sheet | Ce que la planche d'une pose enverrait, et son prix | Oui | — |
| GET /characters/{id}/calibration | Les poses d'une chose, leur boîte, la hauteur commune proposée | Oui | — |
| POST /characters/{id}/calibration | Pose la hauteur commune sur les poses retenues | Oui | — |
| PUT /characters/{id}/calibration/{pose} | Reprend le calage d'une pose à la main | Oui | — |
| PUT /characters/{id}/calibration/{pose}/aside | Sort une pose du calage commun, ou l'y remet | Oui | — |
| GET /characters/{id}/style | Les textes qui habillent une chose, et d'où chacun vient | Oui | — |
| GET /characters/{id}/references | Les images de référence disponibles pour une chose | Oui | — |
| PUT /characters/{id}/references | Fait d'une image une référence permanente, ou cesse de l'être | Oui | — |
| PUT /characters/{id}/reference-image | Choisit l'**image de référence** de la fiche d'un sujet — `asset: null` la retire (`RP19`) | Oui | `list_characters`, en lecture seule |
| GET /characters/showcase | La vitrine du jeu entier : fonds, taille commune | Oui | — |
| GET /characters/{id}/showcase | La vitrine d'une chose | Oui | — |
| GET /characters/types | Les poses attendues par type d'objet, et d'où la liste vient | Oui | — |
| PUT /characters/types/{type}/poses | Écrit la liste de poses d'un type | Oui | — |
| DELETE /characters/types/{type}/poses | Le type revient à la liste proposée par défaut | Oui | — |
| GET /characters/search | Cherche un sujet par nom ou description, dans tout le projet | Non — la barre cherche en mémoire | `list_characters(search=…)`, depuis `RP18` |
| GET /characters/families/{famille} | La grille d'une famille de sujets, paginée | Oui | — |
| GET /characters | Le plan de poses et les personnages du jeu | Oui | — |
| GET /dashboard | La complétude par famille, ce qui manque le plus, le prix du lot | Oui | — |
| POST /characters | Crée un personnage | Oui | create_character |
| GET /characters/{id}/objective | L'objectif de production d'un personnage | Oui | get_character_objective |
| PUT /characters/{id}/objective | Définit l'objectif de production | Oui | set_character_objective |
| PUT /characters/{id} | Règle un personnage (nom, description, poses, ambiance…) | Oui | — |
| GET /characters/{id}/unplaced | Ce qui est fait pour ce sujet sans occuper de case (images, clips, animations) | Oui | — |
| DELETE /characters/{id} | Supprime un personnage (ses images restent, marquées) | Oui | — |
| PUT /assets/{id}/character | Désigne cette image comme le corps d'une case | Oui | — |
| POST /characters/slots | Ajoute un emplacement au vestiaire | Oui | — |
| POST /characters/slots/suggested | Pose les six emplacements proposés par l'atelier | Oui | — |
| PUT /characters/slots/{id} | Renomme un emplacement, ou le déplace dans l'ordre | Oui | — |
| DELETE /characters/slots/{id} | Retire un emplacement (les pièces restent) | Oui | — |
| GET /characters/pieces/uses | Le vestiaire résolu du jeu (pièces, emplois, comptes) | Oui | — |
| GET /characters/pieces/{id}/animations/{porteur} | La matrice des calques animés d'un emploi | Oui | — |
| GET /characters/pieces/{id}/wearers | Sur quels personnages cette pièce est posée | Oui | — |
| POST /characters/pieces | Décrit une pièce d'équipement | Oui | edit_equipment_definition (même objet, pièce = définition) |
| PUT /characters/pieces/{id} | Règle une pièce (nom, description, portée) | Oui | edit_equipment_definition |
| DELETE /characters/pieces/{id} | Retire une pièce (ses calques restent) | Oui | — |
| POST /characters/pieces/{id}/uses | Ajoute un emploi (une façon de plus dont la pièce sert) | Oui | — |
| PUT /characters/pieces/{id}/uses/{emploi} | Règle un emploi (jamais son porteur) | Oui | — |
| DELETE /characters/pieces/{id}/uses/{emploi} | Retire un emploi (ses images restent) | Oui | — |
| PUT /assets/{id}/layer | Pose, déplace ou retire le masque rectangle d'un calque | Oui | — |
| PUT /assets/{id}/hand | Pose une couche de retouche à la main sur un calque | Oui | — |
| POST /assets/{id}/realign | Rejoue le recalage de la planche dont l'image est sortie | Oui | — |
| POST /characters/subject | Le sujet qu'une case demande au modèle | Oui | — |
| POST /characters/{id}/strips/export | Toutes les animations d'un personnage, en une archive | Oui | — |
| PUT /references | Décoche une référence, pour un personnage ou tout le projet | Oui | — |

### Les mouvements, clips, le montage, les bandes (`animation.py`, 47 routes depuis RP18)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /movements | La bibliothèque de mouvements, commune à tous les jeux | Oui | — |
| GET /movements/for-pose/{id} | Le mouvement qui partirait pour animer cette pose | Oui | — |
| POST /movements | Crée un mouvement (texte, cadence, directions) | Oui | — |
| PUT /movements/{id} | Renomme ou retouche un mouvement | Oui | — |
| DELETE /movements/{id} | Retire un mouvement de la liste | Oui | — |
| POST /movements/{id}/show | Remontre un mouvement masqué | Oui | — |
| GET /clips/models | Les modèles vidéo et le prix du jour pour ce réglage | Oui | — |
| POST /clips/models/refresh | Redemande le catalogue vidéo aux fournisseurs | Oui — écran du clip, quand la liste est vide (`RP18`) | — |
| GET /clips/engine | Ce que le moteur vidéo de la maison peut faire aujourd'hui | Oui | — |
| POST /clips/engine/download | Rapatrie les fichiers manquants au moteur de la maison | Oui | — |
| POST /clips | Commande un lot de clips payants | Oui | — (voir doublons : même moteur que les travaux de production) |
| GET /clips/start-image | Ce qu'un clip prendrait au départ, et pourquoi celle-là | Oui | — |
| POST /clips/keep | Garde un clip, écarte les autres | Oui | — |
| POST /clips/restore | Remontre ce qu'on avait écarté | Oui | — |
| POST /clips/import | Une vidéo qui vient d'ailleurs entre comme clip | Oui | import_clip |
| POST /clips/sheet | Une feuille de sprites montée en animation — ou, depuis RP21, une carte de la toile à la place de la feuille | Oui | animate_sheet (feuille seulement) |
| POST /clips/assemble | RP21 — une sélection d'images fixes déjà en bibliothèque devient une bande, sans découpe | Oui | — |
| GET /clips | Les clips gardés d'un jeu | Oui | — |
| GET /clips/pending | Les clips payés ou peut-être payés, en attente d'un geste | Oui | — |
| POST /clips/{id}/recover | Rapatrie un clip déjà payé | Oui | — |
| GET /clips/{id}/video | Le fichier vidéo tel qu'il est arrivé | Oui | — |
| GET /clips/{id}/frames/{numero} | Une image prélevée dans le clip, par son numéro | Oui | — |
| GET /clips/{id}/cover | La couverture d'un clip pour une case de grille | Oui | — |
| POST /clips/{id}/frames/{numero}/pick | Met une image du clip de côté, en bibliothèque | Oui | — |
| POST /strips/{id}/frames/{rang}/pick | Taille une bande de plus dans ce clip | Oui | — |
| POST /montage/preview | La bande montée, sans rien écrire | Oui | — |
| GET /montage/{id} | Tout ce que l'écran de montage demande, en un aller-retour | Oui | — |
| GET /montage/{id}/contact | Toutes les images du clip en une seule, en grille | Oui | — |
| POST /montage/{id}/frame | Remesure la fenêtre commune sur toutes les images du clip | Oui | — |
| GET /strips | Les bandes taillées dans un clip | Oui | — |
| POST /strips | Une bande de plus, taillée dans ce clip | Oui | — |
| POST /strips/export | Une sélection d'animations sort en une archive | Oui | — |
| PUT /strips/favorite | Marque des bandes favorites | Oui | — |
| POST /strips/delete | Écarte une sélection de bandes (annulable un temps) | Oui | — |
| POST /strips/restore | Annule un écart récent | Oui | — |
| POST /strips/{id}/layer | Pose le calque d'une pièce sur chaque image d'une animation | Oui | — |
| PUT /strips/{id}/layer | Règle un calque animé (il tient, ou il glisse) | Oui | — |
| POST /strips/{id}/layer/align | Cale un calque animé à la main, et garde le réglage | Non — son seul appelant, `calerLeCalqueAnime` dans `interface/src/api.ts`, n'est employé par aucun composant (voir *Ce qui est parti*) | — |
| ~~DELETE /strips/{id}/layer/align~~ | ~~Oublie le calage d'un calque animé~~ | **retirée le 16 septembre 2026** (`RP18`) | — |
| GET /strips/{id}/layer/preview | Aperçu d'un calque animé | Oui — écran *Ses animations, image par image* (`RP18`) | — |
| DELETE /strips/{id}/layer | L'habillage s'en va, le corps et le calque restent | Oui | — |
| PUT /strips/{id}/case | La case du plan que cette bande remplit — ou plus aucune | Oui | — |
| PUT /strips/{id}/name | Renomme une bande | Oui | — |
| DELETE /strips/{id} | La bande s'en va, le clip et ses images restent | Oui | — |
| GET /strips/{id} | Une animation gardée, rouverte avec tous ses réglages | Oui | — |
| PUT /strips/{id} | Une correction posée sur une animation gardée | Oui | — |
| POST /strips/{id}/frame | Remesure la fenêtre d'une animation gardée | Oui | — |
| GET /strips/{id}/sheet | La planche de sprites d'une bande gardée | Oui | — |

### La barre d'actions (`gestes.py`, 1 route)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /actions | Ce que la barre peut proposer maintenant — dérivé en direct de la liste des outils MCP | Oui | — (elle *lit* la liste des outils, voir plus bas) |

### La sortie (`sortie.py`, 3 routes — B21, `RP17`)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /output/settings | Les listes fermées de la sortie, ses sujets, et la fois d'avant | Oui | — |
| POST /output/preview | Ce qui sortirait, et pas un octet n'est écrit | Oui | preview_output |
| POST /output | Écrit la sortie pour de vrai, rend le compte rendu | Oui | write_output |

### La livraison vers Godot — animations (`livraison.py`, 8 routes) et images (`livraison_images.py`, 2 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /projects/{p}/godot-link | Le projet Godot lié à ce jeu | Oui | — |
| PUT /projects/{p}/godot-link | Lie ce jeu à un dossier Godot | Oui | link_godot_project |
| GET /projects/{p}/delivery-animations | Les animations livrables d'un jeu | Oui | list_animation_deliveries |
| GET /projects/{p}/deliveries | L'historique des livraisons vers Godot | Oui | — |
| POST /projects/{p}/deliveries/preview | Prépare une livraison d'animations sans écrire dans le jeu | Oui | preview_animation_delivery |
| POST /projects/{p}/deliveries | Publie une livraison préparée dans le projet Godot | Oui | publish_animation_delivery |
| POST /projects/{p}/deliveries/{jeton}/preview | Relit une livraison déjà publiée | Oui | preview_delivery_revision |
| POST /projects/{p}/deliveries/{jeton}/decisions | Décide d'un conflit — conserver, copier à côté, remplacer (`RP10`) | Oui — écran *Livrer au jeu* | — |
| GET /projects/{p}/characters/{s}/delivery-images | Les images livrables d'un personnage | Oui | list_image_delivery_versions |
| POST /projects/{p}/image-deliveries/preview | Prépare la livraison d'une image fixe vers Godot | Oui | preview_image_delivery |

### Les tuiles (`tuiles.py`, 9 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /projects/{p}/tilesets | Liste les ensembles de tuiles d'un projet | Oui | list_tile_sets |
| POST /projects/{p}/tilesets | Crée un ensemble de tuiles depuis une image du projet | Oui | create_tile_set |
| GET /projects/{p}/tilesets/{id} | Lit un ensemble de tuiles (ou une révision) | Oui | read_tile_set |
| PUT /projects/{p}/tilesets/{id} | Enregistre une nouvelle révision (terrains, cellules, carte de test) | Oui | update_tile_set |
| POST /projects/{p}/tilesets/{id}/restore | Restaure une révision passée | Oui | restore_tile_set_revision |
| GET /projects/{p}/tilesets/{id}/preview.png | L'image de l'atlas ou de la carte de test | Oui | — |
| POST /projects/{p}/tilesets/{id}/tiles/{x}/{y}/extract | Copie une case de l'atlas en bibliothèque, pour la retoucher | Oui | extract_tile_for_editing |
| GET /projects/{p}/tilesets/{id}/export.zip | Archive ZIP de l'ensemble de tuiles | Oui | — |
| POST /projects/{p}/tilesets/{id}/delivery/preview | Prépare la livraison des tuiles vers Godot | Oui | preview_tile_delivery |

### Les sons (`sons.py`, 11 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /projects/{p}/sounds | Liste les sons d'un projet | Oui | list_sounds |
| POST /projects/{p}/sounds/import | Importe un fichier audio local | Oui | import_sound |
| GET /projects/{p}/sounds/{id} | Lit un son (ou une révision passée) | Oui | get_sound |
| PUT /projects/{p}/sounds/{id} | Enregistre une nouvelle révision (recette de retouche) | Oui | edit_sound |
| POST /projects/{p}/sounds/{id}/restore | Restaure une ancienne révision | Oui | restore_sound |
| POST /projects/{p}/sounds/{id}/judgment | Juge une révision : à juger / retenue / écartée | Oui | judge_sound |
| GET /projects/{p}/sounds/{id}/source | Le fichier audio source, tel quel | Oui | — |
| GET /projects/{p}/sounds/{id}/preview.wav | Le son rendu (recette appliquée), en WAV | Oui | — |
| GET /projects/{p}/sounds/{id}/waveform | La forme d'onde, pour l'affichage | Oui | — |
| GET /projects/{p}/sounds/{id}/export.zip | Archive ZIP du son | Oui | — |
| POST /projects/{p}/sounds/{id}/delivery/preview | Prépare la livraison du son vers Godot | Oui | preview_sound_delivery |

### Les tenues (`tenues.py`, 9 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET .../outfits | Liste les tenues d'un personnage | Oui | list_character_outfits |
| POST .../outfits | Compose une tenue (calques et emplois choisis) | Oui | create_character_outfit |
| GET .../outfits/{id} | Lit une tenue (ou une révision) | Oui | get_character_outfit |
| PUT .../outfits/{id} | Enregistre une nouvelle révision de la tenue | Oui | edit_character_outfit |
| POST .../outfits/{id}/refresh | Capture les calques actuels dans une nouvelle révision | Oui | refresh_character_outfit |
| GET .../outfits/{id}/preview.png | L'image composée d'une tenue, pour une frame donnée | Oui | — |
| POST .../outfits/{id}/restore | Restaure une ancienne révision de la tenue | Oui | restore_character_outfit |
| GET .../outfits/{id}/export.zip | Archive ZIP de la tenue (calques ou assemblée) | Oui | — |
| POST .../outfits/{id}/delivery/preview | Prépare la livraison de la tenue vers Godot | Oui | preview_outfit_delivery |

(chemins abrégés : `/projects/{p}/characters/{s}/outfits`)

### Les travaux de production (`travaux.py`, 9 routes ; `travaux_equipement.py`, 7 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /projects/{p}/delegation | Le cadre de délégation à l'agent (modèles, plafonds) | Oui | — |
| PUT /projects/{p}/delegation | Change le cadre de délégation à l'agent | Oui | — |
| GET /projects/{p}/production-jobs | Liste les travaux de production, en cours et passés | Oui | — |
| POST /projects/{p}/production-jobs/preview | Prépare un travail (image + vidéo + bande) sans le lancer | Oui | request_character_animation |
| POST .../production-jobs/{id}/start | Lance un travail préparé | Oui | request_character_animation |
| POST .../production-jobs/{id}/resume | Reprend un travail interrompu | Oui | resume_animation_production |
| GET .../production-jobs/{id} | Suit l'état d'un travail (avec attente optionnelle) | Oui | get_animation_production |
| GET .../production-jobs/{id}/references/{rang} | Une image de référence utilisée par ce travail | Oui — *Fabrication suivie* la rend par l'adresse que le serveur lui donne | — |
| GET .../production-jobs/{id}/video-reference | L'image de départ d'une vidéo en cours | Oui — *Fabrication suivie* et *Fabrication libre*, même chemin | — |
| GET .../equipment/{piece}/uses/{emploi}/coverage | Ce qui manque à un emploi d'équipement | Oui | get_equipment_coverage |
| POST .../equipment/.../jobs/preview | Prépare la fabrication des images équipées | Oui | preview_equipment_production |
| GET .../equipment/.../jobs/{id}/bases/{rang} | L'image de base d'un appel d'équipement | Oui | — |
| GET .../equipment/.../jobs/{id}/references/{rang}/{ref} | Une référence envoyée à un appel d'équipement | Oui | — |
| POST .../equipment/.../jobs/{id}/cancel | Arrête les appels restants d'un travail d'équipement | Oui | cancel_equipment_production |
| GET .../equipment/.../jobs/{id}/retours/{rang} | L'image revenue d'un appel d'équipement | Oui | — |
| POST .../equipment/.../jobs/{id}/sheets/{appel}/confirm | Confirme le découpage d'une planche d'équipement reçue | Oui | — |

### Les workflows locaux et la file locale (`workflows.py`, 7 routes ; `file_locale.py`, 4 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /workflow-profiles | Liste les profils de workflow ComfyUI importés | Oui | list_workflow_profiles |
| POST /workflow-profiles | Importe un profil de workflow (fichier ComfyUI) | Oui | — |
| GET /workflow-profiles/{id}/versions/{v} | Lit une version précise d'un profil | Oui | — |
| POST .../versions/{v}/diagnose | Vérifie les nœuds et modèles requis par un workflow | Oui | diagnose_workflow_profile |
| POST /projects/{p}/workflow-image-jobs/prepare | Prépare une image locale (ComfyUI) sans la lancer | Oui | prepare_workflow_image |
| POST /projects/{p}/free-video-jobs/prepare | Prépare un clip libre (sans personnage ni pose) | Oui | prepare_free_video |
| POST /projects/{p}/audio-jobs/prepare | Prépare un bruitage local | Oui | prepare_audio |
| GET /local-queue | La file locale : étapes GPU possédées, et leurs mesures | Oui | get_local_queue |
| GET /local-queue/engines | L'état des moteurs GPU locaux détectés | Oui | — |
| POST /local-queue/{id}/resume | Reprend le suivi d'une étape locale | Oui | resume_local_stage |
| POST /local-queue/{id}/cancel | Annule une étape locale avant soumission | Oui | cancel_local_stage |

### Les calques d'équipement ciblés — AU15 (`calques_cibles.py`, 12 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET .../targets | Les cibles exactes (images/frames) d'un emploi d'équipement | Oui | list_equipment_targets |
| GET .../targets/preview.png | L'image d'une cible d'équipement | Oui | — |
| POST .../layers | Associe une image de bibliothèque à une cible | Oui | create_equipment_layer |
| GET .../layers/{id} | Lit une variante de calque d'équipement | Oui | get_equipment_layer |
| PUT .../layers/{id} | Corrige le placement ou les masques d'un calque | Oui | edit_equipment_layer |
| POST .../layers/{id}/extract | Extrait un calque transparent par différence CPU | Oui | extract_equipment_layer |
| POST .../layers/{id}/validate | Retient un calque après vérification visuelle | Oui | validate_equipment_layer |
| GET .../layers/{id}/alignment | Propose un calage automatique pour un calque | Oui | — |
| POST .../layers/{id}/reuse | Réemploie un calque sur d'autres cibles | Oui | reuse_equipment_layer |
| POST .../layers/{id}/adopt | Rattache un calque à une nouvelle base (frame changée) | Oui | adopt_equipment_layer_base |
| GET .../layers/{id}/preview.png | L'image composée d'un calque | Oui | — |
| POST .../layers/{id}/preview.png | Aperçu d'un brouillon de calque (placement/masques en cours) | Oui | — |

(chemins abrégés : `/projects/{p}/equipment/{piece}/uses/{emploi}`)

### Le pont 3D (`sources_3d.py`, 15 routes)

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| GET /3d/connection | L'adresse du pont asset3d, et si elle est configurée | Oui | — |
| PUT /3d/connection | Change l'adresse du pont asset3d | Oui | — |
| GET /3d/catalogue | Le catalogue 3D : moteurs, animations, angles, styles, bornes | Oui | get_asset3d_catalogue |
| POST /projects/{p}/3d/jobs/prepare | Prépare une étape 3D (modèle, rig ou rendu) | Oui | prepare_3d_stage |
| POST /projects/{p}/3d/jobs/{t}/reconcile | Retrouve une soumission 3D perdue, sans la relancer | Oui | reconcile_3d_stage |
| GET /projects/{p}/3d/jobs/{t}/files/{nom} | Un fichier (GLB/image) produit par une étape 3D | Oui | — |
| GET /3d/characters | Les personnages connus du moteur 3D externe | Oui | list_asset3d_characters |
| GET /3d/characters/{p}/renders | Les rendus 3D existants d'un personnage | Oui | list_asset3d_renders |
| GET /3d/characters/{p}/corrections | Les corrections de squelette d'un personnage 3D | Oui | get_asset3d_rig_corrections |
| PUT /3d/characters/{p}/corrections | Enregistre des corrections de squelette | Oui | set_asset3d_rig_corrections |
| GET /3d/characters/{p}/rig | Aperçu GLB en direct du squelette corrigé | Oui | — |
| GET /3d/characters/{p}/preview | Photo d'aperçu d'un personnage 3D externe | Oui | — |
| GET /projects/{p}/3d/sources | Les sources 3D copiées dans ce jeu | Oui | list_3d_sources |
| POST /projects/{p}/3d/import | Copie un rendu 3D existant dans ce jeu | Oui | import_asset3d_render |
| GET /projects/{p}/3d/sources/{s}/files/{nom} | Un fichier d'une source 3D copiée | Oui | — |

### Enregistrer sous — un rendu devient une autre case (`enregistrer_sous.py`, 4 routes depuis RP20)

Deux par calque, et la coupure est celle du miroir : ce qui ne crée rien se redemande à chaque ouverture de fenêtre, ce qui crée un objet ne se redemande jamais. La proposition est un `POST` et non un `GET` parce qu'elle emporte **la recette en cours**, celle que l'écran tient et qui n'est pas forcément enregistrée.

| Verbe et chemin | Ce qu'elle fait | Appelée par l'interface ? | Outil MCP équivalent ? |
|---|---|---|---|
| POST /assets/{id}/save-as/preview | Propose la case d'arrivée d'une image, sans rien écrire | Oui | preview_save_render_as |
| POST /assets/{id}/save-as | Le rendu devient une image neuve, dans une autre case | Oui | save_render_as |
| POST /strips/{id}/save-as/preview | La même proposition, pour une animation | Oui | preview_save_render_as |
| POST /strips/{id}/save-as | Chaque frame rendue devient un clip neuf et sa bande | Oui | save_render_as |

## Les outils de l'agent Godot

87 outils, exposés par le serveur MCP monté dans le même programme que l'API HTTP (`atelier/mcp/serveur.py` + 12 fichiers `atelier/mcp/*.py`). Chaque outil déclare lui-même, dans sa fiche, l'écran de l'atelier qui offre la même capacité (`"ou": "..."` dans le code) — c'est cette déclaration, et pas une supposition, qui remplit la colonne ci-dessous.

### Générer, retrouver, retoucher (21 outils, `atelier/mcp/serveur.py`)

| Outil | Ce qu'il fait | Même capacité côté écran ? |
|---|---|---|
| generate_asset | Génère une image depuis une description courte, applique l'univers du projet | Ouvre l'écran d'envoi — ne paie pas depuis la barre |
| check_generation | Suit une génération lancée par generate_asset | Oui — écran galerie (chantier) |
| list_projects | Liste les jeux (projets) de l'atelier | Oui — écran jeux |
| list_assets | Liste les assets, avec filtres | Oui — écran galerie |
| get_asset | Lit la fiche d'un asset | Oui — écran galerie |
| list_models | Le catalogue de modèles disponibles | Oui — écran réglages |
| import_asset | Fait entrer un fichier local comme asset | Oui — écran galerie |
| import_clip | Fait entrer une vidéo locale comme clip | Oui — écran galerie |
| edit_asset | Retouche la recette d'un asset (recadrage, couleurs, détourage) | Oui — écran galerie |
| slice_asset | Découpe une image en plusieurs assets | Oui — écran galerie |
| animate_sheet | Monte une feuille de sprites en clip et en bandes | Oui — écran galerie |
| preview_output | Ce qui serait écrit dans le dossier du jeu, marque par marque — rien n'est posé | Oui — écran *Livrer au jeu › Exporter des fichiers* |
| write_output | Écrit dans le dossier du jeu ce que l'aperçu annonçait | Oui — le même écran |
| list_characters | Liste les personnages/objets d'un jeu — et, depuis `RP19`, l'**image de référence** de chacun, en lecture seule : aucun outil ne la choisit. Depuis `RP18`, un terme `search` restreint la liste aux sujets dont le nom ou la description répond, par `GET /characters/search` | Oui — codex |
| add_pose | Ajoute une pose au plan du projet | Oui — univers |
| generate_pose | Génère une planche remplissant une ou plusieurs poses | Ouvre l'écran d'envoi |
| equip_character | Associe une pièce d'équipement à un personnage | Oui — codex |
| get_budget | Le budget et la consommation de l'agent | Oui — dépenses |
| rebuild_library | Reconstruit l'index de la bibliothèque depuis le disque | Oui — POST /api/library/rebuild |
| realign_project | Réapplique palette et grille à tout un jeu, sans appel payant | Oui — POST /api/universe/realign |
| refresh_models | Relit le catalogue chez les fournisseurs | Oui — POST /api/models/refresh |

### Équipement, tenues, tuiles, sons, 3D, workflows locaux, livraison (66 outils)

| Outil | Ce qu'il fait | Même capacité côté écran ? |
|---|---|---|
| edit_equipment_definition | Nom, apparence et références partagées d'une pièce d'équipement | Oui — écran équipements |
| list_equipment_targets | Les cibles exactes (images/frames) d'un emploi | Oui — écran équipements |
| get_equipment_layer | Lit une variante de calque d'équipement | Oui — écran équipements |
| create_equipment_layer | Attache une image de bibliothèque à une cible précise | Oui — écran équipements |
| edit_equipment_layer | Corrige le placement ou les masques d'un calque | Oui — écran équipements |
| extract_equipment_layer | Extrait un calque transparent par différence CPU | Oui — écran équipements |
| adopt_equipment_layer_base | Rattache un calque à une base changée | Oui — écran équipements |
| validate_equipment_layer | Retient un calque après vérification visuelle | Oui — écran équipements |
| reuse_equipment_layer | Réemploie un calque sur une sélection de cibles | Oui — écran équipements |
| get_local_queue | Lit la file locale (étapes GPU possédées) | Oui — écran fabrications |
| resume_local_stage | Reprend le suivi d'une étape locale existante | Oui — écran fabrications |
| cancel_local_stage | Annule une étape locale avant soumission | Oui — écran fabrications |
| list_animation_deliveries | Les animations livrables d'un jeu | Oui — écran sortie |
| link_godot_project | Lie le jeu à un dossier de projet Godot | Oui — écran sortie |
| preview_animation_delivery | Prépare une livraison d'animations, sans écrire | Oui — écran sortie |
| publish_animation_delivery | Publie une livraison préparée dans le projet Godot | Oui — écran sortie |
| preview_delivery_revision | Relit une livraison déjà publiée | Oui — écran sortie |
| list_image_delivery_versions | Les images livrables d'un personnage | Oui — écran sortie |
| preview_image_delivery | Prépare la livraison d'une image fixe vers Godot | Oui — écran sortie |
| get_character_objective | Lit l'objectif de production d'un personnage | Oui — codex |
| set_character_objective | Définit l'objectif de production | Oui — codex |
| create_character | Crée un personnage | Oui — codex |
| list_sounds | Liste les sons d'un projet | Oui — galerie |
| get_sound | Lit un son (révision, mesures, jugement) | Oui — galerie |
| import_sound | Importe un fichier audio local | Oui — galerie |
| edit_sound | Enregistre une nouvelle révision (recette de son) | Oui — galerie |
| restore_sound | Restaure une ancienne révision sonore | Oui — galerie |
| judge_sound | Juge une révision sonore (retenue/écartée) | Oui — galerie |
| preview_sound_delivery | Prépare la livraison d'un son vers Godot | Oui — galerie |
| list_3d_sources | Les sources 3D copiées dans un jeu | Oui — fabrications |
| get_asset3d_catalogue | Le catalogue du moteur 3D configuré | Oui — fabrications |
| get_asset3d_rig_corrections | Les corrections de squelette d'un personnage externe | Oui — fabrications |
| set_asset3d_rig_corrections | Enregistre des corrections de squelette | Oui — fabrications |
| list_asset3d_characters | Les personnages connus du moteur 3D externe | Oui — fabrications |
| list_asset3d_renders | Les rendus 3D existants d'un personnage | Oui — fabrications |
| import_asset3d_render | Copie un rendu 3D existant dans le jeu | Oui — fabrications |
| prepare_3d_stage | Prépare une étape 3D locale, sans la lancer | Oui — fabrications |
| reconcile_3d_stage | Retrouve une soumission 3D perdue | Oui — fabrications |
| list_character_outfits | Liste les tenues sauvegardées d'un personnage | Oui — équipements |
| create_character_outfit | Compose une tenue (calques et emplois retenus) | Oui — équipements |
| get_character_outfit | Lit une tenue sauvegardée (ou une révision) | Oui — équipements |
| edit_character_outfit | Enregistre une nouvelle révision de tenue | Oui — équipements |
| refresh_character_outfit | Capture les calques actuels dans une nouvelle révision | Oui — équipements |
| restore_character_outfit | Restaure un ancien instantané de tenue | Oui — équipements |
| preview_outfit_delivery | Prépare le paquet Godot d'une tenue | Oui — équipements |
| get_animation_production | Suit l'état d'un travail d'animation demandé | Oui — fabrications |
| request_character_animation | Demande une animation complète (image + vidéo + bande) | Oui — fabrications |
| resume_animation_production | Reprend le suivi d'une animation interrompue | Oui — fabrications |
| get_equipment_coverage | Ce qui manque en images/calques pour un emploi | Oui — fabrications |
| preview_equipment_production | Prévoit les images équipées à fabriquer | Oui — fabrications |
| start_equipment_production | Lance la fabrication des images équipées | Oui — fabrications |
| cancel_equipment_production | Arrête les appels d'équipement restants | Oui — fabrications |
| list_tile_sets | Liste les ensembles de tuiles d'un projet | Oui — sortie |
| read_tile_set | Lit un ensemble de tuiles (ou une révision) | Oui — sortie |
| create_tile_set | Crée un atlas carré depuis une image existante | Oui — sortie |
| update_tile_set | Enregistre une nouvelle révision (terrains, cellules) | Oui — sortie |
| extract_tile_for_editing | Copie une cellule de l'atlas pour la retoucher | Oui — sortie |
| restore_tile_set_revision | Restaure un instantané de tuiles passé | Oui — sortie |
| preview_tile_delivery | Prépare les fichiers Godot natifs d'un tileset | Oui — sortie |
| list_workflow_profiles | Liste les profils de workflow local importés | Oui — fabrications |
| diagnose_workflow_profile | Vérifie les nœuds/modèles ComfyUI requis | Oui — fabrications |
| prepare_workflow_image | Prépare une image locale, sans la soumettre | Oui — fabrications |
| prepare_free_video | Prépare un clip libre (sans personnage ni pose) | Oui — fabrications |
| prepare_audio | Prépare un bruitage local, sans le lancer | Oui — fabrications |
| preview_save_render_as | Dit où le rendu courant se rangerait, sans rien créer | Oui — ici |
| save_render_as | Garde le rendu courant sous une autre pose ou direction | Oui — ici |

Remarque : les fiches déclarent une correspondance d'écran pour les **87** outils — aucun outil MCP n'est orphelin de l'écran. C'est l'inverse (des routes HTTP sans outil MCP) qui existe, et c'est attendu : l'agent travaille par gestes complets (« équipe ce personnage »), l'écran doit aussi savoir dessiner une vignette ou déplacer un curseur — deux choses qu'un agent de code n'a pas à faire.

## Les doublons de capacité

### Faire entrer une image dans la bibliothèque

- **Chemin A** : `POST /assets/import` — un chemin de fichier sur le disque (utilisé par l'agent et par `import_asset`).
- **Chemin B** : `POST /assets/upload` — des octets envoyés par le navigateur (glisser-déposer à l'écran).
- **Ce qui les sépare** : rien, côté fabrication — la docstring de `importer_asset` le dit explicitement : *« l'un et l'autre passent par `ServiceGenerations.importer`, et c'est ça qui garantit que ce que l'agent peut faire, l'écran le peut aussi »*. Les deux routes existent parce qu'un agent a un chemin de fichier et qu'un navigateur n'en a jamais un — c'est une différence d'entrée, pas une capacité dupliquée. Rien à corriger ici.

### Faire sortir un personnage du jeu — **refermé le 16 septembre 2026 (`RP17`)**

Il n'y a plus qu'une porte. Ce qui suit est ce qu'elle a remplacé, et ce qui l'accompagne.

- **Ce qui est parti** : `POST /characters/{id}/export` — un personnage nommé écrit directement dans le dossier du jeu, sans aperçu et sans comparaison. Avec elle, les outils MCP `export_character` et `export_assets`, et le bouton *Poser dans le dossier du jeu* de la fiche du sujet.
- **Ce qui reste** : `POST /output`, précédée de `POST /output/preview` et de `GET /output/settings` — l'écran *Livrer au jeu › Exporter des fichiers*. Elle montre chaque fichier avec sa marque (`nouveau`, `remplace`, `inchangé`) avant d'écrire, et dit ce que la sortie précédente avait posé et qui ne sort plus. **Sortir un seul personnage est devenu un réglage de celle-ci**, `sujet` : posé, il emporte ce sujet-là en entier — ses images et ses animations — et le lot n'est plus lu.
- **La parité, enfin vraie** : `preview_output` et `write_output` sont les deux outils MCP de ces deux routes, aux mêmes sept réglages. Avant, l'agent avait une porte que l'écran n'avait pas (`export_assets`) et l'écran en avait une que l'agent n'avait pas (`/output`).
- **Les variantes archive restent** : `POST /exports`, `POST /strips/export` et `POST /characters/{id}/strips/export` rendent un ZIP au navigateur. Elles n'écrivent rien dans le dossier du jeu, donc elles ne sont pas une seconde porte — c'est une décision, pas un oubli.
- **Le seul autre écrivain du dossier du jeu**, et il est nommé : l'argument `folder` des outils MCP de génération et de retouche (`generate_asset`, `edit_asset`, `generate_pose`, `equip_character`, `check_generation`). Il pose **l'image que l'agent vient de payer**, une à la fois, là où il code — c'est la promesse de T7, pas une sortie : il ne compose aucun lot, ne nomme rien d'après la matrice et n'écrase jamais. `tests/test_rp17.py` lit les appelants de `ServiceAgent.deposer` dans tout `atelier/` et refuse le troisième.

### La livraison Godot, qui n'est pas la même chose

`POST /projects/{p}/deliveries` écrit elle aussi des fichiers, mais **ailleurs** : dans le projet Godot associé au jeu, sous `assets/asset-kitchen/…`, en révisions, avec les décisions par conflit de `RP10`. Ce n'est pas le « dossier du jeu » de l'installation, et ce n'est pas un export d'images : c'est un paquet Godot — scènes, `SpriteFrames`, manifeste. Les deux portes ne se recouvrent pas, et aucune ne peut faire le travail de l'autre.
### Commander un clip vidéo payant

- **Chemin A (direct)** : `POST /clips` — un bouton qui commande tout de suite un lot de clips chez un fournisseur payant.
- **Chemin B (délégué, AU3)** : `POST /projects/{p}/production-jobs/preview` puis `.../start` — le système de « travaux » qui prépare, lance et peut reprendre un travail, utilisable par l'auteur *ou* par l'agent (`request_character_animation`), avec budget et file locale.
- **Ce qui les sépare** : les deux appellent le même moteur en bout de chaîne — `atelier/services/travaux.py` délègue explicitement à `self.a.animation.commander(...)`, la méthode que `POST /clips` appelle aussi directement. Ce n'est donc pas du code dupliqué, mais deux portes d'entrée parallèles vers le même moteur : l'une pour un clip isolé et immédiat, l'autre pour un travail suivi et repris dans le temps. Moins gênant que le précédent — il n'y a qu'un seul endroit qui paie vraiment — mais ça vaut la peine de savoir que les deux existent avant d'en retirer un.

## Ce que plus personne n'appelle

**Plus aucune, depuis `RP18` le 16 septembre 2026.** Les neuf que ce relevé nommait ont chacune
reçu une décision : quatre sont parties, trois ont reçu leur emprunteur, et **deux n'étaient pas
orphelines** — c'est la méthode du relevé qui les avait manquées. Le détail de chaque décision
et sa raison vivent dans `docs/PLAN-remise-a-plat.md`, § RP18, *Les neuf décisions*.

⚠️ **Et voici la faute de méthode, parce qu'elle se refera.** La colonne « appelée par
l'interface ? » a été remplie par une recherche de chaînes dans `interface/src/`. Or une adresse
que **le serveur compose et met dans sa réponse** n'apparaît nulle part dans l'interface : l'écran
affiche `quelque_chose.url`, sans jamais nommer la route. C'était le cas de
`.../production-jobs/{id}/references/{rang}` et de `.../video-reference`, toutes deux rendues par
*Fabrication suivie* depuis le premier jour. La recherche à faire en plus tient en une ligne, et
elle nomme aujourd'hui quatre écritures, toutes affichées :

```
grep -rn '"url": f"/api' atelier/
```

Ce qui est parti, et sa date :

- `GET /presets`, `PUT /presets/{nom}`, `DELETE /presets/{nom}` — **retirées le 16 septembre 2026**. Les « jeux de réglages » nommés (US-134) : la route existait et fonctionnait, l'écran n'a jamais été construit, et ce qu'elle promettait est fait par *Reprendre les réglages* sur la fiche d'une image de la galerie (`interface/src/gestes.ts`).
- `DELETE /strips/{id}/layer/align` — **retirée le 16 septembre 2026**. Défaire un calage posé à la main sur une bande, alors qu'aucun écran n'en pose : `POST .../layer/align` n'a de client qu'un appel d'`api.ts` qu'aucun composant n'emploie. Elle reviendra avec l'écran qui posera le calage.

Ce qui a reçu son emprunteur le même jour :

- `GET /characters/search` — l'agent, par `list_characters(search=…)`. La barre, elle, cherche les sujets sur la liste entière que `GET /characters` lui donne : côté écran, la route ne trouverait rien de plus et ferait un aller-retour par frappe.
- `POST /clips/models/refresh` — l'écran du clip, quand la liste des modèles vidéo est vide, à l'endroit même où la panne est écrite.
- `GET /strips/{id}/layer/preview` — l'écran *Ses animations, image par image*, qui annonçait « huit calculs » et ne montrait pas un pixel.

À part : `GET /health` n'est pas appelée par l'interface non plus, mais ce n'est pas un candidat « plus servie » — elle est utilisée par le lanceur de l'atelier (`atelier/__main__.py`) pour savoir quand le serveur a fini de démarrer, et testée dans `tests/test_lanceur.py`.

**Modules de `atelier/services/` et `atelier/domaine/`** : aucun module mort trouvé. Vérifié par un script qui relève, pour chaque fichier, les deux façons de l'importer (`from atelier.services.X import ...` et `from atelier.domaine import X`) et cherche une utilisation ailleurs dans `atelier/` — les deux dossiers comptent 46 et 34 modules, et chacun est référencé par au moins un autre fichier de code produit (hors tests). Un cas a d'abord semblé mort par une vérification trop étroite (`atelier/domaine/aseprite.py`, qui n'avait pas la forme d'import cherchée au premier passage) puis s'est révélé actif dans quatre services (`export.py`, `export_tenues.py`, `livraison.py`, `tenues.py`) une fois le script corrigé.

## Les essais qui tombent pour l'environnement

Deux essais échouent, tous deux pour la même cause :

```
tests/test_au10_environnement.py::test_charger_le_pont_ne_touche_a_aucun_fichier_du_voisin
tests/test_pont_asset3d.py::test_executeur_natif_separe_sans_gpu_et_sans_ecriture_chez_le_voisin
```

**La cause.** `atelier/pont_asset3d.py` est un pont qui, par conception, importe pour de vrai le code du projet voisin `asset3d` (`serveur.main`, `serveur.depot`, `serveur.executeur`, etc. — voir sa docstring : *« Les modules `serveur` du projet voisin ne sont importés qu'ici »*). Sur cette machine, `..\asset3d` est bien cloné à côté de ce dépôt, mais son propre environnement Python n'est pas installé dans le `.venv` de *ce* dépôt : `serveur/main.py` importe `serveur/filtres.py`, qui importe `cv2` (le paquet `opencv-python`) — une dépendance du voisin, pas de l'atelier.

Les deux essais ont déjà une garde : ils passent (`pytest.skip`) quand `asset3d/serveur/main.py` n'existe pas du tout sur la machine. Mais cette garde ne couvre que « le voisin est absent » — pas « le voisin est là, mais son environnement ne l'est pas ». C'est exactement le cas ici, et l'import échoue en `ModuleNotFoundError` au lieu d'être sauté proprement.

**Est-ce normal ?** Oui, dans le sens où rien de ce dépôt n'est cassé — c'est un essai qui exige un second projet entièrement installé à côté, avec ses propres paquets lourds (vision par ordinateur), pour prouver une garantie d'isolation entre les deux. Non, dans le sens où l'essai devrait rendre un verdict clair (sauté, avec sa raison) plutôt qu'un échec qui ressemble à une régression.

**Ce qu'on propose.** Sauter plutôt qu'échouer : entourer l'appel à `charger_asset3d(...)` dans ces deux essais d'un `except ModuleNotFoundError` qui transforme l'échec en `pytest.skip("le voisin est présent mais son environnement n'est pas installé — ModuleNotFoundError: <nom>")`. Déclarer `opencv-python` comme dépendance de ce dépôt serait le mauvais choix : c'est une dépendance du *voisin*, que le code de l'atelier ne touche jamais autrement que par ce pont, et l'installer ici brouillerait la frontière que ces essais existent justement pour vérifier.

**Autres essais dans le même cas ?** Recherche faite sur tous les fichiers de `tests/` qui mentionnent `asset3d` (`test_au10.py`, `test_au10_environnement.py`, `test_au11_camera.py`, `test_au11_directions.py`, `test_au18.py`, `test_au9.py`, `test_essai_au11_cadre_directions.py`, `test_pont_asset3d.py`) et exécution ciblée de tous (`pytest -k "asset3d or pont or au10 or au11"`, 37 essais). Un seul autre essai appelle réellement `charger_asset3d(...)` en dehors des deux ci-dessus (`test_au10.py`, via une fixture partagée) et il passe — les autres parlent de `atelier.fournisseur.asset3d` (l'adaptateur HTTP de *ce* dépôt vers le pont, pas le voisin lui-même) ou utilisent délibérément un double de test. Aucun autre essai ne dépend du voisin de la même façon.
