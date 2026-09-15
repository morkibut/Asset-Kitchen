# Atelier unifié — affectation des tranches

> Compagnon de [PLAN-atelier-unifie.md](PLAN-atelier-unifie.md). Classement du 11 septembre
> sur le code existant ; les tranches historiques du carnet ne sont pas reclassées.
> Ces noms de modèles sont ceux de la grille du skill, pas une affirmation qu'ils sont
> disponibles ou qu'un agent de ce modèle a été lancé dans cette session Codex.

## Les cinq étiquettes

| Étiquette | Modèle | Réflexion | Critère |
|---|---|---|---|
| VERY-EASY | Haiku 4.5 | faible | report mécanique, résultat entièrement défini |
| EASY | Sonnet | faible | exposition de données existantes, aucun invariant nouveau |
| MEDIUM | Sonnet | élevée | règle métier, route ou algorithme standard |
| HARD | Opus | moyenne | forme de données, invariant, argent, disque ou sous-système nouveau |
| VERY-HARD | Opus | max | plusieurs couches et corpus existant conservé assertion pour assertion |

## Mesures avant classement

Déclarations d'essais relevées, **pas essais exécutés** : MCP T7 25, export C5 22,
animations A4 18, clips A9 51, moteur local A11 50, bandes B11 10 ; écran sujet 34,
animations 32, retouche 100. Le nombre de cas exécutés peut différer avec le paramétrage.

| Tranches | Déjà présent | À ajouter | Surface existante et vérifications à préserver |
|---|---|---|---|
| AU1, AU5 | export des bandes, MCP, dépôt contrôlé des images | export animé MCP, livraison Godot et remplacement possédé | 3 entrées inspectées : façade MCP, service export, écran Sortie ; T7/C5/A4 |
| AU2 | personnage, plan de poses, comptes fixes/bandes | intention de sortie indépendante, couverture partagée | 4 points : domaine personnage, production, page du sujet, onglet animations ; tests sujet/animations/B11 |
| AU3 | demandes vidéo, identifiants persistés, recettes de montage | boucle MCP, clé de demande et politique par capacité | 4 points : MCP, génération, animation, règles de l'agent ; A9/A11/T7 et tests de plafonds |
| AU4 | retouche des images et bandes, comparaison, sauvegarde | composition du parcours et conservation du contexte | 3 écrans : sujet, retouche, atelier d'une bande ; 166 déclarations dans les 3 suites sujet/animations/retouche |
| AU6 | attente vidéo, client ComfyUI, verrous locaux dans asset3d | planification partagée des demandes possédées | 3 mécanismes à raccorder, aucun ordonnanceur commun relevé ; A9/A11 |
| AU7, AU8 | montage vidéo Maison et découverte des prérequis | profils versionnés et adaptation image | 3 points : adaptateur Maison, montage Maison, installation ; A11 et essais Installation |
| AU9 à AU11 | catalogues, sources, rigs et rendus d'asset3d | adaptateur et rattachement au domaine de l'atelier | 4 frontières lues chez asset3d : API, exécuteur, personnages, contrat rendu ; ses essais sont à exécuter séparément |
| AU12 | familles, univers, images, import, animations | objectif animé pour un objet et parcours agent commun | 3 ensembles UI existants famille/sujet/galerie ; éviter une seconde bibliothèque |
| AU13 | découpe et export d'images | contrat de tuiles raccordables et pont de carte Godot | pas de sous-système de tuiles livré relevé ; anciens plans seulement |
| AU14 | savoir audio dans le projet voisin signalé par AGENTS | domaine audio, écoute, traitement et export | aucun pipeline audio dans l'atelier inspecté ; mesurer le voisin avant de figer le découpage |
| AU15 | pièces, emplois, extraction C3 et calques de pose | cibles distinctes pose/direction/frame et compatibilité explicite | 4 surfaces : emploi, calque, bande et habillage ; 20 déclarations C3, 33 B20 et 22 dans l'écran CalquesAnimes |
| AU16 | demandes suivies AU3, extraction, masque et suivi TIENT/GLISSE | couverture et traitement d'une sélection de cibles selon AU15 | reprise des mêmes surfaces avec montage et suivi de travail ; conserver corrections et identité des frames |
| AU17 | superposition, export et livraison AU1/AU5 | tenue de plusieurs emplois et export synchronisé des couches | composition, bande et export ; pas de nouveau contrat de propriété des fichiers |

Ces nombres décrivent des points d'intégration inspectés, pas un chiffrage exact des futurs
fichiers modifiés. Tuiles et son sont des estimations provisoires à réévaluer avant exécution.

## Les 20 tranches

**Préparation UX hors tranches de production — [MEDIUM], Sonnet, réflexion élevée.**
Le premier prototype avait une navigation et des données fictives sans sauvegarde ; le
complément demande un état local, des gestes de toile et de montage et une relecture des
fonctions, sans schéma serveur, fournisseur ni fichier du jeu. Son code est isolé du produit,
et les essais sont des parcours de navigateur. Le raccord aux vrais outils se classe dans
AU2 à AU4 ; le prototype ne paie pas à lui seul leur point dur. L'ajout de cette préparation
ne reclasse aucune des quatorze tranches initiales ; les ajouts AU15–AU17 sont classés séparément.

**Consolidation du 12 septembre — même préparation UX MEDIUM, réflexion élevée.**
Mesure : le châssis et l'état vivent dans deux fichiers, le rangement et les travaux dans
un module de parcours, et les envois dans trois chemins distincts ; les équipements ont
déjà leurs cibles, masques et historique. Les ajouts portent sur leur raccord interactif,
la sauvegarde locale de démonstration et les contrôles communs, sans fournisseur ni migration
serveur. Trois parcours indépendants se parallélisent, puis les équipements et la toile
réutilisent leurs contrôles. Les preuves sont des essais navigateur, notamment après
rechargement et sur données nombreuses. L'affectation historique recommande Sonnet ; les
agents de cette session utilisent le modèle disponible hérité, sans prétendre exécuter Sonnet.

**Sources vidéo et 3D — préparation UX [MEDIUM], Sonnet, réflexion élevée.**
Le montage, la relecture et la conservation des sources existent dans le prototype ;
le parcours 3D est encore une fiche à trois actions. L'extension ajoute des états locaux,
un aperçu géométrique CPU et des raccords aux mêmes résultats, sans API externe ni
modification des installations. Les contrats de reprise de montage et de livraison
restent à préserver. Les garanties sur les vrais maillages, rigs et rendus demeurent
dans AU9–AU11 et leur affectation n'est pas abaissée par une maquette fonctionnelle.

**Complément après validation de la simplicité de l'UI.** AU2, AU3 et AU4 sont renforcées
par US-534 à US-536 : création sans MCP, toile et reprise complète des tables. Leurs
étiquettes sont conservées : aucune réécriture de la toile ni nouveau schéma de retouche
n'est demandé. Si la conception en impose un, sortir ce point dur avant de coder.

Mesure complémentaire : la toile existe avec **39 déclarations d'essais géométriques**
dans `interface/src/composants/Toile.test.tsx` ; ils ne montent pas l'écran et ne remplacent
donc pas l'essai d'ouverture, modification et réouverture demandé par AU2. Les postes
de détourage, recadrage, grille, couleurs, nettoyage et contour sont déjà exportés par la
retouche ; AU4 doit reprendre leurs contrôles et les outils de main, pas les remplacer par
six intitulés. Ces décomptes proviennent d'une lecture, pas d'une exécution des suites.

**Complément découpe / extraction / composition.** AU4 conserve son classement MEDIUM :
les ateliers dédiés de découpe et de calque existent, avec services CPU, masque manuel et
relecture ; ils ne sont pas des tables de la recette. Leur reprise et les accès depuis la toile
s'ajoutent à l'inventaire. Le prototype reste MEDIUM : découpe par projections et recalage
borné de pixels, sans modèle entraîné ni schéma du produit. La robustesse du calage sur de
vraies variantes devra être mesurée avant de promettre un résultat automatique ; cette
démonstration ne valide pas un nouveau moteur d'extraction ni un suivi de calque animé.

| Tranche | Étiquette | Pourquoi |
|---|---|---|
| AU1 · Animation existante vers Godot | HARD | Écrit dans un projet externe et pose le contrat durable de livraison. |
| AU2 · Objectif du personnage | HARD | Ajoute une intention persistante sans changer le sens des anciennes poses. |
| AU3 · Nouvelle animation par l'agent | HARD | Lie demande durable, capacités, plafonds et reprise d'un appel potentiellement payé. |
| AU4 · Juger et corriger | MEDIUM | Compose des outils existants avec retour au contexte et relecture. |
| AU5 · Révision dans le jeu | MEDIUM | Applique le contrat de propriété et de livraison établi par AU1 à une sélection révisée. |
| AU6 · File locale | HARD | Pose la propriété des travaux et l'invariant de coordination entre moteurs. |
| AU7 · Workflow image | MEDIUM | Adapte le mécanisme de profils locaux au port image existant. |
| AU8 · Workflow vidéo | MEDIUM | Étend le moteur vidéo déjà branché aux profils établis par AU7. |
| AU9 · Rendu 3D existant | MEDIUM | Ajoute un adaptateur de lecture et importe dans les objets déjà conservés. |
| AU10 · Fabrication 3D | MEDIUM | Raccorde le pipeline externe au travail durable et au planificateur déjà posés. |
| AU11 · Autres rendus 3D | MEDIUM | Réutilise source et rig avec les paramètres du catalogue externe. |
| AU12 · Autres assets | MEDIUM | Applique le parcours commun aux familles existantes. |
| AU13 · Tuiles | HARD | Le sous-système de raccords et la livraison d'une carte sont encore absents. |
| AU14 · Son | HARD | Le média audio, son traitement et sa restitution n'existent pas encore ici. |
| AU15 · Premier calque d'emploi | HARD | Étend l'identité des calques aux cibles de direction et de frame sans réinterpréter les données de pose existantes. |
| AU16 · Couverture de l'emploi | MEDIUM | Applique les cibles établies par AU15 aux fabrications suivies, à la couverture et aux corrections par sélection. |
| AU17 · Tenues et livraison | MEDIUM | Compose les emplois définis par AU15 et réutilise le contrat de livraison d'AU1 pour les couches synchronisées. |
| AU18 · Une vidéo qui vient d'ailleurs | MEDIUM | Une route neuve d'import et le tirage des images à l'entrée ; le montage, le prélèvement et le rejeu existent déjà. *Classée après coup, le 15 septembre 2026 — la tranche était close le 13.* |
| AU19 · Une feuille de sprites qui vient d'ailleurs | MEDIUM | Une règle neuve — une bande par ligne quand les lignes sont les directions — sur la découpe et la bande déjà là ; sans encodage vidéo. *Classée après coup, le 15 septembre 2026.* |
| AU20 · Ce qui entre par une fiche y reste | HARD | Change ce qu'un sujet porte — un sujet sans case devient un état légitime — et retourne deux décisions d'AU18 et AU19. *Classée après coup, le 15 septembre 2026.* |

**Compte** : 8 HARD, 12 MEDIUM, aucun VERY-HARD/EASY/VERY-EASY.
Le seuil indicatif d'un tiers a été revu : cinq HARD posent les contrats persistants du
nouveau parcours et deux couvrent des médias non livrés. Les masquer en MEDIUM minorerait
le travail ; ils doivent être redécoupés avant codage, surtout les deux derniers.

## Points durs qui montent

| Dans | Morceau | Traité en |
|---|---|---|
| AU4 | Départage persistant partagé entre UI et agent si le contrat d'AU2 ne le couvre pas | HARD · Opus moyenne |
| AU5 | Reprise après écriture partielle et conflit sur fichier modifié | HARD · Opus moyenne |
| AU7 | Validation et versionnement des profils importés, sans exécution arbitraire ajoutée | HARD · Opus moyenne |
| AU10 | Acceptation externe incertaine et compatibilité du contrat asset3d | HARD · Opus moyenne |
| AU17 | Contrat durable de tenue et référence aux variantes, avant le branchement de son écran | HARD · Opus moyenne |

## Morceaux qui descendent après décision

| Dans | Morceau | Traité en |
|---|---|---|
| AU1 | Exposition MCP des métadonnées d'une bande déjà conservée | EASY · Sonnet faible |
| AU2 | Présentation des objectifs et des états déjà calculés au serveur | EASY · Sonnet faible |
| AU3 | Traduction des réponses métier en réponses MCP | EASY · Sonnet faible |
| AU6 | Affichage de la file depuis ses états durables | EASY · Sonnet faible |
| AU15 | Présentation d'un emploi et de ses cibles après fixation de leur identité et de leur relecture | EASY · Sonnet faible |

## Règles d'exécution

### Modèles exécutables dans Codex — accord de l'auteur du 12 septembre

L'auteur demande désormais de déléguer les morceaux simples aux modèles GPT plus légers.
Les étiquettes historiques ci-dessus sont conservées ; cette correspondance remplace leurs
noms de modèles pour les prochaines missions. GPT-5.3 Codex Spark n'est pas proposé par
l'outil de sous-agents de cette session : aucun lancement Spark n'est donc annoncé.

| Morceau à prendre | Classement conservé ou affiné | Modèle exécuté · réflexion |
|---|---|---|
| Reports mécaniques, libellés et raccords de composants aux routes déjà vérifiées | VERY-EASY / EASY | GPT-5.6 Luna · faible ou moyenne |
| Parcours d'écran avec contexte à conserver et essais d'interaction | MEDIUM | GPT-5.6 Terra · élevée |
| Contrat de données, dépense, reprise incertaine, écriture dans le jeu | HARD et points durs extraits | Modèle principal · élevée |
| Revue finale entre services, interface réelle et maquette approuvée | Relecture transversale | Modèle principal |

Mesure avant les raccords suivants : création d'asset et son possèdent déjà composants,
routes et services ; il reste trois portes d'interface à relier. La préparation d'image
existe également : les anciens gestes de réinjection doivent ouvrir son nouveau dialogue
en conservant la page, sans modifier le contrat d'envoi. Ces raccords descendent en EASY.
La mise à jour asynchrone de l'envoi et l'interdiction de payer une prévisualisation périmée
restent un point dur séparé, relu par le modèle principal.

Les missions déjà lancées terminent leur vérification ; la correspondance s'applique dès
la mission suivante, sans relancer un travail terminé ni multiplier les copies de contexte.

Relevé du 11 septembre à 23 h 53 : AU15 reprend la liste des trois genres d'emploi
déjà présente en B19 et précise l'association depuis la retouche et l'occultation partielle.
AU16 réutilise le pliage/dépliage C3 plutôt qu'un appel imposé par frame ; il distingue
la modification d'un clip, conditionnée à un profil compatible. Les affectations existantes
restent valables : AU15 pose déjà les cibles et masques, AU16 raccorde les fabrications.
La simulation des planches, de leur découpe et de l'attribution reste dans la préparation
UX MEDIUM, sans modification du contrat de stockage de production ni appel fournisseur.

Les sélecteurs de rattachement et l'ordre des frames restent dans AU4 et la préparation UX
MEDIUM. La précision de l'auteur après 22 h 56 annule le report des équipements : AU15–AU17
sont désormais requises, avant les nouveaux moteurs et les médias différés. La préparation
UX représente le parcours complet avec ses traitements simulés ; elle ne livre ni migration
serveur ni qualité de génération. Les étiquettes des quatorze tranches initiales sont conservées.

**AU15 se prend en deux morceaux.** D'abord le contrat **HARD · Opus · réflexion moyenne** :
identité des cibles, relecture des calques de pose, variantes par direction/frame et corrections
liées au bon résultat après montage. Ensuite le chemin import → extraction → placement →
relecture descend en **MEDIUM · Sonnet · réflexion élevée**, en réutilisant les outils.
Le code B20 a 33 déclarations d'essais, dont le partage d'un calque entre directions et les
tenues TIENT/GLISSE : ce sont des garanties du mode historique à conserver, pas la preuve que
des variantes indépendantes existent déjà. Ces nombres viennent d'une lecture, pas d'une exécution.

Le complément de 22 h 28 ajoute les critères de collections, équipement contextualisé,
fabrication libre et galerie à AU2/AU3, et précise le montage déjà prévu dans AU4.
La préparation de ces écrans reste MEDIUM ; les affectations de production sont conservées.
La fabrication libre de sources 3D suit les frontières et affectations AU9 à AU11 : sa
fiche simulée dans la maquette ne constitue pas un adaptateur réalisé.

Les retours d'essai de 21 h 49 enrichissent les critères AU2, AU3 et AU4 sans nouvelle
tranche ni changement d'affectation. Leur simulation reste dans la préparation UX MEDIUM ;
les garanties de stockage, de coût réel et de fidélité des traitements restent à réaliser
dans les tranches de production concernées.

La difficulté appartient au contrat qui change, pas au prestige d'un écran. Un HARD se
découpe avant exécution ; les reports redescendent une fois l'invariant fixé. Les points
durs se traitent séparément conformément au skill affecte. La revue confronte domaine,
façades, stockage et résultat réel. L'environnement actif doit être annoncé honnêtement ;
ne jamais prétendre qu'un modèle recommandé est celui qui a effectué le travail.
