import { useEffect, useRef, useState } from "react"

/** Le zoom ne change que la vue. Les outils gardent leurs coordonnées image. */
export function SurfaceZoomable({ largeur, hauteur, children, libelle = "la surface" }: {
  largeur: number; hauteur: number; children: React.ReactNode; libelle?: string
}) {
  const vue = useRef<HTMLDivElement>(null)
  const [taille, setTaille] = useState({ largeur: 1, hauteur: 1 })
  const [zoom, setZoom] = useState<number | null>(null)
  const [espace, setEspace] = useState(false)
  const pan = useRef<{ x: number; y: number; gauche: number; haut: number } | null>(null)
  const ajuste = Math.min(taille.largeur / Math.max(1, largeur), taille.hauteur / Math.max(1, hauteur))
  const facteur = zoom ?? ajuste
  const changer = (valeur: number) => setZoom(Math.max(0.03125, Math.min(32, valeur)))
  useEffect(() => {
    const noeud = vue.current
    if (!noeud) return
    const molette = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      changer(facteur * (e.deltaY < 0 ? 1.2 : 1 / 1.2))
    }
    // React pose les événements wheel en passif : seul ce listener empêche
    // le navigateur de zoomer aussi toute l’application.
    noeud.addEventListener("wheel", molette, { passive: false })
    return () => noeud.removeEventListener("wheel", molette)
  }, [facteur])
  useEffect(() => {
    const noeud = vue.current
    if (!noeud) return
    const mesurer = () => setTaille({ largeur: Math.max(1, noeud.clientWidth - 28), hauteur: Math.max(1, noeud.clientHeight - 28) })
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(noeud)
    return () => observateur.disconnect()
  }, [])
  useEffect(() => {
    const clavier = (event: KeyboardEvent) => {
      if (event.code !== "Space" || (event.target as HTMLElement)?.closest("input, textarea, select, button, [contenteditable=true]")) return
      event.preventDefault(); setEspace(event.type === "keydown")
    }
    const relacher = () => { setEspace(false); pan.current = null }
    window.addEventListener("keydown", clavier); window.addEventListener("keyup", clavier); window.addEventListener("blur", relacher)
    return () => { window.removeEventListener("keydown", clavier); window.removeEventListener("keyup", clavier); window.removeEventListener("blur", relacher) }
  }, [])
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-[8px] border-b border-trait p-[8px] text-[12px]">
      <button type="button" aria-label={`Réduire ${libelle}`} onClick={() => changer(facteur / 1.5)}>−</button>
      <label className="flex items-center gap-[4px]"><input aria-label={`Zoom de ${libelle}`} type="number" min={3.125} max={3200}
        value={Math.round(facteur * 100)} onChange={(e) => changer(Number(e.target.value) / 100)} className="w-[70px] rounded-5 border border-trait bg-carte p-[4px]" /> %</label>
      <button type="button" aria-label={`Agrandir ${libelle}`} onClick={() => changer(facteur * 1.5)}>+</button>
      <button type="button" onClick={() => { setZoom(null); if (vue.current) { vue.current.scrollLeft = 0; vue.current.scrollTop = 0 } }}>Adapter</button>
      <button type="button" onClick={() => changer(1)}>100 %</button>
      <span className="text-[11px] text-encre-3">Ctrl + molette · Espace + glisser</span>
    </div>
    <div ref={vue} tabIndex={0} aria-label={`Vue de ${libelle}`} className="defile flex min-h-0 min-w-0 flex-1 overflow-auto p-[14px] outline-none"
      onPointerDownCapture={(e) => {
        if (!espace && e.button !== 1) return
        e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId)
        pan.current = { x: e.clientX, y: e.clientY, gauche: e.currentTarget.scrollLeft, haut: e.currentTarget.scrollTop }
      }}
      onPointerMoveCapture={(e) => { if (!pan.current) return; e.stopPropagation(); e.currentTarget.scrollLeft = pan.current.gauche + pan.current.x - e.clientX; e.currentTarget.scrollTop = pan.current.haut + pan.current.y - e.clientY }}
      onPointerUpCapture={(e) => { if (pan.current) { e.stopPropagation(); pan.current = null } }}
      onPointerCancel={() => { pan.current = null }}>
      <div className="m-auto shrink-0" style={{ width: largeur * facteur, height: hauteur * facteur }}>{children}</div>
    </div>
  </div>
}
