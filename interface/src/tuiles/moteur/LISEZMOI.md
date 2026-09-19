# Le moteur de tuiles

Copie du moteur de tuiles de **sc-clone (SpriteForge)**, recopiée telle quelle dans
l'interface pour que gag2 fabrique et vérifie des jeux de tuiles avec le même code que
sc-clone a validé — voir `docs/PLAN-tuiles.md`, décision 1.

## Provenance

- Dépôt : `C:\STOCKAGE\PROJET\_DEV\sc-clone` (SpriteForge), dossier `public/`.
- Commit : `f27f054` du 16 septembre 2026 (« Mur : le bout d'un mur vertical ne cree plus
  de second escalier, trou en V et fente supprimes »).
- Recopié une première fois dans `docs/maquettes-atelier-unifie/tuiles-moteur/` le
  19 septembre 2026 (pour la maquette `04-tuiles.html`), puis ici, à l'identique, le même
  jour (TU1).

| Fichier | Rôle |
|---|---|
| `vendor/tileset-engine.js` | le moteur : dessine la planche de toutes les pièces (`renderLogical`) |
| `tile-masks.js` | les jeux de pièces (47, 16, 15) et leur place sur la planche |
| `tile-materials.js` | les 13 matières intégrées |
| `tile-emplacements.js` | les emplacements (surface, bordure, face, sol dessous) et le lien bordure–surface |
| `tile-scene.js` | la carte peinte, avec murs, ombres et personnage |
| `tile-check.js` | la vérification des raccords |
| `tile-palette.js`, `tile-palette-lab.js`, `pixel-core.js` | les couleurs communes à plusieurs matières |
| `tile-mesures.js` | la fiche de mesure d'une image (couleurs, luminance) — utilisée par les essais de palette |
| `tile-ia-prompt.js` | le texte envoyé au générateur d'images |

**Aucune ligne de logique n'a changé.** Seuls les chemins d'import ont bougé, pour tenir
dans un seul dossier (`./vendor/...` au lieu de `../tile-masks.js` depuis `vendor/`, ce qui
est déjà la disposition d'origine — rien à changer là non plus).

Ce qui n'a **pas** été copié, et pourquoi :
- `tile-ia.js` — appelle le serveur de SpriteForge (`app.js`, `state`) ; gag2 aura son
  propre appelant, en Python (TU5).
- `exports.js` — écrit les paquets Godot ; l'export de gag2 est en Python (TU4), pas en JS.
- `app.js`, `tools.js`, `editor.js`, `wizard.js`, `jobs-ui.js`, `sequence.js`, `motion.js` —
  ce sont des écrans, pas le moteur. TU1 ne touche à aucun écran.
- `lib/providers.mjs` (utilisé par une partie des essais de `tile-ia-prompt.js`) — c'est
  l'appelant HTTP du fournisseur d'images, hors moteur pur. Les essais qui en dépendent
  sont marqués `.skip` dans `__tests__/` avec la raison.

**Ne pas modifier la logique ici.** Toute évolution du moteur se fait d'abord dans
sc-clone, puis se recopie ; ou, si sc-clone n'est plus la source de vérité, se note dans ce
fichier avec la date et la raison de l'écart.

## Licences

- **Moteur de base** : adapté de
  [SpriteCook/spritecook-tileset-gen](https://github.com/SpriteCook/spritecook-tileset-gen)
  (l'outil en ligne « Tileset Base Generator » de SpriteCook), copyright 2026 SpriteCook,
  licence MIT. Texte complet : `vendor/LICENSE-SpriteCook.txt`.
- **Réduction qui garde le trait** (`poidsExpansion`, `expansionContours`, `choixContraste`
  dans `vendor/tileset-engine.js`) : portage JavaScript de PixelOE
  (`pixeloe/torch/outline.py`, `pixeloe/torch/downscale/contrast_based.py`), copyright 2024
  KohakuBlueLeaf, licence Apache 2.0. Texte complet : `vendor/LICENSE-PixelOE.txt`.
- Le reste est du code de SpriteForge, écrit par l'auteur.

## Comment les essais vérifient la fidélité

`__tests__/empreinte-provenance.test.ts` calcule l'empreinte SHA-256 de chaque module,
après normalisation des fins de ligne (LF) et des lignes d'import (dont seul le chemin a pu
bouger), et la compare à une liste figée relevée sur sc-clone au commit `f27f054`. Toute
modification de logique — une ligne qui n'est pas un `import` — fait échouer cet essai.
