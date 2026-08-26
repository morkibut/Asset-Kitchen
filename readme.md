# Analyse SpriteCook — point d'entrée

**Livrable principal :** [Anatomie de SpriteCook](https://claude.ai/code/artifact/4145bd12-343e-4c9b-8e3e-07578aaffd50) — spécifications fonctionnelles complètes (12 sections).
Copie archivée dans ce projet : `claude/spritecook-specs-fonctionnelles.html`.

Relevé effectué le **26 août 2026** sur le compte `@throttle_gusty_bubbly` (palier Adventurer, 5 jobs simultanés).

## Ce que couvre le document

| § | Contenu |
|---|---|
| 1 | Architecture en 4 couches — où se situe réellement la valeur du produit |
| 2 | Modèle d'objets (9 entités) + règles d'auto-provisionnement projets/collections |
| 3 | Les 11 routes de l'application et leurs états d'URL |
| 4 | Le moteur de génération : 4 types, panneau de réglages contrôle par contrôle, catalogue des 5 modèles et leurs coûts, options tileset |
| 5 | Les 8 parcours utilisateur, avec les machines à états des 3 assistants |
| 6 | Post-traitement (7 opérations) + Manual Editor + outils gratuits |
| 7 | Exports moteurs : matrice cible × type d'objet, avec le gating par palier |
| 8 | Intégration : scopes d'API, endpoints exacts, MCP (43 outils), contrat asynchrone |
| 9 | Économie : paliers, 18 coûts relevés, matrice de gating |
| 10 | Règles métier : exclusions, prérequis, plafonds numériques, licence |
| 11 | Lecture critique : 5 idées à reprendre, 6 fragilités |
| 12 | Méthode et fiabilité, points non vérifiés |

## Les faits à retenir

- **La valeur n'est pas dans le modèle d'image.** SpriteCook expose 5 modèles tiers sans surcouche propriétaire. Ce qui est difficile à reproduire, c'est le post-traitement (grille pixel, atlas autotile, découpe alpha, 9-slice) et les workflows guidés.
- **Le mécanisme de « prep » de pose** est la meilleure idée technique : des générations intermédiaires déclarées côté serveur qui retournent ou remettent en pose le sprite avant de l'animer. Graphe de dépendances chaînable, facturé 12 crédits en pixel / 2 en detailed.
- **Coût d'un personnage complet** (sprite de base + prep + 3 animations de 8 frames) : **74 crédits**, soit environ 0,74 $ au tarif Adventurer, en moins de 2 minutes de calcul.
- **API et MCP inclus sur tous les paliers**, y compris le gratuit. Ce sont les **exports moteurs** (Unity, Godot, Phaser, Roblox) qui sont payants — le ZIP brut reste gratuit.
- **Pas de webhooks** : polling uniquement, URL signées expirantes, aucune limite de débit chiffrée publiée.
- **Usage commercial autorisé sans restriction de palier.** La politique de confidentialité ne dit pas explicitement si le contenu utilisateur sert à entraîner des modèles.

## Vérification

Les 21 affirmations chiffrées et énumérations les plus risquées (coûts par modèle et résolution, registres tileset, sets d'animations, frames, coûts de prep, état du compte) ont été recoupées ligne à ligne contre les réponses du serveur MCP authentifié : **aucune erreur**.

## Reste à explorer si besoin

- Contenu exact des archives Unity / Godot / Phaser / Roblox (rien n'a été téléchargé).
- Qualité réelle des tilesets autotile et des textures sans couture (aucun généré).
- Comportement du Slicer sur une planche multi-sprites.
- Prix annuels absolus et composition des packs de crédits top-up.