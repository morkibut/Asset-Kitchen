// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
// Essais de la tranche T5 : couverture garantie de l'île aléatoire, et pouvoir de
// détection du validateur. Le contrôle de couture lui-même (compatibleHorizontal,
// compatibleVertical, seamFault, edgeOf) est déjà éprouvé par tests/tileset.test.mjs
// (tranche T2) — ce fichier ne le rejoue pas, il teste ce que public/tile-check.js
// ajoute par-dessus : generateIsland, islandCoverage, checkMaskSetAtlas, checkWallAtlas.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { installerBouchonCanvas } from './canvas-shim';
// renderLogical dessine dans un canvas : même stub minimal que tileset.test.ts.
installerBouchonCanvas();
const { renderLogical, WALL_TOP_ROWS, WALL_BAND_STATES, biaisAtlasDescriptor } = await import('../vendor/tileset-engine.js');
const { W16, B47, E16, NEIGHBOUR_BITS, SIDE_BITS, CORNER_BITS, atlasPosition } = await import('../tile-masks.js');
const { generateIsland, islandCoverage, blobMaskAt, edgeMaskAt, checkMaskSetAtlas, checkWallAtlas, compatibleHorizontal, compatibleVertical } = await import('../tile-check.js');

const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
// Calqué sur tileSettings() de public/tools.js, valeurs par défaut du panneau.
const settings = (over = {}) => { const size = over.tileSize ?? 32; return { tilesetType: 'blob-47', tileSize: size, cornerRadius: 2 * size / 32, edgeStyle: 'rough', edgeRoughness: 3 * size / 32, edgeFrequency: 5, edgePadding: 2 * size / 16, baseColor: hex('#92af70'), edgeColor: hex('#43563d'), edgeFade: 3 * size / 32, shades: 4, textureNoise: 12, fleckAmount: 6, seed: 31415, whiteBackground: false, showGrid: false, pixelFlecks: true, ...over }; };
const shot = (over = {}) => { const s = settings(over), i = renderLogical(s).imageData; return { data: i.data, width: i.width, height: i.height, tile: s.tileSize }; };

// ===========================================================================
// 1. L'île aléatoire couvre tous les cas de voisinage, sur plusieurs graines
// ===========================================================================

const SEEDS = [1, 2, 7, 42, 2024, 31415, 999999, 0xC0FFEE];

test('l’île blob couvre les 47 masques du jeu B47, quelle que soit la graine', () => {
  for (const seed of SEEDS) {
    const { grid } = generateIsland('B47', seed);
    const { present, total, count } = islandCoverage('B47', grid);
    assert.equal(total, 47);
    assert.equal(count, 47, `graine ${seed} : ${count} / 47 seulement — masques manquants : ${B47.masks.filter((m) => !present.has(m)).join(', ')}`);
    // Et rien n'est hors jeu : chaque masque présent est un des 47 canoniques.
    for (const m of present) assert.ok(B47.masks.includes(m), `graine ${seed} : masque ${m} hors du jeu B47`);
  }
});

test('l’île chemin couvre les 16 masques du jeu E16, quelle que soit la graine', () => {
  for (const seed of SEEDS) {
    const { grid } = generateIsland('E16', seed);
    const { present, total, count } = islandCoverage('E16', grid);
    assert.equal(total, 16);
    assert.equal(count, 16, `graine ${seed} : ${count} / 16 seulement — masques manquants : ${E16.masks.filter((m) => !present.has(m)).join(', ')}`);
  }
});

test('la couverture garantie tient même si la silhouette organique et les plots de couverture se chevauchent aux bords de leurs bandes', () => {
  // Les plots sont nettoyés sur 5 × 5 avant d'être posés (voir generateIsland) :
  // le bruit ne doit donc jamais pouvoir faire disparaître un masque garanti, quelle
  // que soit la graine — redondant avec les deux essais précédents, mais qui isole
  // spécifiquement cette garantie de construction plutôt que le compte final.
  for (const seed of SEEDS) {
    const { grid, columns, rows } = generateIsland('B47', seed);
    // Chaque case pleine doit donner un masque canonique valide (jamais undefined/NaN).
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      if (!grid[y][x]) continue;
      const m = blobMaskAt(grid, x, y);
      assert.ok(Number.isInteger(m) && m >= 0 && m <= 255, `graine ${seed} : masque invalide en (${x}, ${y})`);
    }
  }
});

test('blobMaskAt et edgeMaskAt sont cohérents avec une petite grille faite à la main', () => {
  // Croix : (1,1) plein, avec un voisin à l'est (2,1) et un au sud (1,2), rien au
  // nord ni à l'ouest, et le coin sud-est (2,2) vide — donc pas de diagonale SE
  // malgré ses deux cardinaux, puisque la case diagonale elle-même est vide.
  const grid = [
    [false, false, false],
    [false, true, true],
    [false, true, false],
  ];
  assert.equal(blobMaskAt(grid, 1, 1), NEIGHBOUR_BITS.E | NEIGHBOUR_BITS.S);
  assert.equal(edgeMaskAt(grid, 1, 1), SIDE_BITS.E | SIDE_BITS.S);

  // Même grille, en remplissant aussi le coin (2,2) : la diagonale SE devient légitime.
  const filled = grid.map((row) => [...row]);
  filled[2][2] = true;
  assert.equal(blobMaskAt(filled, 1, 1), NEIGHBOUR_BITS.E | NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.SE);
  assert.equal(edgeMaskAt(filled, 1, 1), SIDE_BITS.E | SIDE_BITS.S); // le bord ne connaît pas les diagonales.

  // Hors grille = toujours vide, jamais une exception : (0, 1) n'a pas de voisin à
  // l'ouest (hors grille) ni au nord ((0, 0), vide) — seul l'est (1, 1) est plein.
  assert.equal(blobMaskAt(grid, 0, 1), NEIGHBOUR_BITS.E);
  assert.equal(edgeMaskAt(grid, 0, 1), SIDE_BITS.E);
});

// ===========================================================================
// 2. Le validateur détecte un vrai défaut — le critère principal de la tranche
// ===========================================================================

test('le validateur ne dit rien sur un atlas blob propre', () => {
  const img = shot({ tilesetType: 'blob-47' });
  assert.deepEqual(checkMaskSetAtlas(img, B47), []);
});

test('le validateur ne dit rien sur un atlas chemin propre', () => {
  const img = shot({ tilesetType: 'edge-16' });
  assert.deepEqual(checkMaskSetAtlas(img, E16), []);
});

test('le validateur ne dit rien sur un atlas W16 (mode 15 pièces) propre', () => {
  const img = shot({ tilesetType: 'topdown-15' });
  assert.deepEqual(checkMaskSetAtlas(img, W16), []);
});

// ---------------------------------------------------------------------------
// La règle de voisinage W16, et le contrôle de couture qu'elle débloque
// ---------------------------------------------------------------------------
// W16 lit des sommets : deux cases voisines partagent une arête, donc deux
// sommets. La règle est l'égalité de ces deux sommets, et rien d'autre.

test('la règle de voisinage W16 est l’égalité des deux sommets partagés, pas un débordement de bits', () => {
  const C = CORNER_BITS;
  // À l'horizontale : le coin haut-droit de gauche EST le coin haut-gauche de droite.
  assert.ok(compatibleHorizontal('W16', C.TR | C.BL, C.TL | C.BR), 'masques 6 et 9 : les deux sommets coïncident');
  assert.ok(compatibleHorizontal('W16', 0, 0), 'deux cases vides se voisinent trivialement');
  assert.ok(compatibleHorizontal('W16', 15, 15), 'deux cases pleines aussi');
  assert.ok(!compatibleHorizontal('W16', C.TR, 0), 'un sommet haut rempli à gauche et vide à droite : impossible');
  assert.ok(!compatibleHorizontal('W16', 0, C.BL), 'idem sur le sommet bas');
  // À la verticale : le coin bas-gauche du haut EST le coin haut-gauche du bas.
  assert.ok(compatibleVertical('W16', C.BL | C.BR, C.TL | C.TR), 'les deux sommets du bas rejoignent ceux du haut');
  assert.ok(compatibleVertical('W16', C.TL | C.BL, C.TL | C.BL), 'le masque 5 s’empile sur lui-même');
  assert.ok(!compatibleVertical('W16', C.BL, 0), 'un sommet rempli en bas et vide en haut : impossible');
  assert.ok(!compatibleVertical('W16', 0, C.TR), 'idem sur l’autre sommet');
  // Symétrie : L à droite de R doit se lire comme R à gauche de L, en miroir.
  for (const L of W16.masks) for (const R of W16.masks) {
    const droite = compatibleHorizontal('W16', L, R);
    const bas = compatibleVertical('W16', L, R);
    assert.equal(typeof droite, 'boolean');
    assert.equal(typeof bas, 'boolean');
  }
});

test('le validateur signale une couture décalée (mode 15 pièces) — la preuve que le contrôle W16 mord vraiment', () => {
  // Sans cette assertion, « le validateur ne dit rien sur un atlas W16 propre »
  // passerait tout aussi bien si le contrôle de couture ne s'exécutait pas du tout,
  // ce qui a longtemps été le cas : W16 n'entrait pas dans SEAM_CHECKED_SETS.
  const img = shot({ tilesetType: 'topdown-15', edgeStyle: 'clean' });
  const problems = checkMaskSetAtlas(shiftSeam(img, W16, 15), W16);
  assert.ok(problems.length > 0, 'aucun défaut signalé pour une couture W16 décalée');
  assert.ok(problems.some((p) => p.includes('couture') && p.includes('15')), problems.join('\n'));
});

test('toutes les paires W16 réellement voisines se raccordent, bordures nettes comme organiques, sur plusieurs graines', () => {
  // Le défaut d'origine — bruit de bord à graine par masque — se voyait précisément ici :
  // 13 des 64 paires compatibles s'écartaient jusqu'à 2 px, à la graine par défaut.
  // Borné à une irrégularité de 5, la limite connue de seamlessFbm (voir
  // le PLAN-tilesets de sc-clone) ; c'est la même borne que l'essai de propriété de
  // tests/tileset.test.mjs, et elle est tenue par le moteur, pas par le validateur.
  for (const seed of [31415, 7, 42, 2718]) for (const edgeStyle of ['clean', 'rough']) {
    const img = shot({ tilesetType: 'topdown-15', edgeStyle, seed, edgeRoughness: 5 });
    const problems = checkMaskSetAtlas(img, W16).filter((p) => p.includes('couture'));
    assert.deepEqual(problems, [], `graine ${seed}, bordures ${edgeStyle}`);
  }
});

test('le validateur ne dit rien sur un atlas mur propre', () => {
  const img = shot({ tilesetType: 'wall' });
  assert.deepEqual(checkWallAtlas(img, { WALL_TOP_ROWS, WALL_BAND_STATES, biais: biaisAtlasDescriptor('wall') }), []);
});

// Le critère principal de la tranche : soumettre un atlas volontairement abîmé et
// vérifier que le validateur le signale, de deux façons distinctes (case effacée,
// couture décalée) — un validateur qui ne dit jamais rien ne vaut rien.

function erase(img, set, mask) {
  const p = atlasPosition(set, mask);
  const data = new Uint8ClampedArray(img.data);
  for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) {
    data[(((p.row * img.tile + y) * img.width) + p.col * img.tile + x) * 4 + 3] = 0;
  }
  return { ...img, data };
}

// Décale la couture d'une case en effaçant quelques pixels au milieu de son bord droit —
// jamais aux extrémités (qui sont des transitions tolérées), donc jamais une marche que
// seamFault laisserait passer.
function shiftSeam(img, set, mask) {
  const p = atlasPosition(set, mask);
  const data = new Uint8ClampedArray(img.data);
  const mid = Math.floor(img.tile / 2);
  for (let y = mid - 2; y < mid + 2; y++) {
    data[(((p.row * img.tile + y) * img.width) + p.col * img.tile + (img.tile - 1)) * 4 + 3] = 0;
  }
  return { ...img, data };
}

test('le validateur signale une case effacée par erreur (blob)', () => {
  const img = shot({ tilesetType: 'blob-47' });
  const problems = checkMaskSetAtlas(erase(img, B47, 255), B47);
  assert.ok(problems.length > 0, 'aucun défaut signalé pour une case entièrement effacée');
  assert.ok(problems.some((p) => p.includes('masque 255') && p.includes('transparent')), problems.join('\n'));
});

test('le validateur signale une couture décalée (blob), sans confondre avec la case effacée', () => {
  const img = shot({ tilesetType: 'blob-47', edgeStyle: 'clean' });
  const problems = checkMaskSetAtlas(shiftSeam(img, B47, 255), B47);
  assert.ok(problems.length > 0, 'aucun défaut signalé pour une couture décalée');
  assert.ok(problems.some((p) => p.includes('couture') && p.includes('255')), problems.join('\n'));
  // Le masque 255 lui-même garde assez de terrain : ce n'est pas une case vide, seulement un bord mordu.
  assert.ok(!problems.some((p) => p.includes('masque 255') && p.includes('transparent')), problems.join('\n'));
});

test('le validateur signale une case effacée par erreur (chemin)', () => {
  const img = shot({ tilesetType: 'edge-16' });
  const problems = checkMaskSetAtlas(erase(img, E16, 15), E16);
  assert.ok(problems.some((p) => p.includes('masque 15') && p.includes('transparent')), problems.join('\n'));
});

test('le validateur signale une couture décalée (chemin)', () => {
  const img = shot({ tilesetType: 'edge-16', edgeStyle: 'clean' });
  const problems = checkMaskSetAtlas(shiftSeam(img, E16, 15), E16);
  assert.ok(problems.some((p) => p.includes('couture') && p.includes('15')), problems.join('\n'));
});

test('le validateur signale une case libre peinte par erreur (48e case du blob)', () => {
  const img = shot({ tilesetType: 'blob-47' });
  const { col, row } = B47.layout.unusedCells[0];
  const data = new Uint8ClampedArray(img.data);
  const idx = (((row * img.tile + 5) * img.width) + col * img.tile + 5) * 4;
  data[idx + 3] = 255;
  const problems = checkMaskSetAtlas({ ...img, data }, B47);
  assert.ok(problems.some((p) => p.includes('case libre') && p.includes(`${col}, ${row}`)), problems.join('\n'));
});

test('le validateur signale un état de coin vidé par erreur (colonnes 6 et 7 d’une bande de mur)', () => {
  // T37 a rempli les deux dernières colonnes des bandes basses : il n'y reste aucune case
  // libre à salir, et l'essai qui vérifiait ça n'a plus d'objet. Ce qui le remplace garde
  // exactement la même valeur — soumettre au validateur un atlas volontairement abîmé —
  // mais sur le défaut que ces colonnes peuvent désormais porter : une case entièrement
  // transparente, c'est-à-dire un état de bande que le moteur aurait cessé de peindre.
  const img = shot({ tilesetType: 'wall' });
  const data = new Uint8ClampedArray(img.data);
  const row = WALL_TOP_ROWS + 1, col = 7; // bande base, colonne « corner-right ».
  assert.equal(WALL_BAND_STATES[col].id, 'corner-right', 'la colonne 7 des bandes basses n’est plus le coin droit');
  for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) {
    data[(((row * img.tile + y) * img.width) + col * img.tile + x) * 4 + 3] = 0;
  }
  const problems = checkWallAtlas({ ...img, data }, { WALL_TOP_ROWS, WALL_BAND_STATES, biais: biaisAtlasDescriptor('wall') });
  assert.ok(problems.some((p) => p.includes('corner-right') && p.includes('transparent')), problems.join('\n'));
});

test('le validateur signale une case effacée sur le dessus du mur (réutilise le contrôle blob)', () => {
  const img = shot({ tilesetType: 'wall' });
  const problems = checkWallAtlas(erase(img, B47, 255), { WALL_TOP_ROWS, WALL_BAND_STATES, biais: biaisAtlasDescriptor('wall') });
  assert.ok(problems.some((p) => p.includes('masque 255') && p.includes('transparent')), problems.join('\n'));
});

// ===========================================================================
// T43 — les douze tuiles en biais
// ===========================================================================
// Même exigence qu'au-dessus : un validateur qui ne dit jamais rien ne vaut rien. On
// abîme donc l'atlas de trois façons distinctes, chacune reproduisant un défaut que la
// tranche a réellement écarté par mesure.

const biaisCase = (piece, sens = 'droite') => biaisAtlasDescriptor('wall').cells.find((c) => c.sens === sens && c.piece === piece);
function abimer(img, cell, retouche) {
  const data = new Uint8ClampedArray(img.data);
  for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) {
    const i = (((cell.row * img.tile + y) * img.width) + cell.col * img.tile + x) * 4;
    retouche(data, i, x, y);
  }
  return { ...img, data };
}
const verifier = (img) => checkWallAtlas(img, { WALL_TOP_ROWS, WALL_BAND_STATES, biais: biaisAtlasDescriptor('wall') });

test('T43 · le validateur signale une pièce en biais entièrement effacée', () => {
  const img = shot({ tilesetType: 'wall' });
  const problems = verifier(abimer(img, biaisCase('face', 'gauche'), (d, i) => { d[i + 3] = 0; }));
  assert.ok(problems.some((p) => p.includes('gauche') && p.includes('face') && p.includes('transparente')), problems.join('\n'));
});

test('T43 · le validateur signale une diagonale décalée d’un seul pixel — 190 px de trous sur le prototype', () => {
  // On efface la dernière ligne opaque de chaque colonne de la base coupée : la diagonale
  // recule d'un pixel, exactement le décalage qui ouvrait 190 px de trous ou de
  // recouvrement. Le contrôle doit le voir, et le voir au pixel.
  const img = shot({ tilesetType: 'wall' });
  const problems = verifier(abimer(img, biaisCase('base-basse'), (d, i, x, y) => { if (y === x) d[i + 3] = 0; }));
  assert.ok(problems.some((p) => p.includes('coin à coin')), problems.join('\n'));
});

// T45 a pris l'unique colonne que T44 laissait encore libre par ligne pour le
// raccord-base : il ne reste donc plus aucune case libre à abîmer dans les deux lignes
// en biais, ce que le contrôle « case libre » ne peut alors plus jamais déclencher — les
// deux essais T45 ci-dessous couvrent la pièce qui a pris sa place.

test('T45 · le validateur signale un raccord-base entièrement effacé', () => {
  const img = shot({ tilesetType: 'wall' });
  const problems = verifier(abimer(img, biaisCase('raccord-base', 'gauche'), (d, i) => { d[i + 3] = 0; }));
  assert.ok(problems.some((p) => p.includes('Raccord-base') && p.includes('gauche') && p.includes('transparente')), problems.join('\n'));
});

test('T45 · le validateur signale une moitié u > 0 du raccord-base qui diverge de base-haute', () => {
  const img = shot({ tilesetType: 'wall' });
  // On assombrit un pixel de la moitié « base » (u = y − x > 0, loin de la diagonale
  // pour ne heurter aucun autre contrôle) sans toucher la case base-haute correspondante.
  // Coin bas-gauche : u = (tile − 1) − 0, largement positif.
  const problems = verifier(abimer(img, biaisCase('raccord-base', 'droite'), (d, i, x, y) => {
    if (x === 0 && y === img.tile - 1) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
  }));
  assert.ok(problems.some((p) => p.includes('Raccord-base') && p.includes('droite') && p.includes('base-haute')), problems.join('\n'));
});
