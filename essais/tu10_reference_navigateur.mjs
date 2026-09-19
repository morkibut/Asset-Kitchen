// TU10 — ce que rend un VRAI navigateur, à partir des gestes de l'écran, pour que le rendu
// serveur (atelier/tuiles_node/rendre.mjs, lancé par Node) s'y compare au pixel près.
// `tests/test_tu10_agent.py` le lance et compare ; on peut aussi le lancer à la main :
//
//   node essais/tu10_reference_navigateur.mjs > sortie.json
//
// Ce qui se passe, et pourquoi ce n'est pas une tautologie :
//  - un serveur Vite (celui de l'interface, sans ses greffons d'écran) sert
//    `interface/src/tuiles/atelier.ts` et `png.ts` au navigateur, transformés comme en
//    développement ;
//  - Edge (ou le Chromium de Playwright) sans écran charge ces modules et refait, pour
//    chaque cas, les gestes de l'écran : `nouveauJeu`, `poserIntegree`, `poserAsset`,
//    `changerSecondTerrain`, les réglages posés sur le jeu édité — pas une recette
//    fabriquée à la main ;
//  - les matières « asset » y sont écrites en PNG puis DÉCODÉES PAR LE NAVIGATEUR
//    (Image → canevas → getImageData), comme `lireLesPixels` de
//    `interface/src/composants/AtelierTuiles.tsx` ; le serveur, lui, les relira par
//    Pillow depuis la bibliothèque ;
//  - l'atlas est pris comme l'écran le prend pour l'envoyer (`atlasDe(j).pixels`, capturé
//    dans le vrai `putImageData` du navigateur) et encodé par `encoderPng` avec le vrai
//    `CompressionStream` du navigateur ;
//  - sortent : la recette que l'écran enverrait (`recetteDe`), les PNG des matières, et
//    pour chaque cas l'empreinte SHA-256 des pixels RGBA, celle du PNG, la carte par
//    défaut en pièces posées et le résultat du contrôle (`verifier`).
// Le serveur refait le chemin inverse — recette complétée par le serveur, matières lues en
// bibliothèque, rendu sous Node — et doit retomber sur les mêmes empreintes.
import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ici = dirname(fileURLToPath(import.meta.url))
const interfaceDir = resolve(ici, '..', 'interface')
const { createServer } = await import(pathToFileURL(resolve(interfaceDir, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
const { chromium } = await import(pathToFileURL(resolve(interfaceDir, 'node_modules', 'playwright-core', 'index.mjs')).href)

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

// ── Ce qui tourne DANS le navigateur ─────────────────────────────────────────
async function capturer() {
  const A = await import('/src/tuiles/atelier.ts')
  const { encoderPng, enBase64 } = await import('/src/tuiles/png.ts')
  const sha = async (octets) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', octets))].map((b) => b.toString(16).padStart(2, '0')).join('')

  // Trois matières « de la bibliothèque », opaques comme ce que ComfyUI rend, de tailles
  // qui ne sont pas celles des pièces (le moteur les ramène à la taille de pièce).
  const matieres = {}
  for (const [id, l, h, graine, teinte] of [['mat-a', 64, 64, 11, [96, 150, 70]], ['mat-b', 48, 48, 23, [150, 120, 90]], ['mat-c', 100, 100, 37, [180, 170, 150]]]) {
    const data = new Uint8ClampedArray(l * h * 4)
    let s = graine >>> 0
    for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      const bruit = (s >>> 24) - 128, dalle = ((x >> 4) + (y >> 4)) % 2 ? 18 : -12, i = (y * l + x) * 4
      data[i] = teinte[0] + dalle + (bruit >> 2); data[i + 1] = teinte[1] + dalle + (bruit >> 3); data[i + 2] = teinte[2] + (bruit >> 2); data[i + 3] = 255
    }
    const png = await encoderPng({ width: l, height: h, data })
    // Décodée comme l'écran décode une image de la bibliothèque (`lireLesPixels`).
    const image = new Image()
    image.src = URL.createObjectURL(new Blob([png], { type: 'image/png' }))
    await image.decode()
    const c = document.createElement('canvas')
    c.width = image.naturalWidth
    c.height = image.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(image, 0, 0)
    matieres[id] = { png: enBase64(png), pixels: ctx.getImageData(0, 0, c.width, c.height) }
  }
  const poser = (j, cible, id) => A.poserAsset(j, cible, id, id, matieres[id].pixels)
  const regler = (reglages) => (j) => Object.assign(j.reglages, reglages)
  const tu6 = 'memesCouleurs' in A.reglagesParDefaut('sol')

  const cas = [
    ['sol-32', 'sol', 32, 7, null],
    ['sol-16-second-terrain-variantes', 'sol', 16, 101, (j) => { A.changerSecondTerrain(j, true); j.reglages.variantes = 2 }],
    ['sol-64-animation-decor', 'sol', 64, 55, regler({ animation: 4, decor: 'leger' })],
    ['sol-32-animation-atlas-prairie', 'sol', 32, 9, (j) => { A.poserIntegree(j, 'surface', 'prairie'); j.reglages.animationAtlas = 3 }],
    ['sol-32-nettes-couleurs-fond-blanc', 'sol', 32, 4, regler({ bordures: 'nettes', arrondi: 0, irregularite: 10, nuances: 8, relief: 10, reduction: 'compensee', couleurSurface: '#aa3355', couleurContour: '#221133', fondBlanc: true })],
    ['chemin-32', 'chemin', 32, 3, null],
    ['chemin-16-decor-dense-roche', 'chemin', 16, 77, (j) => { A.poserIntegree(j, 'surface', 'roche'); A.delier(j, 'bordure'); A.poserIntegree(j, 'bordure', 'terre'); j.reglages.decor = 'dense' }],
    ['mur-32-h1', 'mur', 32, 5, regler({ hauteurMur: 1 })],
    ['mur-16-h3-decor-ombre', 'mur', 16, 8, regler({ hauteurMur: 3, decor: 'leger', ombreMur: 'marquee', penombre: 'aucune' })],
    ['coins-15-32', 'coins-15', 32, 12, null],
    ['coins-15-16-second-terrain-eau', 'coins-15', 16, 13, (j) => { A.changerSecondTerrain(j, true); A.poserIntegree(j, 'bas', 'eau') }],
    ['pieces-17-32', 'pieces-17', 32, 14, null],
    ['sol-32-matieres-asset', 'sol', 32, 21, (j) => { poser(j, 'surface', 'mat-a'); poser(j, 'bordure', 'mat-b') }],
    ['sol-16-second-terrain-asset', 'sol', 16, 22, (j) => { A.changerSecondTerrain(j, true); poser(j, 'bas', 'mat-c'); j.reglages.reduction = 'moyenne' }],
    ['chemin-64-asset', 'chemin', 64, 23, (j) => { poser(j, 'surface', 'mat-c'); A.poserIntegree(j, 'bordure', 'sable') }],
    ['mur-32-h2-face-asset', 'mur', 32, 24, (j) => { poser(j, 'face', 'mat-b'); A.poserIntegree(j, 'surface', 'neige') }],
    ['coins-15-64-asset-variantes', 'coins-15', 64, 25, (j) => { poser(j, 'surface', 'mat-a'); j.reglages.variantes = 3 }],
  ]
  // TU6 : quand la palette commune existe, un cas sans elle et un cas avec la palette du jeu.
  const palette = ['#1b1f22', '#3a4a3f', '#6b8a4e', '#a7c06a', '#e0d9a8', '#8c5a3c']
  if (tu6) {
    cas.push(['sol-32-assets-sans-memes-couleurs', 'sol', 32, 31, (j) => { poser(j, 'surface', 'mat-a'); poser(j, 'bordure', 'mat-c'); j.reglages.memesCouleurs = false }])
    cas.push(['chemin-32-palette-du-jeu', 'chemin', 32, 32, (j) => { poser(j, 'surface', 'mat-b'); j.reglages.paletteJeu = true; j.paletteUnivers = palette }])
  }

  const sortie = []
  for (const [nom, sorte, taille, graine, gestes] of cas) {
    const j = A.nouveauJeu({ nom, sorte, taille, graine })
    if (gestes) gestes(j)
    A.oublierLesRendus()
    const t0 = performance.now()
    const atlas = A.atlasDe(j)
    const duree = performance.now() - t0
    const png = await encoderPng(atlas.pixels)
    const v = A.verifier(j, atlas)
    sortie.push({
      nom, recette: A.recetteDe(j), palette_univers: j.paletteUnivers ?? [],
      largeur: atlas.pixels.width, hauteur: atlas.pixels.height,
      pixels: await sha(atlas.pixels.data), png: await sha(png), png_octets: png.length, duree_ms: Math.round(duree),
      carte: j.carte ? A.versCarteServeur(j) : null,
      verification: v.rien ? null : { pieces: v.pieces, defauts: v.defauts },
    })
  }
  return { navigateur: navigator.userAgent, tu6, matieres: Object.fromEntries(Object.entries(matieres).map(([k, m]) => [k, m.png])), cas: sortie }
}

// ── Le banc ──────────────────────────────────────────────────────────────────
const vite = await createServer({ root: interfaceDir, configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } })
await vite.listen()
const base = vite.resolvedUrls.local[0].replace(/\/$/, '')
const navigateur = await chromium.launch({ headless: true, ...(existsSync(EDGE) ? { executablePath: EDGE } : {}) })
try {
  const page = await navigateur.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(e.message))
  // Une page de l'origine de Vite, sans monter l'application (elle appellerait l'API).
  await page.goto(`${base}/src/tuiles/png.ts`)
  const resultat = await page.evaluate(capturer)
  if (erreurs.length) throw new Error(erreurs.join(' | '))
  process.stdout.write(JSON.stringify(resultat))
} finally {
  await navigateur.close()
  await vite.close()
}
