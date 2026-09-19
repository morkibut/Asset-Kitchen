/* Maquette des jeux de tuiles. Le rendu est celui du vrai moteur (copie de SpriteForge dans
   tuiles-moteur/) : les pièces, la carte, la planche et la vérification sont calculées pour de
   vrai. Seules la génération d'image et la livraison sont simulées. Rien n'est gardé après
   rechargement. ?fige arrête toute animation (captures). */
import {
  renderLogical, hexToRgb, TILESET_LAYOUTS, WALL_TOP_ROWS, WALL_BAND_STATES, BLOB_LOWER_CELL,
  wallAtlasDescriptor, biaisAtlasDescriptor, decorAtlasDescriptor, variantAtlasDescriptor, animationAtlasDescriptor,
} from './tuiles-moteur/vendor/tileset-engine.js';
import { MATIERES, LISTE_MATIERES, rendreMatiere, couleurMoyenne, tolerePhase } from './tuiles-moteur/tile-materials.js';
import { creerEtat, poserMatiere, poserImage, relier, rafraichirMatieres, texturesDe, PAR_ID } from './tuiles-moteur/tile-emplacements.js';
import { dessinerScene, peintreCanvas, descripteurScene } from './tuiles-moteur/tile-scene.js';
import { cellMaskAt, checkMaskSetAtlas, checkWallAtlas, mulberry32 } from './tuiles-moteur/tile-check.js';
import { maskAtPosition, NEIGHBOUR_BITS, SIDE_BITS, CORNER_BITS } from './tuiles-moteur/tile-masks.js';
import { composerPrompt, CADRAGES, cadrageParDefaut } from './tuiles-moteur/tile-ia-prompt.js';
import { harmoniserPalette } from './tuiles-moteur/tile-palette.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FIGE = new URLSearchParams(location.search).has('fige');
const sidebar = $('#sidebar'), main = $('#main');
let minuterieMessage;
function toast(texte) { $('#message').textContent = texte; clearTimeout(minuterieMessage); minuterieMessage = setTimeout(() => { $('#message').textContent = ''; }, 5000); }
function slug(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'tuiles'; }
function liste(mots) { return mots.length < 2 ? mots.join('') : mots.slice(0, -1).join(', ') + ' et ' + mots[mots.length - 1]; }

/* ——— Les sortes de tuiles ——— */
const SORTES = {
  sol: { nom: 'Un sol', court: 'Sol', type: 'blob-47', set: 'B47', lower: true, texte: 'L’herbe, le sable, l’eau… les bords se posent tout seuls.' },
  chemin: { nom: 'Un chemin', court: 'Chemin', type: 'edge-16', set: 'E16', texte: 'Route, rivière, rail.' },
  mur: { nom: 'Un mur', court: 'Mur', type: 'wall', wall: true, texte: 'Avec sa hauteur, sa face et son ombre.' },
  p15: { nom: '15 pièces', court: 'Sol, format RPG Maker', type: 'topdown-15', set: 'W16', lower: true, texte: 'Le format de SpriteCook et de RPG Maker : le bord passe au milieu des cases.' },
  p17: { nom: '17 pièces', court: 'Pièces libres', type: 'topdown-17', texte: 'Des pièces à poser à la main, sans raccord automatique.' },
};
const DEFAUTS_SORTE = {
  sol: { nom: 'Nouveau sol', surface: 'herbe', fond: 'terre' },
  chemin: { nom: 'Nouveau chemin', surface: 'terre', fond: 'herbe' },
  mur: { nom: 'Nouveau mur', surface: 'pierre', face: 'brique', fond: 'carrelage' },
  p15: { nom: 'Nouveau sol en 15 pièces', surface: 'herbe', fond: 'terre' },
  p17: { nom: 'Nouvelles pièces', surface: 'herbe', fond: 'terre' },
};
const REGLAGES_DEFAUT = { arrondi: 2, irregularite: 3, relief: 4, hauteur: 3, bordures: 'rough', nuances: 4, ombre: 110, penombre: 50, decor: 'aucun', reduction: 'contraste', variantes: 0, animation: 0 };
const COLS = 18, ROWS = 12;
const DESC_MUR = descripteurScene(wallAtlasDescriptor, WALL_BAND_STATES);

function nombrePieces(j) {
  const S = SORTES[j.sorte];
  if (S.wall) return wallAtlasDescriptor().cells.filter((c) => c.placeable).length;
  return { 'blob-47': 47, 'edge-16': 16, 'topdown-15': 15, 'topdown-17': 17 }[S.type];
}

/* ——— Les cartes (ce qu'on peint) ——— */
const ovale = (x, y, cols, rows) => Math.hypot((x - cols / 2) / (cols * 0.33), (y - rows / 2) / (rows * 0.34)) + Math.sin(x * 1.7) * 0.08 + Math.cos(y * 2.1) * 0.08 <= 1;
const vide = (c, r) => Array.from({ length: r }, () => Array(c).fill(false));
function cases(columns, rows, f) { return { kind: 'cases', columns, rows, grid: Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => !!f(x, y))) }; }
function sommets(columns, rows, f) { return { kind: 'sommets', columns, rows, v: Array.from({ length: rows + 1 }, (_, y) => Array.from({ length: columns + 1 }, (_, x) => !!f(x, y))) }; }
function traits(columns, rows, segments) {
  const g = vide(columns, rows);
  for (const [x0, y0, x1, y1] of segments) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (g[y] && x >= 0 && x < columns) g[y][x] = true;
  return { kind: 'cases', columns, rows, grid: g };
}
function piece(g, l, t, r, b, porte) {
  for (let x = l; x <= r; x++) { g[t][x] = true; if (!porte || !porte.includes(x)) g[b][x] = true; }
  for (let y = t; y <= b; y++) { g[y][l] = true; g[y][r] = true; }
}
function carteDefaut(sorte) {
  if (sorte === 'sol') return cases(COLS, ROWS, (x, y) => ovale(x + 0.5, y + 0.5, COLS, ROWS));
  if (sorte === 'chemin') return traits(COLS, ROWS, [[1, 7, 16, 7], [5, 1, 5, 7], [5, 3, 9, 3], [12, 7, 12, 11]]);
  if (sorte === 'mur') { const g = vide(COLS, ROWS); piece(g, 3, 4, 14, 10, [8, 9]); return { kind: 'cases', columns: COLS, rows: ROWS, grid: g }; }
  if (sorte === 'p15') return sommets(COLS, ROWS, (x, y) => ovale(x, y, COLS, ROWS));
  return null;
}
function carteApercu(sorte) {
  if (sorte === 'sol') return cases(9, 5, (x, y) => ovale(x + 0.5, y + 0.5, 7, 5) || Math.hypot(x - 7.6, y - 1.2) < 1.3);
  if (sorte === 'chemin') return traits(9, 5, [[0, 3, 8, 3], [5, 0, 5, 3], [2, 1, 5, 1]]);
  if (sorte === 'mur') { const g = vide(9, 5); piece(g, 1, 2, 7, 3, [4]); return { kind: 'cases', columns: 9, rows: 5, grid: g }; }
  if (sorte === 'p15') return sommets(9, 5, (x, y) => ovale(x, y, 9, 5));
  return null;
}
// Le mur monte de `hauteur` cases au-dessus de son pied et pose son ombre une case en dessous :
// la carte s'agrandit plutôt que de rogner le haut du mur.
function margeMur(carte, hauteur) {
  const haut = carte.grid.findIndex((l) => l.some(Boolean));
  if (haut >= 0 && haut < hauteur) { for (let i = 0; i < hauteur - haut; i++) carte.grid.unshift(Array(carte.columns).fill(false)); }
  let bas = 0; for (let y = carte.grid.length - 1; y >= 0 && !carte.grid[y].some(Boolean); y--) bas++;
  if (carte.grid.some((l) => l.some(Boolean)) && bas < 1) carte.grid.push(Array(carte.columns).fill(false));
  carte.rows = carte.grid.length;
}
function ileAuHasard(j) {
  const r = mulberry32((Math.random() * 1e9) | 0), S = SORTES[j.sorte];
  if (j.sorte === 'sol' || j.sorte === 'p15') {
    const disques = Array.from({ length: 4 + Math.floor(r() * 4) }, () => ({ x: 3 + r() * (COLS - 6), y: 2.5 + r() * (ROWS - 5), r: 1.5 + r() * 2.2 }));
    const dedans = (x, y) => disques.some((d) => Math.hypot(x - d.x, y - d.y) <= d.r);
    return S.set === 'W16' ? sommets(COLS, ROWS, dedans) : cases(COLS, ROWS, (x, y) => dedans(x + 0.5, y + 0.5));
  }
  if (j.sorte === 'chemin') {
    const g = vide(COLS, ROWS);
    for (let k = 0; k < 3; k++) {
      let x = Math.floor(r() * COLS), y = Math.floor(r() * ROWS), dir = Math.floor(r() * 4);
      for (let pas = 0; pas < 34; pas++) {
        g[y][x] = true;
        if (r() < 0.22) dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= COLS - 1 || ny >= ROWS - 1) { dir = (dir + 2) % 4; continue; }
        x = nx; y = ny;
      }
    }
    return { kind: 'cases', columns: COLS, rows: ROWS, grid: g };
  }
  if (j.sorte === 'mur') {
    const g = vide(COLS, ROWS), n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const w = 4 + Math.floor(r() * 7), h = 3 + Math.floor(r() * 3);
      const l = 1 + Math.floor(r() * (COLS - w - 2)), t = j.reglages.hauteur + Math.floor(r() * Math.max(1, ROWS - h - j.reglages.hauteur - 2));
      const porte = l + 1 + Math.floor(r() * (w - 2));
      piece(g, l, Math.min(t, ROWS - h - 2), l + w, Math.min(t, ROWS - h - 2) + h, [porte]);
    }
    return { kind: 'cases', columns: COLS, rows: ROWS, grid: g };
  }
  return null;
}
function casesPosees(carte) {
  if (!carte) return 0;
  if (carte.kind === 'sommets') return carte.v.flat().filter(Boolean).length;
  return carte.grid.flat().filter(Boolean).length;
}

/* ——— Les jeux de tuiles ——— */
let prochainId = 1;
const contourDe = new WeakMap(); // image générée → sa bordure, pour « suit la surface »
function nouveauJeu({ nom, sorte, taille = 32, surface, face, bas, fond, graine = 31415, livre = null, reglages = {} }) {
  const j = {
    id: 'j' + prochainId++, nom, sorte, taille, graine, autreSol: !!bas, livre,
    reglages: { ...REGLAGES_DEFAUT, ...reglages }, etat: creerEtat(), origine: {},
    fond: { matiere: fond || 'terre' }, carte: carteDefaut(sorte),
    texte: { pierre: '', motifs: {}, cadrages: {} }, demande: null,
  };
  if (surface) poserMatiere(j.etat, 'surface', surface, taille, graine);
  if (face) poserMatiere(j.etat, 'face', face, taille, graine);
  if (bas) poserMatiere(j.etat, 'bas', bas, taille, graine);
  return j;
}
const JEUX = [
  nouveauJeu({ nom: 'Herbe et terre', sorte: 'sol', surface: 'herbe', fond: 'terre', livre: 'le 14 septembre' }),
  nouveauJeu({ nom: 'Mur de pierre', sorte: 'mur', surface: 'pierre', face: 'roche', fond: 'carrelage', graine: 2718, livre: 'le 16 septembre', reglages: { hauteur: 2 } }),
  nouveauJeu({ nom: 'Rivière', sorte: 'chemin', surface: 'eau', fond: 'prairie', graine: 1618, reglages: { arrondi: 4, irregularite: 5 } }),
];
const HERBE = JEUX[0];
const DEMANDE = { quand: '19 septembre', texte: 'un sol de marais, 32 px, pour la carte du chapitre 2', nom: 'Sol de marais', pierre: 'de la vase sombre et humide, avec des reflets d’eau', motif: 'des flaques irrégulières et des touffes de joncs, sans objet posé', faite: null };
const BIBLIO = [
  { id: 'b1', nom: 'Pierre du donjon', mat: 'pierre', graine: 7, quand: 'Générée le 12 septembre' },
  { id: 'b2', nom: 'Vase du marais', mat: 'terre', graine: 91, quand: 'Générée le 15 septembre' },
  { id: 'b3', nom: 'Planches du ponton', mat: 'bois', graine: 3, quand: 'Importée le 16 septembre' },
  { id: 'b4', nom: 'Mousse', mat: 'feuillage', graine: 55, quand: 'Générée le 17 septembre' },
];
const ORIGINE = { vide: 'Vide', matiere: 'Intégrée', ia: 'Générée', import: 'Importée', biblio: 'Mes matières' };

/* ——— Le moteur : réglages, atlas en cache, carte ——— */
const idsImages = new WeakMap(); let prochaineImage = 0;
const idImage = (im) => { if (!im) return 0; if (!idsImages.has(im)) idsImages.set(im, ++prochaineImage); return idsImages.get(im); };
function reglagesMoteur(j) {
  const s = j.taille, r = j.reglages, S = SORTES[j.sorte];
  rafraichirMatieres(j.etat, s, j.graine);
  const tex = texturesDe(j.etat);
  return {
    tilesetType: S.type, tileSize: s, cornerRadius: r.arrondi * s / 32, edgeStyle: r.bordures, edgeRoughness: r.irregularite * s / 32,
    edgeFrequency: 5, edgePadding: 2 * s / 16, baseColor: hexToRgb('#92af70'), edgeColor: hexToRgb('#43563d'), edgeFade: 3 * s / 32,
    shades: r.nuances, textureNoise: 12, fleckAmount: 6, seed: j.graine, relief: r.relief / 10, reductionMode: r.reduction, palette: null,
    wallShadowAlpha: r.ombre, wallCornerOcclusion: r.penombre, whiteBackground: false, showGrid: false, pixelFlecks: true,
    variants: S.set ? r.variantes : 0, texturePhase: j.etat.surface.source === 'matiere' && tolerePhase(j.etat.surface.matiere),
    decor: S.set || S.wall ? r.decor : 'aucun', animatedFrames: S.set ? r.animation : 0, animatedAtlasCopies: 0,
    surfaceTexture: tex.surfaceTexture, edgeTexture: tex.edgeTexture, faceTexture: S.wall ? tex.faceTexture : null,
    lowerTerrain: j.autreSol && S.lower ? { baseColor: hexToRgb('#d6b476'), edgeColor: hexToRgb('#96764a'), surfaceTexture: tex.lowerSurfaceTexture, edgeTexture: tex.lowerEdgeTexture } : null,
  };
}
const cacheAtlas = new Map();
function atlasDe(j) {
  const s = reglagesMoteur(j);
  const cle = JSON.stringify({ ...s, surfaceTexture: idImage(s.surfaceTexture), edgeTexture: idImage(s.edgeTexture), faceTexture: idImage(s.faceTexture),
    lowerTerrain: s.lowerTerrain && { surfaceTexture: idImage(s.lowerTerrain.surfaceTexture), edgeTexture: idImage(s.lowerTerrain.edgeTexture) } });
  let atlas = cacheAtlas.get(cle);
  if (!atlas) {
    atlas = renderLogical(s);
    cacheAtlas.set(cle, atlas);
    if (cacheAtlas.size > 40) cacheAtlas.delete(cacheAtlas.keys().next().value);
  }
  return atlas;
}
function versCanvas(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const d = c.getContext('2d').createImageData(img.width, img.height); d.data.set(img.data); c.getContext('2d').putImageData(d, 0, 0);
  return c;
}
const cacheMotif = new Map();
function motifFond(j) {
  const f = j.fond, s = j.taille;
  const cle = (f.image ? 'img' + idImage(f.image) : f.matiere) + '|' + s + '|' + j.graine;
  if (!cacheMotif.has(cle)) {
    if (f.image) {
      const c = versCanvas(f.image), t = document.createElement('canvas'); t.width = s; t.height = s;
      const ctx = t.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, s, s);
      const d = f.image.data; let r = 0, g = 0, b = 0, n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      cacheMotif.set(cle, { canvas: t, couleur: `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})` });
    } else {
      const m = couleurMoyenne(f.matiere);
      cacheMotif.set(cle, { canvas: versCanvas(rendreMatiere(f.matiere, s, j.graine).surface), couleur: `rgb(${m.r},${m.g},${m.b})` });
    }
  }
  return cacheMotif.get(cle);
}
function nomFond(j) { return j.fond.image ? j.fond.nom : MATIERES[j.fond.matiere].nom; }

function dessinerCarte(canvas, j, atlas, carte, zoom, { image = 0, heros = false } = {}) {
  const S = SORTES[j.sorte], s = j.taille, r = j.reglages;
  if (S.wall) margeMur(carte, r.hauteur);
  const cols = carte.columns, rows = carte.rows;
  canvas.width = cols * s * zoom; canvas.height = rows * s * zoom;
  const lower = j.autreSol && S.lower;
  const variantes = S.set ? r.variantes : 0, frames = S.set ? r.animation : 0;
  const vd = S.set ? variantAtlasDescriptor(S.type, variantes) : null;
  const dd = decorAtlasDescriptor(S.type, S.set || S.wall ? r.decor : 'aucun', variantes, frames, 0);
  const ad = frames > 0 ? animationAtlasDescriptor(S.type, frames, variantes) : null;
  const masqueDe = (x, y) => {
    if (carte.kind === 'sommets') {
      const v = carte.v, m = (v[y][x] ? CORNER_BITS.TL : 0) | (v[y][x + 1] ? CORNER_BITS.TR : 0) | (v[y + 1][x] ? CORNER_BITS.BL : 0) | (v[y + 1][x + 1] ? CORNER_BITS.BR : 0);
      return m === 0 && !lower ? null : m;
    }
    if (carte.grid[y][x]) return cellMaskAt(S.set, carte.grid, x, y);
    return S.set === 'B47' && lower ? BLOB_LOWER_CELL : null;
  };
  const sol = motifFond(j);
  dessinerScene(peintreCanvas(canvas.getContext('2d'), atlas, zoom), {
    tile: s, colonnes: cols, lignes: rows,
    set: S.wall ? null : S.set, masqueDe: S.wall ? () => null : masqueDe,
    mur: S.wall ? { hauteur: r.hauteur, grille: carte.grid, descripteur: DESC_MUR } : null,
    sol: { couleur: sol.couleur, motif: sol.canvas },
    animation: ad ? { col: ad.col, row: ad.row, pas: ad.rowStride, images: ad.count, duree: ad.frameDurationMs } : null, image,
    variants: vd ? { mask: vd.mask, count: vd.variants.length, list: vd.variants, seed: j.graine } : null,
    decor: dd ? { descripteur: dd, densite: dd.density, graine: j.graine } : null,
    heros: heros ? { x: cols * 0.7, y: rows * 0.62, image: 0 } : null, reperes: false,
  });
}

/* ——— Le nom d'une pièce de la planche ——— */
const COTES = { N: 'le nord', E: 'l’est', S: 'le sud', W: 'l’ouest' };
const COINS = { NE: 'nord-est', SE: 'sud-est', SW: 'sud-ouest', NW: 'nord-ouest' };
function nomBlob(m) {
  const a = (k) => (m & NEIGHBOUR_BITS[k]) !== 0;
  if (m === 255) return 'Pleine : entourée de tous côtés';
  const cotes = ['N', 'E', 'S', 'W'].filter(a);
  if (!cotes.length) return 'Seule : aucune voisine';
  const rentrants = [['NE', 'N', 'E'], ['SE', 'S', 'E'], ['SW', 'S', 'W'], ['NW', 'N', 'W']].filter(([d, x, y]) => a(x) && a(y) && !a(d)).map(([d]) => COINS[d]);
  return 'Continue vers ' + liste(cotes.map((k) => COTES[k])) + (rentrants.length ? ' · coin rentrant au ' + liste(rentrants) : '');
}
function nomChemin(m) {
  const c = ['N', 'E', 'S', 'W'].filter((k) => (m & SIDE_BITS[k]) !== 0), n = { N: 'nord', E: 'est', S: 'sud', W: 'ouest' };
  if (!c.length) return 'Seule : aucun chemin ne part';
  if (c.length === 1) return 'Bout de chemin, ouvert vers ' + COTES[c[0]];
  if (c.length === 4) return 'Croisement';
  if (c.length === 3) return 'Embranchement, fermé vers ' + COTES[['N', 'E', 'S', 'W'].find((k) => !c.includes(k))];
  const droit = (c.includes('N') && c.includes('S')) || (c.includes('E') && c.includes('W'));
  return (droit ? 'Ligne droite ' : 'Virage ') + c.map((k) => n[k]).join('–');
}
function nomCoins(m) {
  if (m === 15) return 'Pleine';
  const n = { TL: 'en haut à gauche', TR: 'en haut à droite', BL: 'en bas à gauche', BR: 'en bas à droite' };
  const c = Object.keys(n).filter((k) => (m & CORNER_BITS[k]) !== 0);
  return c.length ? 'Coins remplis : ' + liste(c.map((k) => n[k])) : 'Vide';
}
const ETATS_MUR = { isolated: 'seule', 'left-end': 'bout gauche', middle: 'milieu', 'right-end': 'bout droit', 'flank-left': 'flanc gauche, pas posée', 'flank-right': 'flanc droit, pas posée', 'corner-left': 'angle gauche', 'corner-right': 'angle droit' };
const BANDES = { top: 'Dessus', face: 'Face', base: 'Pied (bloque le passage)', shadow: 'Ombre au sol', pente: 'Pente du dessus', decor: 'Gravats' };
function nomPiece(j, col, row) {
  const S = SORTES[j.sorte], r = j.reglages;
  if (S.wall) {
    const c = wallAtlasDescriptor({ decor: r.decor }).cells.find((x) => x.col === col && x.row === row);
    if (!c) return 'Case vide : rien à poser';
    if (c.band === 'top') return c.state === null ? 'Case vide : rien à poser' : 'Dessus · ' + nomBlob(c.state);
    if (c.band === 'decor') return 'Gravats · appui ' + c.orientation;
    if (c.sens) return 'En biais vers la ' + c.sens + ' · ' + (BANDES[c.band] || c.band).toLowerCase();
    return c.state ? `${BANDES[c.band] || c.band} · ${ETATS_MUR[c.state] || c.state}` : 'Case vide : rien à poser';
  }
  const L = TILESET_LAYOUTS[S.type];
  if (!S.set) return 'Pièce ' + (row * L.columns + col + 1) + ', à poser à la main';
  if (row < L.rows) {
    const m = maskAtPosition(S.set, col, row);
    if (m === null || m === undefined) return j.autreSol && S.set === 'B47' && col === BLOB_LOWER_CELL.col && row === BLOB_LOWER_CELL.row ? 'Le sol dessous, seul' : 'Case vide : rien à poser';
    return S.set === 'B47' ? nomBlob(m) : S.set === 'E16' ? nomChemin(m) : nomCoins(m);
  }
  const vd = variantAtlasDescriptor(S.type, r.variantes);
  if (vd && vd.variants.some((v) => v.col === col && v.row === row)) return `Variante ${col + 1} de la pièce pleine`;
  const ad = r.animation > 0 ? animationAtlasDescriptor(S.type, r.animation, r.variantes) : null;
  const i = ad ? ad.frames.findIndex((f) => f.col === col && f.row === row) : -1;
  if (i > 0) return `Image ${i + 1} de l’animation de la pièce pleine`;
  const dd = decorAtlasDescriptor(S.type, r.decor, r.variantes, r.animation, 0);
  const d = dd && dd.cells.find((x) => x.col === col && x.row === row);
  if (d) return 'Gravats · appui ' + d.orientation;
  return 'Case vide : rien à poser';
}

/* ——— La vérification (tile-check.js, pour de vrai) ——— */
function verifier(j) {
  const S = SORTES[j.sorte];
  if (!S.set && !S.wall) return { rien: true };
  const atlas = atlasDe(j), d = atlas.getContext('2d').getImageData(0, 0, atlas.width, atlas.height);
  const img = { data: d.data, width: d.width, height: d.height, tile: j.taille };
  let defauts = S.wall ? checkWallAtlas(img, { WALL_TOP_ROWS, WALL_BAND_STATES, biais: biaisAtlasDescriptor('wall') }) : checkMaskSetAtlas(img, S.set);
  // tile-check ne connaît pas le sol dessous : la case que le moteur lui réserve (la 48ᵉ du
  // blob, le masque 0 des 15 pièces) est peinte exprès, et le contrôle la compte comme un défaut.
  if (j.autreSol && S.lower) {
    const libre = `case libre (${BLOB_LOWER_CELL.col}, ${BLOB_LOWER_CELL.row})`;
    defauts = defauts.filter((p) => !(S.set === 'B47' && p.includes(libre)) && !(S.set === 'W16' && /masque 0\b.*aucun coin/.test(p)));
  }
  return { defauts, pieces: nombrePieces(j) };
}
function enClair(p) {
  if (/couture|diffère/.test(p)) return 'Deux pièces voisines ne se raccordent pas : leur bord commun ne tombe pas au même endroit.';
  if (/entièrement transparent/.test(p)) return 'Une pièce est vide : rien n’y est dessiné.';
  if (/devrait rester transparente/.test(p)) return 'Une case qui doit rester vide est dessinée.';
  if (/diagonale/.test(p)) return 'Une pièce en biais ne va pas d’un coin à l’autre.';
  return 'Un défaut que la maquette ne sait pas dire autrement : voir le détail.';
}

/* ——— L'état de l'écran ——— */
const state = {
  vue: 'liste', jeu: null, onglet: 'carte', zoom: 1, heros: true, tiroir: null,
  nouveau: { sorte: 'sol', taille: 32, nom: DEFAUTS_SORTE.sol.nom, nomTouche: false },
  gen: null, tirages: [], verif: null, livraison: null, image: 0, survol: null, planche: null,
};
let atlasCourant = null, minuterieRendu = null, minuterieAnim = null, minuterieGen = null;

/* ——— Le carnet ——— */
const PORTES = ['Le jeu', 'Univers & toile', 'Les sujets', 'Les tuiles', 'Galerie', 'Fabrications', 'Livrer au jeu', 'Réglages', 'Guide'];
function vueCarnet() {
  return `<div class="sidebar-heading"><div class="brand">Asset Kitchen</div></div>
    <div class="game"><div class="label">Le jeu ouvert</div><h3>Les marais d’ambre</h3><small>Pixel art · 32 px</small></div>
    <nav aria-label="Atelier">${PORTES.map((n) => n === 'Les tuiles'
      ? `<button data-action="liste" aria-current="page">${n}<span class="mono">${JEUX.length}</span></button>`
      : `<button data-action="ailleurs" title="Ouvre la maquette de l’atelier">${n}<span class="muted">↗</span></button>`).join('')}</nav>
    <div class="sidefoot"><p class="small">Cette maquette ne montre que les tuiles. Les portes marquées ↗ ouvrent la maquette de l’atelier.</p></div>`;
}

/* ——— Aperçus rendus en différé (listes et cartes de choix) ——— */
const fileApercus = [];
let fileEnCours = false;
function demanderApercu(canvas, rendu) { fileApercus.push({ canvas, rendu }); if (!fileEnCours) { fileEnCours = true; setTimeout(viderFile, 30); } }
function viderFile() {
  const t = fileApercus.shift();
  if (!t) { fileEnCours = false; return; }
  if (t.canvas.isConnected) { try { t.rendu(t.canvas); } catch (e) { console.error(e); } }
  setTimeout(viderFile, 0);
}
function apercuJeu(canvas, j) {
  const atlas = atlasDe(j);
  if (SORTES[j.sorte].type === 'topdown-17') return planchePetite(canvas, atlas);
  dessinerCarte(canvas, j, atlas, carteApercu(j.sorte), 32 / j.taille);
}
function planchePetite(canvas, atlas) {
  const fit = Math.min(canvas.width / atlas.width, canvas.height / atlas.height), k = fit >= 1 ? Math.floor(fit) : fit;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(atlas, Math.round((canvas.width - atlas.width * k) / 2), Math.round((canvas.height - atlas.height * k) / 2), Math.round(atlas.width * k), Math.round(atlas.height * k));
}

/* ——— A · Les tuiles du jeu ——— */
function vueListe() {
  const demande = !DEMANDE.faite ? `<button class="carte-jeu carte-demande" data-action="demande">
      <div class="apercu">Pas encore fait</div>
      <span class="label">Demandé par l’agent Godot</span><strong>${esc(DEMANDE.nom)}</strong><small>32 px · pour la carte du chapitre 2 · le ${DEMANDE.quand}</small></button>` : '';
  return `<div class="tu-tete"><div><h1>Les tuiles du jeu</h1><p>Les sols, les chemins et les murs que ton jeu pose case par case sur ses cartes.</p></div>
    <div class="row"><button class="lien" data-action="atlas-existant">À partir d’une image déjà faite</button><button class="principal" data-action="nouveau">Nouveau jeu de tuiles</button></div></div>
    <div class="cartes-jeux">${demande}${JEUX.map((j) => `<button class="carte-jeu" data-action="ouvrir" data-id="${j.id}">
      <div class="apercu image-fond"><canvas data-apercu="${j.id}" width="288" height="160" aria-hidden="true"></canvas></div>
      <strong>${esc(j.nom)}</strong><small>${SORTES[j.sorte].court} · ${nombrePieces(j)} pièces · ${j.taille} px</small>
      <small>${j.demande ? 'Demandé par l’agent Godot · ' : ''}${j.livre ? 'Livré au jeu ' + esc(j.livre) : 'Pas encore livré au jeu'}</small></button>`).join('')}</div>
    <p class="tu-pied-liste">Dans la maquette, rien n’est gardé après rechargement.</p>`;
}
function apresListe() { for (const c of $$('[data-apercu]')) demanderApercu(c, (cv) => apercuJeu(cv, JEUX.find((j) => j.id === cv.dataset.apercu))); }

/* ——— B · Quelle sorte de tuiles ? ——— */
function jeuModele(sorte, taille = 32) { const d = DEFAUTS_SORTE[sorte]; return nouveauJeu({ nom: d.nom, sorte, taille, surface: d.surface, face: d.face, fond: d.fond, reglages: sorte === 'mur' ? { hauteur: 2 } : {} }); }
function vueSorte() {
  const n = state.nouveau;
  const grande = (id) => `<button class="sorte" data-action="choisir-sorte" data-sorte="${id}" aria-pressed="${n.sorte === id}">
      <div class="apercu"><canvas data-sorte-apercu="${id}" width="288" height="160" aria-hidden="true"></canvas></div>
      <h2>${SORTES[id].nom}</h2><p>${SORTES[id].texte}</p><span class="mono small">${id === 'mur' ? nombrePieces({ sorte: 'mur' }) : { sol: 47, chemin: 16 }[id]} pièces</span></button>`;
  const petite = (id) => `<button class="autre" data-action="choisir-sorte" data-sorte="${id}" aria-pressed="${n.sorte === id}"><canvas data-sorte-apercu="${id}" width="81" height="81" aria-hidden="true"></canvas><span><strong>${SORTES[id].nom}</strong><small>${SORTES[id].texte}</small></span></button>`;
  const autreChoisi = n.sorte === 'p15' || n.sorte === 'p17';
  return `<div class="fil"><button data-action="liste">Les tuiles</button><span>›</span><span>Nouveau jeu de tuiles</span></div>
    <div class="tu-tete"><div><h1>Quelle sorte de tuiles ?</h1><p>Choisis ce que ces tuiles vont dessiner sur tes cartes. Tu pourras tout changer ensuite.</p></div></div>
    <div class="sortes">${grande('sol')}${grande('chemin')}${grande('mur')}</div>
    <details class="autres-formats" ${autreChoisi ? 'open' : ''}><summary>Autres formats</summary><div class="autres">${petite('p15')}${petite('p17')}</div></details>
    <div class="creer">
      <label>Nom<input type="text" id="nouveau-nom" value="${esc(n.nom)}"></label>
      <div><div class="small">Taille d’une tuile</div><div class="puces">${[16, 32, 64].map((t) => `<button class="puce" data-action="taille-nouveau" data-taille="${t}" aria-pressed="${n.taille === t}">${t} px</button>`).join('')}</div>
        <div class="aide-taille">${n.taille === 32 ? '32 px, la taille de ce jeu.' : 'Le reste du jeu est en 32 px : ces tuiles n’auront pas la même taille que tes personnages.'}</div></div>
      <button class="quiet" data-action="liste">Annuler</button>
      <button class="principal" data-action="creer">Ouvrir l’atelier</button>
    </div>`;
}
const modeles = {};
function apresSorte() {
  for (const c of $$('[data-sorte-apercu]')) {
    const id = c.dataset.sorteApercu;
    demanderApercu(c, (cv) => {
      const j = modeles[id] || (modeles[id] = jeuModele(id));
      if (id === 'p17' || cv.width < 100) return planchePetite(cv, atlasDe(j));
      apercuJeu(cv, j);
    });
  }
}

/* ——— C · L'atelier ——— */
function emplacementsDe(j) {
  const S = SORTES[j.sorte];
  if (S.wall) return [{ id: 'surface', nom: 'Dessus', bord: 'Bord du dessus' }, { id: 'face', nom: 'Face' }, { id: 'fond', nom: 'Sol au pied' }];
  const l = [{ id: 'surface', nom: j.sorte === 'chemin' ? 'Le chemin' : 'Surface', bord: 'Bordure' }];
  if (j.autreSol && S.lower) l.push({ id: 'bas', nom: 'Sol dessous', bord: 'Sa bordure' });
  return l;
}
function vueAtelier() {
  const j = state.jeu, S = SORTES[j.sorte];
  const demande = j.demande ? `<div class="bandeau bandeau-attention"><p>L’agent Godot a demandé ce jeu de tuiles le ${DEMANDE.quand} : « ${esc(DEMANDE.texte)} ». Il le recevra quand tu l’auras livré.</p></div>` : '';
  return `<div class="at-tete"><div style="min-width:0;flex:1">
      <div class="fil"><button data-action="liste">Les tuiles</button><span>›</span><span id="fil-nom">${esc(j.nom)}</span></div>
      <input class="nom-jeu" id="nom-jeu" value="${esc(j.nom)}" aria-label="Nom du jeu de tuiles" spellcheck="false">
      <div class="meta"><span>${S.court} · ${nombrePieces(j)} pièces</span><span>·</span><label>tuiles de <select id="taille" aria-label="Taille d’une tuile">${[16, 32, 64].map((t) => `<option ${t === j.taille ? 'selected' : ''}>${t}</option>`).join('')}</select> px</label></div>
    </div>
    <div class="at-actions"><button data-action="enregistrer">Enregistrer</button><button class="principal" data-action="livrer">Livrer à Godot</button></div></div>
    ${demande}
    <div class="atelier">
      <div class="colonne" id="col-matieres"></div>
      <div class="centre" id="centre"></div>
      <div class="colonne" id="col-reglages"></div>
      <div id="tiroir-place"></div>
    </div>`;
}
function apresAtelier() {
  majMatieres(); majReglages(); majCentre(); majTiroir();
  if (state.zoomAuto && state.onglet === 'carte') { state.zoomAuto = false; zoomAjuste(); }
  rendreMaintenant();
}
function zoomAjuste() {
  const j = state.jeu, v = $('#vue'); if (!v || !j.carte) return;
  let z = 1;
  for (const k of [2, 3]) if (j.carte.columns * j.taille * k <= v.clientWidth - 28 && j.carte.rows * j.taille * k <= v.clientHeight - 28) z = k;
  state.zoom = z;
  $$('[data-action="zoom"]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.zoom) === z)));
}

function vignette(canvas, img) {
  if (!canvas || !img) return;
  const c = versCanvas(img); canvas.width = img.width * 2; canvas.height = img.height * 2;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.drawImage(c, x * img.width, y * img.height);
}
function majMatieres() {
  const j = state.jeu, S = SORTES[j.sorte], col = $('#col-matieres'); if (!col) return;
  const cible = state.tiroir && state.tiroir.cible;
  const ligne = (e) => {
    if (e.id === 'fond') return `<div class="groupe-matiere"><button class="matiere" data-action="tiroir" data-cible="fond" aria-pressed="${cible === 'fond'}">
        <canvas data-vig="fond"></canvas><span><strong>${e.nom}</strong><span class="nom-matiere">${esc(nomFond(j))}</span><span class="origine">Sur la carte seulement</span></span></button></div>`;
    const emp = j.etat[e.id];
    const vig = emp.image ? `<canvas data-vig="${e.id}"></canvas>` : '<span class="vide">à choisir</span>';
    let bord = '';
    if (e.bord) {
      const b = PAR_ID[e.id].bordure, eb = j.etat[b];
      bord = eb.lie
        ? `<div class="bordure-ligne"><canvas data-vig="${b}"></canvas><span>${e.bord}</span><button class="suit" data-action="delier" data-id="${b}" title="Cliquer pour lui donner sa propre matière">${e.id === 'bas' ? 'suit le sol dessous' : S.wall ? 'suit le dessus' : j.sorte === 'chemin' ? 'suit le chemin' : 'suit la surface'}</button></div>`
        : `<div class="bordure-ligne" style="flex-wrap:wrap"><canvas data-vig="${b}"></canvas><span>${e.bord} : ${esc(eb.nom || 'vide')}</span><button data-action="tiroir" data-cible="${b}" aria-pressed="${cible === b}">Changer</button><button data-action="relier" data-id="${b}">Relier</button></div>`;
    }
    return `<div class="groupe-matiere"><button class="matiere" data-action="tiroir" data-cible="${e.id}" aria-pressed="${cible === e.id}">${vig}
        <span><strong>${e.nom}</strong><span class="nom-matiere">${esc(emp.nom || (S.wall && e.id === 'face' ? 'comme le dessus' : 'couleur provisoire'))}</span><span class="origine">${j.origine[e.id] || ORIGINE[emp.source]}</span></span></button>${bord}</div>`;
  };
  col.innerHTML = `<div class="label">Les matières</div>${emplacementsDe(j).map(ligne).join('')}
    ${S.lower ? `<label class="coche"><input type="checkbox" data-action="autre-sol" ${j.autreSol ? 'checked' : ''}>Sur un autre sol</label><p class="note-col">Ajoute le sol qui apparaît sous les bords : le sable sous l’herbe, la berge sous l’eau.</p>` : ''}
    <p class="cout-ecran">Rien ne coûte ici : chaque changement refait les tuiles sur ta machine.</p>`;
  for (const c of $$('[data-vig]', col)) {
    const id = c.dataset.vig;
    if (id === 'fond') { const m = motifFond(j).canvas; c.width = m.width * 2; c.height = m.height * 2; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.drawImage(m, x * m.width, y * m.height); }
    else vignette(c, j.etat[id].image);
  }
}

const OPTIONS = {
  bordures: [['rough', 'Organiques'], ['clean', 'Nettes']],
  nuances: [[2, '2'], [4, '4'], [8, '8']],
  ombre: [[0, 'Aucune'], [110, 'Discrète'], [190, 'Marquée']],
  penombre: [[0, 'Aucune'], [50, 'Discrète'], [80, 'Marquée']],
  decor: [['aucun', 'Aucun'], ['leger', 'Léger'], ['dense', 'Dense']],
  reduction: [['contraste', 'Garder le trait'], ['moyenne', 'Moyenne'], ['compensee', 'Moyenne compensée']],
  variantes: [[0, 'Aucune'], [1, '1'], [2, '2'], [3, '3']],
  animation: [[0, 'Aucune'], [2, '2 images'], [4, '4 images'], [6, '6 images'], [8, '8 images']],
};
function majReglages() {
  const j = state.jeu, S = SORTES[j.sorte], r = j.reglages, col = $('#col-reglages'); if (!col) return;
  const curseur = (cle, nom, min, max, unite = '') => `<label class="reglage"><span>${nom}</span><span class="valeur" data-valeur="${cle}">${r[cle]}${unite}</span><input type="range" data-reglage="${cle}" min="${min}" max="${max}" value="${r[cle]}"></label>`;
  const choix = (cle, nom, aide = '') => `<label class="reglage"><span>${nom}</span><select data-reglage="${cle}">${OPTIONS[cle].map(([v, t]) => `<option value="${v}" ${String(v) === String(r[cle]) ? 'selected' : ''}>${t}</option>`).join('')}</select>${aide ? `<small>${aide}</small>` : ''}</label>`;
  col.innerHTML = `<div class="label">Réglages</div>
    ${curseur('arrondi', 'Arrondi des coins', 0, 8)}${curseur('irregularite', 'Irrégularité des bords', 0, 10)}${curseur('relief', 'Relief', 0, 10)}
    ${S.wall ? curseur('hauteur', 'Hauteur du mur', 1, 8, ' cases') : ''}
    <details class="fins"><summary>Réglages fins</summary><div class="corps">
      ${choix('bordures', 'Bords')}${choix('nuances', 'Nuances par matière')}
      ${S.wall ? choix('ombre', 'Ombre du mur') + choix('penombre', 'Pénombre dans les angles') : ''}
      ${S.set || S.wall ? choix('decor', 'Cailloux au bord', 'Ils débordent sur la case voisine : le bord ne suit plus la grille.') : ''}
      ${choix('reduction', 'Réduire une image', 'Pour une image plus grande qu’une tuile.')}
      ${S.set ? choix('variantes', 'Variantes de la pièce pleine') + choix('animation', 'Animation de la pièce pleine') : ''}
      <label class="reglage"><span>Graine</span><input type="number" id="graine" value="${j.graine}" min="1"><small><button class="lien" data-action="graine">Tirer une autre graine</button> : les matières intégrées changent de dessin.</small></label>
    </div></details>`;
}

function majCentre() {
  const j = state.jeu, S = SORTES[j.sorte], c = $('#centre'); if (!c) return;
  const o = state.onglet;
  const onglets = `<div class="onglets" role="tablist">${[['carte', 'Carte'], ['planche', 'Planche'], ['verifier', 'Vérifier']].map(([id, n]) => `<button role="tab" aria-selected="${o === id}" data-action="onglet" data-onglet="${id}">${n}</button>`).join('')}
    <span class="aide">${o === 'carte' && j.carte ? 'Clic : poser · clic droit : effacer' : o === 'planche' ? 'Survole une pièce pour lire son nom' : ''}</span></div>`;
  if (o === 'carte') {
    const fonds = [...LISTE_MATIERES].sort((a, b) => (b.role === 'sol') - (a.role === 'sol'));
    c.innerHTML = onglets + (j.carte
      ? `<div class="vue" id="vue"><div class="vue-dedans"><canvas id="scene" aria-label="La carte : clic pour poser, clic droit pour effacer"></canvas></div></div>
        <div class="barre-scene"><button class="petit" data-action="ile">${j.sorte === 'mur' ? 'Pièces au hasard' : j.sorte === 'chemin' ? 'Chemins au hasard' : 'Île au hasard'}</button><button class="petit" data-action="effacer">Tout effacer</button>
          <label>Sol de fond <select id="fond" aria-label="Sol de fond">${j.fond.image ? `<option value="" selected>${esc(j.fond.nom)}</option>` : ''}${fonds.map((m) => `<option value="${m.id}" ${!j.fond.image && m.id === j.fond.matiere ? 'selected' : ''}>${esc(m.nom)}</option>`).join('')}</select></label>
          <label><input type="checkbox" data-action="heros" ${state.heros ? 'checked' : ''}>Personnage</label>
          <span class="puces pousse">${[1, 2, 3].map((z) => `<button class="puce petit" data-action="zoom" data-zoom="${z}" aria-pressed="${state.zoom === z}">×${z}</button>`).join('')}</span></div>`
      : `<div class="vue" id="vue"><div class="vide-carte">Ces 17 pièces se posent à la main dans Godot : il n’y a pas de carte à peindre ici. Elles sont toutes dans l’onglet Planche.</div></div>`);
  } else if (o === 'planche') {
    c.innerHTML = onglets + `<div class="vue damier" id="vue"><div class="vue-dedans"><canvas id="planche" aria-label="La planche de toutes les pièces"></canvas></div></div>
      <div class="lecture" id="lecture"><span class="muted">Survole une pièce pour lire son nom.</span></div>`;
  } else {
    c.innerHTML = onglets + `<div class="verifier" id="verif"></div>`;
  }
  brancherScene();
}
function majTiroir() {
  const place = $('#tiroir-place'); if (!place) return;
  $('.atelier').classList.toggle('avec-tiroir', !!state.tiroir);
  if (state.onglet === 'planche' && atlasCourant) requestAnimationFrame(dessinerPlanche);
  requestAnimationFrame(centrerVue);
  if (!state.tiroir) { place.innerHTML = ''; return; }
  const j = state.jeu, t = state.tiroir, nomCible = nomCibleDe(j, t.cible);
  place.innerHTML = `<aside class="tiroir" aria-label="Choisir la matière">
    <div class="tiroir-tete"><div><h2>Choisir la matière</h2><p>Pour : ${esc(nomCible)}</p></div><button data-action="fermer-tiroir">Fermer</button></div>
    <div class="onglets" role="tablist">${[['integrees', 'Intégrées'], ['miennes', 'Mes matières'], ['generer', 'Générer']].map(([id, n]) => `<button role="tab" aria-selected="${t.onglet === id}" data-action="onglet-tiroir" data-onglet="${id}">${n}</button>`).join('')}</div>
    <div class="tiroir-corps" id="tiroir-corps"></div></aside>`;
  majCorpsTiroir();
}
function nomCibleDe(j, cible) {
  if (cible === 'fond') return 'Sol au pied';
  if (cible === 'bordure') return SORTES[j.sorte].wall ? 'Bord du dessus' : 'Bordure';
  if (cible === 'bordureBas') return 'Bordure du sol dessous';
  return (emplacementsDe(j).find((e) => e.id === cible) || {}).nom || cible;
}
function matiereActuelle(j, cible) { return cible === 'fond' ? (j.fond.image ? '' : j.fond.matiere) : j.etat[cible].source === 'matiere' ? j.etat[cible].matiere : ''; }
function majCorpsTiroir() {
  const corps = $('#tiroir-corps'); if (!corps) return;
  const j = state.jeu, t = state.tiroir, s = j.taille;
  if (t.onglet === 'integrees') {
    const prefere = t.cible === 'face' ? 'mur' : 'sol', actuelle = matiereActuelle(j, t.cible);
    const l = [...LISTE_MATIERES].sort((a, b) => (b.role === prefere) - (a.role === prefere));
    corps.innerHTML = `<div class="grille-matieres">${l.map((m) => `<button class="choix" data-action="poser-integree" data-mat="${m.id}" aria-pressed="${m.id === actuelle}"><canvas data-mat-vig="${m.id}"></canvas>${esc(m.nom)}</button>`).join('')}</div>`;
    for (const c of $$('[data-mat-vig]', corps)) vignette(c, rendreMatiere(c.dataset.matVig, s, j.graine).surface);
  } else if (t.onglet === 'miennes') {
    corps.innerHTML = `<p class="simule">Les matières déjà faites pour ce jeu. Dans la maquette, ce sont des matières intégrées redessinées.</p>
      <div class="grille-matieres" style="margin-top:8px">${BIBLIO.map((b) => `<button class="choix" data-action="poser-biblio" data-id="${b.id}"><canvas data-biblio-vig="${b.id}"></canvas>${esc(b.nom)}<small>${esc(b.quand)}</small></button>`).join('')}</div>`;
    for (const c of $$('[data-biblio-vig]', corps)) { const b = BIBLIO.find((x) => x.id === c.dataset.biblioVig); vignette(c, imagesBiblio(b, s).surface); }
  } else {
    corps.innerHTML = vueGenerer();
    majTexteEnvoye(); majBoutonGenerer(); majResultat();
  }
}
function imagesBiblio(b, s) { if (b.images && b.images.surface.width === s) return b.images; if (b.images && b.ia) return b.images; return (b.images = rendreMatiere(b.mat, s, b.graine)); }

/* ——— D · Générer (simulé) ——— */
function cibleTexte(t) { return t.cible === 'fond' ? 'fond' : t.cible; }
function vueGenerer() {
  const j = state.jeu, t = state.tiroir, c = cibleTexte(t);
  const cadrage = j.texte.cadrages[c] || cadrageParDefaut(t.cible);
  const nomCible = nomCibleDe(j, t.cible);
  return `<div class="gen">
    <label class="champ">C’est fait de quoi ?<input type="text" id="g-pierre" value="${esc(j.texte.pierre)}" placeholder="de la pierre grise usée"><small>Le même pour toutes les matières de ce jeu de tuiles.</small></label>
    <label class="champ">Le motif<input type="text" id="g-motif" value="${esc(j.texte.motifs[c] || '')}" placeholder="de grandes dalles carrées, deux par deux"><small>Seulement pour : ${esc(nomCible)}.</small></label>
    <div><div class="small" style="margin-bottom:4px">Vu comment</div><div class="puces">${Object.entries(CADRAGES).map(([id, cd]) => `<button class="puce petit" data-action="cadrage" data-cadrage="${id}" aria-pressed="${id === cadrage}" title="${esc(cd.aide)}">${esc({ surface: 'Sol vu du dessus', face: 'Face de mur', plat: 'Matière à plat', motif: 'Motif régulier' }[id])}</button>`).join('')}</div></div>
    <div><button class="lien" data-action="voir-texte" aria-expanded="${!!state.texteOuvert}">${state.texteOuvert ? 'Cacher le texte envoyé' : 'Voir le texte envoyé'}</button><div class="texte-envoye" id="texte-envoye" ${state.texteOuvert ? '' : 'hidden'}></div></div>
    <label class="coche"><input type="checkbox" id="g-commune" ${state.commune !== false ? 'checked' : ''}>Mêmes couleurs pour toutes les matières</label>
    <div class="gen-bas">
      <div class="row"><label class="coche">Tirages <input type="number" id="g-n" min="1" max="8" value="${state.nTirages || 4}"></label><button class="principal" data-action="generer" id="g-bouton">Générer</button></div>
      <p class="raison" id="g-raison"></p>
    </div>
    <div id="g-resultat"></div></div>`;
}
function champsGen() {
  const j = state.jeu, t = state.tiroir, c = cibleTexte(t);
  return { pierre: j.texte.pierre, motif: j.texte.motifs[c] || '', cadrage: j.texte.cadrages[c] || cadrageParDefaut(t.cible) };
}
function majTexteEnvoye() {
  const el = $('#texte-envoye'); if (!el) return;
  const { pierre, motif, cadrage } = champsGen();
  if (!pierre.trim() || !motif.trim()) { el.innerHTML = '<span class="ajout">Écris de quoi c’est fait et le motif : le texte envoyé s’affichera ici.</span>'; return; }
  const texte = composerPrompt(pierre, motif, cadrage), ajout = CADRAGES[cadrage].consigne;
  const debut = texte.slice(0, texte.length - ajout.length);
  el.innerHTML = `${esc(debut)}<span class="ajout">${esc(ajout)}</span>`;
}
function majBoutonGenerer() {
  const b = $('#g-bouton'), r = $('#g-raison'); if (!b) return;
  const { pierre, motif } = champsGen(), n = state.nTirages || 4;
  const enCours = state.gen && state.gen.jeu === state.jeu;
  b.textContent = `Générer ${n} tirage${n > 1 ? 's' : ''}`;
  b.disabled = enCours || !pierre.trim() || !motif.trim();
  r.innerHTML = enCours ? 'Une génération est en cours pour ce jeu de tuiles.'
    : !pierre.trim() || !motif.trim() ? 'Écris de quoi c’est fait et le motif pour pouvoir générer.'
    : `<span class="gratuit">Gratuit</span>, sur ta machine · environ 2 min par image, ${2 * n} min pour ${n} tirage${n > 1 ? 's' : ''}.`;
}
function minutes(sec) { return sec >= 90 ? `environ ${Math.round(sec / 60)} min` : sec > 30 ? 'environ 1 min' : 'moins d’une minute'; }
function majResultat() {
  const el = $('#g-resultat'); if (!el) return;
  const g = state.gen;
  if (g && g.jeu === state.jeu) {
    const f = Math.min(1, (Date.now() - g.debut) / g.duree), reste = g.total * (1 - f);
    el.innerHTML = `<div class="attente"><span>${g.cibleNom} · tirage ${Math.min(g.n, Math.floor(f * g.n) + 1)} sur ${g.n} · encore ${minutes(reste)}</span><div class="bar"><span style="width:${(f * 100).toFixed(1)}%"></span></div><span class="simule">Dans la maquette, l’attente est raccourcie à quelques secondes.</span></div>`;
    return;
  }
  const tirs = state.tirages.filter((x) => x.jeu === state.jeu);
  if (!tirs.length) { el.innerHTML = ''; return; }
  const cible = state.tiroir.cible;
  el.innerHTML = `<div class="label" style="margin-bottom:8px">Les tirages · clique celui qui te plaît</div>
    <div class="tirages">${tirs.map((x, i) => `<button class="choix" data-action="poser-tirage" data-i="${i}" aria-pressed="${!!x.pose && x.pose === cible}"><canvas data-tirage="${i}"></canvas>Tirage ${i + 1}<small>${esc(x.pourNom)}</small></button>`).join('')}</div>
    <p class="simule" style="margin-top:8px">Tirages simulés dans la maquette : des matières intégrées redessinées, choisies d’après les mots du texte.</p>`;
  for (const c of $$('[data-tirage]', el)) vignette(c, tirs[Number(c.dataset.tirage)].surface);
}
const MOTS = [
  [/herbe|gazon|pelouse|grass/, 'herbe'], [/jonc|roseau|prairie|foin|hautes? herbes?/, 'prairie'], [/dalle|pav|flagstone/, 'pierre'],
  [/brique|brick/, 'brique'], [/roche|rocher|falaise|granit|rock/, 'roche'], [/terre|boue|vase|dirt|mud/, 'terre'], [/sable|plage|sand/, 'sable'],
  [/eau|rivi|flaque|mare|lac|water/, 'eau'], [/planche|bois|parquet|ponton|wood/, 'bois'], [/neige|glace|snow/, 'neige'], [/feuill|mousse|leaf|moss/, 'feuillage'],
  [/lave|magma|lava/, 'lave'], [/carrel|tomette|tile/, 'carrelage'], [/pierre|stone/, 'pierre'],
];
function matieresProches(texte, cible) {
  const t = texte.toLowerCase(), trouve = [];
  for (const [re, id] of MOTS) if (re.test(t) && !trouve.includes(id)) trouve.push(id);
  if (!trouve.length) trouve.push(cible === 'face' ? 'brique' : 'pierre');
  return trouve.slice(0, 3);
}
function lancerGeneration() {
  const j = state.jeu, t = state.tiroir, { pierre, motif } = champsGen();
  const n = Math.max(1, Math.min(8, state.nTirages || 4));
  const cibleNom = nomCibleDe(j, t.cible);
  state.gen = { jeu: j, cible: t.cible, cibleNom, n, debut: Date.now(), duree: FIGE ? 0 : 3500, total: n * 120, pierre, motif };
  state.tirages = state.tirages.filter((x) => x.jeu !== j);
  majBoutonGenerer(); majResultat();
  clearInterval(minuterieGen);
  const fin = () => {
    clearInterval(minuterieGen); const g = state.gen; state.gen = null;
    const proches = matieresProches(g.pierre + ' ' + g.motif, g.cible), s = j.taille;
    const ref = g.cible !== 'surface' && j.etat.surface.image && state.commune !== false ? j.etat.surface.image : null;
    for (let i = 0; i < g.n; i++) {
      const im = rendreMatiere(proches[i % proches.length], s, 1000 + i * 97 + ((Math.random() * 500) | 0));
      const [surface, contour] = ref ? harmoniserPalette([ref, im.surface, im.contour]).slice(1) : [im.surface, im.contour];
      contourDe.set(surface, contour);
      state.tirages.push({ jeu: j, surface, contour, pourNom: g.cibleNom, nom: (g.motif || g.pierre).slice(0, 40), pose: null });
    }
    if ($('#g-resultat')) { majBoutonGenerer(); majResultat(); if (!FIGE) $('#g-resultat').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    toast(`${g.n} tirage${g.n > 1 ? 's' : ''} prêt${g.n > 1 ? 's' : ''} pour ${g.cibleNom}.`);
  };
  if (FIGE) return fin();
  minuterieGen = setInterval(() => { if (Date.now() - state.gen.debut >= state.gen.duree) fin(); else if ($('#g-resultat')) majResultat(); }, 250);
}
function poserTirage(i) {
  const j = state.jeu, x = state.tirages.filter((y) => y.jeu === j)[i], cible = state.tiroir.cible;
  const nom = j.texte.pierre ? j.texte.pierre.replace(/^(de la |du |des |de l’|de l'|d’|d')/i, '').slice(0, 32) : 'Matière générée';
  const propre = nom.charAt(0).toUpperCase() + nom.slice(1);
  if (cible === 'fond') j.fond = { image: x.surface, nom: propre, source: 'ia' };
  else {
    const b = PAR_ID[cible].bordure, lie = b && j.etat[b].lie;
    poserImage(j.etat, cible, x.surface, propre, 'ia');
    if (lie) j.etat[b] = { source: 'ia', matiere: '', nom: propre, image: x.contour, lie: true, cle: '' };
    delete j.origine[cible]; if (b) delete j.origine[b];
  }
  for (const y of state.tirages) if (y.jeu === j && y.pose === cible) y.pose = null;
  x.pose = cible;
  if (!BIBLIO.some((b) => b.images && b.images.surface === x.surface)) BIBLIO.unshift({ id: 'b' + (BIBLIO.length + 1) + 'g', nom: propre, quand: 'Générée aujourd’hui', ia: true, images: { surface: x.surface, contour: x.contour } });
  majMatieres(); majResultat(); planifierRendu();
  toast(`Tirage posé : la carte se refait avec.`);
}

/* ——— Poser une matière ——— */
function poserIntegree(mat) {
  const j = state.jeu, cible = state.tiroir.cible;
  if (cible === 'fond') { j.fond = { matiere: mat }; }
  else {
    poserMatiere(j.etat, cible, mat, j.taille, j.graine);
    delete j.origine[cible]; const b = PAR_ID[cible].bordure; if (b && j.etat[b].lie) delete j.origine[b];
  }
  majMatieres(); majCorpsTiroir(); planifierRendu(); if (state.onglet === 'carte') majCentreBarre();
}
function poserBiblio(id) {
  const j = state.jeu, cible = state.tiroir.cible, b = BIBLIO.find((x) => x.id === id), im = imagesBiblio(b, j.taille);
  if (cible === 'fond') j.fond = { image: im.surface, nom: b.nom, source: 'biblio' };
  else {
    const bord = PAR_ID[cible].bordure, lie = bord && j.etat[bord].lie;
    poserImage(j.etat, cible, im.surface, b.nom, 'biblio');
    j.origine[cible] = b.quand.split(' le ')[0].replace(' aujourd’hui', '');
    contourDe.set(im.surface, im.contour);
    if (lie) { j.etat[bord] = { source: 'biblio', matiere: '', nom: b.nom, image: im.contour, lie: true, cle: '' }; j.origine[bord] = j.origine[cible]; }
  }
  majMatieres(); planifierRendu();
  toast(`${b.nom} posée.`);
}
function majCentreBarre() { const f = $('#fond'); if (f && !state.jeu.fond.image) f.value = state.jeu.fond.matiere; }

/* ——— Rendu différé et dessin du centre ——— */
function planifierRendu() { clearTimeout(minuterieRendu); minuterieRendu = setTimeout(rendreMaintenant, 150); }
function rendreMaintenant() {
  clearTimeout(minuterieRendu);
  const j = state.jeu; if (!j || state.vue !== 'atelier') return;
  const t0 = performance.now();
  atlasCourant = atlasDe(j);
  state.dureeRendu = Math.round(performance.now() - t0);
  state.verif = null;
  dessinerCentre();
  cadencer();
}
function dessinerCentre() {
  if (state.onglet === 'carte') dessinerSceneCourante();
  else if (state.onglet === 'planche') dessinerPlanche();
  else majVerif();
}
// Quand la carte déborde (tiroir ouvert, grand zoom), on la montre par son milieu.
function centrerVue() { const v = $('#vue'); if (v) { v.scrollLeft = (v.scrollWidth - v.clientWidth) / 2; v.scrollTop = (v.scrollHeight - v.clientHeight) / 2; } }
function dessinerSceneCourante() {
  const c = $('#scene'), j = state.jeu; if (!c || !atlasCourant || !j.carte) return;
  const z = state.zoom;
  dessinerCarte(c, j, atlasCourant, j.carte, z, { image: state.image, heros: state.heros });
  const sv = state.survol; if (!sv) return;
  const ctx = c.getContext('2d'), t = j.taille * z;
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff8f4';
  if (j.carte.kind === 'sommets') { ctx.beginPath(); ctx.arc(sv.x * t, sv.y * t, Math.max(4, t / 8), 0, Math.PI * 2); ctx.stroke(); }
  else {
    if (SORTES[j.sorte].wall) { ctx.setLineDash([4, 4]); ctx.strokeRect(sv.x * t + 1, (sv.y - j.reglages.hauteur) * t + 1, t - 2, j.reglages.hauteur * t); ctx.setLineDash([]); }
    ctx.strokeRect(sv.x * t + 1, sv.y * t + 1, t - 2, t - 2);
  }
  ctx.restore();
}
function dessinerPlanche() {
  const c = $('#planche'), v = $('#vue'), a = atlasCourant; if (!c || !a) return;
  const j = state.jeu, s = j.taille;
  const k = Math.max(1, Math.min(8, Math.floor(Math.min((v.clientWidth - 28) / a.width, (v.clientHeight - 28) / a.height))));
  c.width = a.width * k; c.height = a.height * k;
  const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(a, 0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(148,140,128,.55)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= a.width; x += s) { ctx.moveTo(x * k + 0.5, 0); ctx.lineTo(x * k + 0.5, c.height); }
  for (let y = 0; y <= a.height; y += s) { ctx.moveTo(0, y * k + 0.5); ctx.lineTo(c.width, y * k + 0.5); }
  ctx.stroke();
  state.planche = { k, cols: a.width / s, rows: a.height / s };
  if (state.surPiece) { ctx.lineWidth = 2; ctx.strokeStyle = '#221f1b'; ctx.strokeRect(state.surPiece.col * s * k + 1, state.surPiece.row * s * k + 1, s * k - 2, s * k - 2); }
}
function majVerif() {
  const el = $('#verif'); if (!el) return;
  const j = state.jeu;
  if (!state.verif) state.verif = verifier(j);
  const v = state.verif;
  if (v.rien) { el.innerHTML = '<h2>Rien à vérifier</h2><p>Ces 17 pièces n’ont pas de raccord automatique : c’est toi qui les poses une à une dans Godot.</p>'; return; }
  if (!v.defauts.length) {
    el.innerHTML = `<div class="bandeau bandeau-ok"><p>Aucun défaut : les ${v.pieces} pièces se raccordent.</p></div>
      <p>Chaque pièce est à sa place sur la planche, porte bien de la matière, et son bord tombe exactement sur celui de ses voisines. Dans Godot, les bords se poseront tout seuls quand tu peindras.</p>
      <p class="small">Vérifié sur la planche telle qu’elle est maintenant. Change une matière ou un réglage, et la vérification se refait ici.</p>`;
    return;
  }
  const groupes = new Map(); for (const p of v.defauts) groupes.set(enClair(p), (groupes.get(enClair(p)) || 0) + 1);
  el.innerHTML = `<div class="bandeau bandeau-echec"><p>${v.defauts.length} défaut${v.defauts.length > 1 ? 's' : ''} sur ${v.pieces} pièces : ils se verront dans le jeu.</p></div>
    <ul>${[...groupes].map(([t, n]) => `<li>${esc(t)}${n > 1 ? ` <span class="mono small">× ${n}</span>` : ''}</li>`).join('')}</ul>
    <p>Essaie un arrondi plus petit ou des bords moins irréguliers, puis reviens ici.</p>
    <details><summary class="small">Le détail, pour l’agent</summary>${v.defauts.map((p) => `<div class="detail">${esc(p)}</div>`).join('')}</details>`;
}
// L'animation de la pièce pleine se joue seulement si elle existe, et jamais avec ?fige.
function cadencer() {
  clearInterval(minuterieAnim); minuterieAnim = null; state.image = 0;
  const j = state.jeu, S = SORTES[j.sorte];
  if (FIGE || !S.set || !(j.reglages.animation > 0) || state.onglet !== 'carte') return;
  const ad = animationAtlasDescriptor(S.type, j.reglages.animation, j.reglages.variantes);
  minuterieAnim = setInterval(() => { if (state.vue !== 'atelier' || !$('#scene')) { clearInterval(minuterieAnim); return; } state.image += 1; dessinerSceneCourante(); }, ad.frameDurationMs);
}

/* ——— Peindre la carte, survoler la planche ——— */
function brancherScene() {
  const c = $('#scene');
  if (c) {
    let peint = null;
    const caseSous = (e) => {
      const j = state.jeu, r = c.getBoundingClientRect(), k = j.carte;
      if (k.kind === 'sommets') { const x = Math.round((e.clientX - r.left) / r.width * k.columns), y = Math.round((e.clientY - r.top) / r.height * k.rows); return x >= 0 && x <= k.columns && y >= 0 && y <= k.rows ? { x, y, table: k.v } : null; }
      const x = Math.floor((e.clientX - r.left) / r.width * k.columns), y = Math.floor((e.clientY - r.top) / r.height * k.rows);
      return x >= 0 && x < k.columns && y >= 0 && y < k.rows ? { x, y, table: k.grid } : null;
    };
    c.oncontextmenu = (e) => e.preventDefault();
    c.onpointerdown = (e) => { peint = e.button === 2 ? false : true; c.setPointerCapture(e.pointerId); const q = caseSous(e); if (q) q.table[q.y][q.x] = peint; state.survol = q; dessinerSceneCourante(); };
    c.onpointermove = (e) => { const q = caseSous(e); if (q && peint !== null) q.table[q.y][q.x] = peint; state.survol = q; dessinerSceneCourante(); };
    c.onpointerup = () => { peint = null; };
    c.onpointerleave = () => { state.survol = null; dessinerSceneCourante(); };
  }
  const p = $('#planche');
  if (p) {
    p.onpointermove = (e) => {
      const r = p.getBoundingClientRect(), pl = state.planche; if (!pl) return;
      const col = Math.floor((e.clientX - r.left) / r.width * pl.cols), row = Math.floor((e.clientY - r.top) / r.height * pl.rows);
      if (col < 0 || row < 0 || col >= pl.cols || row >= pl.rows) return;
      if (state.surPiece && state.surPiece.col === col && state.surPiece.row === row) return;
      state.surPiece = { col, row };
      $('#lecture').innerHTML = `<span class="mono">Case ${col + 1}, ${row + 1}</span> · ${esc(nomPiece(state.jeu, col, row))}`;
      dessinerPlanche();
    };
    p.onpointerleave = () => { state.surPiece = null; dessinerPlanche(); $('#lecture').innerHTML = `<span class="muted">Survole une pièce pour lire son nom.</span> <span class="mono">Planche ${state.planche.cols} × ${state.planche.rows} cases · ${atlasCourant.width} × ${atlasCourant.height} px</span>`; };
    requestAnimationFrame(() => { if ($('#lecture') && state.planche) $('#lecture').innerHTML = `<span class="muted">Survole une pièce pour lire son nom.</span> <span class="mono">Planche ${state.planche.cols} × ${state.planche.rows} cases · ${atlasCourant.width} × ${atlasCourant.height} px</span>`; });
  }
}

/* ——— E · Livrer à Godot ——— */
function vueLivrer() {
  const j = state.jeu, S = SORTES[j.sorte], nom = slug(j.nom), atlas = atlasDe(j);
  if (!state.verif) state.verif = verifier(j);
  const v = state.verif, octets = Math.round((atlas.toDataURL('image/png').length - 22) * 3 / 4);
  const poids = octets < 1024 ? octets + ' o' : (octets / 1024).toFixed(1).replace('.', ',') + ' Ko';
  const terrains = j.autreSol && S.lower ? `deux terrains, « ${esc(j.etat.surface.nom || 'Surface')} » par-dessus « ${esc(j.etat.bas.nom || 'Sol dessous')} »` : `un terrain, « ${esc(j.etat.surface.nom || j.nom)} »`;
  const fichiers = [
    [`${nom}.png`, poids, `La planche : ${atlas.width / j.taille} × ${atlas.height / j.taille} cases de ${j.taille} px, ${atlas.width} × ${atlas.height} px.`],
    [`${nom}.tres`, '', S.wall ? 'Le mur pour Godot : le dessus se peint comme un terrain ; la face, le pied et l’ombre sont rangés à part, et le pied bloque le passage.'
      : S.set ? `Les règles de pose pour Godot : ${terrains}. Quand tu peins, les ${nombrePieces(j)} pièces se choisissent toutes seules.` : 'Les 17 pièces rangées pour Godot, sans raccord automatique.'],
  ];
  if (j.carte) fichiers.push([`carte_exemple.tscn`, '', `Une carte d’exemple : celle que tu as peinte ici, ${j.carte.columns} × ${j.carte.rows} cases dont ${casesPosees(j.carte)} posées.`]);
  if (S.wall) fichiers.push(['LISEZMOI.txt', '', `Comment poser le mur à la main : la face se répète sur ${j.reglages.hauteur} case${j.reglages.hauteur > 1 ? 's' : ''} de haut, le pied juste en dessous, l’ombre au sol.`]);
  const verif = v.rien ? '<div class="bandeau bandeau-attention"><p>Ces pièces n’ont pas de raccord automatique : rien à vérifier.</p></div>'
    : v.defauts.length ? `<div class="bandeau bandeau-echec"><p>${v.defauts.length} défaut${v.defauts.length > 1 ? 's' : ''} : ils se verront dans le jeu. <button class="lien" data-action="voir-defauts">Voir lesquels</button></p></div>`
    : `<div class="bandeau bandeau-ok"><p>Vérifié : les ${v.pieces} pièces se raccordent.</p></div>`;
  const fait = state.livraison && state.livraison.jeu === j, livreAvant = fait ? state.livraison.avant : j.livre;
  return `<div class="fil"><button data-action="liste">Les tuiles</button><span>›</span><button data-action="retour-atelier">${esc(j.nom)}</button><span>›</span><span>Livrer à Godot</span></div>
    <div class="tu-tete"><div><h1>Livrer à Godot</h1><p>Relis ce qui part dans le projet du jeu. Rien n’est écrit tant que tu n’as pas déposé.</p></div></div>
    ${fait ? `<div class="bandeau bandeau-ok" style="max-width:1240px"><p>Déposé dans <span class="mono">res://tuiles/${nom}/</span> : ${fichiers.length} fichiers. Dans Godot, ouvre <span class="mono">carte_exemple.tscn</span> pour voir la carte.${j.demande ? ' L’agent Godot est prévenu : il peut s’en servir pour la carte du chapitre 2.' : ''}</p></div>` : ''}
    <div class="livrer">
      <section><h2>Ce qui part</h2>${fichiers.map(([f, p, d]) => `<div class="fichier"><span class="mono">${f}</span><span class="poids">${p}</span><p>${d}</p></div>`).join('')}
        <h2 style="margin-top:22px">La planche</h2><div class="planche-livree"><canvas id="planche-livree"></canvas></div></section>
      <section><h2>La vérification</h2>${verif}
        <h2 style="margin-top:22px">Où ça va</h2>
        <div class="destination"><strong>Le projet Godot lié · Les marais d’ambre</strong><span class="mono">res://tuiles/${nom}/</span>
          <span class="small">${livreAvant ? `Déjà livré ${esc(livreAvant)} : cette version remplace l’ancienne, qui reste dans l’historique des livraisons.` : 'Première livraison de ce jeu de tuiles.'}</span></div>
        <div class="deposer"><button data-action="retour-atelier">Revenir à l’atelier</button>${fait ? '' : '<button class="rust" data-action="deposer">Déposer dans le projet Godot</button>'}</div>
        <p class="simule" style="margin-top:8px">Dans la maquette, rien n’est écrit dans le projet : le dépôt est simulé.</p></section>
    </div>`;
}
function apresLivrer() {
  const c = $('#planche-livree'), a = atlasDe(state.jeu); if (!c) return;
  const k = Math.max(1, Math.min(3, Math.floor(560 / a.width)));
  c.width = a.width * k; c.height = a.height * k; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(a, 0, 0, c.width, c.height);
}

/* ——— Afficher ——— */
function afficher() {
  clearInterval(minuterieAnim);
  document.body.classList.toggle('plein', state.vue === 'atelier');
  sidebar.innerHTML = vueCarnet();
  if (state.vue === 'liste') { main.innerHTML = vueListe(); apresListe(); }
  else if (state.vue === 'sorte') { main.innerHTML = vueSorte(); apresSorte(); }
  else if (state.vue === 'atelier') { main.innerHTML = vueAtelier(); apresAtelier(); }
  else if (state.vue === 'livrer') { main.innerHTML = vueLivrer(); apresLivrer(); }
  $$('.sauts button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === state.saut)));
}
function ouvrirJeu(j, { tiroir = null } = {}) {
  state.jeu = j; state.vue = 'atelier'; state.onglet = j.carte ? 'carte' : 'planche'; state.tiroir = tiroir; state.survol = null; state.verif = null; state.zoomAuto = true;
  afficher();
}

/* ——— Les gestes ——— */
const ACTIONS = {
  saut: (b) => {
    state.saut = b.dataset.id; state.livraison = null;
    if (b.dataset.id === 'liste') { state.vue = 'liste'; afficher(); }
    else if (b.dataset.id === 'sorte') { state.vue = 'sorte'; afficher(); }
    else if (b.dataset.id === 'atelier') ouvrirJeu(HERBE);
    else if (b.dataset.id === 'tiroir') { state.texteOuvert = true; if (!HERBE.texte.pierre) { HERBE.texte.pierre = 'de l’herbe grasse de prairie'; HERBE.texte.motifs.surface = 'des touffes courtes et serrées, sans fleurs'; } ouvrirJeu(HERBE, { tiroir: { cible: 'surface', onglet: 'generer' } }); if (new URLSearchParams(location.search).has('genere')) { lancerGeneration(); $('#tiroir-corps').scrollTop = 1e6; } }
    else if (b.dataset.id === 'livrer') { state.jeu = HERBE; state.verif = null; state.vue = 'livrer'; afficher(); }
    else if (b.dataset.id === 'agent') ACTIONS.demande();
  },
  ailleurs: () => { location.href = '02-atelier.html'; },
  liste: () => { state.vue = 'liste'; state.tiroir = null; afficher(); },
  'atlas-existant': () => toast('Dans le produit, ce lien ouvre l’éditeur d’atlas : on y découpe une image de tuiles déjà faite.'),
  nouveau: () => { state.nouveau = { sorte: 'sol', taille: 32, nom: DEFAUTS_SORTE.sol.nom, nomTouche: false }; state.vue = 'sorte'; afficher(); },
  ouvrir: (b) => ouvrirJeu(JEUX.find((j) => j.id === b.dataset.id)),
  demande: () => {
    let j = DEMANDE.faite;
    if (!j) {
      j = nouveauJeu({ nom: DEMANDE.nom, sorte: 'sol', fond: 'eau', graine: 4242 });
      j.demande = true; j.texte.pierre = DEMANDE.pierre; j.texte.motifs.surface = DEMANDE.motif;
      DEMANDE.faite = j; JEUX.unshift(j);
    }
    state.saut = 'agent';
    ouvrirJeu(j, { tiroir: { cible: 'surface', onglet: 'generer' } });
  },
  'choisir-sorte': (b) => {
    const n = state.nouveau; n.sorte = b.dataset.sorte;
    if (!n.nomTouche) n.nom = DEFAUTS_SORTE[n.sorte].nom;
    $$('[data-action="choisir-sorte"]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.sorte === n.sorte)));
    $('#nouveau-nom').value = n.nom;
  },
  'taille-nouveau': (b) => { state.nouveau.taille = Number(b.dataset.taille); $$('[data-action="taille-nouveau"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('.aide-taille').textContent = state.nouveau.taille === 32 ? '32 px, la taille de ce jeu.' : 'Le reste du jeu est en 32 px : ces tuiles n’auront pas la même taille que tes personnages.'; },
  creer: () => {
    const n = state.nouveau, d = DEFAUTS_SORTE[n.sorte];
    const j = nouveauJeu({ nom: n.nom.trim() || d.nom, sorte: n.sorte, taille: n.taille, surface: d.surface, face: d.face, fond: d.fond, graine: (Math.random() * 90000 + 10000) | 0, reglages: n.sorte === 'mur' ? { hauteur: 2 } : {} });
    JEUX.push(j); ouvrirJeu(j);
    toast('Jeu de tuiles créé. Peins la carte, change les matières : tout se refait sur ta machine.');
  },
  enregistrer: () => toast(`« ${state.jeu.nom} » est enregistré dans le jeu. Dans la maquette, il disparaîtra au rechargement.`),
  livrer: () => { state.vue = 'livrer'; state.tiroir = null; state.livraison = null; state.verif = null; afficher(); },
  'retour-atelier': () => ouvrirJeu(state.jeu),
  deposer: () => { state.livraison = { jeu: state.jeu, avant: state.jeu.livre }; state.jeu.livre = 'aujourd’hui'; afficher(); toast('Déposé dans le projet Godot (simulé).'); },
  'voir-defauts': () => { state.onglet = 'verifier'; state.vue = 'atelier'; afficher(); },
  onglet: (b) => { state.onglet = b.dataset.onglet; state.surPiece = null; majCentre(); if (state.onglet === 'carte' && state.zoomAuto) { state.zoomAuto = false; zoomAjuste(); } dessinerCentre(); cadencer(); },
  ile: () => { const j = state.jeu; j.carte = ileAuHasard(j); dessinerSceneCourante(); },
  effacer: () => { const j = state.jeu; if (j.carte.kind === 'sommets') j.carte.v.forEach((l) => l.fill(false)); else j.carte.grid.forEach((l) => l.fill(false)); dessinerSceneCourante(); },
  heros: (b) => { state.heros = b.checked; dessinerSceneCourante(); },
  zoom: (b) => { state.zoom = Number(b.dataset.zoom); $$('[data-action="zoom"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); dessinerSceneCourante(); centrerVue(); },
  'autre-sol': (b) => {
    const j = state.jeu; j.autreSol = b.checked;
    if (j.autreSol && j.etat.bas.source === 'vide') poserMatiere(j.etat, 'bas', 'sable', j.taille, j.graine);
    majMatieres(); planifierRendu();
  },
  delier: (b) => { const j = state.jeu; relier(j.etat, b.dataset.id, false, j.taille, j.graine); majMatieres(); toast('Bordure déliée : choisis-lui sa propre matière.'); },
  relier: (b) => {
    const j = state.jeu, id = b.dataset.id, parent = PAR_ID[id].suit, p = j.etat[parent];
    relier(j.etat, id, true, j.taille, j.graine);
    if (p.source !== 'matiere' && p.image && contourDe.has(p.image)) j.etat[id] = { source: p.source, matiere: '', nom: p.nom, image: contourDe.get(p.image), lie: true, cle: '' };
    delete j.origine[id]; if (j.origine[parent]) j.origine[id] = j.origine[parent];
    majMatieres(); planifierRendu();
  },
  tiroir: (b) => {
    const cible = b.dataset.cible, t = state.tiroir;
    state.tiroir = { cible, onglet: t ? t.onglet : 'integrees' };
    majTiroir(); majMatieres();
  },
  'fermer-tiroir': () => { state.tiroir = null; majTiroir(); majMatieres(); },
  'onglet-tiroir': (b) => { state.tiroir.onglet = b.dataset.onglet; majTiroir(); },
  'poser-integree': (b) => poserIntegree(b.dataset.mat),
  'poser-biblio': (b) => poserBiblio(b.dataset.id),
  'poser-tirage': (b) => poserTirage(Number(b.dataset.i)),
  cadrage: (b) => { const j = state.jeu; j.texte.cadrages[cibleTexte(state.tiroir)] = b.dataset.cadrage; $$('[data-action="cadrage"]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); majTexteEnvoye(); },
  'voir-texte': (b) => { state.texteOuvert = !state.texteOuvert; $('#texte-envoye').hidden = !state.texteOuvert; b.textContent = state.texteOuvert ? 'Cacher le texte envoyé' : 'Voir le texte envoyé'; b.setAttribute('aria-expanded', String(state.texteOuvert)); majTexteEnvoye(); },
  generer: () => lancerGeneration(),
  graine: () => { const j = state.jeu; j.graine = (Math.random() * 90000 + 10000) | 0; $('#graine').value = j.graine; majMatieres(); planifierRendu(); },
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  if (b.matches('input[type=checkbox]')) return;
  if (b.dataset.action !== 'saut') state.saut = null;
  const f = ACTIONS[b.dataset.action]; if (f) f(b);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-action]')) { const f = ACTIONS[el.dataset.action]; if (f) f(el); return; }
  if (el.matches('select[data-reglage]')) { const j = state.jeu, v = el.value; j.reglages[el.dataset.reglage] = /^\d+$/.test(v) ? Number(v) : v; planifierRendu(); if (el.dataset.reglage === 'animation') cadencer(); return; }
  if (el.id === 'taille') { const j = state.jeu; j.taille = Number(el.value); state.zoomAuto = true; majMatieres(); zoomAjuste(); majCentre(); rendreMaintenant(); if (state.tiroir) majCorpsTiroir(); return; }
  if (el.id === 'fond') { if (el.value) { state.jeu.fond = { matiere: el.value }; majMatieres(); dessinerSceneCourante(); } return; }
  if (el.id === 'graine') { const j = state.jeu; j.graine = Math.max(1, Number(el.value) || 1); majMatieres(); planifierRendu(); return; }
  if (el.id === 'g-commune') { state.commune = el.checked; return; }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('input[type=range][data-reglage]')) {
    const j = state.jeu, cle = el.dataset.reglage; j.reglages[cle] = Number(el.value);
    const v = $(`[data-valeur="${cle}"]`); if (v) v.textContent = el.value + (cle === 'hauteur' ? ' cases' : '');
    if (cle === 'hauteur') dessinerSceneCourante(); else planifierRendu();
    return;
  }
  if (el.id === 'nom-jeu') { state.jeu.nom = el.value; $('#fil-nom').textContent = el.value || 'Sans nom'; return; }
  if (el.id === 'nouveau-nom') { state.nouveau.nom = el.value; state.nouveau.nomTouche = true; return; }
  if (el.id === 'g-pierre') { state.jeu.texte.pierre = el.value; majTexteEnvoye(); majBoutonGenerer(); return; }
  if (el.id === 'g-motif') { state.jeu.texte.motifs[cibleTexte(state.tiroir)] = el.value; majTexteEnvoye(); majBoutonGenerer(); return; }
  if (el.id === 'g-n') { state.nTirages = Math.max(1, Math.min(8, Number(el.value) || 1)); majBoutonGenerer(); }
});
let minuterieFenetre;
window.addEventListener('resize', () => { clearTimeout(minuterieFenetre); minuterieFenetre = setTimeout(() => { if (state.vue === 'atelier' && state.onglet === 'planche') dessinerPlanche(); }, 150); });

// Pour vérifier la maquette par script (javascript_tool) : l'état et le moteur, en lecture.
window.maquetteTuiles = { state, JEUX, atlasDe, verifier, nomPiece };
// ?etat=liste|sorte|atelier|tiroir|livrer|agent ouvre directement un état.
const etatDemande = new URLSearchParams(location.search).get('etat');
if (etatDemande && $(`.sauts [data-id="${etatDemande}"]`)) ACTIONS.saut($(`.sauts [data-id="${etatDemande}"]`)); else afficher();
