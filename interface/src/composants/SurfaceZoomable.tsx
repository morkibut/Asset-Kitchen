import { useEffect, useRef, useState } from "react"
import { type ZoomTable } from "../recette"
import { BarreDuZoom } from "./CommandesDuZoom"

/** Le zoom ne change que la vue. Les outils gardent leurs coordonnées image. */
export function SurfaceZoomable({ largeur, hauteur, children, libelle = "la surface" }: {
  largeur: number; hauteur: number; children: React.ReactNode; libelle?: string
}) {
  const vue = useRef<HTMLDivElement>(null)
  const [taille, setTaille] = useState({ largeur: 1, hauteur: 1 })
  /** En pour cent, comme partout dans l'atelier ; `ajuste` fait tenir l'image. */
  const [zoom, setZoom] = useState<ZoomTable>("ajuste")
  const [espace, setEspace] = useState(false)
  const pan = useRef<{ x: number; y: number; gauche: number; haut: number } | null>(null)
  const ajuste = Math.min(taille.largeur / Math.max(1, largeur), taille.hauteur / Math.max(1, hauteur))
  const facteur = zoom === "ajuste" ? ajuste : zoom / 100
  const changer = (valeur: number) => setZoom(Math.max(1, Math.min(3200, Math.round(valeur * 100))))
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
    <BarreDuZoom zoom={zoom} ajuste={Math.round(ajuste * 100)} maximum={3200} libelle={`Zoom de ${libelle}`}
      onZoom={(suite) => { setZoom(suite); if (suite === "ajuste" && vue.current) { vue.current.scrollLeft = 0; vue.current.scrollTop = 0 } }} />
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
