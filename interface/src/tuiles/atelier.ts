/**
 * L'atelier d'un jeu de tuiles fabriqué (TU3, `docs/PLAN-tuiles.md`) — **sans React
 * ni écran** : ce que la maquette validée (`docs/maquettes-atelier-unifie/tuiles.js`)
 * faisait avec le moteur, rangé pour être essayé seul.
 *
 * Trois choses s'y tiennent :
 *
 * 1. **Un jeu en cours d'édition, et sa recette.** Le serveur garde la recette (sorte,
 *    taille, graine, matières par emplacement, réglages) et l'atlas qu'elle a rendu.
 *    Les noms des réglages sont ceux du serveur (`atelier/domaine/recette_tuiles.py`) ;
 *    c'est ici, et nulle part ailleurs, qu'ils deviennent ceux du moteur.
 * 2. **Le rendu, mis en cache par recette.** Il tourne sur le fil principal : le moteur
 *    crée son canevas par `document.createElement`, qu'un worker n'a pas, et une
 *    planche de 32 px se rend en 15 à 50 ms. Voir `docs/PLAN-tuiles.md` § TU3 · L'atelier du jeu de tuiles.
 * 3. **La carte peinte, et sa forme serveur.** L'écran peint des cases (ou des
 *    sommets, pour les 15 pièces) ; le serveur garde des pièces posées. Le passage se
 *    fait dans les deux sens sans rien perdre, parce que chaque pièce connaît son
 *    masque.
 */

import {
  renderLogical, hexToRgb, TILESET_LAYOUTS, WALL_TOP_ROWS, WALL_BAND_STATES, BLOB_LOWER_CELL,
  wallAtlasDescriptor, biaisAtlasDescriptor, decorAtlasDescriptor, variantAtlasDescriptor, animationAtlasDescriptor,
} from "./moteur/vendor/tileset-engine"
import { MATIERES, LISTE_MATIERES, rendreMatiere, couleurMoyenne, tolerePhase } from "./moteur/tile-materials"
import { NOMBRE_COULEURS, paletteDeReferenceLab } from "./moteur/tile-palette"
import { creerEtat, poserMatiere, poserImage, relier, vider, rafraichirMatieres, texturesDe, PAR_ID, type EtatEmplacements } from "./moteur/tile-emplacements"
import { dessinerScene, peintreCanvas, peintrePixels, descripteurScene } from "./moteur/tile-scene"
import { cellMaskAt, checkMaskSetAtlas, checkWallAtlas, mulberry32 } from "./moteur/tile-check"
import { maskAtPosition, atlasPosition, TILE_MASK_SETS, NEIGHBOUR_BITS, SIDE_BITS, CORNER_BITS, type MaskSet } from "./moteur/tile-masks"
import { cadrageParDefaut, LISTE_CADRAGES } from "./moteur/tile-ia-prompt"
import type { CanvasContext2DLike, CanvasLike, RGBAImage } from "./moteur/types"

export { LISTE_MATIERES, MATIERES, PAR_ID, cadrageParDefaut, LISTE_CADRAGES }

// ── Les sortes ───────────────────────────────────────────────────────────────

export type Sorte = "sol" | "chemin" | "mur" | "coins-15" | "pieces-17"
type JeuDeMasques = "B47" | "E16" | "W16"

export const SORTES: Record<Sorte, { nom: string; court: string; type: string; set: JeuDeMasques | null; mur?: boolean; dessous?: boolean; texte: string }> = {
  sol: { nom: "Un sol", court: "Sol", type: "blob-47", set: "B47", dessous: true, texte: "L’herbe, le sable, l’eau… les bords se posent tout seuls." },
  chemin: { nom: "Un chemin", court: "Chemin", type: "edge-16", set: "E16", texte: "Route, rivière, rail." },
  mur: { nom: "Un mur", court: "Mur", type: "wall", set: null, mur: true, texte: "Avec sa hauteur, sa face et son ombre." },
  "coins-15": { nom: "15 pièces", court: "Sol, format RPG Maker", type: "topdown-15", set: "W16", dessous: true, texte: "Le format de SpriteCook et de RPG Maker : le bord passe au milieu des cases." },
  "pieces-17": { nom: "17 pièces", court: "Pièces libres", type: "topdown-17", set: null, texte: "Des pièces à poser à la main, sans raccord automatique." },
}

export const DEFAUTS_SORTE: Record<Sorte, { nom: string; surface: string; face?: string; fond: string }> = {
  sol: { nom: "Nouveau sol", surface: "herbe", fond: "terre" },
  chemin: { nom: "Nouveau chemin", surface: "terre", fond: "herbe" },
  mur: { nom: "Nouveau mur", surface: "pierre", face: "brique", fond: "carrelage" },
  "coins-15": { nom: "Nouveau sol en 15 pièces", surface: "herbe", fond: "terre" },
  "pieces-17": { nom: "Nouvelles pièces", surface: "herbe", fond: "terre" },
}

type DescripteurMur = { cells: { col: number; row: number; placeable: boolean; band: string; state: string | number | null; sens?: string; orientation?: string }[] }
const murDescripteur = wallAtlasDescriptor as (o?: { decor?: string }) => DescripteurMur

export function nombrePieces(sorte: Sorte): number {
  if (sorte === "mur") return murDescripteur().cells.filter((c) => c.placeable).length
  return { sol: 47, chemin: 16, "coins-15": 15, "pieces-17": 17 }[sorte]
}

// ── Les réglages (noms du serveur) ───────────────────────────────────────────

export type Reglages = Record<string, string | number | boolean>

const A_MASQUES: readonly Sorte[] = ["sol", "chemin", "coins-15"]
/** Ce que l'écran règle, et les sortes qui le connaissent. Le serveur en connaît
 *  davantage (les couleurs de repli, le fond blanc, l'animation de tout l'atlas, le
 *  décor) : ceux-là voyagent tels qu'il les rend, et prennent son défaut sinon. */
const REGLAGES_DE_L_ECRAN: Record<string, { defaut: string | number | boolean; sortes?: readonly Sorte[] }> = {
  bordures: { defaut: "organiques" },
  arrondi: { defaut: 2 },
  irregularite: { defaut: 3 },
  nuances: { defaut: 4 },
  relief: { defaut: 4 },
  reduction: { defaut: "contraste" },
  variantes: { defaut: 0, sortes: A_MASQUES },
  animation: { defaut: 0, sortes: A_MASQUES },
  secondTerrain: { defaut: false, sortes: A_MASQUES },
  hauteurMur: { defaut: 2, sortes: ["mur"] },
  ombreMur: { defaut: "discrete", sortes: ["mur"] },
  penombre: { defaut: "discrete", sortes: ["mur"] },
  // TU6 — la palette commune (T26 bis) est cochée par défaut ; la palette du jeu (T31)
  // ne l'est pas, et n'a d'effet que si l'univers en a une (voir `reglagesMoteur`).
  memesCouleurs: { defaut: true },
  paletteJeu: { defaut: false },
}

export function reglagesParDefaut(sorte: Sorte): Reglages {
  const r: Reglages = {}
  for (const [nom, { defaut, sortes }] of Object.entries(REGLAGES_DE_L_ECRAN)) if (!sortes || sortes.includes(sorte)) r[nom] = defaut
  return r
}

/** Les couleurs de repli de la recette, quand elle ne les donne pas : les mêmes que le
 *  serveur (`REGLAGES`), écrites en composantes. */
const REPLI = {
  couleurSurface: { r: 146, g: 175, b: 112 },
  couleurContour: { r: 67, g: 86, b: 61 },
  couleurDessous: { r: 214, g: 180, b: 118 },
  couleurContourDessous: { r: 150, g: 118, b: 74 },
}
const couleur = (r: Reglages, cle: keyof typeof REPLI) => typeof r[cle] === "string" ? hexToRgb(r[cle] as string) : REPLI[cle]
const NIVEAUX_OMBRE: Record<string, number> = { aucune: 0, discrete: 110, marquee: 190 }
const NIVEAUX_PENOMBRE: Record<string, number> = { aucune: 0, discrete: 50, marquee: 80 }

// ── Le jeu en cours d'édition ────────────────────────────────────────────────

export type Carte =
  | { kind: "cases"; columns: number; rows: number; grid: boolean[][] }
  | { kind: "sommets"; columns: number; rows: number; v: boolean[][] }

export type Fond = { matiere: string } | { asset: string; nom: string }

/** Le texte de génération d'une matière (TU5) : gardé dans **l'état du jeu en
 *  cours d'édition**, jamais dans la recette — la recette (`atelier/domaine/
 *  recette_tuiles.py`) ne connaît que la sorte, la taille, la graine, les
 *  emplacements et les réglages du moteur ; ce que l'auteur tape dans l'onglet
 *  « Générer » ne survit qu'à la session d'édition, comme le zoom ou le
 *  personnage affiché. `pierre` est commune à toutes les matières du jeu ;
 *  `motifs` et `cadrages` sont par emplacement, comme dans la maquette
 *  validée (`docs/maquettes-atelier-unifie/tuiles.js`). */
export type TexteMatieres = { pierre: string; motifs: Record<string, string>; cadrages: Record<string, string> }

/** Une matière en cours de fabrication, ou déjà arrivée — tenue sur le jeu
 *  pour survivre à un changement d'emplacement sans perdre les tirages en
 *  cours (la maquette les garde tous, quel que soit l'emplacement visé au
 *  moment de cliquer « Générer »). */
export type TirageMatiere = { identifiant: string; rang: number; statut: string; pourNom: string }

export type JeuEdite = {
  identifiant: string | null
  revision: number | null
  nom: string
  sorte: Sorte
  taille: number
  graine: number
  reglages: Reglages
  etat: EtatEmplacements
  /** L'asset posé sur un emplacement : le moteur ne garde que l'image. */
  assets: Record<string, string>
  fond: Fond
  carte: Carte | null
  texte: TexteMatieres
  tirages: TirageMatiere[]
  /** La palette de l'univers du projet (`Univers.palette`, des `#rrggbb`), pour la
   *  « palette du jeu » (TU6). **Tenue à jour par l'appelant** (`Tuiles.tsx`), qui seul
   *  connaît l'univers ouvert — ni `nouveauJeu` ni `jeuDepuisRecette` n'appellent le
   *  serveur. Vide, `reglages.paletteJeu` n'a aucun effet, et l'écran le dit. */
  paletteUnivers: readonly string[]
}

export const COLONNES = 18
export const LIGNES = 12

export const aSecondTerrain = (j: Pick<JeuEdite, "sorte" | "reglages">) => !!SORTES[j.sorte].dessous && j.reglages.secondTerrain === true

export function nouveauJeu({ nom, sorte, taille, graine }: { nom: string; sorte: Sorte; taille: number; graine: number }): JeuEdite {
  const d = DEFAUTS_SORTE[sorte]
  const etat = creerEtat()
  poserMatiere(etat, "surface", d.surface, taille, graine)
  if (d.face) poserMatiere(etat, "face", d.face, taille, graine)
  return { identifiant: null, revision: null, nom, sorte, taille, graine, reglages: reglagesParDefaut(sorte), etat, assets: {}, fond: { matiere: d.fond }, carte: carteDefaut(sorte),
    texte: { pierre: "", motifs: {}, cadrages: {} }, tirages: [], paletteUnivers: [] }
}

/** Les emplacements que l'écran montre, dans l'ordre de la maquette. */
export function emplacementsDe(j: Pick<JeuEdite, "sorte" | "reglages">): { id: string; nom: string; bord?: string }[] {
  if (SORTES[j.sorte].mur) return [{ id: "surface", nom: "Dessus", bord: "Bord du dessus" }, { id: "face", nom: "Face" }, { id: "fond", nom: "Sol au pied" }]
  const l: { id: string; nom: string; bord?: string }[] = [{ id: "surface", nom: j.sorte === "chemin" ? "Le chemin" : "Surface", bord: "Bordure" }]
  if (aSecondTerrain(j)) l.push({ id: "bas", nom: "Sol dessous", bord: "Sa bordure" })
  return l
}

export function nomCible(j: Pick<JeuEdite, "sorte" | "reglages">, cible: string): string {
  if (cible === "fond") return "Sol au pied"
  if (cible === "bordure") return SORTES[j.sorte].mur ? "Bord du dessus" : "Bordure"
  if (cible === "bordureBas") return "Bordure du sol dessous"
  return emplacementsDe(j).find((e) => e.id === cible)?.nom ?? cible
}

/** Les emplacements que la recette déclare pour ce jeu (`emplacements_actifs`). */
function emplacementsDeLaRecette(j: Pick<JeuEdite, "sorte" | "reglages">): string[] {
  const l = ["surface", "bordure"]
  if (j.sorte === "mur") l.push("face")
  if (A_MASQUES.includes(j.sorte) && j.reglages.secondTerrain === true) l.push("bas", "bordureBas")
  return l
}

// ── Poser une matière ────────────────────────────────────────────────────────

export function poserIntegree(j: JeuEdite, cible: string, matiere: string): void {
  if (cible === "fond") { j.fond = { matiere }; return }
  poserMatiere(j.etat, cible, matiere, j.taille, j.graine)
  const vraie = PAR_ID[cible].suit && j.etat[cible].lie ? PAR_ID[cible].suit! : cible
  delete j.assets[vraie]
  const paire = PAR_ID[vraie].bordure
  if (paire && j.etat[paire].lie) delete j.assets[paire]
}

/** Une image de la bibliothèque sur un emplacement. Elle délie la bordure : une
 *  bordure ne peut pas suivre une image, elle n'en a pas le contour — c'est la règle
 *  du moteur (`poserImage`) et celle du serveur. */
export function poserAsset(j: JeuEdite, cible: string, asset: string, nom: string, image: RGBAImage): void {
  if (cible === "fond") { j.fond = { asset, nom }; return }
  poserImage(j.etat, cible, image, nom, "import")
  j.assets[cible] = asset
}

export function delier(j: JeuEdite, bordure: string): void {
  relier(j.etat, bordure, false, j.taille, j.graine)
}

/** Relier n'a de sens que si la surface porte une matière intégrée : une image n'a pas
 *  de contour à prêter. */
export const peutRelier = (j: JeuEdite, bordure: string) => j.etat[PAR_ID[bordure].suit!].source !== "import"

export function relierBordure(j: JeuEdite, bordure: string): void {
  relier(j.etat, bordure, true, j.taille, j.graine)
  const parent = j.etat[PAR_ID[bordure].suit!]
  if (parent.source === "vide") vider(j.etat, bordure)
  delete j.assets[bordure]
}

export function changerSecondTerrain(j: JeuEdite, oui: boolean): void {
  j.reglages.secondTerrain = oui
  if (oui && j.etat.bas.source === "vide") poserMatiere(j.etat, "bas", "sable", j.taille, j.graine)
}

// ── La recette, dans les deux sens ───────────────────────────────────────────

export type SourceEmplacement =
  | { source: "integree"; nom: string; lie?: boolean }
  | { source: "asset"; asset: string; lie?: boolean }
  | { source: "vide"; lie?: boolean }
  | { source?: undefined; lie: true }
export type Recette = { sorte: Sorte; taille: number; graine: number; emplacements: Record<string, SourceEmplacement>; reglages: Reglages }

export function recetteDe(j: JeuEdite): Recette {
  const emplacements: Record<string, SourceEmplacement> = {}
  for (const id of emplacementsDeLaRecette(j)) {
    const e = j.etat[id]
    // Une bordure liée ne dit rien d'autre que son lien : le serveur la recopie de sa surface.
    if (PAR_ID[id].suit && e.lie) { emplacements[id] = { lie: true }; continue }
    const lien = PAR_ID[id].suit ? { lie: false } : {}
    emplacements[id] = e.source === "matiere" ? { source: "integree", nom: e.matiere, ...lien }
      : e.source !== "vide" && j.assets[id] ? { source: "asset", asset: j.assets[id], ...lien }
      : { source: "vide", ...lien }
  }
  const reglages: Reglages = {}
  for (const [nom, v] of Object.entries(j.reglages)) {
    const conn = REGLAGES_DE_L_ECRAN[nom]
    if (conn?.sortes && !conn.sortes.includes(j.sorte)) continue
    reglages[nom] = v
  }
  return { sorte: j.sorte, taille: j.taille, graine: j.graine, emplacements, reglages }
}

/** Les assets qu'une recette nomme : il faut leurs pixels avant de rendre. */
export const assetsDeLaRecette = (r: Recette) => Object.values(r.emplacements).flatMap((e) => (e.source === "asset" ? [e.asset] : []))

export function jeuDepuisRecette(
  { identifiant, revision, nom, recette: r, carte }: { identifiant: string | null; revision: number | null; nom: string; recette: Recette; carte?: CarteServeur | null },
  images: Map<string, RGBAImage>, nomsDAssets: Record<string, string> = {},
): JeuEdite {
  const etat = creerEtat()
  const assets: Record<string, string> = {}
  const poser = (id: string, e: SourceEmplacement) => {
    if (e.source === "integree") poserMatiere(etat, id, e.nom, r.taille, r.graine)
    else if (e.source === "asset") {
      const image = images.get(e.asset)
      if (image) { poserImage(etat, id, image, nomsDAssets[e.asset] ?? "Image du jeu", "import"); assets[id] = e.asset }
    } else vider(etat, id)
  }
  const surfaces = ["surface", "face", "bas"], bordures = ["bordure", "bordureBas"]
  for (const id of surfaces) if (r.emplacements[id]) poser(id, r.emplacements[id])
  for (const id of bordures) {
    const e = r.emplacements[id]
    if (!e) continue
    if (e.lie) { relier(etat, id, true, r.taille, r.graine); continue }
    relier(etat, id, false, r.taille, r.graine)
    poser(id, e)
  }
  const d = DEFAUTS_SORTE[r.sorte]
  const j: JeuEdite = { identifiant, revision, nom, sorte: r.sorte, taille: r.taille, graine: r.graine, reglages: { ...r.reglages }, etat, assets, fond: { matiere: d.fond }, carte: null,
    texte: { pierre: "", motifs: {}, cadrages: {} }, tirages: [], paletteUnivers: [] }
  j.carte = carte ? depuisCarteServeur(j, carte) : carteDefaut(r.sorte)
  return j
}

// ── Les cartes ───────────────────────────────────────────────────────────────

const ovale = (x: number, y: number, cols: number, rows: number) =>
  Math.hypot((x - cols / 2) / (cols * 0.33), (y - rows / 2) / (rows * 0.34)) + Math.sin(x * 1.7) * 0.08 + Math.cos(y * 2.1) * 0.08 <= 1
const vide = (c: number, r: number) => Array.from({ length: r }, () => Array<boolean>(c).fill(false))
const enCases = (columns: number, rows: number, f: (x: number, y: number) => boolean): Carte =>
  ({ kind: "cases", columns, rows, grid: Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => !!f(x, y))) })
const enSommets = (columns: number, rows: number, f: (x: number, y: number) => boolean): Carte =>
  ({ kind: "sommets", columns, rows, v: Array.from({ length: rows + 1 }, (_, y) => Array.from({ length: columns + 1 }, (_, x) => !!f(x, y))) })
function traits(columns: number, rows: number, segments: number[][]): Carte {
  const g = vide(columns, rows)
  for (const [x0, y0, x1, y1] of segments)
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (g[y] && x >= 0 && x < columns) g[y][x] = true
  return { kind: "cases", columns, rows, grid: g }
}
function piece(g: boolean[][], l: number, t: number, r: number, b: number, porte?: number[]) {
  for (let x = l; x <= r; x++) { g[t][x] = true; if (!porte || !porte.includes(x)) g[b][x] = true }
  for (let y = t; y <= b; y++) { g[y][l] = true; g[y][r] = true }
}

export function carteDefaut(sorte: Sorte): Carte | null {
  if (sorte === "sol") return enCases(COLONNES, LIGNES, (x, y) => ovale(x + 0.5, y + 0.5, COLONNES, LIGNES))
  if (sorte === "chemin") return traits(COLONNES, LIGNES, [[1, 7, 16, 7], [5, 1, 5, 7], [5, 3, 9, 3], [12, 7, 12, 11]])
  if (sorte === "mur") { const g = vide(COLONNES, LIGNES); piece(g, 3, 4, 14, 10, [8, 9]); return { kind: "cases", columns: COLONNES, rows: LIGNES, grid: g } }
  if (sorte === "coins-15") return enSommets(COLONNES, LIGNES, (x, y) => ovale(x, y, COLONNES, LIGNES))
  return null
}

export function carteApercu(sorte: Sorte): Carte | null {
  if (sorte === "sol") return enCases(9, 5, (x, y) => ovale(x + 0.5, y + 0.5, 7, 5) || Math.hypot(x - 7.6, y - 1.2) < 1.3)
  if (sorte === "chemin") return traits(9, 5, [[0, 3, 8, 3], [5, 0, 5, 3], [2, 1, 5, 1]])
  if (sorte === "mur") { const g = vide(9, 5); piece(g, 1, 2, 7, 3, [4]); return { kind: "cases", columns: 9, rows: 5, grid: g } }
  if (sorte === "coins-15") return enSommets(9, 5, (x, y) => ovale(x, y, 9, 5))
  return null
}

/** Le mur monte de `hauteur` cases au-dessus de son pied et pose son ombre une case en
 *  dessous : la carte s'agrandit plutôt que de rogner le haut du mur. Idempotent. */
export function margeMur(carte: Carte, hauteur: number): void {
  if (carte.kind !== "cases") return
  const haut = carte.grid.findIndex((l) => l.some(Boolean))
  if (haut >= 0 && haut < hauteur) for (let i = 0; i < hauteur - haut; i++) carte.grid.unshift(Array<boolean>(carte.columns).fill(false))
  let bas = 0
  for (let y = carte.grid.length - 1; y >= 0 && !carte.grid[y].some(Boolean); y--) bas++
  if (carte.grid.some((l) => l.some(Boolean)) && bas < 1) carte.grid.push(Array<boolean>(carte.columns).fill(false))
  carte.rows = carte.grid.length
}

export function ileAuHasard(j: JeuEdite, graine: number): Carte | null {
  const r = mulberry32(graine)
  if (j.sorte === "sol" || j.sorte === "coins-15") {
    const disques = Array.from({ length: 4 + Math.floor(r() * 4) }, () => ({ x: 3 + r() * (COLONNES - 6), y: 2.5 + r() * (LIGNES - 5), r: 1.5 + r() * 2.2 }))
    const dedans = (x: number, y: number) => disques.some((d) => Math.hypot(x - d.x, y - d.y) <= d.r)
    return j.sorte === "coins-15" ? enSommets(COLONNES, LIGNES, dedans) : enCases(COLONNES, LIGNES, (x, y) => dedans(x + 0.5, y + 0.5))
  }
  if (j.sorte === "chemin") {
    const g = vide(COLONNES, LIGNES)
    for (let k = 0; k < 3; k++) {
      let x = Math.floor(r() * COLONNES), y = Math.floor(r() * LIGNES), dir = Math.floor(r() * 4)
      for (let pas = 0; pas < 34; pas++) {
        g[y][x] = true
        if (r() < 0.22) dir = (dir + (r() < 0.5 ? 1 : 3)) % 4
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][dir]
        const nx = x + dx, ny = y + dy
        if (nx < 1 || ny < 1 || nx >= COLONNES - 1 || ny >= LIGNES - 1) { dir = (dir + 2) % 4; continue }
        x = nx; y = ny
      }
    }
    return { kind: "cases", columns: COLONNES, rows: LIGNES, grid: g }
  }
  if (j.sorte === "mur") {
    const hauteur = Number(j.reglages.hauteurMur) || 2
    const g = vide(COLONNES, LIGNES), n = 1 + Math.floor(r() * 2)
    for (let k = 0; k < n; k++) {
      const w = 4 + Math.floor(r() * 7), h = 3 + Math.floor(r() * 3)
      const l = 1 + Math.floor(r() * (COLONNES - w - 2)), t = hauteur + Math.floor(r() * Math.max(1, LIGNES - h - hauteur - 2))
      const porte = l + 1 + Math.floor(r() * (w - 2))
      piece(g, l, Math.min(t, LIGNES - h - 2), l + w, Math.min(t, LIGNES - h - 2) + h, [porte])
    }
    return { kind: "cases", columns: COLONNES, rows: LIGNES, grid: g }
  }
  return null
}

export function toutEffacer(carte: Carte): void {
  if (carte.kind === "sommets") carte.v.forEach((l) => l.fill(false))
  else carte.grid.forEach((l) => l.fill(false))
}

export const copieCarte = (c: Carte | null): Carte | null =>
  !c ? null : c.kind === "cases" ? { ...c, grid: c.grid.map((l) => [...l]) } : { ...c, v: c.v.map((l) => [...l]) }

export function casesPosees(carte: Carte | null): number {
  if (!carte) return 0
  return (carte.kind === "sommets" ? carte.v : carte.grid).flat().filter(Boolean).length
}

// ── La carte, telle que le serveur la garde ──────────────────────────────────

export type CarteServeur = { largeur: number; hauteur: number; cases: { x: number; y: number; tuile_x: number; tuile_y: number }[] }

const jeuDeMasques = (id: JeuDeMasques) => TILE_MASK_SETS[id] as MaskSet
const grilleNum = (g: boolean[][]) => g as unknown as number[][]
const CASE_DESSOUS = BLOB_LOWER_CELL as { col: number; row: number }

/** Le masque d'une case de la carte, ou la case de l'atlas qui la remplit, ou rien. */
function masqueDe(j: Pick<JeuEdite, "sorte" | "reglages">, carte: Carte, x: number, y: number): number | { col: number; row: number } | null {
  const S = SORTES[j.sorte], dessous = aSecondTerrain(j)
  if (carte.kind === "sommets") {
    const v = carte.v
    const m = (v[y][x] ? CORNER_BITS.TL : 0) | (v[y][x + 1] ? CORNER_BITS.TR : 0) | (v[y + 1][x] ? CORNER_BITS.BL : 0) | (v[y + 1][x + 1] ? CORNER_BITS.BR : 0)
    return m === 0 && !dessous ? null : m
  }
  if (carte.grid[y][x]) return cellMaskAt(S.mur ? "B47" : S.set!, grilleNum(carte.grid), x, y)
  return S.set === "B47" && dessous ? CASE_DESSOUS : null
}

/** La carte peinte, en pièces posées. Pour un mur, c'est son emprise, chaque case avec
 *  son dessus brut : le serveur en déduit la pose complète à la livraison
 *  (atelier/domaine/pose_mur.py, portage de la scène du moteur, TU7). */
export function versCarteServeur(j: JeuEdite): CarteServeur {
  const carte = copieCarte(j.carte)
  if (!carte) return { largeur: COLONNES, hauteur: LIGNES, cases: [] }
  if (SORTES[j.sorte].mur) margeMur(carte, Number(j.reglages.hauteurMur) || 2)
  const set = jeuDeMasques(SORTES[j.sorte].mur ? "B47" : SORTES[j.sorte].set!)
  const cases: CarteServeur["cases"] = []
  for (let y = 0; y < carte.rows; y++) for (let x = 0; x < carte.columns; x++) {
    const m = masqueDe(j, carte, x, y)
    if (m === null) continue
    const p = typeof m === "number" ? atlasPosition(set, m) : m
    cases.push({ x, y, tuile_x: p.col, tuile_y: p.row })
  }
  return { largeur: carte.columns, hauteur: carte.rows, cases }
}

/** Le chemin inverse. Il ne perd rien : une case peinte porte une pièce, une pièce
 *  porte son masque, un masque de coins porte ses quatre sommets. */
export function depuisCarteServeur(j: Pick<JeuEdite, "sorte" | "reglages">, c: CarteServeur): Carte | null {
  const S = SORTES[j.sorte]
  if (!S.set && !S.mur) return null
  if (S.set === "W16") {
    const set = jeuDeMasques("W16")
    const v = Array.from({ length: c.hauteur + 1 }, () => Array<boolean>(c.largeur + 1).fill(false))
    for (const k of c.cases) {
      const m = maskAtPosition(set, k.tuile_x, k.tuile_y) ?? 0
      if (m & CORNER_BITS.TL) v[k.y][k.x] = true
      if (m & CORNER_BITS.TR) v[k.y][k.x + 1] = true
      if (m & CORNER_BITS.BL) v[k.y + 1][k.x] = true
      if (m & CORNER_BITS.BR) v[k.y + 1][k.x + 1] = true
    }
    return { kind: "sommets", columns: c.largeur, rows: c.hauteur, v }
  }
  const grid = vide(c.largeur, c.hauteur)
  for (const k of c.cases) {
    if (S.set === "B47" && k.tuile_x === CASE_DESSOUS.col && k.tuile_y === CASE_DESSOUS.row) continue
    grid[k.y][k.x] = true
  }
  return { kind: "cases", columns: c.largeur, rows: c.hauteur, grid }
}

// ── Le rendu de la planche, mis en cache par recette ─────────────────────────

const idsImages = new WeakMap<object, number>()
let prochaineImage = 0
const idImage = (im: object | null | undefined) => {
  if (!im) return 0
  if (!idsImages.has(im)) idsImages.set(im, ++prochaineImage)
  return idsImages.get(im)!
}

// ── La palette commune, et la palette du jeu (TU6) ───────────────────────────
//
// Les deux passent par le même mécanisme que la « palette de référence désignée » de
// sc-clone (T31, `resolvePalette`/`appliquerPalette` dans `vendor/tileset-engine.js`) :
// un descripteur Lab posé APRÈS la réduction, sur les cinq textures d'un coup — c'est
// le moteur qui tient cet ordre (§ « T31 — la palette de référence » du fichier), pas
// ce module. Aucune des deux ne touche au chemin `palette: null` d'avant cette tranche
// quand elle ne s'applique pas : c'est ce qui garde le rendu identique au bit près à
// celui de TU3 quand les deux réglages sont éteints.

/** Une image 1×N, une couleur par pixel : le seul moyen de faire passer une palette
 *  déjà connue (celle de l'univers, en `#rrggbb`) par le même relevé Lab pondéré que la
 *  référence désignée — plutôt qu'un second chemin de quantification à côté de celui du
 *  moteur. Poids égaux, alpha plein : chaque couleur de l'univers compte pour elle-même. */
function imageDePalette(hex: readonly string[]): RGBAImage {
  const data = new Uint8ClampedArray(Math.max(1, hex.length) * 4)
  hex.forEach((h, i) => { const c = hexToRgb(h); data[i * 4] = c.r; data[i * 4 + 1] = c.g; data[i * 4 + 2] = c.b; data[i * 4 + 3] = 255 })
  return { width: Math.max(1, hex.length), height: 1, data }
}

/** Le descripteur de palette à passer au moteur (`settings.palette`), ou `null` — rien
 *  ne bouge. `paletteJeu` gagne dès que l'univers a une palette : « une référence
 *  désignée remplace la palette commune » (T31). Sinon, `memesCouleurs` (coché par
 *  défaut) ramène toutes les matières sur les ≤24 couleurs de la première — la surface,
 *  le sol — et rien tant qu'elle n'a pas de texture à lire (couleur provisoire seule). */
function paletteDuRendu(j: Pick<JeuEdite, "reglages" | "paletteUnivers">, surfaceTexture: RGBAImage | null): unknown {
  if (j.reglages.paletteJeu === true && j.paletteUnivers.length) return paletteDeReferenceLab([imageDePalette(j.paletteUnivers)], j.paletteUnivers.length)
  if (j.reglages.memesCouleurs === false || !surfaceTexture) return null
  return paletteDeReferenceLab([surfaceTexture], NOMBRE_COULEURS)
}

export function reglagesMoteur(j: JeuEdite): Record<string, unknown> & { tilesetType: string; tileSize: number; seed: number } {
  const s = j.taille, r = j.reglages, S = SORTES[j.sorte], masques = !!S.set && S.type !== "topdown-17"
  rafraichirMatieres(j.etat, s, j.graine)
  const tex = texturesDe(j.etat)
  const n = (cle: string, defaut: number) => (typeof r[cle] === "number" ? (r[cle] as number) : defaut)
  return {
    tilesetType: S.type, tileSize: s, cornerRadius: n("arrondi", 2) * s / 32, edgeStyle: r.bordures === "nettes" ? "clean" : "rough",
    edgeRoughness: n("irregularite", 3) * s / 32, edgeFrequency: 5, edgePadding: 2 * s / 16,
    baseColor: couleur(r, "couleurSurface"), edgeColor: couleur(r, "couleurContour"), edgeFade: 3 * s / 32,
    shades: n("nuances", 4), textureNoise: 12, fleckAmount: 6, seed: j.graine, relief: n("relief", 4) / 10,
    reductionMode: (r.reduction as string) || "contraste", palette: paletteDuRendu(j, tex.surfaceTexture),
    wallShadowAlpha: NIVEAUX_OMBRE[String(r.ombreMur ?? "discrete")] ?? 110, wallCornerOcclusion: NIVEAUX_PENOMBRE[String(r.penombre ?? "discrete")] ?? 50,
    whiteBackground: r.fondBlanc === true, showGrid: false, pixelFlecks: true,
    variants: masques ? n("variantes", 0) : 0, texturePhase: j.etat.surface.source === "matiere" && tolerePhase(j.etat.surface.matiere),
    decor: masques || S.mur ? (r.decor as string) || "aucun" : "aucun",
    animatedFrames: masques ? n("animation", 0) : 0, animatedAtlasCopies: masques ? n("animationAtlas", 0) : 0,
    surfaceTexture: tex.surfaceTexture, edgeTexture: tex.edgeTexture, faceTexture: S.mur ? tex.faceTexture : null,
    lowerTerrain: aSecondTerrain(j) ? { baseColor: couleur(r, "couleurDessous"), edgeColor: couleur(r, "couleurContourDessous"), surfaceTexture: tex.lowerSurfaceTexture, edgeTexture: tex.lowerEdgeTexture } : null,
  }
}

export type Atlas = { canvas: CanvasLike; pixels: RGBAImage; cle: string; duree: number }
const cacheAtlas = new Map<string, Atlas>()

/** Le moteur peint sa planche par un seul `putImageData` : on prend ces pixels-là,
 *  tels quels, plutôt que de les relire du canevas (prémultiplication). */
function rendre(s: ReturnType<typeof reglagesMoteur>): { canvas: CanvasLike; pixels: RGBAImage } {
  const Proto = typeof CanvasRenderingContext2D !== "undefined" ? CanvasRenderingContext2D.prototype : null
  const original = Proto?.putImageData
  let pris: RGBAImage | null = null
  if (Proto && original) Proto.putImageData = function (this: CanvasRenderingContext2D, ...args: unknown[]) { pris = args[0] as RGBAImage; return (original as (...a: unknown[]) => void).apply(this, args) } as typeof original
  let canvas: CanvasLike
  try { canvas = renderLogical(s) } finally { if (Proto && original) Proto.putImageData = original }
  const pixels = pris ?? canvas.imageData ?? lirePixels(canvas)
  return { canvas, pixels: { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) } }
}

function lirePixels(canvas: CanvasLike): RGBAImage {
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export function atlasDe(j: JeuEdite): Atlas {
  const s = reglagesMoteur(j)
  const lt = s.lowerTerrain as { surfaceTexture: object | null; edgeTexture: object | null } | null
  const cle = JSON.stringify({ ...s, surfaceTexture: idImage(s.surfaceTexture as object), edgeTexture: idImage(s.edgeTexture as object), faceTexture: idImage(s.faceTexture as object),
    lowerTerrain: lt && { ...lt, surfaceTexture: idImage(lt.surfaceTexture), edgeTexture: idImage(lt.edgeTexture) } })
  let atlas = cacheAtlas.get(cle)
  if (!atlas) {
    const t0 = performance.now()
    const { canvas, pixels } = rendre(s)
    atlas = { canvas, pixels, cle, duree: performance.now() - t0 }
    cacheAtlas.set(cle, atlas)
    if (cacheAtlas.size > 40) cacheAtlas.delete(cacheAtlas.keys().next().value!)
  }
  return atlas
}

/** Vider le cache — pour qu'un essai mesure un vrai rendu, pas une lecture. */
export const oublierLesRendus = () => cacheAtlas.clear()

// ── Peindre la carte ─────────────────────────────────────────────────────────

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
export const enHex = ({ r, g, b }: { r: number; g: number; b: number }) => "#" + hex2(r) + hex2(g) + hex2(b)

export function imageDuFond(j: JeuEdite, images: Map<string, RGBAImage>): { image: RGBAImage; couleur: string } {
  const f = j.fond
  if ("asset" in f) {
    const im = images.get(f.asset)
    if (im) {
      let r = 0, g = 0, b = 0
      const n = im.data.length / 4
      for (let i = 0; i < im.data.length; i += 4) { r += im.data[i]; g += im.data[i + 1]; b += im.data[i + 2] }
      return { image: echantillonner(im, j.taille), couleur: enHex({ r: r / n, g: g / n, b: b / n }) }
    }
  }
  const m = "matiere" in f ? f.matiere : DEFAUTS_SORTE[j.sorte].fond
  return { image: rendreMatiere(m, j.taille, j.graine).surface, couleur: enHex(couleurMoyenne(m)) }
}

/** Une image ramenée à `taille` × `taille` au plus proche voisin — le fond de carte. */
function echantillonner(im: RGBAImage, taille: number): RGBAImage {
  const data = new Uint8ClampedArray(taille * taille * 4)
  for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) {
    const sx = Math.floor(x * im.width / taille), sy = Math.floor(y * im.height / taille)
    data.set(im.data.subarray((sy * im.width + sx) * 4, (sy * im.width + sx) * 4 + 4), (y * taille + x) * 4)
  }
  return { width: taille, height: taille, data }
}

/** Un canevas prêt à dessiner, fait de pixels. */
export function versCanvas(img: RGBAImage): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext("2d") as unknown as CanvasContext2DLike
  const d = ctx.createImageData(img.width, img.height)
  d.data.set(img.data)
  ctx.putImageData(d, 0, 0)
  return c
}

const DESC_MUR = descripteurScene(wallAtlasDescriptor, WALL_BAND_STATES)
type DescVariantes = { mask: number; variants: { col: number; row: number }[] } | null
type DescAnimation = { col: number; row: number; rowStride: number; count: number; frameDurationMs: number; frames: { col: number; row: number }[] }
type DescDecor = { density: string; cells: { col: number; row: number; orientation: string }[] } | null
const variantesDe = variantAtlasDescriptor as (type: string, n: number) => DescVariantes
const animationDe = animationAtlasDescriptor as (type: string, n: number, v: number) => DescAnimation
const decorDe = decorAtlasDescriptor as (type: string, decor: string, v: number, f: number, c: number) => DescDecor

export const dureeImageAnimation = (j: JeuEdite) => {
  const S = SORTES[j.sorte], n = Number(j.reglages.animation) || 0
  return S.set && n > 0 ? animationDe(S.type, n, Number(j.reglages.variantes) || 0).frameDurationMs : 0
}

export type Survol = { x: number; y: number } | null

/** Peint la carte dans `canvas`. Avec un vrai contexte 2D, par `drawImage` ; sans lui
 *  (les essais, sous jsdom), pixel par pixel puis un seul `putImageData`. Les deux
 *  peintres sont ceux du moteur (`peintreCanvas`, `peintrePixels`). */
export function dessinerCarte(
  canvas: HTMLCanvasElement, j: JeuEdite, atlas: Atlas, carte: Carte, zoom: number,
  { image = 0, heros = false, survol = null, fond }: { image?: number; heros?: boolean; survol?: Survol; fond: { image: RGBAImage; couleur: string } },
): void {
  const S = SORTES[j.sorte], s = j.taille, r = j.reglages
  const hauteur = Number(r.hauteurMur) || 2
  if (S.mur) margeMur(carte, hauteur)
  const cols = carte.columns, rows = carte.rows
  canvas.width = cols * s * zoom
  canvas.height = rows * s * zoom
  const masques = !!S.set && S.type !== "topdown-17"
  const variantes = masques ? Number(r.variantes) || 0 : 0, images = masques ? Number(r.animation) || 0 : 0
  const vd = masques ? variantesDe(S.type, variantes) : null
  const dd = decorDe(S.type, masques || S.mur ? String(r.decor ?? "aucun") : "aucun", variantes, images, 0)
  const ad = images > 0 ? animationDe(S.type, images, variantes) : null
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D & CanvasContext2DLike
  const natif = typeof (ctx as { drawImage?: unknown }).drawImage === "function"
  let tampon: RGBAImage | null = null
  const peintre = natif
    ? peintreCanvas(ctx, atlas.canvas as unknown as RGBAImage, zoom)
    : peintrePixels((tampon = ctx.createImageData(canvas.width, canvas.height)), atlas.pixels, zoom)
  dessinerScene(peintre, {
    tile: s, colonnes: cols, lignes: rows,
    set: S.mur ? null : S.set, masqueDe: S.mur ? () => null : (x: number, y: number) => masqueDe(j, carte, x, y),
    mur: S.mur && carte.kind === "cases" ? { hauteur, grille: carte.grid, descripteur: DESC_MUR } : null,
    sol: { couleur: fond.couleur, motif: natif ? versCanvas(fond.image) : fond.image },
    animation: ad ? { col: ad.col, row: ad.row, pas: ad.rowStride, images: ad.count, duree: ad.frameDurationMs } : null, image,
    variants: vd ? { mask: vd.mask, count: vd.variants.length, list: vd.variants, seed: j.graine } : null,
    decor: dd ? { descripteur: dd, densite: dd.density, graine: j.graine } : null,
    heros: heros ? { x: cols * 0.7, y: rows * 0.62, image: 0 } : null, reperes: false,
  })
  if (tampon) ctx.putImageData(tampon, 0, 0)
  if (survol && natif) {
    const t = s * zoom
    ctx.save()
    ctx.lineWidth = 2
    ctx.strokeStyle = jeton("--color-encre-sur-signal")
    if (carte.kind === "sommets") { ctx.beginPath(); ctx.arc(survol.x * t, survol.y * t, Math.max(4, t / 8), 0, Math.PI * 2); ctx.stroke() }
    else {
      if (S.mur) { ctx.setLineDash([4, 4]); ctx.strokeRect(survol.x * t + 1, (survol.y - hauteur) * t + 1, t - 2, hauteur * t); ctx.setLineDash([]) }
      ctx.strokeRect(survol.x * t + 1, survol.y * t + 1, t - 2, t - 2)
    }
    ctx.restore()
  }
}

/** Un jeton de couleur de `index.css`, lu tel quel — le canevas n'a pas de classes. */
export function jeton(nom: string): string {
  if (typeof document === "undefined") return "black"
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || "black"
}

/** La planche entière, agrandie de `k`, avec la grille des pièces. */
export function dessinerPlanche(canvas: HTMLCanvasElement, j: JeuEdite, atlas: Atlas, k: number, surPiece: { col: number; row: number } | null): void {
  const s = j.taille, a = atlas.pixels
  canvas.width = a.width * k
  canvas.height = a.height * k
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D
  if (typeof ctx.drawImage !== "function") return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(atlas.canvas as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = jeton("--color-encre-4")
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= a.width; x += s) { ctx.moveTo(x * k + 0.5, 0); ctx.lineTo(x * k + 0.5, canvas.height) }
  for (let y = 0; y <= a.height; y += s) { ctx.moveTo(0, y * k + 0.5); ctx.lineTo(canvas.width, y * k + 0.5) }
  ctx.stroke()
  ctx.globalAlpha = 1
  if (surPiece) { ctx.lineWidth = 2; ctx.strokeStyle = jeton("--color-encre"); ctx.strokeRect(surPiece.col * s * k + 1, surPiece.row * s * k + 1, s * k - 2, s * k - 2) }
}

/** La planche seule, agrandie de `k`, sans grille — celle qui part dans le jeu. */
export function dessinerAtlas(canvas: HTMLCanvasElement, atlas: Atlas, k: number): void {
  canvas.width = atlas.pixels.width * k
  canvas.height = atlas.pixels.height * k
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D
  if (typeof ctx.drawImage !== "function") return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(atlas.canvas as unknown as CanvasImageSource, 0, 0, canvas.width, canvas.height)
}

/** Une vignette : l'image répétée deux fois dans chaque sens, pour qu'on voie qu'elle
 *  se raccorde. */
export function dessinerVignette(canvas: HTMLCanvasElement, img: RGBAImage | null): void {
  if (!img) return
  canvas.width = img.width * 2
  canvas.height = img.height * 2
  const ctx = canvas.getContext("2d") as unknown as CanvasContext2DLike
  const d = ctx.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    const sy = y % img.height
    for (let x = 0; x < canvas.width; x++) {
      const i = (sy * img.width + (x % img.width)) * 4
      d.data.set(img.data.subarray(i, i + 4), (y * canvas.width + x) * 4)
    }
  }
  ctx.putImageData(d, 0, 0)
}

// ── Vérifier (tile-check, pour de vrai) ──────────────────────────────────────

export type Verification = { rien: true } | { rien?: false; defauts: string[]; pieces: number }

export function verifier(j: JeuEdite, atlas: Atlas): Verification {
  const S = SORTES[j.sorte]
  if (!S.set && !S.mur) return { rien: true }
  const img = { data: atlas.pixels.data, width: atlas.pixels.width, height: atlas.pixels.height, tile: j.taille }
  let defauts = (S.mur
    ? checkWallAtlas(img, { WALL_TOP_ROWS, WALL_BAND_STATES, biais: (biaisAtlasDescriptor as (t: string) => unknown)("wall") })
    : checkMaskSetAtlas(img, jeuDeMasques(S.set!))) as unknown as string[]
  // Le contrôle ne connaît pas le sol dessous : la case que le moteur lui réserve (la
  // 48ᵉ du blob, le masque 0 des 15 pièces) est peinte exprès (TU9 le corrigera).
  if (aSecondTerrain(j)) {
    const libre = `case libre (${CASE_DESSOUS.col}, ${CASE_DESSOUS.row})`
    defauts = defauts.filter((p) => !(S.set === "B47" && p.includes(libre)) && !(S.set === "W16" && /masque 0\b.*aucun coin/.test(p)))
  }
  return { defauts, pieces: nombrePieces(j.sorte) }
}

export function enClair(p: string): string {
  if (/couture|diffère/.test(p)) return "Deux pièces voisines ne se raccordent pas : leur bord commun ne tombe pas au même endroit."
  if (/entièrement transparent/.test(p)) return "Une pièce est vide : rien n’y est dessiné."
  if (/devrait rester transparente/.test(p)) return "Une case qui doit rester vide est dessinée."
  if (/diagonale/.test(p)) return "Une pièce en biais ne va pas d’un coin à l’autre."
  return "Un autre défaut : voir le détail."
}

// ── Le nom d'une pièce de la planche ─────────────────────────────────────────

const liste = (mots: string[]) => (mots.length < 2 ? mots.join("") : mots.slice(0, -1).join(", ") + " et " + mots[mots.length - 1])
const COTES: Record<string, string> = { N: "le nord", E: "l’est", S: "le sud", W: "l’ouest" }
const COINS: Record<string, string> = { NE: "nord-est", SE: "sud-est", SW: "sud-ouest", NW: "nord-ouest" }
function nomBlob(m: number): string {
  const a = (k: keyof typeof NEIGHBOUR_BITS) => (m & NEIGHBOUR_BITS[k]) !== 0
  if (m === 255) return "Pleine : entourée de tous côtés"
  const cotes = (["N", "E", "S", "W"] as const).filter(a)
  if (!cotes.length) return "Seule : aucune voisine"
  const rentrants = ([["NE", "N", "E"], ["SE", "S", "E"], ["SW", "S", "W"], ["NW", "N", "W"]] as const).filter(([d, x, y]) => a(x) && a(y) && !a(d)).map(([d]) => COINS[d])
  return "Continue vers " + liste(cotes.map((k) => COTES[k])) + (rentrants.length ? " · coin rentrant au " + liste(rentrants) : "")
}
function nomChemin(m: number): string {
  const c = (["N", "E", "S", "W"] as const).filter((k) => (m & SIDE_BITS[k]) !== 0), n: Record<string, string> = { N: "nord", E: "est", S: "sud", W: "ouest" }
  if (!c.length) return "Seule : aucun chemin ne part"
  if (c.length === 1) return "Bout de chemin, ouvert vers " + COTES[c[0]]
  if (c.length === 4) return "Croisement"
  if (c.length === 3) return "Embranchement, fermé vers " + COTES[(["N", "E", "S", "W"] as const).find((k) => !c.includes(k))!]
  const droit = (c.includes("N") && c.includes("S")) || (c.includes("E") && c.includes("W"))
  return (droit ? "Ligne droite " : "Virage ") + c.map((k) => n[k]).join("–")
}
function nomCoins(m: number): string {
  if (m === 15) return "Pleine"
  const n = { TL: "en haut à gauche", TR: "en haut à droite", BL: "en bas à gauche", BR: "en bas à droite" } as const
  const c = (Object.keys(n) as (keyof typeof n)[]).filter((k) => (m & CORNER_BITS[k]) !== 0)
  return c.length ? "Coins remplis : " + liste(c.map((k) => n[k])) : "Vide"
}
const ETATS_MUR: Record<string, string> = { isolated: "seule", "left-end": "bout gauche", middle: "milieu", "right-end": "bout droit", "flank-left": "flanc gauche, pas posée", "flank-right": "flanc droit, pas posée", "corner-left": "angle gauche", "corner-right": "angle droit" }
const BANDES: Record<string, string> = { top: "Dessus", face: "Face", base: "Pied (bloque le passage)", shadow: "Ombre au sol", pente: "Pente du dessus", decor: "Gravats" }

export function nomPiece(j: JeuEdite, col: number, row: number): string {
  const S = SORTES[j.sorte], r = j.reglages
  const vide = "Case vide : rien à poser"
  if (S.mur) {
    const c = murDescripteur({ decor: String(r.decor ?? "aucun") }).cells.find((x) => x.col === col && x.row === row)
    if (!c) return vide
    if (c.band === "top") return c.state === null ? vide : "Dessus · " + nomBlob(c.state as number)
    if (c.band === "decor") return "Gravats · appui " + c.orientation
    if (c.sens) return "En biais vers la " + c.sens + " · " + (BANDES[c.band] || c.band).toLowerCase()
    return c.state ? `${BANDES[c.band] || c.band} · ${ETATS_MUR[String(c.state)] || c.state}` : vide
  }
  const L = TILESET_LAYOUTS[S.type]
  if (!S.set) return "Pièce " + (row * L.columns + col + 1) + ", à poser à la main"
  if (row < L.rows) {
    const m = maskAtPosition(jeuDeMasques(S.set), col, row)
    if (m === null || m === undefined) return aSecondTerrain(j) && S.set === "B47" && col === CASE_DESSOUS.col && row === CASE_DESSOUS.row ? "Le sol dessous, seul" : vide
    return S.set === "B47" ? nomBlob(m) : S.set === "E16" ? nomChemin(m) : nomCoins(m)
  }
  const variantes = Number(r.variantes) || 0, images = Number(r.animation) || 0
  const vd = variantesDe(S.type, variantes)
  if (vd && vd.variants.some((v) => v.col === col && v.row === row)) return `Variante ${col + 1} de la pièce pleine`
  const ad = images > 0 ? animationDe(S.type, images, variantes) : null
  const i = ad ? ad.frames.findIndex((f) => f.col === col && f.row === row) : -1
  if (i > 0) return `Image ${i + 1} de l’animation de la pièce pleine`
  const dd = decorDe(S.type, String(r.decor ?? "aucun"), variantes, images, 0)
  const d = dd && dd.cells.find((x) => x.col === col && x.row === row)
  if (d) return "Gravats · appui " + d.orientation
  return vide
}

export const nomDeMatiere = (id: string) => MATIERES[id]?.nom ?? id

/** La taille par défaut d'un jeu neuf : celle de l'univers quand il est en pixel art
 *  et qu'elle est une taille de pièce, sinon 32. */
export function tailleDeLUnivers(univers: { style?: string; cible_px?: number } | null | undefined): number {
  const c = univers?.cible_px
  return univers?.style === "pixel" && (c === 16 || c === 32 || c === 64) ? c : 32
}
