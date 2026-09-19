// TU7 — fige ce que sc-clone écrit pour un mur, et ce que la scène du moteur pose, pour
// que la livraison Python d'un mur s'y compare (tests/test_tu7_mur.py).
//
// Lance :  node essais/tu7_reference_mur.mjs [chemin de sc-clone] > tests/fixtures/tu7_reference_mur.json
// Par défaut, sc-clone est cherché à côté du dépôt (../sc-clone). Rien n'est modifié :
// sc-clone et le moteur recopié sont lus, jamais écrits.
//
// Deux moitiés, rien de recalculé ici :
//  - `tres` : le .tres que `godotWallTileset` (sc-clone, public/exports.js) écrit pour un
//    mur, avec le descripteur de `wallAtlasDescriptor` comme `exportTiles` le compose ;
//  - `scenes` : chaque tuile que `dessinerScene` (interface/src/tuiles/moteur/tile-scene.js,
//    la copie de TU1) peint pour un mur, DANS L'ORDRE où il la peint. Un peintre qui
//    enregistre au lieu de peindre : c'est la scène elle-même qui parle, pas une
//    réécriture de ses boucles.
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'

const ici = dirname(fileURLToPath(import.meta.url))
const scclone = resolve(process.argv[2] ?? resolve(ici, '..', '..', 'sc-clone'))
const deSc = (chemin) => import(pathToFileURL(resolve(scclone, chemin)).href)
const deMoteur = (chemin) => import(pathToFileURL(resolve(ici, '..', 'interface', 'src', 'tuiles', 'moteur', chemin)).href)

globalThis.document = { createElement() { const c = { width: 0, height: 0, imageData: null }; c.getContext = () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: (i) => { c.imageData = i } }); return c } }

const { godotWallTileset } = await deSc('public/exports.js')
const sc = await deSc('public/vendor/tileset-engine.js')
const moteur = await deMoteur('vendor/tileset-engine.js')
const scene = await deMoteur('tile-scene.js')
const { mulberry32 } = await deMoteur('tile-check.js')

let commit = ''
try { commit = execSync('git rev-parse --short HEAD', { cwd: scclone }).toString().trim() } catch { commit = 'inconnu' }

const couleur = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1)
const PIERRE = { name: 'Dalles de pierre', color: couleur('#92af70') }  // couleurSurface par défaut

const tres = {}
for (const [nom, taille, decor] of [['mur-16', 16, 'aucun'], ['mur-32-decor-leger', 32, 'leger'], ['mur-64', 64, 'aucun']]) {
  const descriptor = sc.wallAtlasDescriptor({ wallHeightTiles: 3, decor })
  tres[nom] = godotWallTileset(taille, { descriptor, filename: 'atlas.png', terrains: [PIERRE] })
}

// ── Les cartes ───────────────────────────────────────────────────────────────
const depuis = (lignes) => lignes.map((l) => [...l].map((c) => c === '#'))
const vide = (c, r) => Array.from({ length: r }, () => Array(c).fill(false))

// L'escalier de cinq marches et les deux courses décrochées de sc-clone
// (scripts/preuve-map-godot.mjs) : la carte où la jonction en diagonale se voit.
const escalier = vide(16, 12)
for (let k = 0; k < 5; k += 1) escalier[3 + k][2 + k] = true
for (let x = 8; x <= 12; x += 1) escalier[8][x] = true
for (let x = 3; x <= 7; x += 1) escalier[9][x] = true

// La pièce par défaut de l'atelier (interface/src/tuiles/atelier.ts, carteDefaut('mur')),
// après la marge que l'écran ajoute au-dessus pour la hauteur du mur.
const piece = vide(18, 12)
for (let x = 3; x <= 14; x += 1) { piece[4][x] = true; if (x !== 8 && x !== 9) piece[10][x] = true }
for (let y = 4; y <= 10; y += 1) { piece[y][3] = true; piece[y][14] = true }

const cartes = {
  escalier,
  piece,
  // Trou en V (tile-scene.test.ts) : un mur vertical qui touche une marche en diagonale.
  'trou-en-v': depuis(['...#..', '...#..', '#..#..', '.#.#..', '..#...', '...###', '......']),
  // Un V dont la case basse reçoit les deux jonctions, et deux pentes sur la MÊME case.
  'double-pente': depuis(['.......', '.#.#...', '..#....', '.......']),
  'v-large': depuis(['......', '.#...#', '..#.#.', '...#..', '......']),
  // Des cases seules, un pilier, une course : les cas limites de placerMur.
  'cas-limites': depuis(['........', '.#..###.', '....#...', '.#..#...', '.#......', '........']),
}
// Des cartes au hasard, graine fixe : aucune règle n'y est choisie à la main.
for (let g = 1; g <= 8; g += 1) {
  const r = mulberry32(7000 + g), c = 14, l = 11, grille = vide(c, l)
  for (let y = 0; y < l; y += 1) for (let x = 0; x < c; x += 1) grille[y][x] = r() < 0.38
  cartes[`hasard-${g}`] = grille
}

const hauteurs = (nom) => nom.startsWith('hasard-') ? [1 + (Number(nom.slice(7)) * 3) % 8] : [1, 2, 3, 5, 8]

// Le descripteur de la scène, tel que l'atelier le construit (atelier.ts, DESC_MUR).
const D = scene.descripteurScene(moteur.wallAtlasDescriptor, moteur.WALL_BAND_STATES)
const TUILE = 16

const scenes = []
for (const [nom, grille] of Object.entries(cartes)) {
  for (const hauteur of hauteurs(nom)) {
    const poses = []
    const peintre = {
      fond() {}, fondMotif() {}, rect() {}, ellipse() {},
      tuile(sx, sy, t, dx, dy) { poses.push([dx / TUILE, dy / TUILE, sx / TUILE, sy / TUILE]) },
    }
    scene.dessinerScene(peintre, {
      tile: TUILE, colonnes: grille[0].length, lignes: grille.length, set: null, masqueDe: () => null,
      mur: { hauteur, grille, descripteur: D }, sol: { couleur: '#000000' },
    })
    const emprise = []
    grille.forEach((ligne, y) => ligne.forEach((plein, x) => { if (plein) emprise.push([x, y]) }))
    scenes.push({ nom, hauteur, colonnes: grille[0].length, lignes: grille.length, emprise, poses })
  }
}

const sortie = {
  provenance: { depot: 'sc-clone', commit, script: 'essais/tu7_reference_mur.mjs', moteur: 'interface/src/tuiles/moteur' },
  descripteur: { faceRow: D.faceRow, baseRow: D.baseRow, shadowRow: D.shadowRow, etats: D.etats, biais: D.biais },
  tres,
  scenes,
}
process.stdout.write(JSON.stringify(sortie) + '\n')
