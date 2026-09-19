// Les critères de TU3 que l'écran ne voit pas : la recette et la carte font
// l'aller-retour sans rien perdre, et l'atlas rendu est le même au pixel près —
// avant et après, comme deux fois de suite. `docs/PLAN-tuiles.md` § TU3.
import { inflateSync } from "node:zlib"
import { describe, expect, test, vi } from "vitest"
import { installerBouchonCanvas } from "./moteur/__tests__/canvas-shim"
import {
  atlasDe, changerSecondTerrain, delier, depuisCarteServeur, dessinerCarte, imageDuFond, jeuDepuisRecette, nouveauJeu,
  oublierLesRendus, poserAsset, poserIntegree, recetteDe, reglagesMoteur, versCarteServeur, verifier,
  type JeuEdite, type Recette, type Sorte,
} from "./atelier"
import { encoderPng } from "./png"
import { maskAtPosition, NEIGHBOUR_BITS, TILE_MASK_SETS, type MaskSet } from "./moteur/tile-masks"
import type { RGBAImage } from "./moteur/types"

installerBouchonCanvas()
// Le mur rend deux planches de 88 cases : sous la charge de toute la suite, plus que
// les cinq secondes par défaut.
vi.setConfig({ testTimeout: 30_000 })

/** Ce que le serveur renvoie d'une recette (`recette_tuiles.recette`) : une bordure
 *  liée recopie sa surface, les réglages absents prennent leur défaut. */
function echoDuServeur(r: Recette): Recette {
  const e: Recette = JSON.parse(JSON.stringify(r))
  for (const [b, s] of [["bordure", "surface"], ["bordureBas", "bas"]] as const)
    if (e.emplacements[b]?.lie) e.emplacements[b] = { ...(e.emplacements[s] as object), lie: true } as Recette["emplacements"][string]
  const defauts: Record<string, string | number | boolean> = { couleurSurface: "#92af70", couleurContour: "#43563d", fondBlanc: false }
  if (r.sorte !== "mur" && r.sorte !== "pieces-17") Object.assign(defauts, { animationAtlas: 0, couleurDessous: "#d6b476", couleurContourDessous: "#96764a", decor: "aucun" })
  if (r.sorte === "mur") defauts.decor = "aucun"
  e.reglages = { ...defauts, ...e.reglages }
  return e
}

async function png(j: JeuEdite) { return encoderPng(atlasDe(j).pixels) }

function rouvrir(j: JeuEdite, images = new Map<string, RGBAImage>()): JeuEdite {
  const recette = echoDuServeur(JSON.parse(JSON.stringify(recetteDe(j))))
  return jeuDepuisRecette({ identifiant: "x", revision: 1, nom: j.nom, recette, carte: versCarteServeur(j) }, images)
}

const texture = (taille: number, graine: number): RGBAImage => {
  const data = new Uint8ClampedArray(taille * taille * 4)
  for (let i = 0; i < taille * taille; i++) data.set([(i * graine) % 256, (i * 7) % 256, 90, 255], i * 4)
  return { width: taille, height: taille, data }
}

describe("L'aller-retour d'un jeu de tuiles", () => {
  const cas: [string, (j: JeuEdite) => void, Sorte][] = [
    ["un sol par défaut", () => undefined, "sol"],
    ["un sol sur un autre sol, bordure déliée", (j) => { changerSecondTerrain(j, true); delier(j, "bordure"); poserIntegree(j, "bordure", "roche"); poserIntegree(j, "bas", "eau"); j.reglages.arrondi = 5; j.reglages.bordures = "nettes" }, "sol"],
    ["un chemin avec variantes", (j) => { j.reglages.variantes = 2; poserIntegree(j, "surface", "sable") }, "chemin"],
    ["un sol en 15 pièces", (j) => { j.reglages.irregularite = 1 }, "coins-15"],
    ["un mur de trois cases", (j) => { j.reglages.hauteurMur = 3; j.reglages.ombreMur = "marquee" }, "mur"],
    ["17 pièces libres", () => undefined, "pieces-17"],
  ]
  for (const [nom, regler, sorte] of cas) {
    test(`${nom} : même carte, même atlas au pixel près`, async () => {
      const j = nouveauJeu({ nom: "Essai", sorte, taille: 32, graine: 4242 })
      regler(j)
      const avant = await png(j)
      const carte = versCarteServeur(j)
      oublierLesRendus()
      const j2 = rouvrir(j)
      expect(Buffer.from(atlasDe(j2).pixels.data)).toEqual(Buffer.from(atlasDe(j).pixels.data))
      expect(Buffer.from(await png(j2))).toEqual(Buffer.from(avant))
      expect(versCarteServeur(j2)).toEqual(carte)
      // La recette relue se réécrit à l'identique — c'est ce qui dit « rien à enregistrer ».
      expect(recetteDe(rouvrir(j2))).toEqual(recetteDe(j2))
    })
  }

  test("une image de la bibliothèque délie la bordure, et revient à sa place", async () => {
    const j = nouveauJeu({ nom: "Vase", sorte: "sol", taille: 32, graine: 7 })
    const im = texture(48, 3)
    poserAsset(j, "surface", "asset-vase", "Vase", im)
    const r = recetteDe(j)
    expect(r.emplacements.surface).toEqual({ source: "asset", asset: "asset-vase" })
    expect(r.emplacements.bordure).toEqual({ source: "integree", nom: "herbe", lie: false })
    const avant = await png(j)
    oublierLesRendus()
    const j2 = rouvrir(j, new Map([["asset-vase", im]]))
    expect(Buffer.from(await png(j2))).toEqual(Buffer.from(avant))
  })

  test("la carte peinte et la carte gardée se correspondent case pour case", () => {
    const j = nouveauJeu({ nom: "Île", sorte: "sol", taille: 16, graine: 1 })
    const k = j.carte!
    if (k.kind !== "cases") throw new Error("un sol se peint par cases")
    const peintes = k.grid.flat().filter(Boolean).length
    const gardee = versCarteServeur(j)
    expect(gardee.cases).toHaveLength(peintes)
    expect(depuisCarteServeur(j, gardee)).toEqual(k)
    // Sur un autre sol, chaque case vide porte le sol dessous — et se relit vide.
    changerSecondTerrain(j, true)
    const pleine = versCarteServeur(j)
    expect(pleine.cases).toHaveLength(k.columns * k.rows)
    expect(depuisCarteServeur(j, pleine)).toEqual(k)
  })
})

describe("Le PNG de l'atlas", () => {
  test("il se relit, et porte exactement les pixels du moteur", async () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "chemin", taille: 16, graine: 99 })
    const a = atlasDe(j).pixels
    const octets = Buffer.from(await encoderPng(a))
    expect([...octets.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(octets.readUInt32BE(16)).toBe(a.width)
    expect(octets.readUInt32BE(20)).toBe(a.height)
    const longueur = octets.readUInt32BE(33)
    const brut = inflateSync(octets.subarray(41, 41 + longueur))
    const lignes = Buffer.alloc(a.width * a.height * 4)
    for (let y = 0; y < a.height; y++) brut.copy(lignes, y * a.width * 4, y * (a.width * 4 + 1) + 1, (y + 1) * (a.width * 4 + 1))
    expect(lignes).toEqual(Buffer.from(a.data))
  })

  test("deux rendus de la même recette donnent les mêmes octets", async () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 12 })
    const un = await png(j)
    oublierLesRendus()
    const deux = await png(nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 12 }))
    expect(Buffer.from(deux)).toEqual(Buffer.from(un))
  })
})

describe("Le dessus du mur (TU7)", () => {
  // Le critère : le dessus d'un mur est identique, au pixel près, au sol de même matière.
  // Mêmes matières, même graine, mêmes réglages communs : les six premières lignes de la
  // planche du mur (le blob 47) sont celles de la planche du sol, case par case. C'est ce
  // qui permet de poser un mur au milieu d'un sol de la même pierre sans couture.
  //
  // Une exception, voulue par le moteur et mesurée ici : la « pénombre dans les angles »
  // du mur (T38 de sc-clone) assombrit les coins rentrants de son dessus, que le sol n'a
  // pas. Pénombre à « aucune », le dessus est le sol ; sinon, seules les pièces qui ont un
  // coin rentrant diffèrent, et rien d'autre.
  const coinRentrant = (m: number) => ([["N", "E", "NE"], ["S", "E", "SE"], ["S", "W", "SW"], ["N", "W", "NW"]] as const)
    .some(([a, b, d]) => (m & NEIGHBOUR_BITS[a]) && (m & NEIGHBOUR_BITS[b]) && !(m & NEIGHBOUR_BITS[d]))
  const casesDifferentes = (sol: JeuEdite, mur: JeuEdite) => {
    const a = atlasDe(sol).pixels, b = atlasDe(mur).pixels, t = sol.taille
    const cases = new Set<string>()
    let opaques = 0
    for (let y = 0; y < 6 * t; y++) for (let x = 0; x < 8 * t; x++) {
      const ia = (y * a.width + x) * 4, ib = (y * b.width + x) * 4
      if (a.data[ia + 3]) opaques++
      for (let k = 0; k < 4; k++) if (a.data[ia + k] !== b.data[ib + k]) { cases.add(`${Math.floor(x / t)},${Math.floor(y / t)}`); break }
    }
    expect(opaques).toBeGreaterThan(20 * t * t)
    return cases
  }
  for (const [taille, surface, regler] of [
    [16, "pierre", () => undefined],
    [32, "herbe", (j: JeuEdite) => { j.reglages.arrondi = 5; j.reglages.bordures = "nettes"; j.reglages.nuances = 8 }],
    [64, "carrelage", (j: JeuEdite) => { j.reglages.relief = 9; j.reglages.reduction = "moyenne" }],
  ] as const) {
    test(`${surface} en ${taille} px`, () => {
      const sol = nouveauJeu({ nom: "Sol", sorte: "sol", taille, graine: 4242 })
      const mur = nouveauJeu({ nom: "Mur", sorte: "mur", taille, graine: 4242 })
      // La palette commune (TU6, cochée par défaut) est hors sujet ici : ce test mesure la
      // pénombre du mur, un effet de nuance bien plus fin que ce qu'un partage à 24
      // couleurs laisse passer — elle absorberait la différence qu'on cherche à voir.
      for (const j of [sol, mur]) { poserIntegree(j, "surface", surface); regler(j); j.reglages.memesCouleurs = false }
      mur.reglages.hauteurMur = 5
      mur.reglages.ombreMur = "marquee"
      mur.reglages.penombre = "aucune"
      expect([...casesDifferentes(sol, mur)]).toEqual([])
      // La pénombre par défaut ne touche que les coins rentrants.
      mur.reglages.penombre = "discrete"
      const touchees = casesDifferentes(sol, mur)
      expect(touchees.size).toBeGreaterThan(20)
      for (const c of touchees) {
        const [x, y] = c.split(",").map(Number)
        expect(coinRentrant(maskAtPosition(TILE_MASK_SETS.B47 as MaskSet, x, y) ?? 0), c).toBe(true)
      }
    })
  }
})

describe("Le temps d'un changement", () => {
  // Le critère : changer une matière ou un réglage redessine la carte en moins d'une
  // demi-seconde à 32 px. Mesuré ici sous jsdom, avec le peintre pixel par pixel —
  // plus lent que le navigateur, qui dessine par `drawImage`.
  for (const taille of [32, 64]) test(`${taille} px`, () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille, graine: 5 })
    atlasDe(j)
    const canvas = document.createElement("canvas")
    const t0 = performance.now()
    poserIntegree(j, "surface", "neige")
    j.reglages.arrondi = 6
    const atlas = atlasDe(j)
    dessinerCarte(canvas, j, atlas, j.carte!, 1, { fond: imageDuFond(j, new Map()) })
    const duree = performance.now() - t0
    console.info(`TU3 · changement de matière et de réglage à ${taille} px : ${Math.round(duree)} ms (atlas ${Math.round(atlas.duree)} ms)`)
    if (taille === 32) expect(duree).toBeLessThan(500)
    // Une seconde lecture de la même recette ne rend rien : elle lit le cache.
    const t1 = performance.now()
    expect(atlasDe(j)).toBe(atlas)
    expect(performance.now() - t1).toBeLessThan(20)
  })
})

describe("Vérifier", () => {
  test("un sol par défaut se raccorde partout", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 31415 })
    const v = verifier(j, atlasDe(j))
    expect(v).toEqual({ defauts: [], pieces: 47 })
  })
})

describe("TU6 — les mêmes couleurs pour toutes les matières", () => {
  type Descripteur = { palette: { rgb: [number, number, number] }[] } | null

  test("cochée par défaut, et le rendu se raccorde toujours", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    expect(j.reglages.memesCouleurs).toBe(true)
    expect(j.reglages.paletteJeu).toBe(false)
    const d = reglagesMoteur(j).palette as Descripteur
    expect(d).not.toBeNull()
    expect(d!.palette.length).toBeLessThanOrEqual(24)
    // Aucune couture nouvelle : la quantification est la même fonction pour tous les
    // pixels, donc deux pixels qui se raccordaient avant se raccordent encore.
    expect(verifier(j, atlasDe(j))).toEqual({ defauts: [], pieces: 47 })
  })

  test("décochée, le réglage envoyé au moteur redevient « rien » — le chemin de TU3, au bit près", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    j.reglages.memesCouleurs = false
    expect(reglagesMoteur(j).palette).toBeNull()
  })

  test("toutes les matières se ramènent sur les couleurs de la surface, l'alpha ne bouge pas", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    poserIntegree(j, "surface", "pierre")
    changerSecondTerrain(j, true)
    j.reglages.arrondi = 6
    const avecAlpha = atlasDe(j).pixels
    oublierLesRendus()
    j.reglages.memesCouleurs = false
    const sansPalette = atlasDe(j).pixels
    expect(avecAlpha.data.length).toBe(sansPalette.data.length)
    for (let i = 0; i < avecAlpha.data.length; i += 4) expect(avecAlpha.data[i + 3]).toBe(sansPalette.data[i + 3])
  })

  test("la palette du jeu, quand elle existe, remplace la palette commune", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    j.reglages.paletteJeu = true
    // Sans palette d'univers, le réglage n'a aucun effet : la palette commune reprend la main.
    expect(j.paletteUnivers).toEqual([])
    const commune = reglagesMoteur(j).palette as Descripteur
    expect(commune).not.toBeNull()
    j.paletteUnivers = ["#204080", "#a0c060", "#ffffff", "#101010"]
    const duJeu = reglagesMoteur(j).palette as Descripteur
    expect(duJeu).not.toBeNull()
    expect(duJeu!.palette.length).toBe(4)
    const rgb = new Set(duJeu!.palette.map((c) => c.rgb.map(Math.round).join(",")))
    expect(rgb).toEqual(new Set(["32,64,128", "160,192,96", "255,255,255", "16,16,16"]))
  })

  test("enregistrer puis rouvrir redonne le même atlas, palette du jeu comprise", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "chemin", taille: 32, graine: 99 })
    j.reglages.paletteJeu = true
    j.paletteUnivers = ["#336699", "#99cc33"]
    const avant = atlasDe(j).pixels
    oublierLesRendus()
    const j2 = rouvrir(j)
    j2.paletteUnivers = j.paletteUnivers
    expect(Buffer.from(atlasDe(j2).pixels.data)).toEqual(Buffer.from(avant.data))
  })
})
