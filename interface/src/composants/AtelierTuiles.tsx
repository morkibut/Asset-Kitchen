import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react"
import { api, type ApercuLivraison } from "../api"
import { tuiles, type EnsembleTuiles } from "../api-tuiles"
import {
  LISTE_MATIERES, PAR_ID, SORTES, atlasDe, carteApercu, casesPosees, changerSecondTerrain, dessinerAtlas, dessinerCarte, dessinerPlanche,
  dessinerVignette, delier, dureeImageAnimation, emplacementsDe, enClair, ileAuHasard, imageDuFond, jeuDepuisRecette,
  nombrePieces, nomCible, nomDeMatiere, nomPiece, nouveauJeu, peutRelier, poserAsset, poserIntegree, recetteDe,
  relierBordure, toutEffacer, verifier, aSecondTerrain,
  type Atlas, type JeuEdite, type Sorte, type Survol,
} from "../tuiles/atelier"
import type { RGBAImage } from "../tuiles/moteur/types"

/** Une matière du jeu : l'image d'un sujet de nature « matière » (`TU2`). */
export type MatiereDuJeu = { identifiant: string; nom: string }

export const BOUTON = "min-h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle transition-colors duration-120 hover:border-encre-3 disabled:opacity-50"
export const PRINCIPAL = `${BOUTON} border-encre-controle font-medium`
export const LIEN = "text-[13px] text-encre-2 underline underline-offset-2 hover:text-encre"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"
const LABEL = "mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3"
const PIXELS = { imageRendering: "pixelated" } as const

// ── Les images des matières du jeu ───────────────────────────────────────────

/** Les pixels d'une image de la bibliothèque, une fois : le moteur les lit, et le
 *  rendu est mis en cache par identité d'image. */
const IMAGES = new Map<string, RGBAImage>()
const EN_COURS = new Map<string, Promise<RGBAImage>>()

export let lireLesPixels = async (identifiant: string): Promise<RGBAImage> => {
  const image = new Image()
  image.src = api.fichier(identifiant)
  await image.decode()
  const c = document.createElement("canvas")
  c.width = image.naturalWidth
  c.height = image.naturalHeight
  const ctx = c.getContext("2d")!
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}
/** Pour les essais : remplacer la lecture d'une image par un double. */
export function doublerLaLecture(f: typeof lireLesPixels) { lireLesPixels = f; IMAGES.clear(); EN_COURS.clear() }

export async function chargerImages(ids: string[]): Promise<Map<string, RGBAImage>> {
  await Promise.all(ids.filter((id) => !IMAGES.has(id)).map((id) => {
    if (!EN_COURS.has(id)) EN_COURS.set(id, lireLesPixels(id).then((im) => { IMAGES.set(id, im); return im }).finally(() => EN_COURS.delete(id)))
    return EN_COURS.get(id)!
  }))
  return IMAGES
}
export const imagesChargees = () => IMAGES

// ── Aperçus rendus en différé ────────────────────────────────────────────────

/** Une liste de dix jeux ne doit pas geler l'écran : chaque aperçu part à son tour. */
const file: (() => void)[] = []
let fileEnCours = false
function demanderApercu(rendu: () => void) {
  file.push(rendu)
  if (fileEnCours) return
  fileEnCours = true
  const suivant = () => {
    const t = file.shift()
    if (!t) { fileEnCours = false; return }
    try { t() } catch (e) { console.error(e) }
    setTimeout(suivant, 0)
  }
  setTimeout(suivant, 0)
}

function Apercu({ jeu, largeur = 288, hauteur = 160, planche = false }: { jeu: () => JeuEdite; largeur?: number; hauteur?: number; planche?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    demanderApercu(() => {
      const c = ref.current
      if (!c || !c.isConnected) return
      const j = jeu(), atlas = atlasDe(j), carte = planche ? null : carteApercu(j.sorte)
      if (!carte) { planchePetite(c, atlas); return }
      dessinerCarte(c, j, atlas, carte, 32 / j.taille, { fond: imageDuFond(j, IMAGES) })
    })
    // L'aperçu se dessine une fois par montage : la recette ne bouge pas dans une liste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <canvas ref={ref} width={largeur} height={hauteur} aria-hidden="true" className="block h-auto max-w-full" style={PIXELS} />
}

function planchePetite(c: HTMLCanvasElement, atlas: Atlas) {
  const ctx = c.getContext("2d") as CanvasRenderingContext2D
  if (typeof ctx.drawImage !== "function") return
  const a = atlas.pixels, fit = Math.min(c.width / a.width, c.height / a.height), k = fit >= 1 ? Math.floor(fit) : fit
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(atlas.canvas as unknown as CanvasImageSource, Math.round((c.width - a.width * k) / 2), Math.round((c.height - a.height * k) / 2), Math.round(a.width * k), Math.round(a.height * k))
}

function Vignette({ image, taille = 81, cle }: { image: RGBAImage | null; taille?: number; cle?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) dessinerVignette(ref.current, image) }, [image, cle])
  if (!image) return <span aria-hidden="true" className="grid place-items-center rounded-5 border border-dashed border-pointille text-[11px] text-encre-3" style={{ width: taille, height: taille }}>à choisir</span>
  return <canvas ref={ref} aria-hidden="true" className="block rounded-5" style={{ ...PIXELS, width: taille, height: taille }} />
}

// ── A · Les tuiles du jeu ────────────────────────────────────────────────────

export function ListeDesJeux({ liste, charge, onOuvrir, onNouveau, onDepuisUneImage }: {
  liste: EnsembleTuiles[]; charge: boolean
  onOuvrir: (id: string) => void; onNouveau: () => void; onDepuisUneImage: () => void
}) {
  return <>
    <div className="mb-[22px] flex flex-wrap items-end justify-between gap-[22px]">
      <div><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Les tuiles du jeu</h1>
        <p className="mt-[4px] text-[13px] text-encre-3">Les sols, les chemins et les murs que ton jeu pose case par case sur ses cartes.</p></div>
      <div className="flex items-center gap-[14px]"><button type="button" className={LIEN} onClick={onDepuisUneImage}>À partir d’une image déjà faite</button>
        <button type="button" className={PRINCIPAL} onClick={onNouveau}>Nouveau jeu de tuiles</button></div>
    </div>
    {!charge && <p role="status" className="text-[13px] text-encre-3">Lecture des jeux de tuiles…</p>}
    {charge && !liste.length && <p className="text-[13px] text-encre-3">Aucun jeu de tuiles pour l’instant.</p>}
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[22px]">
      {liste.map((e) => <button key={e.identifiant} type="button" aria-label={`Ouvrir ${e.nom}`} onClick={() => onOuvrir(e.identifiant)}
        className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px] text-left transition-colors duration-120 hover:border-encre-3">
        <div className="grid aspect-[9/5] w-full place-items-center overflow-hidden rounded-7 bg-pourtour">
          {e.recette ? <ApercuDeRecette ensemble={e} /> : <img src={e.atlas_url} alt="" className="h-full w-full object-contain" style={PIXELS} />}
        </div>
        <strong className="text-[15px] font-medium text-encre">{e.nom}</strong>
        <small className="text-[12px] text-encre-3">{e.recette
          ? `${SORTES[e.recette.sorte].court} · ${nombrePieces(e.recette.sorte)} pièces · ${e.recette.taille} px`
          : `À partir d’une image · ${e.retenues} pièces retenues · ${e.grille.taille} px`}</small>
      </button>)}
    </div>
  </>
}

function ApercuDeRecette({ ensemble: e }: { ensemble: EnsembleTuiles }) {
  const [pret, setPret] = useState(false)
  useEffect(() => {
    let vivant = true
    const ids = Object.values(e.recette!.emplacements).flatMap((x) => (x.source === "asset" ? [x.asset] : []))
    chargerImages(ids).catch(() => undefined).finally(() => { if (vivant) setPret(true) })
    return () => { vivant = false }
  }, [e])
  if (!pret) return null
  return <Apercu jeu={() => jeuDepuisRecette({ identifiant: e.identifiant, revision: e.revision, nom: e.nom, recette: e.recette! }, IMAGES)} />
}

// ── B · Quelle sorte de tuiles ? ─────────────────────────────────────────────

export function ChoixDeSorte({ tailleDuJeu, onAnnuler, onCreer }: {
  tailleDuJeu: number; onAnnuler: () => void; onCreer: (choix: { sorte: Sorte; taille: number; nom: string }) => void
}) {
  const [sorte, setSorte] = useState<Sorte>("sol")
  const [taille, setTaille] = useState(tailleDuJeu)
  const [nom, setNom] = useState("Nouveau sol")
  const [nomTouche, setNomTouche] = useState(false)
  const modeles = useMemo(() => new Map<Sorte, JeuEdite>(), [])
  const modele = (s: Sorte) => () => {
    if (!modeles.has(s)) modeles.set(s, nouveauJeu({ nom: "", sorte: s, taille: 32, graine: 31415 }))
    return modeles.get(s)!
  }
  const choisir = (s: Sorte) => { setSorte(s); if (!nomTouche) setNom({ sol: "Nouveau sol", chemin: "Nouveau chemin", mur: "Nouveau mur", "coins-15": "Nouveau sol en 15 pièces", "pieces-17": "Nouvelles pièces" }[s]) }
  const grande = (s: Sorte) => <button key={s} type="button" aria-pressed={sorte === s} onClick={() => choisir(s)}
    className={`flex flex-col gap-[8px] rounded-10 border p-[14px] text-left transition-colors duration-120 hover:border-encre-3 ${sorte === s ? "border-encre-controle bg-papier" : "border-trait bg-carte"}`}>
    <div className="grid aspect-[9/5] w-full place-items-center overflow-hidden rounded-7 bg-pourtour"><Apercu jeu={modele(s)} /></div>
    <h2 className="mt-[8px] font-serif text-[25px] text-encre">{SORTES[s].nom}</h2>
    <p className="text-[13.5px] text-encre-2">{SORTES[s].texte}</p>
    <span className="mesure text-[12px] text-encre-4">{nombrePieces(s)} pièces</span>
  </button>
  const petite = (s: Sorte) => <button key={s} type="button" aria-pressed={sorte === s} onClick={() => choisir(s)}
    className={`flex items-center gap-[14px] rounded-8 border px-[14px] py-[8px] text-left ${sorte === s ? "border-encre-controle bg-papier" : "border-trait bg-carte"}`}>
    <span className="damier-papier shrink-0 overflow-hidden rounded-5"><Apercu jeu={modele(s)} largeur={81} hauteur={81} planche /></span>
    <span><strong className="block font-medium text-encre">{SORTES[s].nom}</strong><small className="text-[12px] text-encre-3">{SORTES[s].texte}</small></span>
  </button>
  return <>
    <div className="mb-[22px]"><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Quelle sorte de tuiles ?</h1>
      <p className="mt-[4px] text-[13px] text-encre-3">Choisis ce que ces tuiles vont dessiner sur tes cartes. Tu pourras tout changer ensuite.</p></div>
    <div className="grid max-w-[880px] grid-cols-3 gap-[22px]">{(["sol", "chemin", "mur"] as const).map(grande)}</div>
    <details className="mt-[14px] max-w-[880px]" open={sorte === "coins-15" || sorte === "pieces-17"}>
      <summary className="cursor-pointer py-[8px] text-[13px] text-encre-controle">Autres formats</summary>
      <div className="mt-[8px] grid grid-cols-2 gap-[14px]">{(["coins-15", "pieces-17"] as const).map(petite)}</div>
    </details>
    <div className="mt-[22px] flex max-w-[880px] flex-wrap items-end gap-[22px] border-t border-trait pt-[22px]">
      <label className="grid gap-[4px] text-[12px] text-encre-3">Nom
        <input type="text" value={nom} onChange={(e) => { setNom(e.target.value); setNomTouche(true) }} className="min-h-[34px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle" /></label>
      <div><div className="text-[12px] text-encre-3">Taille d’une pièce</div>
        <div className="mt-[4px] flex gap-[4px]">{[16, 32, 64].map((t) => <button key={t} type="button" aria-pressed={taille === t} onClick={() => setTaille(t)}
          className={`min-h-[30px] rounded-7 border px-[14px] text-[13px] ${taille === t ? "border-encre-3 bg-ligne-ouverte text-encre" : "border-contour bg-carte text-encre-controle"}`}>{t} px</button>)}</div>
        <div className="mt-[4px] min-h-[22px] text-[12px] text-encre-3">{taille === tailleDuJeu ? `${tailleDuJeu} px, la taille de ce jeu.` : `Le reste du jeu est en ${tailleDuJeu} px : ces pièces n’auront pas la même taille que tes personnages.`}</div></div>
      <button type="button" className={`${BOUTON} border-transparent bg-transparent`} onClick={onAnnuler}>Annuler</button>
      <button type="button" className={`${PRINCIPAL} ml-auto`} onClick={() => onCreer({ sorte, taille, nom: nom.trim() || "Nouveau jeu de tuiles" })}>Ouvrir l’atelier</button>
    </div>
  </>
}

// ── C · L'atelier ────────────────────────────────────────────────────────────

const OPTIONS: Record<string, [string | number, string][]> = {
  bordures: [["organiques", "Organiques"], ["nettes", "Nettes"]],
  nuances: [[2, "2"], [4, "4"], [8, "8"]],
  ombreMur: [["aucune", "Aucune"], ["discrete", "Discrète"], ["marquee", "Marquée"]],
  penombre: [["aucune", "Aucune"], ["discrete", "Discrète"], ["marquee", "Marquée"]],
  reduction: [["contraste", "Garder le trait"], ["moyenne", "Moyenne"], ["compensee", "Moyenne compensée"]],
  variantes: [[0, "Aucune"], [1, "1"], [2, "2"], [3, "3"]],
  animation: [[0, "Aucune"], [2, "2 images"], [4, "4 images"], [6, "6 images"], [8, "8 images"]],
}

export type Edition = { jeu: JeuEdite; signature: string; carte: string; nom: string }

export function AtelierDuJeu({ edition, matieres, modifie, occupe, message, onEnregistrer, onLivrer, onNom }: {
  edition: Edition; matieres: MatiereDuJeu[]; modifie: () => boolean; occupe: boolean; message: ReactNode
  onEnregistrer: () => void; onLivrer: () => void; onNom: (nom: string) => void
}) {
  const j = edition.jeu, S = SORTES[j.sorte]
  const [, maj] = useReducer((n: number) => n + 1, 0)
  const [onglet, setOnglet] = useState<"carte" | "planche" | "verifier">(j.carte ? "carte" : "planche")
  const [tiroir, setTiroir] = useState<{ cible: string; onglet: "integrees" | "miennes" } | null>(null)
  const [zoom, setZoom] = useState(0)
  const [heros, setHeros] = useState(true)
  const [image, setImage] = useState(0)
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const [erreur, setErreur] = useState("")
  const scene = useRef<HTMLCanvasElement>(null)
  const vue = useRef<HTMLDivElement>(null)
  const survol = useRef<Survol>(null)
  const peint = useRef<boolean | null>(null)

  // La recette qui décide de l'atlas : quand elle change, la planche se refait.
  const cle = JSON.stringify(recetteDe(j)) + "|" + j.taille
  useEffect(() => {
    const t = setTimeout(() => {
      try { setAtlas(atlasDe(j)) } catch (e) { setErreur(e instanceof Error ? e.message : String(e)) }
    }, atlas ? 120 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  // Le zoom qui fait tenir la carte, une fois, à l'ouverture.
  useEffect(() => {
    if (zoom || !j.carte) return
    const v = vue.current
    let z = 1
    if (v) for (const k of [2, 3]) if (j.carte.columns * j.taille * k <= v.clientWidth - 28 && j.carte.rows * j.taille * k <= v.clientHeight - 28) z = k
    setZoom(z)
  }, [zoom, j.carte, j.taille])

  // L'animation de la pièce pleine se joue seulement si elle existe.
  const duree = dureeImageAnimation(j)
  useEffect(() => {
    setImage(0)
    if (!duree || onglet !== "carte") return
    const t = setInterval(() => setImage((i) => i + 1), duree)
    return () => clearInterval(t)
  }, [duree, onglet])

  function dessinerLaScene() {
    const c = scene.current
    if (!c || !atlas || !j.carte) return
    const t0 = performance.now()
    dessinerCarte(c, j, atlas, j.carte, zoom || 1, { image, heros, survol: survol.current, fond: imageDuFond(j, imagesChargees()) })
    c.dataset.renduMs = String(Math.round(atlas.duree + performance.now() - t0))
  }
  useEffect(dessinerLaScene)

  const verification = useMemo(() => (atlas && onglet === "verifier" ? verifier(j, atlas) : null), [atlas, onglet, j])

  const changer = (f: () => void) => { f(); maj() }
  const reglage = (cle: string, v: string | number | boolean) => changer(() => { j.reglages[cle] = v })

  // ── Peindre la carte ──
  function caseSous(e: { clientX: number; clientY: number }) {
    const c = scene.current, k = j.carte
    if (!c || !k) return null
    const r = c.getBoundingClientRect()
    if (!r.width || !r.height) return null
    if (k.kind === "sommets") {
      const x = Math.round((e.clientX - r.left) / r.width * k.columns), y = Math.round((e.clientY - r.top) / r.height * k.rows)
      return x >= 0 && x <= k.columns && y >= 0 && y <= k.rows ? { x, y, table: k.v } : null
    }
    const x = Math.floor((e.clientX - r.left) / r.width * k.columns), y = Math.floor((e.clientY - r.top) / r.height * k.rows)
    return x >= 0 && x < k.columns && y >= 0 && y < k.rows ? { x, y, table: k.grid } : null
  }
  useEffect(() => {
    const fin = () => { if (peint.current !== null) { peint.current = null; maj() } }
    window.addEventListener("mouseup", fin)
    return () => window.removeEventListener("mouseup", fin)
  }, [])

  const emplacements = emplacementsDe(j)
  const ligneMatiere = (e: { id: string; nom: string; bord?: string }) => {
    if (e.id === "fond") {
      const f = imageDuFond(j, imagesChargees())
      return <div key="fond" className="border-b border-trait-faible pb-[4px]">
        <BoutonMatiere actif={tiroir?.cible === "fond"} image={f.image} titre={e.nom} nom={"asset" in j.fond ? j.fond.nom : nomDeMatiere(j.fond.matiere)} origine="Sur la carte seulement" onClick={() => setTiroir({ cible: "fond", onglet: tiroir?.onglet ?? "integrees" })} />
      </div>
    }
    const emp = j.etat[e.id]
    let bord: ReactNode = null
    if (e.bord) {
      const b = PAR_ID[e.id].bordure!, eb = j.etat[b]
      bord = eb.lie
        ? <div className="flex items-center gap-[8px] px-[4px] pb-[8px] text-[12px] text-encre-3"><Vignette image={eb.image} taille={22} cle={eb.cle} /><span className="mr-auto">{e.bord}</span>
          <button type="button" className={`${PETIT} border-dashed`} title="Cliquer pour lui donner sa propre matière" onClick={() => changer(() => delier(j, b))}>
            {e.id === "bas" ? "suit le sol dessous" : S.mur ? "suit le dessus" : j.sorte === "chemin" ? "suit le chemin" : "suit la surface"}</button></div>
        : <div className="flex flex-wrap items-center gap-[8px] px-[4px] pb-[8px] text-[12px] text-encre-3"><Vignette image={eb.image} taille={22} cle={eb.cle} /><span className="mr-auto">{e.bord} : {eb.nom || "vide"}</span>
          <button type="button" className={PETIT} aria-pressed={tiroir?.cible === b} onClick={() => setTiroir({ cible: b, onglet: tiroir?.onglet ?? "integrees" })}>Changer</button>
          {peutRelier(j, b) && <button type="button" className={PETIT} onClick={() => changer(() => relierBordure(j, b))}>Relier</button>}</div>
    }
    const origine = emp.source === "matiere" ? "Intégrée" : emp.source === "vide" ? "Vide" : "Mes matières"
    return <div key={e.id} className="border-b border-trait-faible pb-[4px]">
      <BoutonMatiere actif={tiroir?.cible === e.id} image={emp.image} cle={emp.cle} titre={e.nom} nom={emp.nom || (S.mur && e.id === "face" ? "comme le dessus" : "couleur provisoire")} origine={origine}
        onClick={() => setTiroir({ cible: e.id, onglet: tiroir?.onglet ?? "integrees" })} />{bord}</div>
  }

  const texteHasard = j.sorte === "mur" ? "Pièces au hasard" : j.sorte === "chemin" ? "Chemins au hasard" : "Île au hasard"
  const fonds = [...LISTE_MATIERES].sort((a, b) => Number(b.role === "sol") - Number(a.role === "sol"))
  const livrable = !S.mur

  return <div className="flex h-full min-h-0 flex-col">
    <div className="mb-[14px] flex shrink-0 flex-wrap items-end justify-between gap-[22px]">
      <div className="min-w-0 flex-1">
        <input aria-label="Nom du jeu de tuiles" spellCheck={false} value={j.nom} onChange={(e) => onNom(e.target.value)}
          className="-ml-[4px] w-full max-w-[880px] rounded-7 border border-transparent bg-transparent px-[4px] font-serif text-[38px] leading-[1.05] text-encre hover:border-trait focus:border-contour focus:bg-carte" />
        <div className="mt-[4px] flex items-center gap-[8px] text-[12.5px] text-encre-3">
          <span>{S.court} · {nombrePieces(j.sorte)} pièces</span><span>·</span>
          <label>pièces de <select aria-label="Taille d’une pièce" value={j.taille} onChange={(e) => changer(() => { j.taille = Number(e.target.value); setZoom(0) })}
            className="min-h-[26px] rounded-5 border border-contour bg-carte px-[4px] text-[12px] text-encre-controle">{[16, 32, 64].map((t) => <option key={t} value={t}>{t}</option>)}</select> px</label>
          <span role="status" className="ml-[8px]">{message}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        <button type="button" className={BOUTON} disabled={occupe || (!modifie() && j.identifiant !== null)} onClick={onEnregistrer}>Enregistrer</button>
        {livrable ? <button type="button" className={PRINCIPAL} disabled={occupe || !j.carte} onClick={onLivrer}>Livrer à Godot</button>
          : <span className="text-[12px] text-encre-3">Le mur se livre à Godot dans une prochaine version.</span>}
      </div>
    </div>
    {erreur && <p role="alert" className="mb-[8px] text-[13px] text-echec">{erreur}</p>}

    <div className={`grid min-h-0 flex-1 gap-[14px] ${tiroir ? "grid-cols-[240px_minmax(0,1fr)_380px]" : "grid-cols-[240px_minmax(0,1fr)_240px]"}`}>
      {/* Les matières */}
      <div className="flex min-h-0 min-w-0 flex-col gap-[8px] overflow-y-auto">
        <div className={`${LABEL} py-[4px]`}>Les matières</div>
        {emplacements.map(ligneMatiere)}
        {S.dessous && <><label className="flex items-center gap-[8px] text-[13px] text-encre-controle"><input type="checkbox" checked={aSecondTerrain(j)} onChange={(e) => changer(() => changerSecondTerrain(j, e.target.checked))} />Sur un autre sol</label>
          <p className="text-[12px] text-encre-3">Ajoute le sol qui apparaît sous les bords : le sable sous l’herbe, la berge sous l’eau.</p></>}
        <p className="mt-auto pt-[14px] text-[12px] text-encre-3">Rien ne coûte ici : chaque changement refait les pièces sur ta machine.</p>
      </div>

      {/* La carte, la planche, la vérification */}
      <div className="flex min-h-0 min-w-0 flex-col gap-[8px]">
        <div role="tablist" className="flex shrink-0 items-center gap-[4px]">
          {([["carte", "Carte"], ["planche", "Planche"], ["verifier", "Vérifier"]] as const).map(([id, nom]) =>
            <button key={id} type="button" role="tab" aria-selected={onglet === id} onClick={() => setOnglet(id)}
              className={`min-h-[30px] rounded-7 border px-[14px] text-[13px] ${onglet === id ? "border-contour bg-carte text-encre" : "border-transparent text-encre-controle"}`}>{nom}</button>)}
          <span className="ml-auto text-[12px] text-encre-3">{onglet === "carte" && j.carte ? "Clic : poser · clic droit : effacer" : onglet === "planche" ? "Survole une pièce pour lire son nom" : ""}</span>
        </div>
        {onglet === "carte" && (j.carte ? <>
          <div ref={vue} className="relative min-h-0 flex-1 overflow-auto rounded-8 bg-pourtour">
            <div className="flex min-h-full min-w-full w-max items-center justify-center p-[14px]">
              <canvas ref={scene} aria-label="La carte : clic pour poser, clic droit pour effacer" className="block cursor-crosshair" style={PIXELS}
                onContextMenu={(e) => e.preventDefault()}
                onMouseDown={(e) => { peint.current = e.button !== 2; const q = caseSous(e); if (q) q.table[q.y][q.x] = peint.current; survol.current = q; dessinerLaScene() }}
                onMouseMove={(e) => { const q = caseSous(e); if (q && peint.current !== null) q.table[q.y][q.x] = peint.current; survol.current = q; dessinerLaScene() }}
                onMouseLeave={() => { survol.current = null; dessinerLaScene() }} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-[8px] text-[13px]">
            <button type="button" className={PETIT} onClick={() => changer(() => { j.carte = ileAuHasard(j, (Math.random() * 1e9) | 0) })}>{texteHasard}</button>
            <button type="button" className={PETIT} onClick={() => changer(() => toutEffacer(j.carte!))}>Tout effacer</button>
            {!S.mur && <label className="flex items-center gap-[4px] text-encre-controle">Sol de fond
              <select aria-label="Sol de fond" value={"matiere" in j.fond ? j.fond.matiere : ""} onChange={(e) => e.target.value && changer(() => { j.fond = { matiere: e.target.value } })}
                className="min-h-[30px] max-w-[128px] rounded-7 border border-contour bg-carte px-[4px] text-[13px] text-encre-controle">
                {"asset" in j.fond && <option value="">{j.fond.nom}</option>}
                {fonds.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></label>}
            <label className="flex items-center gap-[4px] text-encre-controle"><input type="checkbox" checked={heros} onChange={(e) => setHeros(e.target.checked)} />Personnage</label>
            <span className="ml-auto flex gap-[4px]">{[1, 2, 3].map((z) => <button key={z} type="button" aria-pressed={(zoom || 1) === z} onClick={() => setZoom(z)}
              className={`${PETIT} ${(zoom || 1) === z ? "border-encre-3 bg-ligne-ouverte text-encre" : ""}`}>×{z}</button>)}</span>
            <span className="mesure text-[11.5px] text-encre-4">{casesPosees(j.carte)} cases</span>
          </div>
        </> : <div className="grid min-h-0 flex-1 place-items-center rounded-8 bg-pourtour p-[22px] text-center text-[13px] text-carte">Ces 17 pièces se posent à la main dans Godot : il n’y a pas de carte à peindre ici. Elles sont toutes dans l’onglet Planche.</div>)}
        {onglet === "planche" && atlas && <PlancheDuJeu jeu={j} atlas={atlas} />}
        {onglet === "verifier" && <div className="min-h-0 flex-1 overflow-auto rounded-8 border border-trait bg-carte p-[22px] text-[13px]">
          {verification ? <Verifie v={verification} /> : <p className="text-encre-3">Vérification…</p>}</div>}
      </div>

      {/* Les réglages, ou le tiroir des matières */}
      {tiroir ? <TiroirDesMatieres jeu={j} cible={tiroir.cible} onglet={tiroir.onglet} matieres={matieres}
        onOnglet={(o) => setTiroir({ ...tiroir, onglet: o })} onFermer={() => setTiroir(null)} onErreur={setErreur}
        onPose={maj} />
        : <div className="flex min-h-0 min-w-0 flex-col gap-[8px] overflow-y-auto">
          <div className={`${LABEL} py-[4px]`}>Réglages</div>
          <Curseur nom="Arrondi des coins" valeur={Number(j.reglages.arrondi)} min={0} max={8} onChange={(v) => reglage("arrondi", v)} />
          <Curseur nom="Irrégularité des bords" valeur={Number(j.reglages.irregularite)} min={0} max={10} onChange={(v) => reglage("irregularite", v)} />
          <Curseur nom="Relief" valeur={Number(j.reglages.relief)} min={0} max={10} onChange={(v) => reglage("relief", v)} />
          {S.mur && <Curseur nom="Hauteur du mur" unite=" cases" valeur={Number(j.reglages.hauteurMur)} min={1} max={8} onChange={(v) => reglage("hauteurMur", v)} />}
          <details className="mt-[8px] border-t border-trait pt-[8px]">
            <summary className="cursor-pointer py-[4px] text-[13px] text-encre-controle">Réglages fins</summary>
            <div className="grid gap-[4px] pt-[4px]">
              <Choix nom="Bords" cle="bordures" jeu={j} onChange={reglage} />
              <Choix nom="Nuances par matière" cle="nuances" jeu={j} onChange={reglage} />
              {S.mur && <><Choix nom="Ombre du mur" cle="ombreMur" jeu={j} onChange={reglage} /><Choix nom="Pénombre dans les angles" cle="penombre" jeu={j} onChange={reglage} /></>}
              <Choix nom="Réduire une image" cle="reduction" jeu={j} onChange={reglage} aide="Pour une image plus grande qu’une pièce." />
              {S.set && S.type !== "topdown-17" && <><Choix nom="Variantes de la pièce pleine" cle="variantes" jeu={j} onChange={reglage} /><Choix nom="Animation de la pièce pleine" cle="animation" jeu={j} onChange={reglage} /></>}
              <label className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[8px] gap-y-[4px] py-[4px] text-[13px] text-encre-controle"><span>Graine</span>
                <input type="number" min={0} value={j.graine} onChange={(e) => changer(() => { j.graine = Math.max(0, Number(e.target.value) || 0) })}
                  className="min-h-[26px] w-[70px] rounded-5 border border-contour bg-carte px-[4px] text-[12.5px] text-encre-controle" />
                <small className="col-span-2 text-[12px] text-encre-3"><button type="button" className="underline" onClick={() => changer(() => { j.graine = (Math.random() * 90000 + 10000) | 0 })}>Tirer une autre graine</button> : les matières intégrées changent de dessin.</small></label>
            </div>
          </details>
        </div>}
    </div>
  </div>
}

function BoutonMatiere({ actif, image, cle, titre, nom, origine, onClick }: { actif: boolean; image: RGBAImage | null; cle?: string; titre: string; nom: string; origine: string; onClick: () => void }) {
  return <button type="button" aria-pressed={actif} onClick={onClick} aria-label={`${titre} · ${nom}`}
    className={`grid w-full grid-cols-[81px_minmax(0,1fr)] items-center gap-[8px] rounded-8 border p-[4px] text-left transition-colors duration-120 hover:border-trait hover:bg-carte ${actif ? "border-encre-3 bg-carte" : "border-transparent"}`}>
    <Vignette image={image} cle={cle} />
    <span><strong className="block text-[13.5px] font-medium text-encre">{titre}</strong><span className="block text-[12.5px] text-encre-2">{nom}</span><span className="block text-[12px] text-encre-3">{origine}</span></span>
  </button>
}

function Curseur({ nom, valeur, min, max, unite = "", onChange }: { nom: string; valeur: number; min: number; max: number; unite?: string; onChange: (v: number) => void }) {
  return <label className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[8px] gap-y-[4px] py-[4px] text-[13px] text-encre-controle">
    <span>{nom}</span><span className="mesure text-[11.5px] text-encre">{valeur}{unite}</span>
    <input type="range" aria-label={nom} min={min} max={max} value={valeur} onChange={(e) => onChange(Number(e.target.value))} className="col-span-2 w-full" />
  </label>
}

function Choix({ nom, cle, jeu, onChange, aide }: { nom: string; cle: string; jeu: JeuEdite; onChange: (cle: string, v: string | number) => void; aide?: string }) {
  return <label className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[8px] gap-y-[4px] py-[4px] text-[13px] text-encre-controle">
    <span>{nom}</span>
    <select aria-label={nom} value={String(jeu.reglages[cle])} onChange={(e) => onChange(cle, /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value)}
      className="min-h-[26px] rounded-5 border border-contour bg-carte px-[4px] text-[12.5px] text-encre-controle">
      {OPTIONS[cle].map(([v, t]) => <option key={String(v)} value={String(v)}>{t}</option>)}</select>
    {aide && <small className="col-span-2 text-[12px] text-encre-3">{aide}</small>}
  </label>
}

function PlancheDuJeu({ jeu: j, atlas }: { jeu: JeuEdite; atlas: Atlas }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const vue = useRef<HTMLDivElement>(null)
  const [sur, setSur] = useState<{ col: number; row: number } | null>(null)
  const [k, setK] = useState(1)
  const cols = atlas.pixels.width / j.taille, rows = atlas.pixels.height / j.taille
  useEffect(() => {
    const v = vue.current
    setK(v ? Math.max(1, Math.min(8, Math.floor(Math.min((v.clientWidth - 28) / atlas.pixels.width, (v.clientHeight - 28) / atlas.pixels.height)))) : 1)
  }, [atlas])
  useEffect(() => { if (ref.current) dessinerPlanche(ref.current, j, atlas, k, sur) })
  return <>
    <div ref={vue} className="damier-papier min-h-0 flex-1 overflow-auto rounded-8">
      <div className="flex min-h-full min-w-full w-max items-center justify-center p-[14px]">
        <canvas ref={ref} aria-label="La planche de toutes les pièces" className="block" style={PIXELS}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (!r.width) return
            const col = Math.floor((e.clientX - r.left) / r.width * cols), row = Math.floor((e.clientY - r.top) / r.height * rows)
            if (col >= 0 && row >= 0 && col < cols && row < rows && (sur?.col !== col || sur?.row !== row)) setSur({ col, row }) }}
          onMouseLeave={() => setSur(null)} />
      </div>
    </div>
    <div className="min-h-[22px] shrink-0 text-[13px] text-encre-controle">{sur
      ? <><span className="mesure text-encre-4">Case {sur.col + 1}, {sur.row + 1}</span> · {nomPiece(j, sur.col, sur.row)}</>
      : <><span className="text-encre-3">Survole une pièce pour lire son nom.</span> <span className="mesure text-encre-4">Planche {cols} × {rows} cases · {atlas.pixels.width} × {atlas.pixels.height} px</span></>}</div>
  </>
}

function Verifie({ v }: { v: ReturnType<typeof verifier> }) {
  if (v.rien) return <><h2 className="mb-[8px] font-serif text-[25px]">Rien à vérifier</h2><p>Ces 17 pièces n’ont pas de raccord automatique : c’est toi qui les poses une à une dans Godot.</p></>
  if (!v.defauts.length) return <>
    <div className="mb-[14px] rounded-7 border border-trait-ok bg-fond-ok px-[14px] py-[8px] text-encre-ok">Aucun défaut : les {v.pieces} pièces se raccordent.</div>
    <p>Chaque pièce est à sa place sur la planche, porte bien de la matière, et son bord tombe exactement sur celui de ses voisines. Dans Godot, les bords se poseront tout seuls quand tu peindras.</p>
  </>
  const groupes = new Map<string, number>()
  for (const p of v.defauts) groupes.set(enClair(p), (groupes.get(enClair(p)) ?? 0) + 1)
  return <>
    <div className="mb-[14px] rounded-7 border border-trait-echec bg-fond-echec px-[14px] py-[8px] text-echec">{v.defauts.length} défaut{v.defauts.length > 1 ? "s" : ""} sur {v.pieces} pièces : ils se verront dans le jeu.</div>
    <ul className="my-[8px] list-disc pl-[22px]">{[...groupes].map(([t, n]) => <li key={t} className="mb-[4px]">{t}{n > 1 && <span className="mesure text-[12px]"> × {n}</span>}</li>)}</ul>
    <p>Essaie un arrondi plus petit ou des bords moins irréguliers, puis reviens ici.</p>
    <details className="mt-[8px]"><summary className="cursor-pointer text-[12px]">Le détail, pour l’agent</summary>{v.defauts.map((p, i) => <div key={i} className="mesure text-[11px] text-encre-3">{p}</div>)}</details>
  </>
}

// ── D · Le tiroir des matières ───────────────────────────────────────────────

function TiroirDesMatieres({ jeu: j, cible, onglet, matieres, onOnglet, onFermer, onErreur, onPose }: {
  jeu: JeuEdite; cible: string; onglet: "integrees" | "miennes"; matieres: MatiereDuJeu[]
  onOnglet: (o: "integrees" | "miennes") => void; onFermer: () => void; onErreur: (m: string) => void; onPose: () => void
}) {
  const [lecture, setLecture] = useState<string | null>(null)
  const prefere = cible === "face" ? "mur" : "sol"
  const actuelle = cible === "fond" ? ("matiere" in j.fond ? j.fond.matiere : "") : j.etat[cible]?.source === "matiere" ? j.etat[cible].matiere : ""
  const actuelAsset = cible === "fond" ? ("asset" in j.fond ? j.fond.asset : "") : j.assets[cible] ?? ""
  const integrees = [...LISTE_MATIERES].sort((a, b) => Number(b.role === prefere) - Number(a.role === prefere))
  async function poserMienne(m: MatiereDuJeu) {
    setLecture(m.identifiant)
    try {
      const images = await chargerImages([m.identifiant])
      poserAsset(j, cible, m.identifiant, m.nom, images.get(m.identifiant)!)
      onPose()
    } catch { onErreur(`L’image « ${m.nom} » n’a pas pu être lue.`) }
    finally { setLecture(null) }
  }
  return <aside aria-label="Choisir la matière" className="flex min-h-0 flex-col rounded-10 border border-contour bg-papier">
    <div className="flex items-start justify-between gap-[8px] border-b border-trait p-[14px]">
      <div><h2 className="font-serif text-[25px] text-encre">Choisir la matière</h2><p className="text-[12.5px] text-encre-3">Pour : {nomCible(j, cible)}</p></div>
      <button type="button" className={PETIT} onClick={onFermer}>Fermer</button>
    </div>
    <div role="tablist" className="flex gap-[4px] px-[14px] pt-[8px]">
      {([["integrees", "Intégrées"], ["miennes", "Mes matières"]] as const).map(([id, nom]) => <button key={id} type="button" role="tab" aria-selected={onglet === id} onClick={() => onOnglet(id)}
        className={`min-h-[30px] rounded-7 border px-[14px] text-[13px] ${onglet === id ? "border-contour bg-carte text-encre" : "border-transparent text-encre-controle"}`}>{nom}</button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-[14px]">
      {onglet === "integrees" ? <div className="grid grid-cols-3 gap-[8px]">
        {integrees.map((m) => <button key={m.id} type="button" aria-pressed={m.id === actuelle} onClick={() => { poserIntegree(j, cible, m.id); onPose() }}
          className={`flex flex-col items-center gap-[4px] rounded-8 border p-[4px] text-center text-[12px] text-encre-controle transition-colors duration-120 hover:bg-carte ${m.id === actuelle ? "border-encre-controle bg-carte" : "border-transparent"}`}>
          <VignetteIntegree id={m.id} jeu={j} />{m.nom}</button>)}
      </div> : matieres.length ? <div className="grid grid-cols-3 gap-[8px]">
        {matieres.map((m) => <button key={m.identifiant} type="button" aria-pressed={m.identifiant === actuelAsset} disabled={lecture !== null} onClick={() => void poserMienne(m)}
          className={`flex flex-col items-center gap-[4px] rounded-8 border p-[4px] text-center text-[12px] text-encre-controle hover:bg-carte ${m.identifiant === actuelAsset ? "border-encre-controle bg-carte" : "border-transparent"}`}>
          <img src={api.fichier(m.identifiant)} alt="" className="block h-[81px] w-[81px] rounded-5 object-cover" style={PIXELS} />{m.nom}{lecture === m.identifiant && <small className="text-[11px] text-encre-3">Lecture…</small>}</button>)}
      </div> : <p className="text-[13px] text-encre-3">Pas encore de matière dans ce jeu. Les images des sujets de nature « matière » apparaîtront ici.</p>}
    </div>
  </aside>
}

const vignettesIntegrees = new Map<string, RGBAImage>()
function VignetteIntegree({ id, jeu }: { id: string; jeu: JeuEdite }) {
  const cle = `${id}|${jeu.taille}|${jeu.graine}`
  const [image, setImage] = useState<RGBAImage | null>(vignettesIntegrees.get(cle) ?? null)
  useEffect(() => {
    if (vignettesIntegrees.has(cle)) { setImage(vignettesIntegrees.get(cle)!); return }
    const t = setTimeout(() => {
      const f = imageDuFond({ ...jeu, fond: { matiere: id } }, IMAGES).image
      vignettesIntegrees.set(cle, f)
      setImage(f)
    }, 0)
    return () => clearTimeout(t)
  }, [cle, id, jeu])
  return <Vignette image={image} cle={cle} />
}

// ── E · Livrer à Godot ───────────────────────────────────────────────────────

export function LivraisonDuJeu({ projet, edition, onRetour, onLivraisons }: {
  projet: string; edition: Edition; onRetour: () => void; onLivraisons?: () => void
}) {
  const j = edition.jeu
  const [apercu, setApercu] = useState<ApercuLivraison | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [depose, setDepose] = useState(false)
  const planche = useRef<HTMLCanvasElement>(null)
  const atlas = useMemo(() => atlasDe(j), [j])
  const v = useMemo(() => verifier(j, atlas), [j, atlas])
  useEffect(() => {
    let vivant = true
    if (!j.identifiant || !j.revision) return
    setOccupe(true)
    tuiles.prevoir(projet, j.identifiant, j.revision).then((a) => { if (vivant) setApercu(a) })
      .catch((e) => { if (vivant) setErreur(e instanceof Error ? e.message : "La livraison n’a pas pu être préparée.") })
      .finally(() => { if (vivant) setOccupe(false) })
    return () => { vivant = false }
  }, [projet, j.identifiant, j.revision])
  useEffect(() => {
    const c = planche.current
    if (!c) return
    dessinerAtlas(c, atlas, Math.max(1, Math.min(3, Math.floor(560 / atlas.pixels.width))))
  }, [atlas])
  const conflitsOuverts = (apercu?.conflits ?? []).filter((c) => !c.decision)
  async function deposer() {
    if (!apercu) return
    setOccupe(true); setErreur("")
    try { await api.livrerGodot(projet, apercu.jeton); setDepose(true) }
    catch (e) { setErreur(e instanceof Error ? e.message : "Le dépôt a échoué.") }
    finally { setOccupe(false) }
  }
  const nomFichier = (chemin: string) => chemin.split("/").at(-1) ?? chemin
  return <>
    <div className="mb-[22px]"><h1 className="font-serif text-[38px] leading-[1.05] text-encre">Livrer à Godot</h1>
      <p className="mt-[4px] text-[13px] text-encre-3">Relis ce qui part dans le projet du jeu. Rien n’est écrit tant que tu n’as pas déposé.</p></div>
    {depose && apercu && <div role="status" className="mb-[14px] max-w-[880px] rounded-7 border border-trait-ok bg-fond-ok px-[14px] py-[8px] text-[13px] text-encre-ok">
      Déposé dans <span className="mesure">{apercu.dossier}</span>. Dans Godot, ouvre <span className="mesure">{nomFichier(apercu.scene)}</span> pour voir la carte.</div>}
    <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-[22px]">
      <section className="min-w-0">
        <h2 className="font-serif text-[25px] text-encre">Ce qui part</h2>
        {!apercu && !erreur && <p className="mt-[8px] text-[13px] text-encre-3">Préparation…</p>}
        {apercu && <ul className="mt-[8px]">{apercu.fichiers.map((f) => <li key={f.chemin} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-[14px] gap-y-[4px] border-t border-trait py-[14px] last:border-b">
          <span className="mesure break-all text-[12px] text-encre">{nomFichier(f.chemin)}</span><span className="mesure text-[11.5px] text-encre-4">{f.etat}</span>
          <p className="col-span-2 text-[13px] text-encre-2">{f.role}</p></li>)}</ul>}
        <h2 className="mt-[22px] font-serif text-[25px] text-encre">La planche</h2>
        <div className="damier-papier mt-[8px] grid place-items-center overflow-auto rounded-8 p-[14px]"><canvas ref={planche} aria-label="La planche livrée" className="block" style={PIXELS} /></div>
        <p className="mt-[8px] mesure text-[11.5px] text-encre-4">{atlas.pixels.width / j.taille} × {atlas.pixels.height / j.taille} cases de {j.taille} px · carte de {casesPosees(j.carte)} cases posées</p>
      </section>
      <section className="min-w-0">
        <h2 className="font-serif text-[25px] text-encre">La vérification</h2>
        <div className="mt-[8px] text-[13px]">{v.rien ? <div className="rounded-7 border border-trait-attention bg-fond-attention px-[14px] py-[8px] text-encre-attention">Ces pièces n’ont pas de raccord automatique : rien à vérifier.</div>
          : v.defauts.length ? <div className="rounded-7 border border-trait-echec bg-fond-echec px-[14px] py-[8px] text-echec">{v.defauts.length} défaut{v.defauts.length > 1 ? "s" : ""} : ils se verront dans le jeu. <button type="button" className="underline" onClick={onRetour}>Voir lesquels</button></div>
          : <div className="rounded-7 border border-trait-ok bg-fond-ok px-[14px] py-[8px] text-encre-ok">Vérifié : les {v.pieces} pièces se raccordent.</div>}</div>
        <h2 className="mt-[22px] font-serif text-[25px] text-encre">Où ça va</h2>
        <div className="mt-[8px] grid gap-[4px] rounded-8 border border-trait bg-carte p-[14px] text-[13px]">
          {apercu ? <><span className="mesure break-all text-[12px]">{apercu.dossier}</span><span className="text-[12px] text-encre-3">Ce qui existe déjà à cet endroit est remplacé ; l’ancienne version reste dans l’historique des livraisons.</span></>
            : erreur ? <span role="alert" className="text-echec">{erreur}</span> : <span className="text-encre-3">Préparation…</span>}
          {conflitsOuverts.map((c) => <span key={c.chemin} className="text-[12px] text-echec">{c.chemin} : {c.raison}</span>)}
          {(erreur || conflitsOuverts.length > 0) && onLivraisons && <button type="button" className={`${LIEN} justify-self-start`} onClick={onLivraisons}>Projet Godot et historique</button>}
        </div>
        <div className="mt-[22px] flex items-center justify-between gap-[14px] border-t border-trait pt-[14px]">
          <button type="button" className={BOUTON} onClick={onRetour}>‹ {j.nom}</button>
          {!depose && <button type="button" className="min-h-[34px] rounded-7 bg-signal px-[22px] text-[13px] font-medium text-encre-sur-signal disabled:opacity-50" disabled={occupe || !apercu?.pret} onClick={() => void deposer()}>Déposer dans le projet Godot</button>}
        </div>
      </section>
    </div>
  </>
}
