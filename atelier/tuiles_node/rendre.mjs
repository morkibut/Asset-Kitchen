// TU10 — le rendu d'un jeu de tuiles fabriqué, côté serveur, par LE MÊME CODE que l'écran.
//
// `docs/PLAN-tuiles.md`, décision 3 et § TU10. Le serveur Python lance ce script en
// sous-processus (`atelier/services/rendu_tuiles.py`) : une commande JSON sur l'entrée,
// une réponse JSON sur la sortie. Rien n'est recopié ni réécrit ici : ce script importe
// `interface/src/tuiles/atelier.ts` — le fichier même où l'écran transforme une recette
// en réglages du moteur, rend la planche et la vérifie — et `interface/src/tuiles/png.ts`,
// l'encodeur par lequel l'écran écrit l'atlas qu'il envoie. Node exécute le TypeScript
// en effaçant les types (Node 22.18+ sans option, 22.6+ avec `--experimental-strip-types`) ;
// le seul ajout est un crochet de résolution, parce que l'écran importe sans extension
// (`"./moteur/vendor/tileset-engine"`, résolu par Vite) et que Node en exige une.
//
// Ce qui diffère du navigateur, et seulement ça :
//  - le canevas : le moteur fait `document.createElement("canvas")`, `createImageData`,
//    `putImageData` et rien d'autre (voir moteur/__tests__/canvas-shim.ts) ; on pose le
//    même bouchon que les essais de sc-clone et que `essais/tu7_reference_mur.mjs`.
//    `rendre()` d'atelier.ts lit alors les pixels sur `canvas.imageData`, là où le
//    navigateur les prend au vol dans `putImageData` : c'est le même tableau.
//  - les images des matières « asset » : le navigateur les décode (Image → canevas →
//    getImageData) ; ici elles arrivent déjà décodées en RGBA par le serveur (Pillow).
//
// Entrée (stdin, JSON) :
//   { "recette": {...},                       // la recette VÉRIFIÉE par le serveur
//     "images": { "<asset>": { "largeur", "hauteur", "rgba": base64 } },
//     "palette_univers": ["#rrggbb", ...],     // la palette du projet (TU6)
//     "rendre": true,                          // rendre l'atlas (PNG + vérification)
//     "atlas": { "largeur", "hauteur", "rgba" } // sinon : vérifier cet atlas-là
//     "carte": null | { "peinte": ["..##..", ...] } // la carte à rendre en pièces posées
//   }
// Sortie (stdout, JSON) :
//   { "png": base64, "largeur", "hauteur", "empreinte": sha256 des pixels RGBA,
//     "verification": { "verifiable", "pieces", "defauts": [{ "brut", "en_clair" }] },
//     "carte": { largeur, hauteur, cases } | null, "duree_ms" }
// Une erreur : { "erreur": "…" } et un code de sortie 1.
import { registerHooks } from 'node:module'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const ext of ['.ts', '.js']) {
        try { return nextResolve(specifier + ext, context) } catch { /* suivante */ }
      }
    }
    return nextResolve(specifier, context)
  },
})

// Le bouchon de canevas : exactement ce que le moteur appelle (TU1, canvas-shim.ts).
globalThis.document = {
  createElement() {
    const c = { width: 0, height: 0, imageData: null }
    c.getContext = () => ({
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (i) => { c.imageData = i },
    })
    return c
  },
}

const ici = dirname(fileURLToPath(import.meta.url))
const tuiles = resolve(ici, '..', '..', 'interface', 'src', 'tuiles')
const atelier = await import(pathToFileURL(resolve(tuiles, 'atelier.ts')).href)
const { encoderPng } = await import(pathToFileURL(resolve(tuiles, 'png.ts')).href)

const decoder = (im) => ({ width: im.largeur, height: im.hauteur, data: new Uint8ClampedArray(Buffer.from(im.rgba, 'base64')) })
const empreinte = (data) => createHash('sha256').update(data).digest('hex')

function carteDepuis(j, peinte) {
  const lignes = peinte.map((l) => [...l].map((c) => c !== '.' && c !== ' '))
  const largeur = Math.max(0, ...lignes.map((l) => l.length))
  const grille = lignes.map((l) => Array.from({ length: largeur }, (_, x) => !!l[x]))
  // Les 15 pièces se peignent par sommets (le bord passe au milieu des cases).
  if (j.sorte === 'coins-15') return { kind: 'sommets', columns: largeur - 1, rows: grille.length - 1, v: grille }
  return { kind: 'cases', columns: largeur, rows: grille.length, grid: grille }
}

function verification(j, pixels) {
  const v = atelier.verifier(j, { pixels })
  if (v.rien) return { verifiable: false, pieces: atelier.nombrePieces(j.sorte), defauts: [] }
  return { verifiable: true, pieces: v.pieces, defauts: v.defauts.map((p) => ({ brut: p, en_clair: atelier.enClair(p) })) }
}

async function traiter(commande) {
  const t0 = performance.now()
  const images = new Map(Object.entries(commande.images ?? {}).map(([id, im]) => [id, decoder(im)]))
  const j = atelier.jeuDepuisRecette({ identifiant: null, revision: null, nom: '', recette: commande.recette, carte: null }, images)
  const manquantes = Object.values(commande.recette.emplacements ?? {}).filter((e) => e.source === 'asset' && !images.has(e.asset))
  // Pour rendre, il faut les pixels de chaque matière ; pour une carte ou un contrôle,
  // seules la sorte et les réglages comptent.
  if (commande.rendre && manquantes.length) throw new Error(`image de matière non fournie : ${manquantes.map((e) => e.asset).join(', ')}`)
  // La palette de l'univers (TU6, « la palette du jeu ») : l'écran la pose sur le jeu
  // édité (`paletteUnivers`) ; ici elle vient du projet, par le serveur.
  if (Array.isArray(commande.palette_univers)) j.paletteUnivers = commande.palette_univers
  const sortie = {}
  if (commande.rendre) {
    atelier.oublierLesRendus()
    const { pixels } = atelier.atlasDe(j)
    sortie.png = Buffer.from(await encoderPng(pixels)).toString('base64')
    sortie.largeur = pixels.width
    sortie.hauteur = pixels.height
    sortie.empreinte = empreinte(pixels.data)
    sortie.verification = verification(j, pixels)
  } else if (commande.atlas) {
    const pixels = decoder(commande.atlas)
    sortie.empreinte = empreinte(pixels.data)
    sortie.verification = verification(j, pixels)
  }
  if (commande.carte !== undefined) {
    if (commande.carte && Array.isArray(commande.carte.peinte)) j.carte = carteDepuis(j, commande.carte.peinte)
    sortie.carte = j.carte ? atelier.versCarteServeur(j) : null
  }
  sortie.duree_ms = Math.round(performance.now() - t0)
  return sortie
}

try {
  const commande = JSON.parse(readFileSync(0, 'utf8'))
  process.stdout.write(JSON.stringify(await traiter(commande)))
} catch (e) {
  process.stdout.write(JSON.stringify({ erreur: e instanceof Error ? e.message : String(e) }))
  process.exitCode = 1
}
