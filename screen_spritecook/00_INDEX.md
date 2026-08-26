# Captures d'écran — analyse SpriteCook

Relevé du 26 août 2026, compte `@throttle_gusty_bubbly` (palier Adventurer).
Correspond au document [Anatomie de SpriteCook](https://claude.ai/code/artifact/4145bd12-343e-4c9b-8e3e-07578aaffd50).

| Fichier | Écran | § du doc |
|---|---|---|
| 01_accueil | Accueil, barre latérale déployée, prompt universel, 7 raccourcis outils | §3 |
| 02_generateur_panneau_haut | Asset Generator — type, preset, style, pixel perfect, style guide | §4.2 |
| 03_generateur_panneau_modele_taille | Asset Generator — modèle IA, taille, couleurs, remove BG | §4.2 |
| 04_generateur_panneau_variations | Asset Generator — ratio, variations, public, projet | §4.2 |
| 05_generateur_types | Sélecteur de type : Assets / Texture / Tileset / UI (bientôt) | §4.1 |
| 06_theme_onglet | Bloc Theme & Style — onglet Theme (Random / Refine) | §4.2 |
| 07_style_onglet | Bloc Theme & Style — onglet Style (preset ou texte libre) | §4.2 |
| 08_style_presets | Presets de style : Pixel Art / Detailed, 8-Bit → Isometric | §4.2 |
| 09_tileset_panneau | Mode Tileset — perspective, type, taille de tuile, arêtes, BG | §4.4 |
| 10_tileset_perspectives | Perspectives : Top-down / Platformer / Isometric | §4.4 |
| 11_tileset_jeux_de_pieces | Jeux de pièces : autotile 15 / 17-piece base, avec aperçu | §4.4 |
| 12_texture_sans_couture | Mode Seamless Texture | §5.6 |
| 13_animate_reglages | Onglet Animate — BG removal, frames, enhance, seed, couleurs | §5.8 |
| 14_character_e1_decrire | Character Creator — étape 1, description | §5.3 |
| 15_character_e2_style_perspective | Étape 2 — style et perspective, coût 12 crédits | §5.3 |
| 16_character_e4_choix_animations | Étape 4 — choix des animations, section « Already made » | §5.3 |
| 17_character_e4_cadrage | Étape 4 — panneau de cadrage (marge, safe margin, power of 2, snap) | §5.3 |
| 18_character_e5_playground | Étape 5 — playground jouable avec curseurs de physique | §5.3 |
| 19_character_e5_animations_pretes | Étape 5 — animations prêtes, true size preview, source character | §5.3 |
| 20_character_export_moteurs | Modale d'export : ZIP gratuit, Unity / Godot / Phaser / Roblox payants | §7 |
| 21_pack_e1_genres | Asset Pack — étape 1, les 6 genres | §5.4 |
| 22_pack_e2_perspective | Asset Pack — étape 2, perspective | §5.4 |
| 23_pack_e3_style_et_taille | Asset Pack — étape 3, style + Mini Pack 24 / Full Pack 88 | §5.4 |
| 24_uikit_e1_point_de_depart | UI Kit Builder — point de départ (kit repris, style, upload) | §5.7 |
| 25_uikit_e2_ecran_plateforme | Étape 2 — type d'écran, plateforme, format | §5.7 |
| 26_uikit_e3_direction_visuelle | Étape 3 — style, densité, références | §5.7 |
| 27_uikit_e3_modeles_et_cout | Étape 3 — réglages avancés : modèle par concept et coût | §5.7 |
| 28_uikit_termine_exports | Kit terminé — exports ZIP/Unity/Godot, « quel écran ensuite ? », 31 éléments | §5.7 / §7 |
| 29_uikit_editeur_9slice | Éditeur 9-slice — taxonomie rôle · état, sliders, aperçu d'étirement | §5.7 |
| 30_bibliotheque_projets_collections | My Assets — arbre Projets › Collections, filtres, tags par asset | §2 / §3 |

## Écrans non inclus

Ces états n'ont pas pu être recapturés sans dépenser de crédits ou sans attendre un job en cours :

- Étape 3 du Character Creator (écran de révision avec les suggestions de retouche) — le personnage de test ayant déjà un run terminé, l'application saute directement à l'étape d'export.
- Écran « Generating animations » et bandeau de job en cours — états transitoires.
- Manual Editor, Community Gallery, API Keys (scopes dépliés), Vibe Code — capturés pendant l'analyse mais non réenregistrés.

## Note

Les captures d'origine de l'analyse n'avaient pas été écrites sur disque : elles ont été streamées dans la conversation. Cette série a donc été reconstituée le 26 août 2026 en reparcourant l'application. Les réglages visibles dans le panneau de génération reflètent l'état de session au moment de la recapture (taille 32×32, Remove BG désactivé) et non ceux du relevé initial.
