import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { apiCalques, cleCible, ETAT_CALQUE, type BrouillonCalque, type CadreAgrandi, type CheminEmploi, type CotesCadre, type ImageCible, type PreparationSource, type VarianteCalque } from "../api-calques"
import type { ZoomTable } from "../recette"
import { BarreDuZoom } from "./CommandesDuZoom"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:text-eteint"
const PRINCIPAL = "h-[34px] rounded-7 bg-signal px-[14px] text-[12px] text-encre-sur-signal disabled:opacity-50"
const PETIT = "h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre-2 disabled:opacity-50"
const copie = <T,>(valeur: T): T => structuredClone(valeur)
const outils = { deplacer: "Déplacer le calque", vue: "Déplacer la vue", effacer: "Effacer le calque", restaurer: "Restaurer le calque", masquer: "Masquer le corps", corps: "Restaurer le corps", dessous: "Passer cette partie dessous", dessus: "Ramener cette partie dessus" }
type Outil = keyof typeof outils
/** `superposes` se dessine dans le navigateur — la pose, et l'image équipée
 *  posée dessus en transparence : le calage se voit pendant qu'on le fait,
 *  sans aller-retour au serveur. Les autres vues sont rendues par le même
 *  compositeur CPU que le résultat gardé. */
type Vue = "superposes" | "composition" | "calque" | "base" | "source"

function Mesure({ nom, valeur, min, max, pas = 1, onChange }: { nom: string; valeur: number; min: number; max: number; pas?: number; onChange: (v: number) => void }) {
  const poser = (v: number) => { if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))) }
  return <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">{nom}<span className="flex items-center gap-[8px]"><input aria-label={nom} type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => poser(Number(e.target.value))} className="min-w-0 flex-1 accent-signal" /><input aria-label={`${nom} — valeur`} type="number" min={min} max={max} step={pas} value={valeur} onChange={(e) => poser(Number(e.target.value))} className={`${CONTROLE} w-[70px]`} /></span></label>
}

/** Une étape de la chaîne, numérotée : la colonne se lit de haut en bas dans
 *  l'ordre où l'on travaille. */
function Etape({ numero, titre, children }: { numero?: number; titre: string; children: ReactNode }) {
  return <section className="flex flex-col gap-[8px] border-t border-trait pt-[14px] first:border-t-0 first:pt-0">
    <h3 className="text-[13px] font-medium text-encre">{numero ? `${numero} · ` : ""}{titre}</h3>
    {children}
  </section>
}

/** Où l'image équipée se pose dans le cadre de la pose — **la même règle que
 *  `aligner`** (`atelier/image/calque.py`) : ramenée pour tenir si elle dépasse,
 *  puis mise à l'échelle autour du centre du cadre et décalée. Une seconde
 *  règle ici ferait voir un calage que l'extraction ne ferait pas. */
export function placeDuDessus(ls: number, hs: number, l: number, h: number, echelle: number, dx: number, dy: number) {
  let largeur = ls, hauteur = hs, gauche = 0, sommet = 0
  if (ls !== l || hs !== h) {
    const tient = ls <= l && hs <= h
    const facteur = tient ? 1 : Math.min(l / Math.max(1, ls), h / Math.max(1, hs))
    largeur = Math.max(1, Math.round(ls * facteur)); hauteur = Math.max(1, Math.round(hs * facteur))
    gauche = tient ? 0 : Math.floor((l - largeur) / 2); sommet = tient ? 0 : Math.floor((h - hauteur) / 2)
  }
  const l2 = Math.max(1, Math.round(l * echelle)), h2 = Math.max(1, Math.round(h * echelle))
  const rx = l2 / l, ry = h2 / h
  return { left: Math.floor((l - l2) / 2) + dx + gauche * rx, top: Math.floor((h - h2) / 2) + dy + sommet * ry, width: largeur * rx, height: hauteur * ry }
}

const enListe = (mots: string[]) => mots.length < 2 ? mots.join("") : `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}`

/** « 38 px à gauche et à droite et 12 px en haut » — les côtés qui ont grandi, et eux seuls. */
export function cotesEnMots(c: CotesCadre) {
  const mots: string[] = []
  if (c.gauche && c.gauche === c.droite) mots.push(`${c.gauche} px à gauche et à droite`)
  else {
    if (c.gauche) mots.push(`${c.gauche} px à gauche`)
    if (c.droite) mots.push(`${c.droite} px à droite`)
  }
  if (c.haut) mots.push(`${c.haut} px en haut`)
  if (c.bas) mots.push(`${c.bas} px en bas`)
  return mots.length ? enListe(mots) : "0 px"
}

/** Ce qui suit l'agrandissement : les autres directions de la pose, puis le reste du personnage. */
function quiSuit(agrandi: CadreAgrandi, pose: string) {
  const directions = agrandi.autres_directions
  const parts: string[] = []
  if (directions.length) parts.push(directions.length === 1 ? `la direction ${directions[0]} de ${pose}` : `les ${directions.length} autres directions de ${pose} (${enListe(directions)})`)
  if (agrandi.autres_images) parts.push(agrandi.autres_images === 1 ? "l’image de l’autre pose" : `les ${agrandi.autres_images} images des autres poses`)
  return parts.length ? `Même cadre pour ${enListe(parts)}.` : ""
}

/** Ce que la préparation a fait, en clair — et ce qu'elle a laissé. */
function LectureDeLaSource({ preparation, nomDeLaPose, pose, attente, onAgrandir }: { preparation?: PreparationSource; nomDeLaPose: string; pose: string; attente: boolean; onAgrandir: () => void }) {
  if (!preparation) return <p className="text-[12px] leading-[1.45] text-encre-3">Lue telle quelle : ni la recette de la pose, ni son échelle. Appliquez la recette de {nomDeLaPose} pour que les deux corps se comparent.</p>
  const dehors = preparation.dehors ?? 0
  const agrandi = preparation.agrandi
  return <div className="flex flex-col gap-[4px] text-[12px] leading-[1.45] text-encre-3">
    {preparation.recette === "pose"
      ? <p data-recette-appliquee><b className="text-encre-2">Recette de {nomDeLaPose} appliquée</b>{preparation.appliquee.length ? ` : ${preparation.appliquee.join(", ")}.` : "."}</p>
      : <p data-recette-appliquee><b className="text-encre-2">Sa propre recette</b>, telle que retouchée{preparation.echelle ? ", ramenée à l’échelle de la pose." : ", à sa taille d’origine."}</p>}
    {preparation.facteur !== undefined && <p>Arrivée à {preparation.cadre_source.largeur} × {preparation.cadre_source.hauteur} px, mise à l’échelle × {preparation.facteur.toFixed(2)}.</p>}
    {!!preparation.laissee.length && <details><summary className="cursor-pointer">Laissé de côté ({preparation.laissee.length})</summary><ul className="mt-[4px] list-disc pl-[14px]">{preparation.laissee.map((l) => <li key={l}>{l}</li>)}</ul></details>}
    {/* **Plus d'avertissement quand c'est fait tout seul** : le cadre a grandi
        (l'écrin du personnage), et la phrase dit de combien et qui suit. */}
    {agrandi && <p data-cadre-agrandi className="rounded-7 border border-trait bg-papier-cote p-[8px] text-encre-2">
      <b className="font-medium text-encre">Cadre agrandi de {cotesEnMots(agrandi.cotes)}</b> pour {agrandi.piece || "la pièce"} ({agrandi.avant.largeur} × {agrandi.avant.hauteur} → {agrandi.apres.largeur} × {agrandi.apres.hauteur} px) : rien n’est coupé. {quiSuit(agrandi, pose)}
    </p>}
    {/* Une lecture d'avant le 18 septembre 2026 a pu couper la pièce : relire
        avec la recette de la pose agrandit le cadre au lieu de couper. */}
    {!agrandi && dehors > 0.02 && <div role="note" className="flex flex-col gap-[6px] rounded-7 border border-trait-attention bg-fond-attention p-[8px] text-encre-attention">
      <p>{Math.round(dehors * 100)} % de l’image équipée tombe hors du cadre de la pose et a été coupé à cette lecture.</p>
      <button type="button" className={`${PETIT} self-start`} disabled={attente} onClick={onAgrandir}>Relire en agrandissant le cadre</button>
    </div>}
    {preparation.accord !== undefined && preparation.accord < 0.5 && <p role="note" className="rounded-7 border border-trait-attention bg-fond-attention p-[8px] text-encre-attention">Les deux corps se recouvrent mal ({Math.round(preparation.accord * 100)} %) : vérifie la superposition avant d’extraire.</p>}
  </div>
}

/** L’aperçu vient du même compositeur CPU que le rendu gardé. Les coordonnées
 * des masques locaux sont inversées avant stockage : zoom et placement ne
 * déplacent jamais une peinture déjà posée.
 *
 * **La mise en page est celle de l'atelier d'animation** (`AtelierDeBande`) :
 * la scène à gauche, les réglages à droite dans l'ordre où l'on travaille —
 * pose de référence, image équipée, calage, extraction, retouche. */
export function EditeurCalqueCible({ chemin, variante, cibles = [], onGarde, onSale, nomDeLaPose, onRetoucher }: {
  chemin: CheminEmploi; variante: VarianteCalque; cibles?: ImageCible[]
  onGarde: (v: VarianteCalque) => void; onSale: (sale: boolean) => void
  /** Le nom lisible de la pose de base, « repos » plutôt que son identifiant. */
  nomDeLaPose?: string
  /** Ouvrir l'image équipée dans la retouche ordinaire. */
  onRetoucher?: (asset: string) => void
}) {
  const initial: BrouillonCalque = { placement: copie(variante.placement), masques: copie(variante.masques), ...(variante.role === "source-equipee" ? { extraction: variante.extraction ?? { dx: 0, dy: 0, echelle: 1, seuil: 30 } } : {}) }
  const cleBrouillon = `atelier-calque:${chemin.projet}:${variante.identifiant}:${variante.revision}`
  const [brouillon, setBrouillon] = useState<BrouillonCalque>(() => {
    try { const texte = sessionStorage.getItem(cleBrouillon); const relu = texte ? JSON.parse(texte) as BrouillonCalque : null; return relu?.placement && relu.masques ? relu : initial }
    catch { return initial }
  })
  const [garde, setGarde] = useState(initial)
  const [annulations, setAnnulations] = useState<BrouillonCalque[]>([])
  const [retablissements, setRetablissements] = useState<BrouillonCalque[]>([])
  const [outil, setOutil] = useState<Outil>("deplacer")
  const [rayon, setRayon] = useState(2)
  const [zoom, setZoom] = useState<ZoomTable>("ajuste")
  const [ajuste, setAjuste] = useState(400)
  const extraction = variante.role === "source-equipee"
  const [vue, setVue] = useState<Vue>(variante.role === "reference" ? "source" : extraction ? "superposes" : "composition")
  const [transparence, setTransparence] = useState(55)
  const [url, setUrl] = useState("")
  const [curseur, setCurseur] = useState<{ x: number; y: number } | null>(null)
  const [erreur, setErreur] = useState("")
  const [attente, setAttente] = useState(false)
  const [calcul, setCalcul] = useState(false)
  const [nouvelleBase, setNouvelleBase] = useState(cleCible(variante.cible))
  const image = useRef<HTMLImageElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const espace = useRef(false)
  const geste = useRef<{ x: number; y: number; clientX: number; clientY: number; dx: number; dy: number; gauche: number; haut: number; pan: boolean } | null>(null)
  const sale = JSON.stringify(brouillon) !== JSON.stringify(garde)
  const modifiable = variante.role !== "reference"
  const extrait = variante.role === "calque"
  const largeur = variante.base.cadre.largeur, hauteur = variante.base.cadre.hauteur
  const pose = `${nomDeLaPose ?? variante.base.pose} · ${variante.base.direction || "sans direction"}`
  const facteur = (zoom === "ajuste" ? ajuste : zoom) / 100

  useEffect(() => { onSale(sale); return () => onSale(false) }, [sale, onSale])
  // Changer de rubrique dans le même atelier ne perd pas le brouillon. Il
  // reste nommé comme tel ; seule l’action Enregistrer écrit le contrat disque.
  useEffect(() => {
    try { if (sale) sessionStorage.setItem(cleBrouillon, JSON.stringify(brouillon)); else sessionStorage.removeItem(cleBrouillon) } catch { /* L’édition et la garde serveur restent disponibles si le stockage du navigateur est plein. */ }
  }, [cleBrouillon, brouillon, sale])
  useEffect(() => {
    if (!sale) return
    const prevenir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", prevenir)
    return () => window.removeEventListener("beforeunload", prevenir)
  }, [sale])
  // « Adapter » suit la place de la scène, comme dans l'atelier d'animation.
  useLayoutEffect(() => {
    const cadre = viewport.current
    if (!cadre) return
    const mesurer = () => { const r = cadre.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setAjuste(Math.max(1, Math.floor(Math.min((r.width - 44) / largeur, (r.height - 44) / hauteur) * 100))) }
    mesurer()
    if (typeof ResizeObserver === "undefined") return
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(cadre)
    return () => observateur.disconnect()
  }, [largeur, hauteur])
  useEffect(() => {
    if (vue === "superposes") return
    if (vue === "base" || vue === "source" || variante.role === "reference") { setUrl(apiCalques.image(chemin, variante, vue === "base" ? "base" : "source")); return }
    const controle = new AbortController()
    let objetUrl = ""
    setCalcul(true)
    const timer = window.setTimeout(() => {
      apiCalques.apercu(chemin, variante.identifiant, { ...brouillon, vue }, controle.signal)
        .then((blob) => { if (!controle.signal.aborted) { objetUrl = URL.createObjectURL(blob); setUrl(objetUrl); setErreur("") } })
        .catch((e: unknown) => { if (!controle.signal.aborted) setErreur(e instanceof Error ? e.message : "L’aperçu n’est pas disponible.") })
        .finally(() => { if (!controle.signal.aborted) setCalcul(false) })
    }, 100)
    return () => { window.clearTimeout(timer); controle.abort(); if (objetUrl) URL.revokeObjectURL(objetUrl) }
  }, [chemin.projet, chemin.piece, chemin.emploi, variante.identifiant, variante.role, brouillon, vue])

  const memoriser = () => { setAnnulations((a) => [...a.slice(-49), copie(brouillon)]); setRetablissements([]) }
  const changer = (nouveau: BrouillonCalque) => { memoriser(); setBrouillon(nouveau) }
  const annuler = () => { const dernier = annulations.at(-1); if (!dernier) return; setRetablissements((a) => [...a, brouillon]); setAnnulations((a) => a.slice(0, -1)); setBrouillon(dernier) }
  const retablir = () => { const dernier = retablissements.at(-1); if (!dernier) return; setAnnulations((a) => [...a, brouillon]); setRetablissements((a) => a.slice(0, -1)); setBrouillon(dernier) }
  const nombre = (nom: "dx" | "dy" | "echelle" | "rotation" | "opacite" | "ordre", valeur: number) => {
    if (brouillon.extraction && (nom === "dx" || nom === "dy" || nom === "echelle")) changer({ ...brouillon, extraction: { ...brouillon.extraction, [nom]: valeur } })
    else changer({ ...brouillon, placement: { ...brouillon.placement, [nom]: valeur } })
  }
  const action = async (faire: () => Promise<VarianteCalque>) => {
    setAttente(true); setErreur("")
    try { const v = await faire(); try { sessionStorage.removeItem(cleBrouillon) } catch { /* Cache facultatif. */ }; setGarde(copie(brouillon)); onSale(false); onGarde(v) }
    catch (e) { setErreur(e instanceof Error ? e.message : "Le calque n’a pas pu être enregistré.") }
    finally { setAttente(false) }
  }
  const relire = (recette: PreparationSource["recette"], echelle: boolean) => void action(() => apiCalques.reprendreSource(chemin, variante.identifiant, variante.revision, recette, echelle))
  const point = (e: PointerEvent) => {
    const r = image.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) * largeur / r.width, y: (e.clientY - r.top) * hauteur / r.height }
  }
  const peindre = (e: PointerEvent, debut: boolean) => {
    if (!extrait || outil === "deplacer" || outil === "vue") return
    let { x, y } = point(e)
    const masque = outil === "masquer" || outil === "corps" ? "corps" : outil === "dessous" || outil === "dessus" ? "derriere" : "calque"
    const p = brouillon.placement
    if (masque !== "corps") {
      const a = p.rotation * Math.PI / 180, ox = x - largeur / 2 - p.dx, oy = y - hauteur / 2 - p.dy
      // Le calque importé peut avoir un cadre différent de celui du corps.
      const w = variante.calque_cadre?.largeur ?? largeur
      const h = variante.calque_cadre?.hauteur ?? hauteur
      x = (Math.cos(a) * ox + Math.sin(a) * oy) / p.echelle + w / 2
      y = (-Math.sin(a) * ox + Math.cos(a) * oy) / p.echelle + h / 2
    }
    const coord: [number, number] = [Math.round(x), Math.round(y)]
    setBrouillon((b) => {
      const traits = b.masques[masque]
      const dernier = traits.at(-1)
      const modifie = debut || !dernier ? [...traits, { garde: ["restaurer", "corps", "dessous"].includes(outil), rayon: Math.max(0, Math.round(rayon / (masque === "corps" ? 1 : p.echelle))), points: [coord], couleur: "" }]
        : [...traits.slice(0, -1), { ...dernier, points: [...dernier.points, coord] }]
      return { ...b, masques: { ...b.masques, [masque]: modifie } }
    })
  }
  const commencer = (e: PointerEvent<HTMLDivElement>) => {
    if (!image.current || !viewport.current || (e.button !== 0 && e.button !== 1)) return
    e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId)
    const p = point(e), placement = brouillon.extraction ?? brouillon.placement
    const pan = espace.current || e.button === 1 || outil === "vue" || !modifiable || !(vue === "composition" || vue === "superposes")
    geste.current = { ...p, clientX: e.clientX, clientY: e.clientY, dx: placement.dx, dy: placement.dy, gauche: viewport.current.scrollLeft, haut: viewport.current.scrollTop, pan }
    if (!pan) { memoriser(); peindre(e, true) }
  }
  const bouger = (e: PointerEvent<HTMLDivElement>) => {
    if (!image.current) return
    const p = point(e); setCurseur(p)
    const g = geste.current
    if (!g) return
    if (g.pan) { if (viewport.current) { viewport.current.scrollLeft = g.gauche - e.clientX + g.clientX; viewport.current.scrollTop = g.haut - e.clientY + g.clientY }; return }
    if (outil === "deplacer") {
      const dx = Math.max(-8192, Math.min(8192, Math.round(g.dx + p.x - g.x))), dy = Math.max(-8192, Math.min(8192, Math.round(g.dy + p.y - g.y)))
      setBrouillon((b) => b.extraction ? { ...b, extraction: { ...b.extraction, dx, dy } } : { ...b, placement: { ...b.placement, dx, dy } })
    } else peindre(e, false)
  }
  const reglage = brouillon.extraction ?? brouillon.placement
  const vues: [Vue, string][] = variante.role === "reference" ? [["source", "Image de référence"]]
    : extraction ? [["superposes", "Les deux superposés"], ["composition", "Ce qui sera extrait"], ["calque", "Calque seul"], ["base", "Pose de référence"], ["source", "Image équipée"]]
      : [["composition", "Personnage équipé"], ["calque", "Calque seul"], ["base", "Base conservée"], ["source", "Image source"]]
  const cadreSource = variante.calque_cadre ?? variante.base.cadre
  const dessus = brouillon.extraction ? placeDuDessus(cadreSource.largeur, cadreSource.hauteur, largeur, hauteur, brouillon.extraction.echelle, brouillon.extraction.dx, brouillon.extraction.dy) : null
  const preparation = variante.preparation

  return <section aria-label="Éditeur du calque ciblé" className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,40%)] grid-rows-[auto_minmax(0,1fr)] gap-[14px] bg-papier p-[14px]">
    {/* ── La barre de la scène ─────────────────────────────────────────── */}
    <div className="col-start-1 row-start-1 flex min-w-0 flex-col gap-[8px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <div role="group" aria-label="Vue du calque" className="flex flex-wrap gap-[4px] rounded-7 bg-papier-cote p-[4px]">{vues.map(([cle, nom]) => <button key={cle} type="button" aria-pressed={vue === cle} onClick={() => setVue(cle)} className={`h-[30px] rounded-7 px-[8px] text-[12px] ${vue === cle ? "bg-carte text-encre" : "text-encre-3"}`}>{nom}</button>)}</div>
        {modifiable && <><button type="button" title="Ctrl + Z" disabled={!annulations.length || attente} className={PETIT} onClick={annuler}>Défaire</button><button type="button" title="Ctrl + Maj + Z" disabled={!retablissements.length || attente} className={PETIT} onClick={retablir}>Refaire</button></>}
        <span className="ml-auto text-[12px] text-encre-3"><strong className="font-medium text-encre">{ETAT_CALQUE[variante.etat]}{variante.retenue ? " · retenue" : ""}</strong> · {largeur} × {hauteur} px · repère {variante.base.repere.x}, {variante.base.repere.y}</span>
      </div>
      <BarreDuZoom zoom={zoom} ajuste={ajuste} maximum={3200} libelle="Zoom du calque en pourcentage" onZoom={setZoom} />
    </div>

    {/* ── La scène ─────────────────────────────────────────────────────── */}
    <div ref={viewport} className="defile col-start-1 row-start-2 flex min-h-0 min-w-0 overflow-auto rounded-7 border border-trait bg-pourtour p-[22px]" onWheel={(e) => { if (e.ctrlKey || e.altKey) { e.preventDefault(); setZoom(Math.max(1, Math.min(3200, Math.round(facteur * 100 * (e.deltaY < 0 ? 1.2 : 1 / 1.2))))) } }}>
      <div role="application" aria-label="Image équipée — glisser pour déplacer, espace pour déplacer la vue" tabIndex={0} className="relative m-auto w-fit shrink-0 touch-none outline-none" onPointerDown={commencer} onPointerMove={bouger} onPointerUp={() => { geste.current = null }} onPointerCancel={() => { geste.current = null }} onPointerLeave={() => setCurseur(null)} onKeyDown={(e) => { if (e.code === "Space") { espace.current = true; e.preventDefault() }; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) retablir(); else annuler() } }} onKeyUp={(e) => { if (e.code === "Space") espace.current = false }} onBlur={() => { espace.current = false; geste.current = null }}>
        {vue === "superposes" && dessus ? <div data-superposes className="relative outline outline-1 outline-pointille" style={{ width: largeur * facteur, height: hauteur * facteur }}>
          <img ref={image} src={apiCalques.image(chemin, variante, "base")} draggable={false} alt="Pose de référence sous l’image équipée" width={largeur} height={hauteur} className="damier-papier block max-w-none" style={{ width: largeur * facteur, height: hauteur * facteur, imageRendering: "pixelated" }} />
          <img src={apiCalques.image(chemin, variante, "source")} draggable={false} alt="Image équipée posée sur la pose" className="pointer-events-none absolute block max-w-none" style={{ left: dessus.left * facteur, top: dessus.top * facteur, width: dessus.width * facteur, height: dessus.height * facteur, opacity: transparence / 100, imageRendering: "pixelated" }} />
        </div>
          : url ? <img ref={image} src={url} draggable={false} alt="Aperçu du calque sur sa base" width={largeur} height={hauteur} className="damier-papier block max-w-none" style={{ width: largeur * facteur, height: hauteur * facteur, imageRendering: "pixelated" }} /> : <p className="text-[13px] text-carte">Préparation de l’image…</p>}
        {curseur && extrait && !["deplacer", "vue"].includes(outil) && vue === "composition" && <span aria-hidden className="pointer-events-none absolute border border-encre bg-carte/20" style={{ left: (curseur.x - rayon - .5) * facteur, top: (curseur.y - rayon - .5) * facteur, width: (2 * rayon + 1) * facteur, height: (2 * rayon + 1) * facteur }} />}
      </div>
    </div>

    {/* ── Les réglages, dans l'ordre où l'on travaille ─────────────────── */}
    <aside aria-label="Outils du calque" className="col-start-2 row-start-1 row-span-2 flex min-h-0 flex-col gap-[14px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex items-baseline justify-between gap-[8px]">
        <h2 className="font-serif text-[25px] text-encre">{extraction ? "Isoler la pièce" : extrait ? "Le calque" : "La référence"}</h2>
        <span role="status" className="text-[12px] text-encre-3">{calcul ? "Calcul de l’aperçu…" : sale ? "Modifications non enregistrées" : "Réglages enregistrés"}</span>
      </div>
      {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
      {variante.raison && <div className="rounded-7 border border-trait bg-papier-cote p-[8px] text-[13px] text-encre-2"><p>{variante.raison}. Les anciens pixels et les masques sont conservés.</p><label className="mt-[8px] flex items-center gap-[8px]">Base à adopter<select className={`${CONTROLE} min-w-0 flex-1`} aria-label="Nouvelle base du calque" value={nouvelleBase} onChange={(e) => setNouvelleBase(e.target.value)}>{!cibles.some((c) => cleCible(c.cible) === cleCible(variante.cible)) && <option value={cleCible(variante.cible)} disabled>La base d’origine n’est plus disponible</option>}{cibles.map((c) => <option key={cleCible(c.cible)} value={cleCible(c.cible)}>{c.pose} · {c.direction || "sans direction"} · {c.cible.nature === "frame" ? `${c.nom_bande} frame ${(c.rang ?? 0) + 1}` : c.image?.label || "image fixe"}</option>)}</select></label><button disabled={sale || attente || !cibles.some((c) => cleCible(c.cible) === nouvelleBase)} onClick={() => void action(() => apiCalques.adopter(chemin, variante.identifiant, variante.revision, cibles.find((c) => cleCible(c.cible) === nouvelleBase)!.cible))} className={`${CONTROLE} mt-[8px]`}>Adopter cette base, puis revérifier</button></div>}

      {variante.cadre_suivi && <p data-cadre-suivi className="rounded-7 border border-trait bg-papier-cote p-[8px] text-[12px] leading-[1.45] text-encre-2">Cadre agrandi de {cotesEnMots(variante.cadre_suivi.cotes)} pour suivre {variante.cadre_suivi.cause.piece || "une pièce"} de {variante.cadre_suivi.cause.pose} · {variante.cadre_suivi.cause.direction || "sans direction"} ({variante.cadre_suivi.avant.largeur} × {variante.cadre_suivi.avant.hauteur} → {variante.cadre_suivi.apres.largeur} × {variante.cadre_suivi.apres.hauteur} px). Le calque et les retouches ont glissé d’autant : rien n’est perdu.</p>}

      <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto">
        {variante.role === "reference" && <p className="text-[12px] leading-[1.45] text-encre-3">Une référence d’apparence ne devient pas une couche : elle sert à regarder. Pour en tirer un calque, associez le personnage équipé comme « image à extraire ».</p>}

        {extraction && brouillon.extraction && <>
          <Etape numero={1} titre="Pose de référence">
            <button type="button" onClick={() => setVue("base")} className="flex items-center gap-[8px] rounded-7 border border-trait p-[4px] text-left hover:border-contour"><img src={apiCalques.image(chemin, variante, "base")} alt="" className="damier-papier h-[54px] w-[54px] shrink-0 object-contain" style={{ imageRendering: "pixelated" }} /><span className="text-[12px] text-encre">{pose}<span className="block text-[11px] text-encre-3">{variante.base.cadre_de_la_pose ? `${variante.base.cadre_de_la_pose.largeur} × ${variante.base.cadre_de_la_pose.hauteur} px, posée au pied d’un cadre commun de ${largeur} × ${hauteur}` : `${largeur} × ${hauteur} px, telle que sa recette la rend`}</span></span></button>
          </Etape>
          <Etape numero={2} titre="Image équipée, lue comme la pose">
            <button type="button" onClick={() => setVue("source")} className="flex items-center gap-[8px] rounded-7 border border-trait p-[4px] text-left hover:border-contour"><img src={apiCalques.image(chemin, variante, "source")} alt="" className="damier-papier h-[54px] w-[54px] shrink-0 object-contain" style={{ imageRendering: "pixelated" }} /><span className="min-w-0 truncate text-[12px] text-encre">{variante.source_fiche.label || "Image équipée"}<span className="block text-[11px] text-encre-3">{cadreSource.largeur} × {cadreSource.hauteur} px</span></span></button>
            <LectureDeLaSource preparation={preparation} nomDeLaPose={pose} pose={nomDeLaPose ?? variante.base.pose} attente={attente} onAgrandir={() => relire("pose", true)} />
            <div role="group" aria-label="Recette de l’image équipée" className="flex gap-[4px] rounded-7 bg-papier-cote p-[4px]">
              <button type="button" aria-pressed={preparation?.recette === "pose"} disabled={attente || preparation?.recette === "pose"} onClick={() => relire("pose", preparation?.echelle ?? true)} className={`h-[30px] flex-1 rounded-7 px-[8px] text-[12px] ${preparation?.recette === "pose" ? "bg-carte text-encre" : "text-encre-3"}`}>Recette de la pose</button>
              <button type="button" aria-pressed={preparation?.recette === "sienne" || !preparation} disabled={attente || preparation?.recette === "sienne"} onClick={() => relire("sienne", preparation?.echelle ?? true)} className={`h-[30px] flex-1 rounded-7 px-[8px] text-[12px] ${preparation?.recette !== "pose" ? "bg-carte text-encre" : "text-encre-3"}`}>Sa propre recette</button>
            </div>
            <label className="flex items-center gap-[8px] text-[12px] text-encre-2"><input type="checkbox" className="accent-signal" checked={preparation?.echelle ?? false} disabled={attente} onChange={(e) => relire(preparation?.recette ?? "sienne", e.target.checked)} />Ramener le corps à l’échelle de la pose</label>
            <div className="flex flex-wrap gap-[8px]">
              {onRetoucher && <button type="button" className={CONTROLE} disabled={attente || sale} title={sale ? "Enregistrez ou abandonnez d’abord le calage" : undefined} onClick={() => onRetoucher(variante.source)}>Retoucher l’image équipée…</button>}
              {preparation?.recette !== "pose" && <button type="button" className={CONTROLE} disabled={attente} onClick={() => relire("sienne", preparation?.echelle ?? false)}>Relire après retouche</button>}
              {variante.planche_d_origine && <button type="button" className={CONTROLE} disabled={attente || sale} title="Reprend la case entière de l’image reçue, sans nouvel appel au modèle" onClick={() => void action(() => apiCalques.relireDepuisLaPlanche(chemin, variante.identifiant, variante.revision))}>Relire depuis l’image reçue</button>}
            </div>
            {onRetoucher && <p className="text-[11px] leading-[1.45] text-encre-4">La retouche ordinaire change l’image dans la bibliothèque. Reviens ici et choisis « Sa propre recette » pour la relire.</p>}
          </Etape>
          <Etape numero={3} titre="Caler les deux corps">
            <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Outil<select aria-label="Outil du calque" value={outil} onChange={(e) => setOutil(e.target.value as Outil)} className={CONTROLE}><option value="deplacer">{outils.deplacer}</option><option value="vue">{outils.vue}</option></select></label>
            <Mesure nom="Échelle" valeur={reglage.echelle} min={.25} max={4} pas={.01} onChange={(v) => nombre("echelle", v)} />
            <Mesure nom="Déplacement horizontal" valeur={reglage.dx} min={-largeur} max={largeur} onChange={(v) => nombre("dx", v)} />
            <Mesure nom="Déplacement vertical" valeur={reglage.dy} min={-hauteur} max={hauteur} onChange={(v) => nombre("dy", v)} />
            <Mesure nom="Visibilité de l’image équipée" valeur={transparence} min={0} max={100} onChange={(v) => { setTransparence(v); setVue("superposes") }} />
            <button className={CONTROLE} disabled={attente} onClick={async () => { setAttente(true); try { const proposition = await apiCalques.aligner(chemin, variante.identifiant); changer({ ...brouillon, extraction: { ...brouillon.extraction!, dx: proposition.dx, dy: proposition.dy, echelle: proposition.echelle } }) } catch (e) { setErreur(e instanceof Error ? e.message : "Le recalage n’a pas abouti.") } finally { setAttente(false) } }}>Caler automatiquement les deux corps</button>
            {preparation?.echelle && <p className="text-[11px] leading-[1.45] text-encre-4">L’image équipée arrive déjà à l’échelle de la pose : le calage part d’une échelle de 1 et d’un décalage nul.</p>}
          </Etape>
          <Etape numero={4} titre="Isoler ce qui s’ajoute">
            <Mesure nom="Seuil de différence" valeur={brouillon.extraction.seuil} min={0} max={255} onChange={(v) => changer({ ...brouillon, extraction: { ...brouillon.extraction!, seuil: v } })} />
            <p className="text-[12px] leading-[1.45] text-encre-3">La différence garde ce que l’image équipée ajoute à la pose. « Ce qui sera extrait » le montre avant d’extraire.</p>
            <button disabled={attente || calcul} className={PRINCIPAL} onClick={() => void action(() => apiCalques.extraire(chemin, variante.identifiant, brouillon.extraction!))}>Extraire une nouvelle variante</button>
          </Etape>
          <Etape numero={5} titre="Retoucher à la main">
            <p className="text-[12px] leading-[1.45] text-encre-3">L’extraction ouvre une variante « À vérifier » : effacez ce qui a été pris en trop, restaurez ce qui manque, masquez le corps sous la pièce, puis retenez-la.</p>
          </Etape>
        </>}

        {extrait && <>
          {/* **PX9 — la pièce d'une zone repeinte suit son image** : elle se
              corrige dans la retouche de cette image (la main, l'éditeur de
              pixels, un pixel ramené de l'image du moteur), et la variante
              recopie la correction à sa prochaine lecture. */}
          {variante.calque_suit_l_image && variante.calque_asset && onRetoucher && (
            <Etape titre="La pièce repeinte">
              <p className="text-[12px] leading-[1.45] text-encre-3">Ce calque vient de « Repeindre ». Il se corrige dans la retouche de sa pièce — y compris pour ramener un pixel de l’image rendue par le moteur — et revient ici corrigé.</p>
              <button type="button" data-retoucher-la-piece className={CONTROLE} disabled={attente || sale} title={sale ? "Enregistrez ou abandonnez d’abord le calage" : undefined} onClick={() => onRetoucher(variante.calque_asset!)}>Retoucher la pièce…</button>
            </Etape>
          )}
          <Etape titre="Retoucher à la main">
            <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Outil<select aria-label="Outil du calque" value={outil} onChange={(e) => setOutil(e.target.value as Outil)} className={CONTROLE}>{Object.entries(outils).map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
            {!["deplacer", "vue"].includes(outil) && <Mesure nom="Rayon du pinceau" valeur={rayon} min={0} max={32} onChange={setRayon} />}
          </Etape>
          <Etape titre="Placer le calque">
            <Mesure nom="Échelle" valeur={reglage.echelle} min={.01} max={16} pas={.01} onChange={(v) => nombre("echelle", v)} />
            <Mesure nom="Déplacement horizontal" valeur={reglage.dx} min={-largeur} max={largeur} onChange={(v) => nombre("dx", v)} />
            <Mesure nom="Déplacement vertical" valeur={reglage.dy} min={-hauteur} max={hauteur} onChange={(v) => nombre("dy", v)} />
            <Mesure nom="Rotation" valeur={brouillon.placement.rotation} min={-180} max={180} onChange={(v) => nombre("rotation", v)} />
            <Mesure nom="Opacité" valeur={brouillon.placement.opacite} min={0} max={1} pas={.01} onChange={(v) => nombre("opacite", v)} />
          </Etape>
          <Etape titre="Dessus ou dessous">
            <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Ordre par défaut<select aria-label="Ordre du calque" value={String(brouillon.placement.devant)} onChange={(e) => changer({ ...brouillon, placement: { ...brouillon.placement, devant: e.target.value === "true" } })} className={CONTROLE}><option value="true">Au-dessus du corps</option><option value="false">Sous le corps</option></select></label>
            {/* **L'ordre est celui des images, pas celui du regard.** La
                composition ne lit jamais la direction de la base
                (`atelier/image/calques_cibles.py`) : seuls `devant` et le masque
                `derriere` décident, et ils appartiennent à cette variante — donc
                à cette frame. Deux frames de la même bande peuvent ranger la même
                pièce à l'envers l'une de l'autre. */}
            <p className="text-[12px] leading-[1.45] text-encre-3">C’est l’ordre des images, pas la direction du regard : la direction de cette base ({variante.base.direction || "sans direction"}) ne change rien. Avec « Passer cette partie dessous » et « Ramener cette partie dessus », une partie de la pièce passe sous le personnage et le reste au-dessus — sur cette image seule.</p>
            <p className="text-[11px] leading-[1.45] text-encre-4">{brouillon.masques.derriere.length ? `${brouillon.masques.derriere.length} passage${brouillon.masques.derriere.length > 1 ? "s" : ""} peint${brouillon.masques.derriere.length > 1 ? "s" : ""} ici : une partie de la pièce ne suit pas l’ordre par défaut.` : "Aucun passage peint ici : toute la pièce suit l’ordre par défaut."}</p>
            <Mesure nom="Ordre entre équipements" valeur={brouillon.placement.ordre} min={-1000} max={1000} onChange={(v) => nombre("ordre", v)} />
          </Etape>
        </>}
      </div>

      <div className="flex shrink-0 flex-col gap-[8px] border-t border-trait pt-[14px]">
        {extrait && <div className="flex flex-wrap gap-[8px]">
          <button disabled={attente || !sale} className={CONTROLE} onClick={() => void action(() => apiCalques.regler(chemin, variante.identifiant, variante.revision, brouillon))}>Enregistrer les corrections</button>
          <button disabled={attente || sale || calcul || variante.etat === "a-revoir"} className={PRINCIPAL} onClick={() => void action(() => apiCalques.valider(chemin, variante.identifiant, variante.revision))}>Vérifier et retenir cette variante</button>
        </div>}
        {sale && <button className={`${CONTROLE} self-start`} disabled={attente} onClick={() => { setBrouillon(copie(garde)); setAnnulations([]); setRetablissements([]) }}>Abandonner les corrections</button>}
        <p className="text-[11px] text-encre-4">{variante.historique.length} révision(s) conservée(s). Cette variante ne modifie ni le corps original, ni les autres personnages. Ctrl + molette : zoom · Espace + glisser : déplacer la vue.</p>
      </div>
    </aside>
  </section>
}
