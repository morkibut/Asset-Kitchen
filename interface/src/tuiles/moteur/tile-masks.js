// ---------------------------------------------------------------------------
// Tables de correspondance masque → moteur (Godot 4, Tiled 1.5+).
//
// Pourquoi ce fichier est bavard là où le reste de public/ est dense : un seul
// indice faux ici casse l'autotiling *en silence*. Le tileset s'importe,
// s'affiche, et l'artiste ne découvre le problème qu'en peignant — aucun rendu
// ne le révèle. C'est une table de référence : elle se relit, donc chaque
// indice porte la raison de sa présence.
//
// Aucune dépendance : le module est importable aussi bien par le navigateur que
// par les scripts Node (comme public/exports.js et public/pixel-core.js le sont
// déjà depuis scripts/godot-validation.mjs).
//
// Documentation confrontée le 2026-09-13 (voir « Ce que la doc dit » plus bas) :
//   - https://docs.godotengine.org/en/stable/classes/class_tileset.html
//   - https://docs.godotengine.org/en/stable/classes/class_tiledata.html
//   - https://doc.mapeditor.org/en/stable/reference/tmx-map-format/
//   - https://doc.mapeditor.org/en/stable/reference/json-map-format/
// ---------------------------------------------------------------------------

// ===========================================================================
// 0. Ce que la doc dit
// ===========================================================================
//
// GODOT 4 — TileSet.TerrainMode
//   TERRAIN_MODE_MATCH_CORNERS_AND_SIDES = 0
//   TERRAIN_MODE_MATCH_CORNERS           = 1
//   TERRAIN_MODE_MATCH_SIDES             = 2
//   Écrit dans le .tres sous la forme `terrain_set_<n>/mode = <entier>`.
//
// GODOT 4 — TileSet.CellNeighbor donne le *nom* de chaque bit de peering. Sur
//   une tuile carrée, seuls huit voisins sur les seize de l'énumération sont
//   valides (les quatre côtés et les quatre coins) ; les autres
//   (RIGHT_CORNER, BOTTOM_CORNER, LEFT_CORNER, TOP_CORNER, et les côtés
//   diagonaux) servent aux formes isométriques et demi-décalées.
//   La propriété s'écrit `<coords>/<alt>/terrains_peering_bit/<nom>`, le nom
//   étant la constante CellNeighbor en minuscules sans le préfixe.
//   Valeur : l'indice du terrain qui se raccorde par ce bit, ou -1 sinon
//   (TileData.terrain vaut lui aussi -1 par défaut, « pas de terrain »).
//   Le mode restreint les bits valides : coins seuls en mode 1, côtés seuls en
//   mode 2, les huit en mode 0.
//
// TILED 1.5+ — <wangtile wangid="…"> : « The Wang ID, since Tiled 1.5 given by
//   a comma-separated list of indexes (0-254) referring to the Wang colors in
//   the Wang set in the order: top, top-right, right, bottom-right, bottom,
//   bottom-left, left, top-left. Index 0 means *unset* and index 1 refers to
//   the first Wang color. »  L'ordre du plan est donc confirmé mot pour mot.
//
// TILED — type de wangset. **Démenti partiel du plan** : le champ `type`
//   (`corner` | `edge` | `mixed`) est documenté pour le format **JSON**
//   (.tmj/.tsj) seulement. La page TMX ne liste, pour <wangset>, que `name`,
//   `class` et `tile` — pas de `type`. Tiled déduit le type des indices
//   réellement employés à la relecture d'un .tsx. On expose donc le type dans
//   les données (`tiled.wangsetType`), à écrire dans le JSON, et à omettre du
//   .tsx plutôt qu'à inventer.

// ===========================================================================
// 1. Les jeux de bits
// ===========================================================================

/** Coins (W16 / DG15). Bits imposés par le plan. */
export const CORNER_BITS = { TL: 1, TR: 2, BL: 4, BR: 8 };

/** Huit voisins (blob B47). Sens horaire depuis le nord. */
export const NEIGHBOUR_BITS = { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 };

/** Quatre côtés (bord E16). `W` = ouest, noté `O` dans le plan (identifiants en anglais). */
export const SIDE_BITS = { N: 1, E: 2, S: 4, W: 8 };

/** TileSet.TerrainMode de Godot 4. */
export const GODOT_TERRAIN_MODES = {
  MATCH_CORNERS_AND_SIDES: 0,
  MATCH_CORNERS: 1,
  MATCH_SIDES: 2,
};

/** Préfixe de propriété .tres pour un bit de peering. */
export const GODOT_PEERING_PREFIX = 'terrains_peering_bit';

/**
 * Valeur d'un bit de peering qui ne se raccorde pas. Même convention que
 * TileData.terrain : -1 signifie « aucun terrain ».
 */
export const GODOT_NO_TERRAIN = -1;

/**
 * TileSet.CellNeighbor — les huit voisins valides sur une tuile carrée, avec
 * leur valeur d'énumération. L'ordre de cet objet est celui de l'énumération
 * elle-même : c'est l'ordre dans lequel Godot sérialise les propriétés, donc
 * celui qu'on reproduit pour qu'un .tres écrit par nous et un .tres réenregistré
 * par l'éditeur se comparent ligne à ligne.
 */
export const GODOT_CELL_NEIGHBORS = {
  right_side: 0,
  bottom_right_corner: 3,
  bottom_side: 4,
  bottom_left_corner: 7,
  left_side: 8,
  top_left_corner: 11,
  top_side: 12,
  top_right_corner: 15,
};

/**
 * Ordre des huit indices d'un `wangid` Tiled. À ne jamais réordonner : c'est
 * l'ordre du format, pas un choix de notre part.
 */
export const WANGID_ORDER = [
  'top',
  'top_right',
  'right',
  'bottom_right',
  'bottom',
  'bottom_left',
  'left',
  'top_left',
];

/** `0` = indice non défini dans un wangid. */
export const WANG_UNSET = 0;

// ===========================================================================
// 2. Énumération des masques
// ===========================================================================

/** Les 2^n masques d'un jeu de n bits, dans l'ordre croissant. */
function allMasks(bits) {
  const full = Object.values(bits).reduce((a, b) => a | b, 0);
  return Array.from({ length: full + 1 }, (_, m) => m);
}

/**
 * Règle de canonicalisation du blob : un bit diagonal n'a de sens que si ses
 * deux cardinaux adjacents sont posés. Sinon la tuile décrirait un coin qui
 * « touche » en diagonale sans que la matière y arrive — cas que le rendu ne
 * sait pas dessiner et que l'autotiler n'atteint jamais.
 */
const BLOB_IMPLICATIONS = [
  [NEIGHBOUR_BITS.NE, NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.E],
  [NEIGHBOUR_BITS.SE, NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.E],
  [NEIGHBOUR_BITS.SW, NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.W],
  [NEIGHBOUR_BITS.NW, NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.W],
];

/** Vrai si `mask` respecte les quatre implications diagonale ⇒ cardinaux. */
export function isCanonicalBlobMask(mask) {
  return BLOB_IMPLICATIONS.every(([diagonal, cardinals]) => !(mask & diagonal) || (mask & cardinals) === cardinals);
}

/** Les 256 voisinages filtrés par la règle ci-dessus. Doit en rendre 47. */
function enumerateBlobMasks() {
  const kept = [];
  for (let mask = 0; mask < 256; mask++) if (isCanonicalBlobMask(mask)) kept.push(mask);
  return kept;
}

const BLOB_MASKS = enumerateBlobMasks();

// Assertion, pas commentaire : si l'énumération dérive, le module refuse de se
// charger plutôt que de livrer un atlas au mauvais compte.
if (BLOB_MASKS.length !== 47) {
  throw new Error(`tile-masks : le blob canonique compte ${BLOB_MASKS.length} masques au lieu de 47.`);
}

// ===========================================================================
// 3. Dispositions d'atlas
// ===========================================================================

/**
 * W16 — la disposition 4 × 4 existe déjà en deux exemplaires identiques dans le
 * dépôt. **Celle qui fait foi est `layout` de public/vendor/tileset-engine.js**,
 * parce que c'est elle qui peint réellement les pixels : `terrainLayout` de
 * public/exports.js n'en est que la copie côté écriture .tres, et un .tres qui
 * s'écarterait du rendu serait faux, pas l'inverse.
 * On la recopie ici pour que ce module reste autonome ; l'essai
 * tests/tile-masks.test.mjs confronte les trois valeurs et casse si l'une dérive.
 */
export const W16_ATLAS_GRID = [
  [4, 10, 13, 12],
  [9, 14, 15, 7],
  [2, 3, 11, 5],
  [0, 8, 6, 1],
];

/** Construit l'objet disposition à partir d'une liste de positions déjà placées. */
function makeLayout({ columns, rows, positions, note }) {
  const byMask = new Map();
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => null));
  for (const position of positions) {
    if (position.col < 0 || position.col >= columns || position.row < 0 || position.row >= rows) {
      throw new Error(`tile-masks : position (${position.col}, ${position.row}) hors de la grille ${columns} × ${rows}.`);
    }
    if (grid[position.row][position.col] !== null) {
      throw new Error(`tile-masks : deux masques à la position (${position.col}, ${position.row}).`);
    }
    if (byMask.has(position.mask)) {
      throw new Error(`tile-masks : le masque ${position.mask} est placé deux fois.`);
    }
    grid[position.row][position.col] = position.mask;
    byMask.set(position.mask, position);
  }
  const unusedCells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (grid[row][col] === null) unusedCells.push({ col, row, index: row * columns + col });
    }
  }
  return { columns, rows, cells: columns * rows, positions, grid, byMask, unusedCells, note };
}

/** Disposition lue dans une grille littérale (cas W16). */
function layoutFromGrid(gridRows, note) {
  const rows = gridRows.length;
  const columns = gridRows[0].length;
  const positions = [];
  gridRows.forEach((cells, row) => {
    if (cells.length !== columns) throw new Error('tile-masks : grille d\'atlas non rectangulaire.');
    cells.forEach((mask, col) => positions.push({ mask, col, row, index: row * columns + col }));
  });
  return makeLayout({ columns, rows, positions, note });
}

/** Disposition remplie de gauche à droite puis de haut en bas (cas B47 et E16). */
function layoutSequential(masks, columns, note) {
  const rows = Math.ceil(masks.length / columns);
  const positions = masks.map((mask, index) => ({
    mask,
    col: index % columns,
    row: Math.floor(index / columns),
    index,
  }));
  return makeLayout({ columns, rows, positions, note });
}

// ===========================================================================
// 4. Les trois jeux
// ===========================================================================

/**
 * Vérifie, à la construction, que les deux tables d'un jeu couvrent exactement
 * ses bits — une fois chacun, sans doublon ni oubli. C'est ce contrôle qui
 * attrape une ligne recopiée puis mal éditée.
 */
function buildSet(definition) {
  const { id, label, bits, masks, layout, godot, tiled } = definition;
  const bitValues = Object.values(bits);
  const fullMask = bitValues.reduce((a, b) => a | b, 0);

  // --- table Godot ---
  const seenNames = new Set();
  const seenGodotBits = new Set();
  for (const [name, bit] of godot.peeringBits) {
    if (!(name in GODOT_CELL_NEIGHBORS)) throw new Error(`tile-masks/${id} : « ${name} » n'est pas un CellNeighbor valide sur tuile carrée.`);
    if (seenNames.has(name)) throw new Error(`tile-masks/${id} : bit de peering « ${name} » listé deux fois.`);
    if (!bitValues.includes(bit)) throw new Error(`tile-masks/${id} : le bit ${bit} n'appartient pas au jeu.`);
    if (seenGodotBits.has(bit)) throw new Error(`tile-masks/${id} : le bit ${bit} est associé à deux bits de peering.`);
    seenNames.add(name);
    seenGodotBits.add(bit);
  }
  if (seenGodotBits.size !== bitValues.length) {
    throw new Error(`tile-masks/${id} : ${seenGodotBits.size} bits de peering pour ${bitValues.length} bits de masque.`);
  }

  // --- table Tiled ---
  if (tiled.wangSlots.length !== 8) throw new Error(`tile-masks/${id} : un wangid a huit indices, pas ${tiled.wangSlots.length}.`);
  const seenWangBits = new Set();
  for (const bit of tiled.wangSlots) {
    if (bit === 0) continue;
    if (!bitValues.includes(bit)) throw new Error(`tile-masks/${id} : le bit ${bit} n'appartient pas au jeu.`);
    if (seenWangBits.has(bit)) throw new Error(`tile-masks/${id} : le bit ${bit} occupe deux positions de wangid.`);
    seenWangBits.add(bit);
  }
  if (seenWangBits.size !== bitValues.length) {
    throw new Error(`tile-masks/${id} : ${seenWangBits.size} positions de wangid pour ${bitValues.length} bits de masque.`);
  }

  // --- masques et disposition ---
  for (const mask of masks) {
    if ((mask & ~fullMask) !== 0) throw new Error(`tile-masks/${id} : le masque ${mask} déborde des bits du jeu.`);
  }
  if (layout.positions.length !== masks.length) {
    throw new Error(`tile-masks/${id} : ${layout.positions.length} positions pour ${masks.length} masques.`);
  }

  return { id, label, bits, fullMask, masks, layout, godot, tiled };
}

/**
 * W16 — coins. Mode Godot « Match Corners » : quatre bits de coin, c'est déjà
 * ce qu'écrit `godotTileset` dans public/exports.js et qu'un essai verrouille
 * (tests/pixel.test.mjs). Côté Tiled, un jeu qui ne pose que des coins est de
 * type `corner` : les quatre positions de côté du wangid restent à 0.
 */
export const W16 = buildSet({
  id: 'W16',
  label: 'Coins (15 pièces + tuile vide)',
  bits: CORNER_BITS,
  masks: allMasks(CORNER_BITS),
  layout: layoutFromGrid(
    W16_ATLAS_GRID,
    'Grille 4 × 4 héritée du moteur SDF ; ordre non trié, il ne se change pas sans recuire les atlas existants. Le masque 0 (tuile vide) occupe la case (0, 3).',
  ),
  godot: {
    mode: GODOT_TERRAIN_MODES.MATCH_CORNERS,
    modeName: 'Match Corners',
    // Ordre CellNeighbor : 3, 7, 11, 15.
    peeringBits: [
      ['bottom_right_corner', CORNER_BITS.BR],
      ['bottom_left_corner', CORNER_BITS.BL],
      ['top_left_corner', CORNER_BITS.TL],
      ['top_right_corner', CORNER_BITS.TR],
    ],
  },
  tiled: {
    wangsetType: 'corner',
    // Ordre WANGID_ORDER : top, top-right, right, bottom-right, bottom,
    // bottom-left, left, top-left. Les quatre côtés valent 0 : un jeu de coins
    // ne dit rien des arêtes.
    wangSlots: [0, CORNER_BITS.TR, 0, CORNER_BITS.BR, 0, CORNER_BITS.BL, 0, CORNER_BITS.TL],
  },
});

/**
 * B47 — blob huit voisins. Mode Godot « Match Corners and Sides » : les huit
 * bits d'une tuile carrée. Côté Tiled, un jeu qui pose côtés *et* coins est de
 * type `mixed`.
 *
 * La correspondance est directe, et c'est la règle de canonicalisation qui la
 * rend légitime : un bit diagonal n'est posé que si ses deux cardinaux le sont,
 * donc « bit NE posé » veut bien dire « le coin haut-droite de la tuile est
 * entièrement dans le terrain » — exactement ce que Godot et Tiled attendent
 * d'un indice de coin, qui est partagé par quatre tuiles.
 */
export const B47 = buildSet({
  id: 'B47',
  label: 'Blob 47 (huit voisins canonicalisés)',
  bits: NEIGHBOUR_BITS,
  masks: BLOB_MASKS,
  layout: layoutSequential(
    BLOB_MASKS,
    8,
    'Grille 8 × 6 remplie par masque croissant, de gauche à droite puis de haut en bas. 47 masques pour 48 cases : la dernière case (7, 5) est vide **volontairement** — 47 est premier, aucun rectangle ne tombe juste.',
  ),
  godot: {
    mode: GODOT_TERRAIN_MODES.MATCH_CORNERS_AND_SIDES,
    modeName: 'Match Corners and Sides',
    // Ordre CellNeighbor : 0, 3, 4, 7, 8, 11, 12, 15.
    peeringBits: [
      ['right_side', NEIGHBOUR_BITS.E],
      ['bottom_right_corner', NEIGHBOUR_BITS.SE],
      ['bottom_side', NEIGHBOUR_BITS.S],
      ['bottom_left_corner', NEIGHBOUR_BITS.SW],
      ['left_side', NEIGHBOUR_BITS.W],
      ['top_left_corner', NEIGHBOUR_BITS.NW],
      ['top_side', NEIGHBOUR_BITS.N],
      ['top_right_corner', NEIGHBOUR_BITS.NE],
    ],
  },
  tiled: {
    wangsetType: 'mixed',
    // Le seul jeu où les huit positions du wangid servent, et où l'ordre du
    // format coïncide avec le sens horaire de NEIGHBOUR_BITS.
    wangSlots: [
      NEIGHBOUR_BITS.N,
      NEIGHBOUR_BITS.NE,
      NEIGHBOUR_BITS.E,
      NEIGHBOUR_BITS.SE,
      NEIGHBOUR_BITS.S,
      NEIGHBOUR_BITS.SW,
      NEIGHBOUR_BITS.W,
      NEIGHBOUR_BITS.NW,
    ],
  },
});

/**
 * E16 — bord quatre côtés (chemins, clôtures, rails, rivières). Mode Godot
 * « Match Sides ». Côté Tiled, type `edge` : les quatre positions de coin du
 * wangid restent à 0.
 */
const SIDE_MASKS = allMasks(SIDE_BITS);

export const E16 = buildSet({
  id: 'E16',
  label: 'Bord 16 (quatre côtés)',
  bits: SIDE_BITS,
  masks: SIDE_MASKS,
  layout: layoutSequential(
    SIDE_MASKS,
    4,
    'Grille 4 × 4 remplie par masque croissant : la case (col, row) porte le masque row × 4 + col. Aucune case libre.',
  ),
  godot: {
    mode: GODOT_TERRAIN_MODES.MATCH_SIDES,
    modeName: 'Match Sides',
    // Ordre CellNeighbor : 0, 4, 8, 12.
    peeringBits: [
      ['right_side', SIDE_BITS.E],
      ['bottom_side', SIDE_BITS.S],
      ['left_side', SIDE_BITS.W],
      ['top_side', SIDE_BITS.N],
    ],
  },
  tiled: {
    wangsetType: 'edge',
    wangSlots: [SIDE_BITS.N, 0, SIDE_BITS.E, 0, SIDE_BITS.S, 0, SIDE_BITS.W, 0],
  },
});

/** Les trois jeux, dans un ordre stable. */
export const TILE_MASK_SETS = { W16, B47, E16 };

/** Accepte indifféremment l'identifiant (`'B47'`) ou l'objet jeu. */
export function maskSet(set) {
  if (typeof set === 'string') {
    const found = TILE_MASK_SETS[set];
    if (!found) throw new Error(`tile-masks : jeu de masques inconnu « ${set} ».`);
    return found;
  }
  if (!set || !TILE_MASK_SETS[set.id]) throw new Error('tile-masks : jeu de masques inconnu.');
  return set;
}

// ===========================================================================
// 5. Disposition — accès
// ===========================================================================

/** Position `{ mask, col, row, index }` du masque dans l'atlas du jeu. */
export function atlasPosition(set, mask) {
  const resolved = maskSet(set);
  const found = resolved.layout.byMask.get(mask);
  if (!found) throw new Error(`tile-masks/${resolved.id} : le masque ${mask} n'a pas de case d'atlas.`);
  return found;
}

/** Masque occupant la case, ou `null` si la case est volontairement vide. */
export function maskAtPosition(set, col, row) {
  const { layout } = maskSet(set);
  if (col < 0 || col >= layout.columns || row < 0 || row >= layout.rows) return null;
  return layout.grid[row][col];
}

// ===========================================================================
// 6. Masque ⇄ bits de peering Godot
// ===========================================================================

/**
 * Bits de peering d'un masque, prêts à écrire dans un `.tres`.
 * @returns un objet `{ nom_du_bit: indice_de_terrain | -1 }`, dans l'ordre
 *   CellNeighbor. `terrain` est l'indice du terrain à raccorder (0 par défaut).
 */
export function godotPeeringBits(set, mask, { terrain = 0 } = {}) {
  const resolved = maskSet(set);
  if (terrain < 0) throw new Error('tile-masks : l\'indice de terrain doit être positif ou nul.');
  const bits = {};
  for (const [name, bit] of resolved.godot.peeringBits) {
    bits[name] = (mask & bit) ? terrain : GODOT_NO_TERRAIN;
  }
  return bits;
}

/**
 * Les mêmes bits sous forme de paires `[chemin de propriété, valeur]`, pour
 * qu'un écrivain de `.tres` n'ait plus qu'à préfixer par `<coords>/<alt>/`.
 */
export function godotPeeringProperties(set, mask, options) {
  return Object.entries(godotPeeringBits(set, mask, options)).map(([name, value]) => [
    `${GODOT_PEERING_PREFIX}/${name}`,
    value,
  ]);
}

/**
 * Inverse de `godotPeeringBits`. Sert d'abord aux essais : c'est l'aller-retour
 * qui attrape un indice décalé, qu'aucune relecture à l'œil n'attrape.
 * Strict volontairement — une clé en trop ou en moins est une erreur, pas un
 * bit à zéro.
 */
export function maskFromGodotPeeringBits(set, bits, { terrain = 0 } = {}) {
  const resolved = maskSet(set);
  const expected = resolved.godot.peeringBits.map(([name]) => name);
  const given = Object.keys(bits);
  if (given.length !== expected.length || !expected.every((name) => name in bits)) {
    throw new Error(`tile-masks/${resolved.id} : attendu les bits ${expected.join(', ')}, reçu ${given.join(', ') || '(rien)'}.`);
  }
  let mask = 0;
  for (const [name, bit] of resolved.godot.peeringBits) {
    const value = bits[name];
    if (value === terrain) mask |= bit;
    else if (value !== GODOT_NO_TERRAIN) {
      throw new Error(`tile-masks/${resolved.id} : le bit « ${name} » vaut ${value}, ni ${terrain} ni ${GODOT_NO_TERRAIN}.`);
    }
  }
  return mask;
}

// ===========================================================================
// 7. Masque ⇄ wangid Tiled
// ===========================================================================

/**
 * `wangid` d'un masque, sous forme de tableau de huit indices dans l'ordre
 * WANGID_ORDER. `color` est l'indice de la couleur du wangset (1 = première).
 */
export function tiledWangId(set, mask, { color = 1 } = {}) {
  const resolved = maskSet(set);
  if (color < 1 || color > 254) throw new Error('tile-masks : une couleur de wangset va de 1 à 254.');
  return resolved.tiled.wangSlots.map((bit) => (bit !== 0 && (mask & bit) ? color : WANG_UNSET));
}

/** Le même `wangid`, dans la forme attendue par l'attribut XML : « 0,1,0,1,… ». */
export function tiledWangIdString(set, mask, options) {
  return tiledWangId(set, mask, options).join(',');
}

/**
 * Inverse de `tiledWangId`. Accepte le tableau ou la chaîne séparée par des
 * virgules. Strict : une couleur posée sur une position que le jeu n'utilise
 * pas est une erreur — c'est exactement le symptôme d'une table décalée.
 */
export function maskFromTiledWangId(set, wangid, { color = 1 } = {}) {
  const resolved = maskSet(set);
  const indices = typeof wangid === 'string' ? wangid.split(',').map((part) => Number(part.trim())) : Array.from(wangid);
  if (indices.length !== 8 || indices.some((value) => !Number.isInteger(value))) {
    throw new Error(`tile-masks/${resolved.id} : un wangid est fait de huit entiers, reçu « ${wangid} ».`);
  }
  let mask = 0;
  indices.forEach((value, slot) => {
    const bit = resolved.tiled.wangSlots[slot];
    if (value === WANG_UNSET) return;
    if (value !== color) throw new Error(`tile-masks/${resolved.id} : la position ${WANGID_ORDER[slot]} vaut ${value}, ni 0 ni ${color}.`);
    if (bit === 0) throw new Error(`tile-masks/${resolved.id} : la position ${WANGID_ORDER[slot]} n'est pas utilisée par un wangset « ${resolved.tiled.wangsetType} ».`);
    mask |= bit;
  });
  return mask;
}

// ===========================================================================
// 8. Gel
// ===========================================================================
// Les tables sont partagées entre le navigateur et les scripts Node : une
// mutation accidentelle chez un consommateur casserait tous les autres.

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value) && !(value instanceof Map)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

deepFreeze(CORNER_BITS);
deepFreeze(NEIGHBOUR_BITS);
deepFreeze(SIDE_BITS);
deepFreeze(GODOT_TERRAIN_MODES);
deepFreeze(GODOT_CELL_NEIGHBORS);
deepFreeze(WANGID_ORDER);
deepFreeze(W16_ATLAS_GRID);
deepFreeze(TILE_MASK_SETS);
