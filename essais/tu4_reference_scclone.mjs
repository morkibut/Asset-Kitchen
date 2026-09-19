// TU4 — fige ce que sc-clone écrit, pour que la livraison Python d'un jeu fabriqué s'y
// compare (tests/test_tu4_livraison.py).
//
// Lance :  node essais/tu4_reference_scclone.mjs [chemin de sc-clone] > tests/fixtures/tu4_reference_scclone.json
// Par défaut, sc-clone est cherché à côté du dépôt (../sc-clone).
//
// Deux moitiés, rien de recalculé ici :
//  - `tres` : le .tres que `public/exports.js` de sc-clone écrit pour quelques recettes,
//    avec les options exactement comme `exportTiles` (public/tools.js) les compose ;
//  - `cartes` : les îles que le moteur de l'atelier (interface/src/tuiles/moteur, la
//    copie de TU1) peint et les pièces qu'il y pose — `generateIsland` garantit que tous
//    les masques du jeu y figurent. C'est la carte que Godot doit retrouver par
//    set_cells_terrain_connect.
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'

const ici = dirname(fileURLToPath(import.meta.url))
const scclone = resolve(process.argv[2] ?? resolve(ici, '..', '..', 'sc-clone'))
const deSc = (chemin) => import(pathToFileURL(resolve(scclone, chemin)).href)
const deMoteur = (chemin) => import(pathToFileURL(resolve(ici, '..', 'interface', 'src', 'tuiles', 'moteur', chemin)).href)

// Le moteur crée ses toiles par `document.createElement` ; ce double suffit (celui de
// sc-clone/scripts/apercu-tileset.mjs).
globalThis.document = { createElement() { const c = { width: 0, height: 0, imageData: null }; c.getContext = () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: (i) => { c.imageData = i } }); return c } }

const { godotTileset } = await deSc('public/exports.js')
const sc = await deSc('public/vendor/tileset-engine.js')
const verif = await deMoteur('tile-check.js')
const masques = await deMoteur('tile-masks.js')
const moteur = await deMoteur('vendor/tileset-engine.js')

let commit = ''
try { commit = execSync('git rev-parse --short HEAD', { cwd: scclone }).toString().trim() } catch { commit = 'inconnu' }

// Couleur d'un terrain côté Godot : rgbToGodotColor de public/tools.js.
const couleur = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1)
const HERBE = { name: 'Herbe', color: couleur('#92af70') }  // couleurSurface par défaut
const SABLE = { name: 'Sable', color: couleur('#d6b476') }  // couleurDessous par défaut

// Les options d'animation telles qu'exportTiles les compose (public/tools.js, l. 1121-1133).
const animationPleine = (type, images, variantes = 0) => {
  const d = sc.animationAtlasDescriptor(type, images, variantes)
  return { [d.mask]: { frames: Array.from({ length: d.count }, () => d.frameDurationMs / 1000), columns: d.animationColumns, separation: d.separation } }
}
const animationAtlas = (type, copies, variantes) => {
  const d = sc.atlasAnimationDescriptor(type, copies, variantes)
  return { frames: d.frames, columns: d.animationColumns, separation: d.separation, rows: d.rows }
}

const tres = {
  'sol-simple': godotTileset(32, { set: 'B47', filename: 'atlas.png', terrains: [HERBE] }),
  'sol-deux-terrains-anime': godotTileset(16, {
    set: 'B47', filename: 'atlas.png', terrains: [SABLE, HERBE], paintedTerrain: 1, unpaintedTerrain: 0,
    atlasAnimation: animationAtlas('blob-47', 3, 2), variants: sc.variantAtlasDescriptor('blob-47', 2),
    decor: sc.decorAtlasDescriptor('blob-47', 'leger', 2, 0, 3),
  }),
  'chemin-anime': godotTileset(16, { set: 'E16', filename: 'atlas.png', terrains: [HERBE], animations: animationPleine('edge-16', 4) }),
  'coins-15-variantes': godotTileset(16, { set: 'W16', filename: 'atlas.png', terrains: [HERBE], variants: sc.variantAtlasDescriptor('topdown-15', 1) }),
  'pieces-17': godotTileset(16, { filename: 'atlas.png', columns: 5, rows: 5 }),
  // exportTiles appelle animationAtlasDescriptor SANS les variantes (tools.js l. 1121) :
  // avec variantes ET animation de la pièce pleine, la séparation écrite ne suit plus le
  // rendu. On garde ici ce que l'outil écrit vraiment, pour nommer l'écart.
  'sol-variantes-et-animation': godotTileset(16, {
    set: 'B47', filename: 'atlas.png', terrains: [HERBE], animations: animationPleine('blob-47', 4),
    variants: sc.variantAtlasDescriptor('blob-47', 2),
  }),
}

function carte(jeu, graine) {
  const { grid, columns, rows } = verif.generateIsland(jeu, graine)
  const surface = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!grid[y][x]) continue
      const p = masques.atlasPosition(jeu, verif.cellMaskAt(jeu, grid, x, y))
      surface.push([x, y, p.col, p.row])
    }
  }
  const couverture = verif.islandCoverage(jeu, grid)
  return { largeur: columns, hauteur: rows, surface, masques: couverture.count, total: couverture.total }
}

const sortie = {
  provenance: { depot: 'sc-clone', commit, script: 'essais/tu4_reference_scclone.mjs', moteur: 'interface/src/tuiles/moteur' },
  tres,
  cartes: { B47: carte('B47', 31415), E16: carte('E16', 31415) },
  blob_dessous: [moteur.BLOB_LOWER_CELL.col, moteur.BLOB_LOWER_CELL.row],
}
process.stdout.write(JSON.stringify(sortie) + '\n')
