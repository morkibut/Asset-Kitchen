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

Ces nombres décrivent des points d'intégration inspectés, pas un chiffrage exact des futurs
fichiers modifiés. Tuiles et son sont des estimations provisoires à réévaluer avant exécution.

## Les 14 tranches

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

**Compte** : 6 HARD, 8 MEDIUM, aucun VERY-HARD/EASY/VERY-EASY.
Le seuil indicatif d'un tiers a été revu : quatre HARD posent les contrats persistants du
nouveau parcours et deux couvrent des médias non livrés. Les masquer en MEDIUM minorerait
le travail ; ils doivent être redécoupés avant codage, surtout les deux derniers.

## Points durs qui montent

| Dans | Morceau | Traité en |
|---|---|---|
| AU4 | Départage persistant partagé entre UI et agent si le contrat d'AU2 ne le couvre pas | HARD · Opus moyenne |
| AU5 | Reprise après écriture partielle et conflit sur fichier modifié | HARD · Opus moyenne |
| AU7 | Validation et versionnement des profils importés, sans exécution arbitraire ajoutée | HARD · Opus moyenne |
| AU10 | Acceptation externe incertaine et compatibilité du contrat asset3d | HARD · Opus moyenne |

## Morceaux qui descendent après décision

| Dans | Morceau | Traité en |
|---|---|---|
| AU1 | Exposition MCP des métadonnées d'une bande déjà conservée | EASY · Sonnet faible |
| AU2 | Présentation des objectifs et des états déjà calculés au serveur | EASY · Sonnet faible |
| AU3 | Traduction des réponses métier en réponses MCP | EASY · Sonnet faible |
| AU6 | Affichage de la file depuis ses états durables | EASY · Sonnet faible |

## Règles d'exécution

La difficulté appartient au contrat qui change, pas au prestige d'un écran. Un HARD se
découpe avant exécution ; les reports redescendent une fois l'invariant fixé. Les points
durs se traitent séparément conformément au skill affecte. La revue confronte domaine,
façades, stockage et résultat réel. L'environnement actif doit être annoncé honnêtement ;
ne jamais prétendre qu'un modèle recommandé est celui qui a effectué le travail.
