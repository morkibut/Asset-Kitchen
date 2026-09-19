// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
// Essais des tables masque → moteur. Le livrable, autant que le module :
// un indice décalé ne se voit dans aucun rendu, seulement ici.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  TILE_MASK_SETS, W16, B47, E16,
  CORNER_BITS, NEIGHBOUR_BITS, SIDE_BITS,
  GODOT_TERRAIN_MODES, GODOT_NO_TERRAIN, GODOT_CELL_NEIGHBORS, GODOT_PEERING_PREFIX,
  WANGID_ORDER, W16_ATLAS_GRID,
  isCanonicalBlobMask, maskSet, atlasPosition, maskAtPosition,
  godotPeeringBits, godotPeeringProperties, maskFromGodotPeeringBits,
  tiledWangId, tiledWangIdString, maskFromTiledWangId,
} from '../tile-masks.js';
import { layout as engineLayout } from '../vendor/tileset-engine.js';
// `exports.js` (le `terrainLayout` de sc-clone, qui vérifiait aussi l'export Godot/Tiled en
// JS) n'est pas porté ici — TU1 ne recopie que le moteur, et l'export équivalent de gag2 est
// en Python (TU4). Le test ci-dessous ne compare donc plus qu'au moteur, pas à un export.

const ALL_SETS = Object.values(TILE_MASK_SETS);

// --- 1. Le compte du blob et la règle de canonicalisation ------------------

test('le blob compte exactement 47 masques, et ce sont exactement les canoniques', () => {
  assert.equal(B47.masks.length, 47);
  // Aucun masque gardé ne viole la règle diagonale ⇒ deux cardinaux adjacents.
  for (const mask of B47.masks) {
    for (const [diagonal, cardinals] of [
      [NEIGHBOUR_BITS.NE, NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.E],
      [NEIGHBOUR_BITS.SE, NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.E],
      [NEIGHBOUR_BITS.SW, NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.W],
      [NEIGHBOUR_BITS.NW, NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.W],
    ]) {
      if (mask & diagonal) assert.equal(mask & cardinals, cardinals, `masque ${mask} : diagonale sans ses deux cardinaux`);
    }
  }
  // Et aucun canonique n'a été oublié : l'ensemble gardé == l'ensemble filtré.
  const kept = new Set(B47.masks);
  for (let mask = 0; mask < 256; mask++) assert.equal(kept.has(mask), isCanonicalBlobMask(mask), `masque ${mask}`);
  // Deux cas limites de la règle, écrits à la main.
  assert.ok(isCanonicalBlobMask(NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.E | NEIGHBOUR_BITS.NE));
  assert.ok(!isCanonicalBlobMask(NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.NE)); // NE sans E
});

test('les jeux de coins et de bords énumèrent bien leurs 16 combinaisons', () => {
  assert.deepEqual(W16.masks, Array.from({ length: 16 }, (_, i) => i));
  assert.deepEqual(E16.masks, Array.from({ length: 16 }, (_, i) => i));
  assert.deepEqual(CORNER_BITS, { TL: 1, TR: 2, BL: 4, BR: 8 });
  assert.deepEqual(SIDE_BITS, { N: 1, E: 2, S: 4, W: 8 });
  assert.deepEqual(NEIGHBOUR_BITS, { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 });
});

// --- 2. Dispositions d'atlas -----------------------------------------------

test('chaque disposition place chaque masque une fois, sans collision ni trou non voulu', () => {
  for (const set of ALL_SETS) {
    const { layout } = set;
    assert.equal(layout.positions.length, set.masks.length, `${set.id} : positions ≠ masques`);
    const seenCells = new Set();
    const seenMasks = new Set();
    for (const { mask, col, row } of layout.positions) {
      assert.ok(col >= 0 && col < layout.columns && row >= 0 && row < layout.rows, `${set.id} : (${col}, ${row}) hors grille`);
      assert.ok(!seenCells.has(`${col}:${row}`), `${set.id} : collision en (${col}, ${row})`);
      assert.ok(!seenMasks.has(mask), `${set.id} : masque ${mask} placé deux fois`);
      seenCells.add(`${col}:${row}`);
      seenMasks.add(mask);
      assert.equal(maskAtPosition(set, col, row), mask);
      assert.deepEqual(atlasPosition(set.id, mask), { mask, col, row, index: row * layout.columns + col });
    }
    assert.deepEqual([...seenMasks].sort((a, b) => a - b), [...set.masks].sort((a, b) => a - b));
    // Les cases libres sont comptées, donc voulues, et documentées par `note`.
    assert.equal(layout.unusedCells.length, layout.cells - set.masks.length, `${set.id} : trou non compté`);
    assert.ok(layout.note && layout.note.length > 0, `${set.id} : disposition non documentée`);
  }
  // Les tailles retenues, en dur : un changement de grille doit se voir ici.
  assert.deepEqual([W16.layout.columns, W16.layout.rows, W16.layout.unusedCells.length], [4, 4, 0]);
  assert.deepEqual([E16.layout.columns, E16.layout.rows, E16.layout.unusedCells.length], [4, 4, 0]);
  assert.deepEqual([B47.layout.columns, B47.layout.rows, B47.layout.unusedCells.length], [8, 6, 1]);
  // 47 est premier : la seule case libre du blob est la dernière, en (7, 5).
  assert.deepEqual(B47.layout.unusedCells[0], { col: 7, row: 5, index: 47 });
  assert.equal(maskAtPosition(B47, 7, 5), null);
  // E16 : rangement trivial, row × 4 + col.
  for (const mask of E16.masks) assert.deepEqual(atlasPosition(E16, mask), { mask, col: mask % 4, row: (mask - mask % 4) / 4, index: mask });
});

test('la grille W16 du module reste celle du moteur', () => {
  // Fait foi : `layout` du moteur, c'est lui qui peint les pixels. La comparaison à
  // `terrainLayout` (public/exports.js côté sc-clone) n'est pas reprise ici : cet export
  // Godot/Tiled n'est pas porté par TU1, il le sera en Python par TU4.
  assert.deepEqual(W16_ATLAS_GRID.map((row) => [...row]), engineLayout.map((row) => [...row]));
});

// --- 3. L'aller-retour ------------------------------------------------------

test('aller-retour masque → bits de peering Godot → masque, sur tous les masques', () => {
  for (const set of ALL_SETS) {
    const signatures = new Set();
    for (const mask of set.masks) {
      const bits = godotPeeringBits(set, mask);
      assert.deepEqual(Object.keys(bits), set.godot.peeringBits.map(([name]) => name), `${set.id} : ordre CellNeighbor`);
      assert.equal(maskFromGodotPeeringBits(set, bits), mask, `${set.id} : masque ${mask}`);
      // Avec un autre indice de terrain, la valeur suit mais le masque revient.
      const other = godotPeeringBits(set, mask, { terrain: 3 });
      assert.equal(maskFromGodotPeeringBits(set, other, { terrain: 3 }), mask, `${set.id} : masque ${mask}, terrain 3`);
      signatures.add(Object.values(bits).join(','));
    }
    // Injectivité : deux masques distincts ne peuvent pas produire les mêmes bits.
    assert.equal(signatures.size, set.masks.length, `${set.id} : bits de peering non injectifs`);
  }
});

test('aller-retour masque → wangid Tiled → masque, sur tous les masques', () => {
  for (const set of ALL_SETS) {
    const seen = new Set();
    for (const mask of set.masks) {
      const wangid = tiledWangId(set, mask);
      assert.equal(wangid.length, 8, `${set.id} : un wangid a huit indices`);
      assert.equal(maskFromTiledWangId(set, wangid), mask, `${set.id} : masque ${mask}`);
      // La chaîne du format XML doit se relire aussi bien que le tableau.
      assert.equal(maskFromTiledWangId(set, tiledWangIdString(set, mask)), mask, `${set.id} : masque ${mask}, forme chaîne`);
      // Une deuxième couleur de wangset ne change rien au retour.
      assert.equal(maskFromTiledWangId(set, tiledWangId(set, mask, { color: 2 }), { color: 2 }), mask, `${set.id} : masque ${mask}, couleur 2`);
      seen.add(wangid.join(','));
    }
    assert.equal(seen.size, set.masks.length, `${set.id} : wangids non injectifs`);
  }
});

test('les deux inverses refusent ce qui trahirait une table décalée', () => {
  // Un jeu de coins ne pose rien sur les côtés : une couleur de côté est une erreur.
  assert.throws(() => maskFromTiledWangId(W16, '1,0,0,0,0,0,0,0'), /top.*pas utilisée|pas utilisée/);
  // Un jeu de bords ne pose rien sur les coins.
  assert.throws(() => maskFromTiledWangId(E16, '0,1,0,0,0,0,0,0'), /pas utilisée/);
  // Longueur et valeurs contrôlées.
  assert.throws(() => maskFromTiledWangId(B47, '1,1,1,0,1,0,0'), /huit entiers/);
  assert.throws(() => maskFromTiledWangId(B47, '1,1,1,0,1,0,0,7'), /ni 0 ni 1/);
  // Un bit de peering manquant n'est pas un bit à zéro.
  assert.throws(() => maskFromGodotPeeringBits(W16, { top_left_corner: 0 }), /attendu les bits/);
  assert.throws(() => maskFromGodotPeeringBits(W16, { ...godotPeeringBits(W16, 5), extra: 0 }), /attendu les bits/);
  assert.throws(() => maskSet('B48'), /inconnu/);
  assert.throws(() => atlasPosition(B47, 3), /case d'atlas/); // 3 = N|NE, non canonique
});

// --- 4. Les cas témoins, vérifiés à la main contre la documentation ---------
// L'aller-retour ne voit pas une convention entièrement décalée ; ceux-ci, si.

test('témoin W16 — masque 11 (TL + TR + BR, coin bas-gauche manquant)', () => {
  const mask = CORNER_BITS.TL | CORNER_BITS.TR | CORNER_BITS.BR;
  assert.equal(mask, 11);
  assert.equal(W16.godot.mode, GODOT_TERRAIN_MODES.MATCH_CORNERS); // = 1
  assert.equal(W16.tiled.wangsetType, 'corner');
  assert.deepEqual(godotPeeringBits(W16, mask), {
    bottom_right_corner: 0, // BR posé
    bottom_left_corner: -1, // BL absent
    top_left_corner: 0,     // TL posé
    top_right_corner: 0,    // TR posé
  });
  // wangid dans l'ordre haut, haut-droite, droite, bas-droite, bas, bas-gauche,
  // gauche, haut-gauche : seules les quatre positions de coin sont servies.
  assert.equal(tiledWangIdString(W16, mask), '0,1,0,1,0,0,0,1');
  assert.deepEqual(godotPeeringProperties(W16, mask)[0], [`${GODOT_PEERING_PREFIX}/bottom_right_corner`, 0]);
});

test('témoin E16 — masque 3 (N + E, un coude nord-est)', () => {
  const mask = SIDE_BITS.N | SIDE_BITS.E;
  assert.equal(mask, 3);
  assert.equal(E16.godot.mode, GODOT_TERRAIN_MODES.MATCH_SIDES); // = 2
  assert.equal(E16.tiled.wangsetType, 'edge');
  assert.deepEqual(godotPeeringBits(E16, mask), {
    right_side: 0,   // E posé
    bottom_side: -1, // S absent
    left_side: -1,   // O absent
    top_side: 0,     // N posé
  });
  assert.equal(tiledWangIdString(E16, mask), '1,0,1,0,0,0,0,0');
});

test('témoin B47 — masque 23 (N + NE + E + S)', () => {
  const mask = NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.NE | NEIGHBOUR_BITS.E | NEIGHBOUR_BITS.S;
  assert.equal(mask, 23);
  assert.ok(isCanonicalBlobMask(mask)); // NE légitime : N et E sont posés
  assert.equal(B47.godot.mode, GODOT_TERRAIN_MODES.MATCH_CORNERS_AND_SIDES); // = 0
  assert.equal(B47.tiled.wangsetType, 'mixed');
  assert.deepEqual(godotPeeringBits(B47, mask), {
    right_side: 0,            // E
    bottom_right_corner: -1,  // SE absent
    bottom_side: 0,           // S
    bottom_left_corner: -1,   // SO absent
    left_side: -1,            // O absent
    top_left_corner: -1,      // NO absent
    top_side: 0,              // N
    top_right_corner: 0,      // NE
  });
  assert.equal(tiledWangIdString(B47, mask), '1,1,1,0,1,0,0,0');
});

test('les noms de bits employés sont tous des CellNeighbor valides sur tuile carrée', () => {
  assert.deepEqual(Object.keys(GODOT_CELL_NEIGHBORS), [
    'right_side', 'bottom_right_corner', 'bottom_side', 'bottom_left_corner',
    'left_side', 'top_left_corner', 'top_side', 'top_right_corner',
  ]);
  assert.deepEqual(WANGID_ORDER, ['top', 'top_right', 'right', 'bottom_right', 'bottom', 'bottom_left', 'left', 'top_left']);
  for (const set of ALL_SETS) {
    const names = set.godot.peeringBits.map(([name]) => name);
    for (const name of names) assert.ok(name in GODOT_CELL_NEIGHBORS, `${set.id} : ${name}`);
    // L'ordre suit la valeur d'énumération, comme la sérialisation de Godot.
    const ids = names.map((name) => GODOT_CELL_NEIGHBORS[name]);
    assert.deepEqual(ids, [...ids].sort((a, b) => a - b), `${set.id} : ordre CellNeighbor non croissant`);
    // Mode ↔ nature des bits : coins seuls, côtés seuls, ou les deux.
    const corners = names.filter((name) => name.endsWith('_corner')).length;
    const sides = names.filter((name) => name.endsWith('_side')).length;
    if (set.godot.mode === GODOT_TERRAIN_MODES.MATCH_CORNERS) assert.deepEqual([corners, sides], [4, 0]);
    if (set.godot.mode === GODOT_TERRAIN_MODES.MATCH_SIDES) assert.deepEqual([corners, sides], [0, 4]);
    if (set.godot.mode === GODOT_TERRAIN_MODES.MATCH_CORNERS_AND_SIDES) assert.deepEqual([corners, sides], [4, 4]);
  }
});

// --- 5. Les masques pleins --------------------------------------------------

test('W16 = 15 et blob = 255 raccordent tous leurs bits', () => {
  const corners = godotPeeringBits(W16, 15);
  assert.equal(Object.keys(corners).length, 4);
  for (const value of Object.values(corners)) assert.equal(value, 0);
  assert.notEqual(GODOT_NO_TERRAIN, 0);
  assert.equal(tiledWangIdString(W16, 15), '0,1,0,1,0,1,0,1'); // quatre coins, côtés muets

  assert.ok(B47.masks.includes(255));
  const blob = godotPeeringBits(B47, 255);
  assert.equal(Object.keys(blob).length, 8);
  for (const value of Object.values(blob)) assert.equal(value, 0);
  assert.equal(tiledWangIdString(B47, 255), '1,1,1,1,1,1,1,1');

  // Et le tout-vide : aucun bit raccordé, aucune couleur posée.
  for (const value of Object.values(godotPeeringBits(B47, 0))) assert.equal(value, GODOT_NO_TERRAIN);
  assert.equal(tiledWangIdString(B47, 0), '0,0,0,0,0,0,0,0');
  assert.equal(tiledWangIdString(W16, 0), '0,0,0,0,0,0,0,0');
});
