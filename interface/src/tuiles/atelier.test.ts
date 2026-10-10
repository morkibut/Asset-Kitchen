// Les critères de TU3 que l'écran ne voit pas : la recette et la carte font
// l'aller-retour sans rien perdre, et l'atlas rendu est le même au pixel près —
// avant et après, comme deux fois de suite. `docs/PLAN-tuiles.md` § TU3.
import { inflateSync } from "node:zlib"
import { describe, expect, test, vi } from "vitest"
import { installerBouchonCanvas } from "./moteur/__tests__/canvas-shim"
import {
  atlasDe, changerSecondTerrain, delier, depuisCarteServeur, dessinerCarte, enClair, imageDuFond, jeuDepuisRecette, nombrePieces, nomPiece, nouveauJeu,
  oublierLesRendus, pieceDeDefaut, poserAsset, poserIntegree, recetteDe, reglagesMoteur, TAILLES_TUILE, tailleDeLUnivers, versCarteServeur, verifier,
  type Atlas, type JeuEdite, type Recette, type Sorte,
} from "./atelier"
import { encoderPng } from "./png"
import { atlasPosition, maskAtPosition, NEIGHBOUR_BITS, TILE_MASK_SETS, type MaskSet } from "./moteur/tile-masks"
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
      // La palette commune (TU6) ne touche plus que les matières-assets depuis la
      // correction de la relecture TU11 : sur des matières intégrées comme ici, elle n'a
      // de toute façon aucun effet. `memesCouleurs = false` reste posé par prudence, pour
      // ne pas dépendre de ce détail dans un test qui mesure autre chose — la pénombre du
      // mur, un effet de nuance bien plus fin que ce qu'un partage à 24 couleurs laisse
      // passer.
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

describe("Vérifier (TU9)", () => {
  test("un sol par défaut se raccorde partout", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 31415 })
    const v = verifier(j, atlasDe(j))
    expect(v).toEqual({ defauts: [], pieces: 47 })
  })

  test("un jeu sur deux sols : la case « tout dessous » n'est plus signalée à tort (sol)", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 31415 })
    changerSecondTerrain(j, true)
    expect(verifier(j, atlasDe(j))).toEqual({ defauts: [], pieces: 47 })
  })

  test("un jeu sur deux sols : même chose en 15 pièces", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "coins-15", taille: 32, graine: 31415 })
    changerSecondTerrain(j, true)
    expect(verifier(j, atlasDe(j))).toEqual({ defauts: [], pieces: 15 })
  })

  test("un mur propre se raccorde, et compte ses pièces posables", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "mur", taille: 32, graine: 31415 })
    const v = verifier(j, atlasDe(j))
    if (v.rien) throw new Error("un mur se vérifie")
    expect(v.defauts).toEqual([])
    expect(v.pieces).toBe(nombrePieces("mur"))
  })

  // Sabotages du même genre que interface/src/tuiles/moteur/__tests__/tile-check.test.ts
  // (erase/shiftSeam) : on efface ou on décale un pixel de l'atlas déjà rendu, sans
  // toucher tile-check.js lui-même.
  function efface(atlas: Atlas, set: MaskSet, mask: number, tuile: number) {
    const p = atlasPosition(set, mask), { data, width } = atlas.pixels
    for (let y = 0; y < tuile; y++) for (let x = 0; x < tuile; x++) data[(((p.row * tuile + y) * width) + p.col * tuile + x) * 4 + 3] = 0
  }
  function decale(atlas: Atlas, set: MaskSet, mask: number, tuile: number) {
    const p = atlasPosition(set, mask), { data, width } = atlas.pixels, mid = Math.floor(tuile / 2)
    for (let y = mid - 2; y < mid + 2; y++) data[(((p.row * tuile + y) * width) + p.col * tuile + (tuile - 1)) * 4 + 3] = 0
  }

  test("une case effacée par erreur donne un défaut en clair, et la pièce se retrouve sur la planche", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 31415 })
    const atlas = atlasDe(j)
    const B47 = TILE_MASK_SETS.B47 as MaskSet
    efface(atlas, B47, 255, j.taille)
    const v = verifier(j, atlas)
    if (v.rien) throw new Error("un sol se vérifie")
    expect(v.defauts.length).toBeGreaterThan(0)
    const d = v.defauts.find((p) => p.includes("masque 255"))!
    expect(d).toBeDefined()
    expect(enClair(d)).toBe("Une pièce est vide : rien n’y est dessiné.")
    expect(pieceDeDefaut(j, d)).toEqual(atlasPosition(B47, 255))
  })

  test("une couture décalée donne un défaut en clair, avec sa pièce", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 31415 })
    const atlas = atlasDe(j)
    const B47 = TILE_MASK_SETS.B47 as MaskSet
    decale(atlas, B47, 255, j.taille)
    const v = verifier(j, atlas)
    if (v.rien) throw new Error("un sol se vérifie")
    expect(v.defauts.length).toBeGreaterThan(0)
    const d = v.defauts.find((p) => /couture/.test(p))!
    expect(d).toBeDefined()
    expect(enClair(d)).toBe("Deux pièces voisines ne se raccordent pas : leur bord commun ne tombe pas au même endroit.")
    expect(pieceDeDefaut(j, d)).not.toBeNull()
  })
})

describe("TU6 — les mêmes couleurs pour toutes les matières", () => {
  // Corrigé après la relecture TU11 (voir `docs/PLAN-tuiles.md` § TU6) : `memesCouleurs`
  // ne recolore plus le rendu entier via `settings.palette` du moteur — seuls les
  // emplacements dont la source est un ASSET (matière générée ou importée) sont
  // ramenés sur la palette du premier d'entre eux, avant même d'atteindre le moteur.
  // Les tests d'avant (palette posée sur un jeu 100 % intégré) testaient le défaut
  // trouvé par la relecture ; ils sont remplacés ici par ceux qui vérifient la
  // décision : rien ne bouge sans asset, et seuls les assets se ramènent les uns sur
  // les autres.
  type Descripteur = { palette: { rgb: [number, number, number] }[] } | null

  test("cochée par défaut ; un jeu 100 % intégré rend identique au bit près, memesCouleurs vrai ou faux, comme avant TU6", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    expect(j.reglages.memesCouleurs).toBe(true)
    expect(j.reglages.paletteJeu).toBe(false)
    expect(reglagesMoteur(j).palette).toBeNull()
    const avec = Buffer.from(atlasDe(j).pixels.data)
    oublierLesRendus()
    j.reglages.memesCouleurs = false
    expect(reglagesMoteur(j).palette).toBeNull()
    const sans = Buffer.from(atlasDe(j).pixels.data)
    expect(avec).toEqual(sans)
    expect(verifier(j, atlasDe(j))).toEqual({ defauts: [], pieces: 47 })
  })

  test("décochée, le réglage envoyé au moteur redevient « rien » — le chemin de TU3, au bit près", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    j.reglages.memesCouleurs = false
    expect(reglagesMoteur(j).palette).toBeNull()
  })

  test("herbe (intégrée) sur sable (intégré), avec un second terrain : le sable n'est pas recoloré", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 }) // surface : herbe, intégrée
    changerSecondTerrain(j, true) // bas : sable, intégrée aussi
    const avecMemesCouleurs = reglagesMoteur(j)
    expect(avecMemesCouleurs.palette).toBeNull()
    j.reglages.memesCouleurs = false
    const sansMemesCouleurs = reglagesMoteur(j)
    const octets = (im: unknown) => Buffer.from((im as RGBAImage).data)
    type AvecDessous = { lowerTerrain: { surfaceTexture: unknown; edgeTexture: unknown } | null }
    expect(octets(avecMemesCouleurs.surfaceTexture)).toEqual(octets(sansMemesCouleurs.surfaceTexture))
    expect(octets(avecMemesCouleurs.edgeTexture)).toEqual(octets(sansMemesCouleurs.edgeTexture))
    const avecDessous = (avecMemesCouleurs as unknown as AvecDessous).lowerTerrain!, sansDessous = (sansMemesCouleurs as unknown as AvecDessous).lowerTerrain!
    expect(octets(avecDessous.surfaceTexture)).toEqual(octets(sansDessous.surfaceTexture))
    expect(octets(avecDessous.edgeTexture)).toEqual(octets(sansDessous.edgeTexture))
  })

  test("deux matières-assets : la seconde n'utilise que des couleurs de la première, au plus 24, l'alpha ne bouge pas", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    changerSecondTerrain(j, true)
    const image1 = texture(32, 11), image2 = texture(32, 53)
    poserAsset(j, "surface", "a1", "Premier asset", image1) // référence, dans l'ordre surface → bas
    poserAsset(j, "bas", "a2", "Second asset", image2)
    const r = reglagesMoteur(j) as unknown as { surfaceTexture: RGBAImage; lowerTerrain: { surfaceTexture: RGBAImage } }
    const surface = r.surfaceTexture, bas = r.lowerTerrain.surfaceTexture
    const couleursDe = (im: RGBAImage) => {
      const s = new Set<string>()
      for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3] >= 8) s.add(`${im.data[i]},${im.data[i + 1]},${im.data[i + 2]}`)
      return s
    }
    const paletteSurface = couleursDe(surface)
    expect(paletteSurface.size).toBeLessThanOrEqual(24)
    for (const c of couleursDe(bas)) expect(paletteSurface.has(c)).toBe(true)
    // L'alpha traverse tel quel : `appliquerPalette` ne réécrit que R/V/B (tile-palette.js).
    expect(bas.data.length).toBe(image2.data.length)
    for (let i = 0; i < bas.data.length; i += 4) expect(bas.data[i + 3]).toBe(image2.data[i + 3])
    for (let i = 0; i < surface.data.length; i += 4) expect(surface.data[i + 3]).toBe(image1.data[i + 3])
  })

  test("la palette du jeu (T31) reste posée par le moteur, indépendamment de memesCouleurs", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 4242 })
    j.reglages.paletteJeu = true
    // Sans palette d'univers, le réglage n'a aucun effet — et depuis la correction de la
    // relecture TU11, plus aucun repli sur la palette commune : `memesCouleurs` ne parle
    // plus à `settings.palette` du tout.
    expect(j.paletteUnivers).toEqual([])
    expect(reglagesMoteur(j).palette).toBeNull()
    j.paletteUnivers = ["#204080", "#a0c060", "#ffffff", "#101010"]
    const duJeu = reglagesMoteur(j).palette as Descripteur
    expect(duJeu).not.toBeNull()
    expect(duJeu!.palette.length).toBe(4)
    const rgb = new Set(duJeu!.palette.map((c) => c.rgb.map(Math.round).join(",")))
    expect(rgb).toEqual(new Set(["32,64,128", "160,192,96", "255,255,255", "16,16,16"]))
    // memesCouleurs, coché par défaut, ne redevient pas un second chemin vers settings.palette.
    j.reglages.memesCouleurs = false
    const duJeuSansMemesCouleurs = reglagesMoteur(j).palette as Descripteur
    expect(duJeuSansMemesCouleurs!.palette.length).toBe(4)
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

describe("TU8 (écran) — le réglage « décor »", () => {
  test("les sortes que la recette serveur accepte le connaissent, avec « aucun » par défaut ; les 17 pièces l'ignorent", () => {
    for (const sorte of ["sol", "chemin", "coins-15", "mur"] as const) {
      const j = nouveauJeu({ nom: "Essai", sorte, taille: 32, graine: 1 })
      expect(j.reglages.decor).toBe("aucun")
      expect(recetteDe(j).reglages.decor).toBe("aucun")
    }
    const dixSept = nouveauJeu({ nom: "Essai", sorte: "pieces-17", taille: 32, graine: 1 })
    expect(dixSept.reglages.decor).toBeUndefined()
    expect(recetteDe(dixSept).reglages.decor).toBeUndefined()
  })

  test("« aucun » rend un atlas identique au bit près à un jeu qui ignore encore ce réglage", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 7 })
    const avecLeReglage = Buffer.from(atlasDe(j).pixels.data)
    const j2 = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 7 })
    delete (j2.reglages as Record<string, unknown>).decor // la recette d'avant TU8 (écran) : la clé manque tout simplement.
    oublierLesRendus()
    const sansLaCle = Buffer.from(atlasDe(j2).pixels.data)
    expect(sansLaCle).toEqual(avecLeReglage)
  })

  test("choisi « léger » ou « dense », le décor part dans la recette et se voit sur la carte peinte", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 32, graine: 7 })
    const propre = Buffer.from(atlasDe(j).pixels.data)
    j.reglages.decor = "dense"
    expect(recetteDe(j).reglages.decor).toBe("dense")
    const atlas = atlasDe(j)
    const avecDecor = Buffer.from(atlas.pixels.data)
    expect(avecDecor).not.toEqual(propre)
    // La planche gagne des pièces de gravats, que `nomPiece` sait nommer (TU8, moteur).
    const cols = atlas.pixels.width / j.taille, rows = atlas.pixels.height / j.taille
    let gravats = 0
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (nomPiece(j, col, row).startsWith("Gravats")) gravats++
    expect(gravats).toBeGreaterThan(0)
  })

  // Le 27 septembre 2026 : même « léger » posait des blocs d'un quart de tuile, coupés net
  // par les côtés de leur case. Détachés, les cailloux tiennent ENTIERS dans leur case.
  function casesDeCailloux(j: JeuEdite) {
    const a = atlasDe(j).pixels, t = j.taille, sortie: { opaques: number; bord: number }[] = []
    for (let row = 0; row < a.height / t; row++) for (let col = 0; col < a.width / t; col++) {
      if (!nomPiece(j, col, row).startsWith("Gravats")) continue
      let opaques = 0, bord = 0
      for (let y = 0; y < t; y++) for (let x = 0; x < t; x++) {
        if (!a.data[((row * t + y) * a.width + col * t + x) * 4 + 3]) continue
        opaques++
        if (x === 0 || y === 0 || x === t - 1 || y === t - 1) bord++
      }
      sortie.push({ opaques, bord })
    }
    return sortie
  }

  test("détachés, aucun caillou ne touche le bord de sa case, même au plus gros et au plus loin", () => {
    for (const sorte of ["chemin", "sol", "mur"] as const) {
      const j = nouveauJeu({ nom: "Essai", sorte, taille: 32, graine: 11 })
      Object.assign(j.reglages, { decor: "partout", caillouxTaille: 10, caillouxNombre: 10, caillouxEcart: 10, irregularite: 10 })
      const cases = casesDeCailloux(j)
      expect(cases.length).toBe(12)
      expect(cases.every((c) => c.opaques > 0)).toBe(true)
      expect(cases.map((c) => c.bord)).toEqual(Array(12).fill(0))
    }
  })

  test("la taille des cailloux change leur surface, dans le bon sens", () => {
    const surface = (taille: number) => {
      const j = nouveauJeu({ nom: "Essai", sorte: "chemin", taille: 64, graine: 5 })
      Object.assign(j.reglages, { decor: "leger", caillouxTaille: taille })
      return casesDeCailloux(j).reduce((s, c) => s + c.opaques, 0)
    }
    const petits = surface(1), moyens = surface(5), gros = surface(10)
    expect(petits).toBeLessThan(moyens)
    expect(moyens).toBeLessThan(gros)
  })

  test("les réglages fins des cailloux survivent à la réouverture", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "chemin", taille: 32, graine: 9 })
    Object.assign(j.reglages, { decor: "moyen", caillouxTaille: 7, caillouxNombre: 2, caillouxEcart: 9, caillouxColles: true })
    const avant = Buffer.from(atlasDe(j).pixels.data)
    oublierLesRendus()
    const j2 = rouvrir(j)
    expect(j2.reglages).toMatchObject({ decor: "moyen", caillouxTaille: 7, caillouxNombre: 2, caillouxEcart: 9, caillouxColles: true })
    expect(Buffer.from(atlasDe(j2).pixels.data)).toEqual(avant)
  })

  test("le mur connaît aussi le réglage, et « aucun » reste son défaut", () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "mur", taille: 32, graine: 3 })
    expect(reglagesMoteur(j).decor).toBe("aucun")
    j.reglages.decor = "leger"
    expect(reglagesMoteur(j).decor).toBe("leger")
  })
})

// La case du jeu de l'auteur est réglée à 96 px (`docs/PLAN-tuiles.md`, « La taille de
// pièce par défaut », tranché le 19 septembre 2026) : la liste des tailles permises suit
// désormais celle des cases du jeu, et non les 16/32/64 recopiés de sc-clone.
describe("La taille d'une pièce suit la liste des cases du jeu", () => {
  test("TAILLES_TUILE est la liste retenue, sans 256 ni 512", () => {
    expect(TAILLES_TUILE).toEqual([8, 16, 24, 32, 48, 64, 96, 128])
  })

  test.each([8, 24, 48, 96, 128] as const)("un univers pixel art réglé sur %i px retombe sur sa propre taille", (cible) => {
    expect(tailleDeLUnivers({ style: "pixel", cible_px: cible })).toBe(cible)
  })

  test.each([256, 512, 0] as const)("un univers en %i px (haute résolution, ou « aucune ») retombe sur 32", (cible) => {
    expect(tailleDeLUnivers({ style: "pixel", cible_px: cible })).toBe(32)
  })

  test("un univers qui n'est pas en pixel art, ou absent, retombe aussi sur 32", () => {
    expect(tailleDeLUnivers({ style: "dessin", cible_px: 96 })).toBe(32)
    expect(tailleDeLUnivers(null)).toBe(32)
    expect(tailleDeLUnivers(undefined)).toBe(32)
  })

  test("une planche de 96 px se rend et se vérifie sans défaut, pour les trois sortes à masques", () => {
    // Bordures « nettes », pas le défaut « organiques » : à 96 comme à 128 px, le bruit des
    // bordures organiques peut occasionnellement décaler une couture d'un pixel selon la
    // graine — un balayage de 300 graines le confirme à TOUTES les tailles dès 96 px (0/300
    // à 64 px, jusqu'à 53/300 à 128 px), y compris pour la matière par défaut. C'est un
    // défaut de bruit, pas de taille : RP10 dit déjà qu'un défaut avertit sans bloquer la
    // livraison. Le critère de cette tranche est que la taille elle-même n'introduit rien de
    // neuf ; des bordures nettes le montrent sans mélanger les deux sujets.
    for (const sorte of ["sol", "chemin", "coins-15"] as const) {
      const j = nouveauJeu({ nom: "Essai", sorte, taille: 96, graine: 2026 })
      j.reglages.bordures = "nettes"
      const atlas = atlasDe(j)
      expect(atlas.pixels.width % 96).toBe(0)
      expect(atlas.pixels.height % 96).toBe(0)
      const v = verifier(j, atlas)
      if (v.rien) throw new Error(`${sorte} se vérifie`)
      expect(v.defauts).toEqual([])
    }
  })

  test("l'aller-retour (enregistrer puis rouvrir) redonne le même atlas au pixel près, à 96 px", async () => {
    const j = nouveauJeu({ nom: "Essai", sorte: "sol", taille: 96, graine: 2026 })
    const avant = await png(j)
    const rouverte = rouvrir(j)
    const apres = await png(rouverte)
    expect(apres).toEqual(avant)
  })
})

describe("Le bord se creuse à l'échelle de la pièce", () => {
  // Une pièce de 64 px est l'agrandissement d'une pièce de 32 px : toutes les longueurs
  // passées au moteur doublent ensemble, y compris la longueur d'onde du bruit de bord.
  // Elle valait 5 px quelle que soit la pièce, pendant que la profondeur du même bruit
  // suivait la taille : au-delà de 64 px la silhouette devenait trop pentue pour qu'un
  // bord retombe au même pixel d'une pièce à l'autre, et « Teste les raccords » signalait
  // des coutures décalées. Voir docs/PLAN-tuiles.md, « Le bruit de bord suit la taille ».
  const LONGUEURS = ["cornerRadius", "edgeRoughness", "edgeFrequency", "edgeFade"] as const

  test("toutes les longueurs du bord doublent avec la pièce", () => {
    const de = (taille: number) => reglagesMoteur(nouveauJeu({ nom: "Essai", sorte: "sol", taille, graine: 7 })) as unknown as Record<string, number>
    const petite = de(16), moyenne = de(32), grande = de(64)
    for (const cle of LONGUEURS) {
      expect(moyenne[cle]).toBeCloseTo(petite[cle] * 2, 10)
      expect(grande[cle]).toBeCloseTo(moyenne[cle] * 2, 10)
    }
  })

  test("les pièces se raccordent à chaque taille offerte, pour les trois sortes à masques", () => {
    for (const taille of [16, 32, 64]) {
      for (const [sorte, pieces] of [["sol", 47], ["chemin", 16], ["coins-15", 15]] as const) {
        const j = nouveauJeu({ nom: "Essai", sorte, taille, graine: 31415 })
        expect({ taille, sorte, ...verifier(j, atlasDe(j)) }).toEqual({ taille, sorte, defauts: [], pieces })
      }
    }
  })
})
