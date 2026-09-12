import { useEffect, useRef, useState, type PointerEvent } from "react"
import { apiCalques, cleCible, ETAT_CALQUE, type BrouillonCalque, type CheminEmploi, type ImageCible, type VarianteCalque } from "../api-calques"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle disabled:text-eteint"
const copie = <T,>(valeur: T): T => structuredClone(valeur)
const outils = { deplacer: "Déplacer le calque", vue: "Déplacer la vue", effacer: "Effacer le calque", restaurer: "Restaurer le calque", masquer: "Masquer le corps", corps: "Restaurer le corps", dessous: "Passer cette partie dessous", dessus: "Ramener cette partie dessus" }
type Outil = keyof typeof outils

function Mesure({ nom, valeur, min, max, pas = 1, onChange }: { nom: string; valeur: number; min: number; max: number; pas?: number; onChange: (v: number) => void }) {
  const poser = (v: number) => { if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v))) }
  return <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">{nom}<span className="flex items-center gap-[8px]"><input aria-label={nom} type="range" min={min} max={max} step={pas} value={valeur} onChange={(e) => poser(Number(e.target.value))} className="min-w-0 flex-1 accent-signal" /><input aria-label={`${nom} — valeur`} type="number" min={min} max={max} step={pas} value={valeur} onChange={(e) => poser(Number(e.target.value))} className={`${CONTROLE} w-[70px]`} /></span></label>
}

/** L’aperçu vient du même compositeur CPU que le rendu gardé. Les coordonnées
 * des masques locaux sont inversées avant stockage : zoom et placement ne
 * déplacent jamais une peinture déjà posée. */
export function EditeurCalqueCible({ chemin, variante, cibles = [], onGarde, onSale }: {
  chemin: CheminEmploi; variante: VarianteCalque; cibles?: ImageCible[]
  onGarde: (v: VarianteCalque) => void; onSale: (sale: boolean) => void
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
  const [zoom, setZoom] = useState(400)
  const [vue, setVue] = useState<"composition" | "calque" | "base" | "source">("composition")
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
  useEffect(() => {
    if (variante.role === "reference") { setUrl(apiCalques.image(chemin, variante, "source")); return }
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
    const pan = espace.current || e.button === 1 || outil === "vue" || !modifiable || vue !== "composition"
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

  return <section aria-label="Éditeur du calque ciblé" className="flex min-h-0 flex-1 flex-col">
    <div className="flex flex-wrap items-center gap-[8px] border-b border-trait p-[14px]">
      <strong className="text-[13px] text-encre">{ETAT_CALQUE[variante.etat]}{variante.retenue ? " · retenue" : ""}</strong>
      <span className="text-[12px] text-encre-3">{largeur} × {hauteur} px · repère {variante.base.repere.x}, {variante.base.repere.y}</span>
      <span role="status" className="ml-auto text-[12px] text-encre-3">{calcul ? "Calcul de l’aperçu…" : sale ? "Modifications non enregistrées" : "Réglages enregistrés"}</span>
    </div>
    {erreur && <p role="alert" className="px-[14px] py-[8px] text-[13px] text-echec">{erreur}</p>}
    {variante.raison && <div className="border-b border-trait bg-carte p-[14px] text-[13px] text-encre-2"><p>{variante.raison}. Les anciens pixels et les masques sont conservés.</p><label className="mt-[8px] flex items-center gap-[8px]">Base à adopter<select className={`${CONTROLE} min-w-0 flex-1`} aria-label="Nouvelle base du calque" value={nouvelleBase} onChange={(e) => setNouvelleBase(e.target.value)}>{!cibles.some((c) => cleCible(c.cible) === cleCible(variante.cible)) && <option value={cleCible(variante.cible)} disabled>La base d’origine n’est plus disponible</option>}{cibles.map((c) => <option key={cleCible(c.cible)} value={cleCible(c.cible)}>{c.pose} · {c.direction || "sans direction"} · {c.cible.nature === "frame" ? `${c.nom_bande} frame ${(c.rang ?? 0) + 1}` : c.image?.label || "image fixe"}</option>)}</select></label><button disabled={sale || attente || !cibles.some((c) => cleCible(c.cible) === nouvelleBase)} onClick={() => void action(() => apiCalques.adopter(chemin, variante.identifiant, variante.revision, cibles.find((c) => cleCible(c.cible) === nouvelleBase)!.cible))} className={`${CONTROLE} mt-[8px]`}>Adopter cette base, puis revérifier</button></div>}
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-[8px] p-[14px]">
          <select aria-label="Vue du calque" value={vue} onChange={(e) => setVue(e.target.value as typeof vue)} className={CONTROLE}><option value="composition">Personnage équipé</option>{modifiable && <option value="calque">Calque seul</option>}<option value="base">Base conservée</option><option value="source">Image source</option></select>
          <button className={CONTROLE} aria-label="Dézoomer le calque" onClick={() => setZoom((z) => Math.max(25, z / 2))}>−</button><label className="flex items-center gap-[4px] text-[12px] text-encre-3"><input aria-label="Zoom du calque en pourcentage" type="number" min="25" max="3200" value={zoom} onChange={(e) => setZoom(Math.max(25, Math.min(3200, Number(e.target.value) || 25)))} className={`${CONTROLE} w-[70px]`} />%</label><button className={CONTROLE} aria-label="Zoomer le calque" onClick={() => setZoom((z) => Math.min(3200, z * 2))}>+</button><button className={CONTROLE} onClick={() => setZoom(100)}>1:1</button>
        </div>
        <div ref={viewport} className="defile min-h-0 flex-1 overflow-auto bg-pourtour p-[22px]" onWheel={(e) => { if (e.ctrlKey || e.altKey) { e.preventDefault(); setZoom((z) => Math.max(25, Math.min(3200, Math.round(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))))) } }}>
          <div role="application" aria-label="Image équipée — glisser pour déplacer, espace pour déplacer la vue" tabIndex={0} className="relative w-fit touch-none outline-none" onPointerDown={commencer} onPointerMove={bouger} onPointerUp={() => { geste.current = null }} onPointerCancel={() => { geste.current = null }} onPointerLeave={() => setCurseur(null)} onKeyDown={(e) => { if (e.code === "Space") { espace.current = true; e.preventDefault() }; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) retablir(); else annuler() } }} onKeyUp={(e) => { if (e.code === "Space") espace.current = false }} onBlur={() => { espace.current = false; geste.current = null }}>
            {url ? <img ref={image} src={url} draggable={false} alt="Aperçu du calque sur sa base" width={largeur} height={hauteur} className="damier-papier block max-w-none" style={{ width: largeur * zoom / 100, height: hauteur * zoom / 100, imageRendering: "pixelated" }} /> : <p className="text-[13px] text-encre-3">Préparation de l’image…</p>}
            {curseur && extrait && !["deplacer", "vue"].includes(outil) && vue === "composition" && <span aria-hidden className="pointer-events-none absolute border border-encre bg-carte/20" style={{ left: (curseur.x - rayon - .5) * zoom / 100, top: (curseur.y - rayon - .5) * zoom / 100, width: (2 * rayon + 1) * zoom / 100, height: (2 * rayon + 1) * zoom / 100 }} />}
          </div>
        </div>
        <p className="px-[14px] py-[8px] text-[11px] text-encre-4">Espace + glisser ou bouton du milieu : déplacer la vue. Ctrl/Alt + molette : zoomer. Les coordonnées restent celles de l’image.</p>
      </div>
      {modifiable && <aside aria-label="Outils du calque" className="defile flex w-[300px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[14px]">
        <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Outil<select aria-label="Outil du calque" value={outil} onChange={(e) => setOutil(e.target.value as Outil)} className={CONTROLE}>{Object.entries(outils).filter(([cle]) => extrait || cle === "deplacer" || cle === "vue").map(([cle, nom]) => <option key={cle} value={cle}>{nom}</option>)}</select></label>
        {extrait && !["deplacer", "vue"].includes(outil) && <Mesure nom="Rayon du pinceau" valeur={rayon} min={0} max={32} onChange={setRayon} />}
        <Mesure nom="Échelle" valeur={reglage.echelle} min={brouillon.extraction ? .25 : .01} max={brouillon.extraction ? 4 : 16} pas={.01} onChange={(v) => nombre("echelle", v)} />
        <Mesure nom="Déplacement horizontal" valeur={reglage.dx} min={-largeur} max={largeur} onChange={(v) => nombre("dx", v)} />
        <Mesure nom="Déplacement vertical" valeur={reglage.dy} min={-hauteur} max={hauteur} onChange={(v) => nombre("dy", v)} />
        {brouillon.extraction ? <>
          <Mesure nom="Seuil de différence" valeur={brouillon.extraction.seuil} min={0} max={255} onChange={(v) => changer({ ...brouillon, extraction: { ...brouillon.extraction!, seuil: v } })} />
          <button className={CONTROLE} disabled={attente} onClick={async () => { setAttente(true); try { const proposition = await apiCalques.aligner(chemin, variante.identifiant); changer({ ...brouillon, extraction: { ...brouillon.extraction!, dx: proposition.dx, dy: proposition.dy, echelle: proposition.echelle } }) } catch (e) { setErreur(e instanceof Error ? e.message : "Le recalage n’a pas abouti.") } finally { setAttente(false) } }}>Caler automatiquement les deux corps</button>
          <p className="text-[12px] text-encre-3">La différence isole ce qui s’ajoute. Un casque qui remplace les cheveux demandera ensuite une retouche du calque et du masque du corps.</p>
          <button disabled={attente || calcul} className={CONTROLE} onClick={() => void action(() => apiCalques.extraire(chemin, variante.identifiant, brouillon.extraction!))}>Extraire une nouvelle variante</button>
        </> : <>
          <Mesure nom="Rotation" valeur={brouillon.placement.rotation} min={-180} max={180} onChange={(v) => nombre("rotation", v)} />
          <Mesure nom="Opacité" valeur={brouillon.placement.opacite} min={0} max={1} pas={.01} onChange={(v) => nombre("opacite", v)} />
          <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Ordre par défaut<select aria-label="Ordre du calque" value={String(brouillon.placement.devant)} onChange={(e) => changer({ ...brouillon, placement: { ...brouillon.placement, devant: e.target.value === "true" } })} className={CONTROLE}><option value="true">Au-dessus du corps</option><option value="false">Sous le corps</option></select></label>
          <p className="text-[12px] text-encre-3">Cet ordre concerne les images superposées, quelle que soit la caméra. En vue 3/4, peignez « passer cette partie dessous » pour cacher la lame derrière une main et garder sa pointe devant.</p>
          <Mesure nom="Ordre entre équipements" valeur={brouillon.placement.ordre} min={-1000} max={1000} onChange={(v) => nombre("ordre", v)} />
          <button disabled={attente || !sale} className={CONTROLE} onClick={() => void action(() => apiCalques.regler(chemin, variante.identifiant, variante.revision, brouillon))}>Enregistrer les corrections</button>
          <button disabled={attente || sale || calcul || variante.etat === "a-revoir"} className={`${CONTROLE} font-medium`} onClick={() => void action(() => apiCalques.valider(chemin, variante.identifiant, variante.revision))}>Vérifier et retenir cette variante</button>
        </>}
        <div className="flex gap-[8px]"><button disabled={!annulations.length || attente} className={`${CONTROLE} flex-1`} onClick={annuler}>Annuler</button><button disabled={!retablissements.length || attente} className={`${CONTROLE} flex-1`} onClick={retablir}>Rétablir</button></div>
        {sale && <button className={CONTROLE} disabled={attente} onClick={() => { setBrouillon(copie(garde)); setAnnulations([]); setRetablissements([]) }}>Abandonner les corrections</button>}
        <p className="text-[11px] text-encre-4">{variante.historique.length} révision(s) conservée(s). Cette variante ne modifie ni le corps original, ni les autres personnages.</p>
      </aside>}
    </div>
  </section>
}
