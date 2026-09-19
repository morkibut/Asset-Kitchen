# Le moteur de tuiles de la maquette

Copie des modules du moteur de tuiles de SpriteForge, pour que la maquette
`04-tuiles.html` dessine de vraies tuiles. Ne pas modifier ici : corriger dans
SpriteForge, puis recopier.

## Provenance

- Dépôt : `C:\STOCKAGE\PROJET\_DEV\sc-clone` (SpriteForge), dossier `public/`.
- Commit : `f27f054` du 16 septembre 2026 (« Mur : le bout d'un mur vertical ne cree plus
  de second escalier, trou en V et fente supprimes »).
- Copié le 19 septembre 2026.

| Fichier | Rôle |
|---|---|
| `vendor/tileset-engine.js` | le moteur : dessine la planche de toutes les pièces (`renderLogical`) |
| `tile-masks.js` | les jeux de pièces (47, 16, 15) et leur place sur la planche |
| `tile-materials.js` | les 13 matières intégrées |
| `tile-emplacements.js` | les emplacements (surface, bordure, face, sol dessous) et le lien bordure–surface |
| `tile-scene.js` | la carte peinte, avec murs, ombres et personnage |
| `tile-check.js` | la vérification des raccords |
| `tile-palette.js`, `tile-palette-lab.js`, `pixel-core.js` | les couleurs communes à plusieurs matières |
| `tile-ia-prompt.js` | le texte envoyé au générateur d'images |

**Aucune ligne de logique n'a changé.** Les chemins d'import n'ont pas eu besoin d'être
retouchés : la copie garde la même disposition que `public/` (le moteur dans `vendor/`,
les autres modules au-dessus).

Ce qui n'a pas été copié : `tile-ia.js` (il appelle le serveur de SpriteForge),
`tile-mesures.js` (inutile ici), `exports.js` (les fichiers Godot ne sont pas écrits par la
maquette).

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
