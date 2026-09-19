// TU8 — fige ce que le moteur pose pour le décor (les gravats des bords, T27), pour que
// la livraison Python (`atelier/domaine/pose_decor.py`, `atelier/domaine/pose_mur.decor`)
// s'y compare, pose pour pose (tests/test_tu8_decor.py).
//
// Lance :  node essais/tu8_reference_decor.mjs > tests/fixtures/tu8_reference_decor.json
// Rien n'est modifié : le moteur recopié est lu, jamais écrit.
//
// Trois familles, rien de recalculé ici que le moteur ne rende déjà :
//  - `generique` : `emplacementsDecor` (interface/src/tuiles/moteur/tile-scene.js, TU1)
//    appelé directement sur des grilles d'occupation quelconques — la preuve la plus large
//    du tirage (présence, orientation, variante) et de l'appariement extérieure/intérieure ;
//  - `sol_chemin` : la même fonction, sur l'occupation réelle d'une île (`generateIsland`
//    de tile-check.js, la copie de TU1) pour B47, E16 et W16 — ce qu'un sol, un chemin ou
//    un jeu 15 pièces fabriqué pose vraiment, avec la case d'atlas de `caseDecor` ;
//  - `mur` : la même fonction, sur l'occupation d'un mur (`occupationMur`), les pentes de
//    `jonctionsDiagonales`/`caseMurPente` exclues comme dans `dessinerScene` — la
//    composition la plus retorse, portée telle quelle plutôt que réinventée.
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const ici = dirname(fileURLToPath(import.meta.url))
const deMoteur = (chemin) => import(pathToFileURL(resolve(ici, '..', 'interface', 'src', 'tuiles', 'moteur', chemin)).href)

const scene = await deMoteur('tile-scene.js')
const moteur = await deMoteur('vendor/tileset-engine.js')
const verif = await deMoteur('tile-check.js')
const { emplacementsDecor, caseDecor, occupationMur, jonctionsDiagonales, caseMurPente } = scene
const { decorAtlasDescriptor } = moteur
const { mulberry32, generateIsland } = verif

// ── 1. Générique : `emplacementsDecor` sur des grilles d'occupation quelconques ─────────
const versGrille = (bool2d) => (x, y) => y >= 0 && y < bool2d.length && x >= 0 && x < bool2d[y].length && bool2d[y][x]

function grilleAuHasard(colonnes, lignes, densite, graine) {
  const r = mulberry32(graine)
  return Array.from({ length: lignes }, () => Array.from({ length: colonnes }, () => r() < densite))
}

const generique = []
let g = 1
for (const [colonnes, lignes, remplissage] of [[10, 8, 0.3], [16, 12, 0.5], [6, 6, 0.15], [20, 5, 0.7]]) {
  for (const densite of ['aucun', 'leger', 'dense']) {
    for (const graine of [0, 1, 12345, 999999]) {
      const grille = grilleAuHasard(colonnes, lignes, remplissage, 4000 + g)
      g += 1
      const occupe = versGrille(grille)
      const pieces = emplacementsDecor(occupe, { colonnes, lignes, densite, graine })
      generique.push({
        colonnes, lignes, densite, graine,
        occupe: grille.flatMap((ligne, y) => ligne.flatMap((v, x) => (v ? [[x, y]] : []))),
        pieces: pieces.map((p) => [p.x, p.y, p.orientation, p.variant, p.moitie]),
      })
    }
  }
}

// ── 2. Sol, chemin, 15 pièces : l'occupation d'une île, la case d'atlas réelle ──────────
// `generateIsland` ne connaît que B47 et E16 (tile-check.js) : le 15 pièces n'a pas de
// blob à raccorder, une grille au hasard suffit à exercer son occupation (l'algorithme du
// décor ne lit que « peint ou non », jamais le masque).
const sol_chemin = []
for (const [jeu, type] of [['B47', 'blob-47'], ['E16', 'edge-16'], ['W16', 'topdown-15']]) {
  for (const graineIle of [31415, 2718, 90210]) {
    const { grid, columns, rows } = jeu === 'W16' ? { grid: grilleAuHasard(22, 14, 0.4, graineIle), columns: 22, rows: 14 } : generateIsland(jeu, graineIle)
    const occupe = (x, y) => y >= 0 && y < rows && x >= 0 && x < columns && grid[y][x]
    for (const densite of ['leger', 'dense']) {
      for (const graineDecor of [0, 7]) {
        const descripteur = decorAtlasDescriptor(type, densite)
        const pieces = emplacementsDecor(occupe, {
          colonnes: columns, lignes: rows, densite, graine: graineDecor,
          variantes: descripteur.variants, orientations: descripteur.orientations,
        })
        sol_chemin.push({
          jeu, graineIle, densite, graineDecor, colonnes: columns, lignes: rows,
          occupe: grid.flatMap((ligne, y) => ligne.flatMap((v, x) => (v ? [[x, y]] : []))),
          pieces: pieces.map((p) => {
            const c = caseDecor(descripteur, p.orientation, p.variant)
            return [p.x, p.y, p.orientation, p.variant, c.col, c.row]
          }),
        })
      }
    }
  }
}

// ── 3. Le mur : occupation par colonne, pentes exclues comme dans dessinerScene ─────────
const depuis = (lignes) => lignes.map((l) => [...l].map((c) => c === '#'))
const cartesMur = {
  escalier: (() => {
    const c = Array.from({ length: 12 }, () => Array(16).fill(false))
    for (let k = 0; k < 5; k += 1) c[3 + k][2 + k] = true
    for (let x = 8; x <= 12; x += 1) c[8][x] = true
    for (let x = 3; x <= 7; x += 1) c[9][x] = true
    return c
  })(),
  'trou-en-v': depuis(['...#..', '...#..', '#..#..', '.#.#..', '..#...', '...###', '......']),
  'double-pente': depuis(['.......', '.#.#...', '..#....', '.......']),
  'cas-limites': depuis(['........', '.#..###.', '....#...', '.#..#...', '.#......', '........']),
}
for (let gr = 1; gr <= 4; gr += 1) {
  const r = mulberry32(8000 + gr), c = 18, l = 12, grille = Array.from({ length: l }, () => Array(c).fill(false))
  for (let y = 0; y < l; y += 1) for (let x = 0; x < c; x += 1) grille[y][x] = r() < 0.32
  cartesMur[`hasard-${gr}`] = grille
}

const D = scene.descripteurScene(moteur.wallAtlasDescriptor, moteur.WALL_BAND_STATES)

function decorDuMur(grille, hauteur, densite, graine) {
  const colonnes = grille[0].length, lignes = grille.length
  const jonctions = jonctionsDiagonales(grille)
  const pentes = new Set(jonctions.map((j) => caseMurPente(D, j, hauteur)).filter(Boolean).map((p) => `${p.dx},${p.dy}`))
  const occMur = occupationMur(grille, hauteur)
  const occupe = (x, y) => occMur(x, y) || pentes.has(`${x},${y}`)
  const descripteur = decorAtlasDescriptor('wall', densite)
  const pieces = emplacementsDecor(occupe, {
    colonnes, lignes, densite, graine, variantes: descripteur.variants, orientations: descripteur.orientations,
  }).filter((p) => !pentes.has(`${p.x},${p.y}`))
  return pieces.map((p) => {
    const c = caseDecor(descripteur, p.orientation, p.variant)
    return [p.x, p.y, p.orientation, p.variant, c.col, c.row]
  })
}

const mur = []
for (const [nom, grille] of Object.entries(cartesMur)) {
  for (const hauteur of nom.startsWith('hasard-') ? [1 + (Number(nom.slice(7)) * 3) % 8] : [1, 2, 3, 5]) {
    for (const densite of ['leger', 'dense']) {
      for (const graine of [0, 31415]) {
        const emprise = []
        grille.forEach((ligne, y) => ligne.forEach((plein, x) => { if (plein) emprise.push([x, y]) }))
        mur.push({
          nom, hauteur, densite, graine, colonnes: grille[0].length, lignes: grille.length, emprise,
          pieces: decorDuMur(grille, hauteur, densite, graine),
        })
      }
    }
  }
}

const sortie = {
  provenance: { script: 'essais/tu8_reference_decor.mjs', moteur: 'interface/src/tuiles/moteur' },
  generique, sol_chemin, mur,
}
process.stdout.write(JSON.stringify(sortie) + '\n')
