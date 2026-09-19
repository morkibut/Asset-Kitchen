// ---------------------------------------------------------------------------
// Contrôle de couture et de couverture — partagé entre les essais
// (tests/tileset.test.mjs, tests/tile-check.test.mjs) et l'interface
// (public/tools.js, panneau « Teste les raccords » et bouton
// « Vérifier le tileset »).
//
// Rien n'est recalculé depuis zéro : les bits et les dispositions viennent de
// public/tile-masks.js, qui fait déjà foi. Ce module ajoute seulement ce qui
// manquait pour *lire* un atlas rendu (profils de pixels, tolérance de
// couture) et pour *peindre* une carte de test (masque d'une case à partir de
// ses voisins, île procédurale à couverture garantie).
//
// Le contrôle de couture (compatibleHorizontal/Vertical, seamFault, edgeOf)
// est extrait tel quel de tests/tileset.test.mjs — tranche T2 — où il avait
// déjà été pensé avec soin, pour B47 et E16. On ne l'affaiblit pas ici, on le
// rend réutilisable par l'interface. W16 l'a rejoint une fois corrigé le défaut
// de bruit du mode 15 qu'il avait lui-même révélé : voir la note devant
// compatibleHorizontal plus bas.
//
// Aucune dépendance DOM : importable par le navigateur comme par Node, comme
// tile-masks.js lui-même.
// ---------------------------------------------------------------------------
import { NEIGHBOUR_BITS, SIDE_BITS, CORNER_BITS, B47, maskSet, atlasPosition } from './tile-masks.js';

const on = (mask, bit) => (mask & bit) !== 0;

// ===========================================================================
// 1. Profils de pixels et tolérance de couture (extraits de tests/tileset.test.mjs)
// ===========================================================================

/** Alpha (terrain présent ou non) du pixel local (x, y) de la case du masque `mask` dans l'atlas `set`. `img` = { data, width, height, tile }. */
export function alphaAt(img, set, mask, x, y) {
  const p = atlasPosition(set, mask), t = img.tile;
  return img.data[(((p.row * t + y) * img.width) + p.col * t + x) * 4 + 3] > 0 ? 1 : 0;
}

/** Les quatre profils d'une couture : la colonne ou la ligne de pixels d'un bord de la case. */
export const rightColumn = (img, set, m) => Array.from({ length: img.tile }, (_, y) => alphaAt(img, set, m, img.tile - 1, y));
export const leftColumn = (img, set, m) => Array.from({ length: img.tile }, (_, y) => alphaAt(img, set, m, 0, y));
export const bottomRow = (img, set, m) => Array.from({ length: img.tile }, (_, x) => alphaAt(img, set, m, x, img.tile - 1));
export const topRow = (img, set, m) => Array.from({ length: img.tile }, (_, x) => alphaAt(img, set, m, x, 0));

/** Vrai si les deux tableaux sont identiques terme à terme. */
export const identical = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Vrai si l'indice `i` tombe sur une transition (terrain ↔ vide) du profil `p`. */
export const edgeOf = (p, i) => (i > 0 && p[i - 1] !== p[i]) || (i < p.length - 1 && p[i + 1] !== p[i]);

/**
 * Premier indice où les deux profils d'une couture divergent sans que ce soit une
 * transition des DEUX côtés — -1 si la couture tient. Un écart n'est tolérable que
 * si c'est un bord qui a glissé d'un pixel sous bruit organique, jamais un trou ni
 * une marche au milieu d'une plage.
 */
export function seamFault(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (!edgeOf(a, i) || !edgeOf(b, i)) return i;
  }
  return -1;
}

/**
 * Vrai si deux masques peuvent réellement se voisiner à l'horizontale (L à gauche,
 * R à droite) dans le jeu `setId`. B47 et E16 lisent des cases : L doit déborder
 * vers l'est et R vers l'ouest, et la canonicalisation du blob (tile-masks.js)
 * impose que ses bits diagonaux suivent ses cardinaux partagés.
 *
 * W16 lit des **sommets**, pas des cases : ses quatre bits disent si du terrain
 * occupe chacun des quatre coins de la case. Deux cases côte à côte partagent
 * donc une arête, c'est-à-dire deux sommets : le coin haut-droit de la gauche
 * EST le coin haut-gauche de la droite, et de même en bas. La règle est cette
 * égalité, et rien d'autre — contrairement à B47, aucun bit ne doit « déborder »
 * vers le voisin, puisqu'un sommet n'appartient à personne en propre.
 *
 * Cette règle a longtemps manqué ici : le contrôle de couture W16 révélait un
 * vrai défaut du moteur SDF (bruit de bord à graine par masque, 13 des 64 paires
 * décalées jusqu'à 2 px en bordures organiques). Le défaut est corrigé — le mode
 * 15 est passé au bruit raccordable, voir `seamless` dans
 * public/vendor/tileset-engine.js — et la règle peut donc enfin être posée.
 */
export function compatibleHorizontal(setId, L, R) {
  if (setId === 'B47') {
    const B = NEIGHBOUR_BITS;
    return on(L, B.E) && on(R, B.W)
      && on(L, B.NE) === (on(L, B.N) && on(R, B.N)) && on(R, B.NW) === (on(L, B.N) && on(R, B.N))
      && on(L, B.SE) === (on(L, B.S) && on(R, B.S)) && on(R, B.SW) === (on(L, B.S) && on(R, B.S));
  }
  if (setId === 'E16') {
    const S = SIDE_BITS;
    return on(L, S.E) === on(R, S.W);
  }
  if (setId === 'W16') {
    const C = CORNER_BITS;
    return on(L, C.TR) === on(R, C.TL) && on(L, C.BR) === on(R, C.BL);
  }
  throw new Error(`tile-check : jeu « ${setId} » sans règle de voisinage horizontal.`);
}

/** Le pendant vertical de compatibleHorizontal (T en haut, U en bas). */
export function compatibleVertical(setId, T, U) {
  if (setId === 'B47') {
    const B = NEIGHBOUR_BITS;
    return on(T, B.S) && on(U, B.N)
      && on(T, B.SW) === (on(T, B.W) && on(U, B.W)) && on(U, B.NW) === (on(T, B.W) && on(U, B.W))
      && on(T, B.SE) === (on(T, B.E) && on(U, B.E)) && on(U, B.NE) === (on(T, B.E) && on(U, B.E));
  }
  if (setId === 'E16') {
    const S = SIDE_BITS;
    return on(T, S.S) === on(U, S.N);
  }
  if (setId === 'W16') {
    const C = CORNER_BITS;
    return on(T, C.BL) === on(U, C.TL) && on(T, C.BR) === on(U, C.TR);
  }
  throw new Error(`tile-check : jeu « ${setId} » sans règle de voisinage vertical.`);
}

/**
 * Les jeux pour lesquels le contrôle de couture ci-dessus est établi.
 *
 * W16 y est entré une fois le défaut de bruit du mode 15 corrigé dans le moteur :
 * mesuré sur six graines, 768 paires compatibles se raccordent sans une faute, en
 * bordures nettes comme organiques, jusqu'à une irrégularité de 5.
 *
 * Au-delà de 5, le curseur allant à 10, W16 peut réellement se décaler de 2 px —
 * une graine sur six dans la mesure, dont 31415, celle par défaut de l'atelier.
 * Ce n'est pas une fausse alerte à faire taire : c'est la limite connue de
 * seamlessFbm (il reboucle de façon continue, pas identique — voir
 * docs/PLAN-tilesets.md), et le validateur est précisément là pour la signaler
 * sur l'atlas réellement rendu plutôt que de laisser l'utilisateur la découvrir
 * une fois le tileset dans son moteur. B47 et E16 n'y sont pas sujets : leurs
 * transitions de bord ne tombent pas au milieu d'une arête.
 */
const SEAM_CHECKED_SETS = new Set(['B47', 'E16', 'W16']);

/**
 * Masque qui décrit, par construction du jeu, une case sans le moindre coin —
 * donc légitimement transparente plutôt qu'un défaut. Seul W16 en a un : ses
 * masques disent la présence de terrain aux quatre coins de la case, et 0 dit
 * qu'aucun n'en porte. B47 et E16 n'ont pas cette exception : chacun de leurs
 * masques décrit le voisinage d'une case qui, elle, est toujours peinte.
 */
const VOID_MASK = { W16: 0 };

// ===========================================================================
// 2. Le validateur — atlas d'un jeu de masques (W16, B47, E16)
// ===========================================================================

/**
 * Contrôle complet d'un atlas rendu pour le jeu `set` : chaque masque occupe sa
 * case et y pose du terrain, les cases libres de la disposition restent
 * transparentes, et toute paire de masques réellement voisins se raccorde sans
 * trou ni marche. `img` = { data, width, height, tile }, comme dans les essais.
 * Retourne un tableau de défauts en français ; vide si l'atlas est propre.
 */
export function checkMaskSetAtlas(img, set) {
  const resolved = maskSet(set);
  const problems = [];
  const voidMask = VOID_MASK[resolved.id];

  for (const mask of resolved.masks) {
    let terrain = 0;
    for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) terrain += alphaAt(img, resolved, mask, x, y);
    const p = atlasPosition(resolved, mask);
    if (mask === voidMask) {
      if (terrain > 0) problems.push(`${resolved.label} : la case (${p.col}, ${p.row}) — masque ${mask}, aucun coin — devrait rester transparente, du terrain y est peint.`);
    } else if (terrain === 0) {
      problems.push(`${resolved.label} : le masque ${mask} (case ${p.col}, ${p.row}) est entièrement transparent — le terrain a disparu.`);
    }
  }

  for (const { col, row } of resolved.layout.unusedCells) {
    let peint = 0;
    for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) {
      if (img.data[(((row * img.tile + y) * img.width) + col * img.tile + x) * 4 + 3] > 0) peint++;
    }
    if (peint > 0) problems.push(`${resolved.label} : la case libre (${col}, ${row}) devrait rester transparente, ${peint} pixel(s) y sont peints.`);
  }

  if (SEAM_CHECKED_SETS.has(resolved.id)) {
    for (const L of resolved.masks) for (const R of resolved.masks) {
      if (!compatibleHorizontal(resolved.id, L, R)) continue;
      const i = seamFault(rightColumn(img, resolved, L), leftColumn(img, resolved, R));
      if (i !== -1) problems.push(`${resolved.label} : couture verticale décalée entre le masque ${L} et le masque ${R}, à la ligne ${i}.`);
    }
    for (const T of resolved.masks) for (const U of resolved.masks) {
      if (!compatibleVertical(resolved.id, T, U)) continue;
      const i = seamFault(bottomRow(img, resolved, T), topRow(img, resolved, U));
      if (i !== -1) problems.push(`${resolved.label} : couture horizontale décalée entre le masque ${T} et le masque ${U}, à la colonne ${i}.`);
    }
  }

  return problems;
}

/**
 * Le pendant pour l'atlas mur : le dessus est le blob 47 aux mêmes cases (on
 * réutilise donc checkMaskSetAtlas telle quelle dessus), puis chaque bande basse
 * (face, base, ombre) est contrôlée pour ses six états utilisés, ses deux
 * colonnes libres, et les trois raccords que la construction garantit
 * (milieu + milieu, gauche → milieu, milieu → droite — voir
 * tests/tileset.test.mjs, tranche T3). Les flancs à 45° ne sont pas connus pour
 * se raccorder latéralement à autre chose — on ne l'invente pas ici — donc on
 * ne les inclut pas dans ce contrôle horizontal.
 */
export function checkWallAtlas(img, { WALL_TOP_ROWS, WALL_BAND_STATES, biais = null }) {
  const problems = checkMaskSetAtlas(img, B47);
  const bandRows = { face: WALL_TOP_ROWS, base: WALL_TOP_ROWS + 1, shadow: WALL_TOP_ROWS + 2 };
  const at = (row, col, x, y) => img.data[(((row * img.tile + y) * img.width) + col * img.tile + x) * 4 + 3] > 0 ? 1 : 0;
  const rc = (row, col) => Array.from({ length: img.tile }, (_, y) => at(row, col, img.tile - 1, y));
  const lc = (row, col) => Array.from({ length: img.tile }, (_, y) => at(row, col, 0, y));
  const br = (row, col) => Array.from({ length: img.tile }, (_, x) => at(row, col, x, img.tile - 1));
  const tr = (row, col) => Array.from({ length: img.tile }, (_, x) => at(row, col, x, 0));
  const stateCol = (id) => WALL_BAND_STATES.findIndex((s) => s.id === id);

  for (const [name, row] of Object.entries(bandRows)) {
    for (let col = 0; col < WALL_BAND_STATES.length; col++) {
      let terrain = 0;
      for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) terrain += at(row, col, x, y);
      if (terrain === 0) problems.push(`Bande ${name} : l'état « ${WALL_BAND_STATES[col].id} » (colonne ${col}) est entièrement transparent.`);
    }
    // Les colonnes au-delà des états : plus aucune depuis T37, qui a rempli les deux
    // dernières avec corner-left et corner-right. La boucle reste — c'est elle qui
    // rattraperait un atlas plus large que sa table d'états, le jour où l'une des deux
    // bougerait sans l'autre.
    for (let col = WALL_BAND_STATES.length; col < 8; col++) {
      let peint = 0;
      for (let y = 0; y < img.tile; y++) for (let x = 0; x < img.tile; x++) peint += at(row, col, x, y);
      if (peint > 0) problems.push(`Bande ${name} : la case libre (${col}, ${row}) devrait rester transparente, ${peint} pixel(s) y sont peints.`);
    }
    // Les coutures. Les trois premières paires datent de T3 ; les trois dernières sont les
    // deux états de coin (T37), dont l'emprise est celle d'un `middle` — deux côtés
    // débordants — et qui doivent donc se raccorder exactement comme lui, alpha pour alpha.
    // C'est le contrôle qui vaut la peine sur ces deux colonnes neuves : leur pénombre
    // d'angle ne touche que la couleur, si bien qu'une couture qui s'ouvrirait ici ne
    // pourrait venir que d'une erreur de géométrie.
    for (const [a, b] of [['left-end', 'middle'], ['middle', 'middle'], ['middle', 'right-end'],
      ['corner-left', 'middle'], ['middle', 'corner-right'], ['corner-left', 'corner-right']]) {
      const i = seamFault(rc(row, stateCol(a)), lc(row, stateCol(b)));
      if (i !== -1) problems.push(`Bande ${name} : couture décalée entre « ${a} » et « ${b} », à la ligne ${i}.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Les douze tuiles en biais (T43)
  // ---------------------------------------------------------------------------
  // Quatre contrôles, et chacun répond à un défaut que la tranche a réellement
  // rencontré ou écarté par mesure — jamais un contrôle de principe :
  //  (a) aucune des douze n'est vide, et les colonnes au-delà des six pièces restent
  //      transparentes — la même garde que celle des colonnes libres des bandes ;
  //  (b) la couture VERTICALE entre la face droite `middle` et le bord gauche de la
  //      bande : c'est le raccord n°2 du plan, « la bande rejoint la face voisine au
  //      pixel près à gauche » ;
  //  (c) les coutures HORIZONTALES de la pile en biais — raccord sur face, face sur
  //      base-haute, base-haute sur base-basse : elles s'empilent et doivent se
  //      raccorder comme deux faces droites le font ;
  //  (d) LA DIAGONALE PASSE COIN À COIN. C'est le contrôle qui compte : décalée d'un
  //      pixel, elle ouvrait 190 px de trous ou de recouvrement ; bruitée, 43 px de
  //      trous. On l'exige donc au pixel — sur `base-basse`, la colonne x porte
  //      exactement x + 1 pixels opaques contigus depuis le haut (miroir pour l'autre
  //      sens). Que les deux moitiés PARTITIONNENT la case — ni trou, ni recouvrement —
  //      se prouve mieux sur la fonction de coupe que sur des pixels (un fond blanc ou un
  //      terrain inférieur rendent tout opaque, et le contrôle ne dirait plus rien) : voir
  //      l'essai « la coupe partitionne la case » dans tests/tileset.test.mjs.
  if (biais) {
    const cellDe = (sens, piece) => biais.cells.find((c) => c.sens === sens && c.piece === piece);
    // T44 : la pente du bord arrière du dessus prend l'une des deux colonnes libres,
    // une par ligne (voir WALL_PENTE_COL côté moteur) — ces deux cases précises
    // cessent d'être contrôlées transparentes et reçoivent leur propre contrôle plus
    // bas ; les autres cases libres restent transparentes comme avant T44.
    // T45 : le raccord-base prend l'AUTRE colonne libre, une par ligne aussi (voir
    // WALL_RACCORD_BASE_COL côté moteur) — il ne reste donc plus aucune case libre
    // dans les lignes en biais, ce que la boucle ci-dessous constate d'elle-même
    // (elle ne peut plus jamais s'exécuter pour aucun col/i, biais.columns valant 6
    // et les deux seules colonnes qui restent, 6 et 7, étant maintenant occupées).
    const penteCells = biais.cells.filter((c) => c.piece === 'pente');
    const raccordBaseCells = biais.cells.filter((c) => c.piece === 'raccord-base');
    const occupeeAt = new Set([...penteCells, ...raccordBaseCells].map((c) => `${c.row},${c.col}`));
    for (let col = biais.columns; col < 8; col += 1) {
      for (let i = 0; i < biais.rows; i += 1) {
        const row = biais.firstRow + i;
        if (occupeeAt.has(`${row},${col}`)) continue;
        let peint = 0;
        for (let y = 0; y < img.tile; y += 1) for (let x = 0; x < img.tile; x += 1) peint += at(row, col, x, y);
        if (peint > 0) problems.push(`Biais : la case libre (${col}, ${row}) devrait rester transparente, ${peint} pixel(s) y sont peints.`);
      }
    }
    for (const sens of biais.sens) {
      for (const piece of biais.pieces) {
        const c = cellDe(sens, piece);
        let opaques = 0;
        for (let y = 0; y < img.tile; y += 1) for (let x = 0; x < img.tile; x += 1) opaques += at(c.row, c.col, x, y);
        if (opaques === 0) problems.push(`Biais ${sens} : la pièce « ${piece} » (colonne ${c.col}) est entièrement transparente.`);
      }
      // (b) la face droite `middle` puis le bord gauche de la bande.
      for (const piece of ['raccord', 'face', 'base-haute']) {
        const c = cellDe(sens, piece);
        const i = seamFault(rc(bandRows.face, stateCol('middle')), lc(c.row, c.col));
        if (i !== -1) problems.push(`Biais ${sens} : couture décalée entre « middle » et « ${piece} », à la ligne ${i}.`);
      }
      // (c) la pile en biais, de haut en bas.
      for (const [a, b] of [['raccord', 'face'], ['face', 'base-haute'], ['base-haute', 'base-basse']]) {
        const ca = cellDe(sens, a); const cb = cellDe(sens, b);
        const i = seamFault(br(ca.row, ca.col), tr(cb.row, cb.col));
        if (i !== -1) problems.push(`Biais ${sens} : couture horizontale décalée entre « ${a} » et « ${b} », à la colonne ${i}.`);
      }
      // (d) la diagonale, au pixel.
      const cb = cellDe(sens, 'base-basse');
      for (let x = 0; x < img.tile; x += 1) {
        const attendu = sens === 'droite' ? x + 1 : img.tile - x;
        let hauteur = 0;
        while (hauteur < img.tile && at(cb.row, cb.col, x, hauteur)) hauteur += 1;
        let total = 0;
        for (let y = 0; y < img.tile; y += 1) total += at(cb.row, cb.col, x, y);
        if (hauteur !== attendu || total !== attendu) {
          problems.push(`Biais ${sens} : la diagonale ne passe pas coin à coin — colonne ${x} porte ${hauteur} pixel(s) contigus (${total} en tout), ${attendu} attendu(s).`);
          break;
        }
      }
    }

    // ---------------------------------------------------------------------------
    // La tuile de pente du bord arrière (T44)
    // ---------------------------------------------------------------------------
    // (a) non vide ; (b) la diagonale passe coin à coin — le triangle est ancré au
    // bord BAS (contrairement à `base-basse`, ancrée en haut) : pour « droite », la
    // colonne x porte `tile − x` pixels contigus depuis le bas ; pour « gauche »,
    // `x + 1` — mesuré sur `penteGeo` (`(lx − ly)/√2` et `(tile − lx − ly)/√2`, la
    // demi-teinte de pixel s'annule exactement dans la différence).
    for (const c of penteCells) {
      let opaques = 0;
      for (let y = 0; y < img.tile; y += 1) for (let x = 0; x < img.tile; x += 1) opaques += at(c.row, c.col, x, y);
      if (opaques === 0) problems.push(`Pente ${c.sens} : la case (${c.col}, ${c.row}) est entièrement transparente.`);
      for (let x = 0; x < img.tile; x += 1) {
        const attendu = c.sens === 'droite' ? img.tile - x : x + 1;
        let hauteur = 0;
        while (hauteur < img.tile && at(c.row, c.col, x, img.tile - 1 - hauteur)) hauteur += 1;
        let total = 0;
        for (let y = 0; y < img.tile; y += 1) total += at(c.row, c.col, x, y);
        if (hauteur !== attendu || total !== attendu) {
          problems.push(`Pente ${c.sens} : la diagonale ne passe pas coin à coin — colonne ${x} porte ${hauteur} pixel(s) contigus depuis le bas (${total} en tout), ${attendu} attendu(s).`);
          break;
        }
      }
    }

    // ---------------------------------------------------------------------------
    // La pièce RACCORD-BASE — mur d'une case de haut (T45)
    // ---------------------------------------------------------------------------
    // (a) non vide ; (b) sa moitié `u > 0` est identique AU PIXEL PRÈS à `base-haute` —
    // c'est la garantie que la fusion ne recrée pas sa propre matière mais reprend celle
    // qui existe déjà (même bande "base", même décalage 0, voir `biaisPieceColor` côté
    // moteur). Comparaison en RGBA COMPLET, jamais l'alpha seul : un fond blanc rendrait
    // deux couleurs différentes également opaques, et un contrôle sur l'alpha seul ne
    // dirait plus rien — la même prudence que pour les cases libres transparentes plus
    // haut, retournée à l'envers puisqu'ici la case n'est PAS censée être transparente.
    const px = (row, col, x, y) => {
      const i = (((row * img.tile + y) * img.width) + col * img.tile + x) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
    };
    for (const sens of biais.sens) {
      const raccordBase = cellDe(sens, 'raccord-base');
      const baseHaute = cellDe(sens, 'base-haute');
      let opaques = 0;
      for (let y = 0; y < img.tile; y += 1) for (let x = 0; x < img.tile; x += 1) opaques += at(raccordBase.row, raccordBase.col, x, y);
      if (opaques === 0) problems.push(`Raccord-base ${sens} : la case (${raccordBase.col}, ${raccordBase.row}) est entièrement transparente.`);
      let divergence = false;
      for (let y = 0; y < img.tile && !divergence; y += 1) {
        for (let x = 0; x < img.tile && !divergence; x += 1) {
          const u = sens === 'droite' ? y - x : y + x - (img.tile - 1);
          if (u <= 0) continue; // moitié « dessus » : une autre matière, par construction
          const a = px(raccordBase.row, raccordBase.col, x, y);
          const b = px(baseHaute.row, baseHaute.col, x, y);
          if (a.join(',') !== b.join(',')) {
            problems.push(`Raccord-base ${sens} : pixel ${x},${y} diffère de « base-haute » (${a.join(',')} contre ${b.join(',')}).`);
            divergence = true;
          }
        }
      }
    }
  }

  return problems;
}

// ===========================================================================
// 3. Carte par cases — masque d'une case à partir de ses voisins (B47, E16)
// ===========================================================================
// La carte par sommets (W16) n'a pas besoin de cette section : son masque se
// lit directement sur quatre sommets, comme le fait déjà drawMap() dans
// public/tools.js.

function cellAt(grid, x, y) {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[y].length && !!grid[y][x];
}

/** Masque blob (huit voisins, canonicalisé par construction) de la case (x, y) de `grid`. */
export function blobMaskAt(grid, x, y) {
  const B = NEIGHBOUR_BITS;
  const N = cellAt(grid, x, y - 1), E = cellAt(grid, x + 1, y), S = cellAt(grid, x, y + 1), W = cellAt(grid, x - 1, y);
  // Un bit diagonal ne se pose que si ses deux cardinaux sont là (règle de
  // tile-masks.js) : construit ainsi, le résultat est toujours l'un des 47
  // masques canoniques, jamais un des 209 exclus.
  const NE = N && E && cellAt(grid, x + 1, y - 1), SE = S && E && cellAt(grid, x + 1, y + 1);
  const SW = S && W && cellAt(grid, x - 1, y + 1), NW = N && W && cellAt(grid, x - 1, y - 1);
  return (N ? B.N : 0) | (NE ? B.NE : 0) | (E ? B.E : 0) | (SE ? B.SE : 0) | (S ? B.S : 0) | (SW ? B.SW : 0) | (W ? B.W : 0) | (NW ? B.NW : 0);
}

/** Masque de bord (quatre côtés) de la case (x, y) de `grid`. */
export function edgeMaskAt(grid, x, y) {
  const S = SIDE_BITS;
  return (cellAt(grid, x, y - 1) ? S.N : 0) | (cellAt(grid, x + 1, y) ? S.E : 0) | (cellAt(grid, x, y + 1) ? S.S : 0) | (cellAt(grid, x - 1, y) ? S.W : 0);
}

const CELL_MASK_FN = { B47: blobMaskAt, E16: edgeMaskAt };

/** Masque de la case (x, y), pour le jeu `setId` (B47 ou E16). */
export function cellMaskAt(setId, grid, x, y) {
  const fn = CELL_MASK_FN[setId];
  if (!fn) throw new Error(`tile-check : « ${setId} » n'est pas un jeu par cases.`);
  return fn(grid, x, y);
}

// ===========================================================================
// 4. Île procédurale à couverture garantie
// ===========================================================================
// Un bruit seuillé donne une île crédible mais ne garantit jamais qu'aucune
// combinaison ne manque (voir docs/PLAN-tilesets.md, tranche T5). La stratégie
// retenue ici sépare donc les deux soucis plutôt que de les mélanger :
//   - une silhouette organique (quelques disques aléatoires) sur une bande de
//     la grille, pour l'aspect « île » ;
//   - une grille de plots 3×3 séparés, un par masque du jeu, dans une bande
//     distincte : chaque plot est d'abord nettoyé sur 5×5 puis reçoit
//     exactement les huit (ou quatre) voisins que son masque cible demande.
//     Avec une bande vide de 3 cases entre deux plots (marge ISLAND_MARGIN),
//     un plot ne peut jamais lire un bit posé par son voisin : la couverture
//     est garantie par construction, pas par chance.

/** Mulberry32 : générateur pseudo-aléatoire minuscule, déterministe, sans dépendance. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ISLAND_PITCH = 4; // 3×3 plot + 1 case de marge minimale entre deux centres.
const ISLAND_MARGIN = 3; // marge des bandes, largement au-dessus du strict nécessaire (voir le calcul plus bas).
const ISLAND_NOISE_WIDTH = 16;
const ISLAND_DIRS = {
  B47: [[0, -1, NEIGHBOUR_BITS.N], [1, -1, NEIGHBOUR_BITS.NE], [1, 0, NEIGHBOUR_BITS.E], [1, 1, NEIGHBOUR_BITS.SE], [0, 1, NEIGHBOUR_BITS.S], [-1, 1, NEIGHBOUR_BITS.SW], [-1, 0, NEIGHBOUR_BITS.W], [-1, -1, NEIGHBOUR_BITS.NW]],
  E16: [[0, -1, SIDE_BITS.N], [1, 0, SIDE_BITS.E], [0, 1, SIDE_BITS.S], [-1, 0, SIDE_BITS.W]],
};
const ISLAND_PATCH_GRID = { B47: { cols: 8, rows: 6 }, E16: { cols: 4, rows: 4 } };

function setCell(grid, x, y, v) {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[y].length) grid[y][x] = v;
}

/**
 * Île procédurale pour le jeu `setId` (B47 ou E16) : `{ grid, columns, rows }`,
 * `grid` étant un tableau de lignes de booléens (case pleine ou vide). Chacun
 * des masques du jeu apparaît au moins une fois, quelle que soit `seed`.
 */
export function generateIsland(setId, seed) {
  const set = maskSet(setId);
  const dirs = ISLAND_DIRS[setId];
  if (!dirs) throw new Error(`tile-check : île aléatoire non définie pour « ${setId} ».`);
  const { cols: patchCols, rows: patchRows } = ISLAND_PATCH_GRID[setId];
  const patchWidth = patchCols * ISLAND_PITCH, patchHeight = patchRows * ISLAND_PITCH;
  const noiseWidth = ISLAND_NOISE_WIDTH, noiseHeight = patchHeight;
  const columns = ISLAND_MARGIN * 3 + noiseWidth + patchWidth;
  const rows = ISLAND_MARGIN * 2 + Math.max(noiseHeight, patchHeight);
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));

  // Silhouette organique, seulement dans la bande de gauche : quelques disques
  // de rayon aléatoire, une île crédible mais dont on ne demande rien de plus.
  const rand = mulberry32(seed);
  for (let i = 0; i < 10; i++) {
    const cx = ISLAND_MARGIN + rand() * noiseWidth, cy = ISLAND_MARGIN + rand() * noiseHeight, r = 1.5 + rand() * 3.5;
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) grid[y][x] = true;
    }
  }

  // Couverture garantie, dans la bande de droite : un plot 3×3 par masque.
  const patchOx = ISLAND_MARGIN + noiseWidth + ISLAND_MARGIN, patchOy = ISLAND_MARGIN;
  set.masks.forEach((mask, i) => {
    const col = i % patchCols, row = Math.floor(i / patchCols);
    const cx = patchOx + col * ISLAND_PITCH + 2, cy = patchOy + row * ISLAND_PITCH + 2;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setCell(grid, cx + dx, cy + dy, false);
    setCell(grid, cx, cy, true);
    for (const [dx, dy, bit] of dirs) setCell(grid, cx + dx, cy + dy, (mask & bit) !== 0);
  });

  return { grid, columns, rows };
}

/** Les masques du jeu `setId` réellement présents dans `grid`, et leur compte sur le total attendu. */
export function islandCoverage(setId, grid) {
  const set = maskSet(setId);
  const fn = CELL_MASK_FN[setId];
  const present = new Set();
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
    if (grid[y][x]) present.add(fn(grid, x, y));
  }
  return { present, total: set.masks.length, count: set.masks.filter((m) => present.has(m)).length };
}
