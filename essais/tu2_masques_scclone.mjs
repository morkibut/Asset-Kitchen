// TU2 — fige les tables de masques de sc-clone en JSON, pour que la table Python
// (atelier/domaine/masques_tuiles.py) se compare case par case à l'original.
//
// Lance :  node essais/tu2_masques_scclone.mjs [chemin de sc-clone] > tests/fixtures/tu2_masques_reference_scclone.json
// Par défaut, sc-clone est cherché à côté du dépôt (../sc-clone).
//
// Rien n'est recalculé ici : tout sort des modules de sc-clone eux-mêmes
// (public/tile-masks.js, public/vendor/tileset-engine.js, public/tile-materials.js).
// Seule exception, les cases vides du 17 pièces : le moteur n'exporte pas sa grille,
// on les lit donc sur un vrai rendu (case entièrement transparente = case vide).
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { execSync } from 'node:child_process'

const ici = dirname(fileURLToPath(import.meta.url))
const scclone = resolve(process.argv[2] ?? resolve(ici, '..', '..', 'sc-clone'))
const module_ = (chemin) => import(pathToFileURL(resolve(scclone, chemin)).href)

// Le moteur crée ses toiles par `document.createElement` ; ce double suffit, c'est celui
// de sc-clone/scripts/apercu-tileset.mjs.
globalThis.document = { createElement() { const c = { width: 0, height: 0, imageData: null }; c.getContext = () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: (i) => { c.imageData = i } }); return c } }

const masques = await module_('public/tile-masks.js')
const moteur = await module_('public/vendor/tileset-engine.js')
const matieres = await module_('public/tile-materials.js')

let commit = ''
try { commit = execSync('git rev-parse --short HEAD', { cwd: scclone }).toString().trim() } catch { commit = 'inconnu' }

function jeu(set) {
  const cases = []
  const { layout } = set
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.columns; col++) {
      const masque = masques.maskAtPosition(set, col, row)
      if (masque === null) continue
      cases.push({ x: col, y: row, masque, godot: masques.godotPeeringBits(set, masque, { terrain: 0 }) })
    }
  }
  return {
    colonnes: layout.columns,
    lignes: layout.rows,
    mode: set.godot.mode,
    bits: set.godot.peeringBits,
    cases,
    vides: layout.unusedCells.map(({ col, row }) => [col, row]),
  }
}

// Les cases vides du 17 pièces, lues sur un rendu.
const T = 16
const rendu17 = moteur.renderLogical({ tilesetType: 'topdown-17', tileSize: T, cornerRadius: 1, edgeStyle: 'rough', edgeRoughness: 1.5, edgeFrequency: 5, edgePadding: 2, baseColor: { r: 120, g: 160, b: 90 }, edgeColor: { r: 60, g: 80, b: 50 }, edgeFade: 1.5, shades: 4, textureNoise: 12, fleckAmount: 6, seed: 31415, relief: 0.4, whiteBackground: false, showGrid: false, pixelFlecks: true }).imageData
const vides17 = []
for (let row = 0; row < rendu17.height / T; row++) {
  for (let col = 0; col < rendu17.width / T; col++) {
    let opaque = false
    for (let y = 0; y < T && !opaque; y++) for (let x = 0; x < T && !opaque; x++) if (rendu17.data[((row * T + y) * rendu17.width + col * T + x) * 4 + 3]) opaque = true
    if (!opaque) vides17.push([col, row])
  }
}

const SORTES = { sol: 'blob-47', chemin: 'edge-16', mur: 'wall', 'coins-15': 'topdown-15', 'pieces-17': 'topdown-17' }
const DECORS = ['aucun', 'leger', 'dense']
const formes = []
const extras = []
for (const [sorte, type] of Object.entries(SORTES)) {
  for (const variantes of [0, 1, 3]) {
    for (const animation of [0, 2, 8]) {
      for (const animationAtlas of [0, 3]) {
        for (const decor of DECORS) {
          const forme = moteur.atlasShape(type, variantes, animation, animationAtlas, decor)
          formes.push({ sorte, variantes, animation, animationAtlas, decor, colonnes: forme.columns, lignes: forme.rows })
          const v = moteur.variantAtlasDescriptor(type, variantes)
          const a = animationAtlas ? null : moteur.animationAtlasDescriptor(type, animation, variantes)
          const c = moteur.atlasAnimationDescriptor(type, animationAtlas, variantes)
          const d = moteur.decorAtlasDescriptor(type, decor, variantes, animation, animationAtlas)
          extras.push({
            sorte, variantes, animation, animationAtlas, decor,
            variantes_cases: v ? v.variants.map(({ col, row, mask }) => ({ x: col, y: row, masque: mask })) : [],
            images: a ? a.frames.slice(1).map(({ col, row }) => [col, row]) : [],
            copies: c ? { nombre: c.count, lignes: c.copyRows } : null,
            decor_cases: d ? d.cells.map(({ col, row, orientation, variant }) => ({ x: col, y: row, orientation, variante: variant })) : [],
          })
        }
      }
    }
  }
}

const mur = {}
for (const decor of DECORS) {
  const d = moteur.wallAtlasDescriptor({ decor })
  mur[decor] = {
    colonnes: d.columns,
    lignes: d.rows,
    cases: d.cells.map((c) => ({ x: c.col, y: c.row, bande: c.band, etat: c.state ?? null, sens: c.sens ?? null, piece: c.piece ?? null, posable: c.placeable })),
  }
}

const sortie = {
  provenance: { depot: 'sc-clone', commit, script: 'essais/tu2_masques_scclone.mjs' },
  matieres: matieres.LISTE_MATIERES.map(({ id, nom, role }) => ({ id, nom, role })),
  jeux: { W16: jeu(masques.W16), B47: jeu(masques.B47), E16: jeu(masques.E16) },
  dispositions: Object.fromEntries(Object.entries(moteur.TILESET_LAYOUTS).map(([k, v]) => [k, { colonnes: v.columns, lignes: v.rows, jeu: v.maskSet }])),
  blob_dessous: { x: moteur.BLOB_LOWER_CELL.col, y: moteur.BLOB_LOWER_CELL.row },
  pieces17_vides: vides17,
  mur,
  formes,
  extras,
}
process.stdout.write(JSON.stringify(sortie) + '\n')
