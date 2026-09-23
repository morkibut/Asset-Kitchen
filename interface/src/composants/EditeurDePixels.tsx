/**
 * **L'éditeur de pixels** (16 septembre 2026) — la Main, dans une fenêtre.
 *
 * Demandé par l'auteur : peindre des pixels de plusieurs couleurs au clic
 * gauche, effacer au clic droit, dans un petit éditeur — outils et couleurs à
 * gauche, l'image au centre, « Valider les modifications » en bas. Tout se voit
 * **au pixel et tout de suite** : rien ne part au serveur avant de valider.
 *
 * Ce qui sort est une liste de coups, dans l'ordre. L'écran qui l'ouvre les
 * range dans la Main de la recette, où le serveur les rejoue : un coup de
 * pinceau devient un passage de calque, un coup de gomme efface l'opacité *et*
 * ce que le calque avait posé — sinon la peinture resterait par-dessus.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Main, Trait } from "../api"
import { avecPassage, OPACITE } from "../recette"
import { CadreDialogue } from "./CadreDialogue"
import { couverture, rejouer, type Attente } from "./MainVivante"

export type Coup = { sorte: "peindre" | "effacer"; trait: Trait }

/** Range les coups de l'éditeur dans la Main — la même règle pour une frame
 *  d'animation et pour une image (22 septembre 2026). Un coup de pinceau va
 *  sur le calque actif, ou le premier visible, ou un calque neuf ; un coup de
 *  gomme efface l'opacité *et* chaque calque. */
export function mainAvecLesCoups(depart: Main, actif: number, coups: Coup[]): Main {
  let main = depart
  let calque = actif !== OPACITE && main.calques[actif] ? actif : main.calques.findIndex((c) => c.visible)
  for (const coup of coups) {
    if (coup.sorte === "peindre") {
      if (calque < 0) {
        main = { ...main, calques: [...main.calques, { nom: `calque ${main.calques.length + 1}`, visible: true, passages: [] }] }
        calque = main.calques.length - 1
      }
      main = avecPassage(main, calque, coup.trait)
    } else {
      const gomme = { ...coup.trait, garde: false, couleur: "" }
      main = avecPassage(main, OPACITE, gomme)
      for (let i = 0; i < main.calques.length; i++) main = avecPassage(main, i, gomme)
    }
  }
  return main
}
type Outil = "pinceau" | "gomme" | "pipette"

const TAILLES = [1, 3, 5, 7] as const
const hexa = (r: number, v: number, b: number) =>
  `#${[r, v, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
const rvb = (couleur: string): [number, number, number] => {
  const n = parseInt(couleur.replace("#", ""), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function EditeurDePixels({
  titre,
  planche,
  rang,
  large,
  haut,
  attente,
  palette,
  couleurDepart,
  onValider,
  onFermer,
}: {
  titre: string
  planche: string
  rang: number
  large: number
  haut: number
  /** Ce que la Main a déjà posé et que la planche ne montre pas encore. */
  attente: Attente | null
  palette: readonly string[]
  couleurDepart: string
  onValider: (coups: Coup[]) => void
  onFermer: () => void
}) {
  const toile = useRef<HTMLCanvasElement | null>(null)
  const pixels = useRef<ImageData | null>(null)
  const [outil, setOutil] = useState<Outil>("pinceau")
  const [taille, setTaille] = useState<number>(1)
  const [couleur, setCouleur] = useState(couleurDepart)
  const [recentes, setRecentes] = useState<string[]>([])
  const [coups, setCoups] = useState<Coup[]>([])
  const [defaits, setDefaits] = useState<Coup[]>([])
  const [zoom, setZoom] = useState<number | null>(null)
  const [vise, setVise] = useState<[number, number] | null>(null)
  const zone = useRef<HTMLDivElement | null>(null)
  const [ajuste, setAjuste] = useState(8)
  const geste = useRef<{ sorte: Coup["sorte"]; points: [number, number][]; rayon: number; couleur: string } | null>(null)
  const origine = useRef<ImageData | null>(null)

  const facteur = zoom ?? ajuste
  /** Le pixel de l'image sous le curseur au moment d'un coup de molette, et
   *  la place du curseur : le zoom garde ce pixel-là sous la souris. */
  const ancre = useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const facteurCourant = useRef(facteur)
  facteurCourant.current = facteur

  // **Zoom à la molette, sur le curseur** (16 septembre 2026). Écouteur natif :
  // celui de React est passif et ne peut pas empêcher la page de défiler.
  useEffect(() => {
    const element = zone.current
    if (!element) return
    const molette = (e: WheelEvent) => {
      const cadre = toile.current?.getBoundingClientRect()
      if (!cadre) return
      e.preventDefault()
      const avant = facteurCourant.current
      const pas = Math.max(1, Math.round(avant * 0.25))
      const apres = Math.max(1, Math.min(64, avant + (e.deltaY < 0 ? pas : -pas)))
      if (apres === avant) return
      ancre.current = { px: (e.clientX - cadre.left) / avant, py: (e.clientY - cadre.top) / avant, x: e.clientX, y: e.clientY }
      setZoom(apres)
    }
    element.addEventListener("wheel", molette, { passive: false })
    return () => element.removeEventListener("wheel", molette)
  }, [])

  useLayoutEffect(() => {
    const a = ancre.current
    const element = zone.current
    const cadre = toile.current?.getBoundingClientRect()
    ancre.current = null
    if (!a || !element || !cadre) return
    element.scrollLeft += cadre.left + a.px * facteur - a.x
    element.scrollTop += cadre.top + a.py * facteur - a.y
  }, [facteur])

  // Le zoom « ajusté » : le plus grand facteur entier qui fait tenir la frame.
  useEffect(() => {
    const element = zone.current
    if (!element || typeof ResizeObserver === "undefined") return
    const mesurer = () => {
      const f = Math.floor(Math.min((element.clientWidth - 28) / large, (element.clientHeight - 28) / haut))
      if (f > 0) setAjuste(Math.max(1, Math.min(48, f)))
    }
    const observe = new ResizeObserver(mesurer)
    observe.observe(element)
    mesurer()
    return () => observe.disconnect()
  }, [large, haut])

  const afficher = useCallback(() => {
    const contexte = toile.current?.getContext("2d")
    if (contexte && pixels.current) contexte.putImageData(pixels.current, 0, 0)
  }, [])

  // La frame, lue une fois dans la planche, avec ce que la Main a déjà posé.
  useEffect(() => {
    if (typeof Image === "undefined") return
    let vivant = true
    const image = new Image()
    image.onload = () => {
      if (!vivant) return
      try {
        const hors = document.createElement("canvas")
        hors.width = large
        hors.height = haut
        const contexte = hors.getContext("2d", { willReadFrequently: true })
        if (!contexte) return
        contexte.drawImage(image, rang * large, 0, large, haut, 0, 0, large, haut)
        const donnees = contexte.getImageData(0, 0, large, haut)
        if (attente) rejouer(donnees.data, large, haut, attente)
        origine.current = new ImageData(new Uint8ClampedArray(donnees.data), large, haut)
        pixels.current = donnees
        afficher()
      } catch {
        /* planche illisible : l'éditeur reste vide, les coups se gardent */
      }
    }
    image.src = planche
    return () => { vivant = false }
    // La frame se lit à l'ouverture seulement : la suite, c'est l'éditeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Poser un coup sur les pixels affichés — le même pinceau que le serveur. */
  const poser = useCallback((coup: Coup, sur: ImageData) => {
    const masque = couverture(large, haut, coup.trait)
    const [r, v, b] = rvb(coup.trait.couleur)
    const d = sur.data
    for (let i = 0; i < masque.length; i++) {
      if (!masque[i]) continue
      const o = i * 4
      if (coup.sorte === "effacer") { d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = 0 }
      else { d[o] = r; d[o + 1] = v; d[o + 2] = b; d[o + 3] = 255 }
    }
  }, [large, haut])

  /** Tout redessiner depuis l'origine — pour défaire et refaire. */
  const rejouerTout = useCallback((liste: Coup[]) => {
    if (!origine.current) return
    const neuf = new ImageData(new Uint8ClampedArray(origine.current.data), large, haut)
    for (const coup of liste) poser(coup, neuf)
    pixels.current = neuf
    afficher()
  }, [afficher, poser, large, haut])

  const defaire = useCallback(() => {
    if (!coups.length) return
    const suite = coups.slice(0, -1)
    setDefaits([...defaits, coups[coups.length - 1]])
    setCoups(suite)
    rejouerTout(suite)
  }, [coups, defaits, rejouerTout])
  const refaire = useCallback(() => {
    if (!defaits.length) return
    const suite = [...coups, defaits[defaits.length - 1]]
    setDefaits(defaits.slice(0, -1))
    setCoups(suite)
    rejouerTout(suite)
  }, [coups, defaits, rejouerTout])

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return
      const touche = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && touche === "z") { e.preventDefault(); if (e.shiftKey) refaire(); else defaire(); return }
      if ((e.ctrlKey || e.metaKey) && touche === "y") { e.preventDefault(); refaire(); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (touche === "b") setOutil("pinceau")
      if (touche === "e") setOutil("gomme")
      if (touche === "i") setOutil("pipette")
    }
    window.addEventListener("keydown", clavier)
    return () => window.removeEventListener("keydown", clavier)
  }, [defaire, refaire])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const cadre = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - cadre.left) / (cadre.width || 1)) * large)
    const y = Math.floor(((e.clientY - cadre.top) / (cadre.height || 1)) * haut)
    return [Math.max(0, Math.min(large - 1, x)), Math.max(0, Math.min(haut - 1, y))]
  }

  const prendreLaCouleur = (x: number, y: number) => {
    const d = pixels.current?.data
    if (!d) return
    const o = (y * large + x) * 4
    if (d[o + 3] === 0) return
    choisirLaCouleur(hexa(d[o], d[o + 1], d[o + 2]))
  }
  const choisirLaCouleur = (suite: string) => {
    setCouleur(suite)
    setRecentes((liste) => [suite, ...liste.filter((c) => c !== suite)].slice(0, 8))
  }

  const tracer = (x: number, y: number) => {
    const g = geste.current
    if (!g) return
    const dernier = g.points[g.points.length - 1]
    if (dernier && dernier[0] === x && dernier[1] === y) return
    const segment: Coup = {
      sorte: g.sorte,
      trait: { garde: true, rayon: g.rayon, couleur: g.couleur, points: dernier ? [dernier, [x, y]] : [[x, y]] },
    }
    g.points.push([x, y])
    if (pixels.current) { poser(segment, pixels.current); afficher() }
  }

  const finir = () => {
    const g = geste.current
    geste.current = null
    if (!g || !g.points.length) return
    const coup: Coup = {
      sorte: g.sorte,
      trait: { garde: g.sorte === "peindre", rayon: g.rayon, couleur: g.sorte === "peindre" ? g.couleur : "", points: g.points },
    }
    setCoups((liste) => [...liste, coup])
    setDefaits([])
    if (g.sorte === "peindre") setRecentes((liste) => [g.couleur, ...liste.filter((c) => c !== g.couleur)].slice(0, 8))
  }

  const rayon = (taille - 1) / 2
  const couleurs = [...new Set(palette.map((c) => c.toLowerCase()))]

  const BOUTON = "h-[30px] rounded-7 border px-[8px] text-[12px] transition-colors duration-120"
  const bouton = (actif: boolean) => `${BOUTON} ${actif ? "border-encre-3 bg-carte text-encre" : "border-trait bg-papier text-encre-3 hover:border-contour"}`

  return (
    <CadreDialogue
      titre={titre}
      onFermer={onFermer}
      enfants={
        <div data-editeur-de-pixels className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-[14px] border-b border-trait px-[22px] py-[14px]">
            <div className="min-w-0">
              <h1 className="truncate font-serif text-[25px]">{titre}</h1>
              <p className="text-[12px] text-encre-3">Clic gauche : peindre · clic droit : effacer · molette : zoom · Ctrl + Z : défaire</p>
            </div>
            <button type="button" onClick={onFermer} className={bouton(false)}>Fermer sans garder</button>
          </header>

          <div className="flex min-h-0 flex-1">
            {/* ── Outils et couleurs ── */}
            <aside className="defile flex w-[240px] shrink-0 flex-col gap-[14px] overflow-y-auto border-r border-trait p-[14px] text-[12px] text-encre-3">
              <section className="flex flex-col gap-[4px]">
                <span>Outil</span>
                <div className="flex flex-col gap-[4px]">
                  {([["pinceau", "Pinceau", "B"], ["gomme", "Gomme", "E"], ["pipette", "Pipette", "I"]] as const).map(([cle, nom, raccourci]) => (
                    <button key={cle} type="button" aria-pressed={outil === cle} aria-label={nom} title={`${nom} (${raccourci})`} onClick={() => setOutil(cle)} className={`${bouton(outil === cle)} flex items-center justify-between`}><span>{nom}</span><span aria-hidden className="text-[11px] text-encre-4">{raccourci}</span></button>
                  ))}
                </div>
              </section>
              <section className="flex flex-col gap-[4px]">
                <span>Taille</span>
                <div className="grid grid-cols-4 gap-[4px]">
                  {TAILLES.map((t) => (
                    <button key={t} type="button" aria-pressed={taille === t} aria-label={`taille ${t} pixel${t > 1 ? "s" : ""}`} onClick={() => setTaille(t)} className={bouton(taille === t)}>{t}</button>
                  ))}
                </div>
              </section>
              <section className="flex flex-col gap-[8px]">
                <span>Couleur</span>
                <label className="flex items-center gap-[8px]">
                  <input type="color" aria-label="couleur du pinceau" value={couleur} onChange={(e) => choisirLaCouleur(e.target.value)} className="h-[34px] w-[70px] cursor-pointer rounded-5 border border-trait bg-carte p-0" />
                  <span className="font-mono text-encre-2">{couleur}</span>
                </label>
                {recentes.length > 0 && (
                  <div className="flex flex-col gap-[4px]">
                    <span className="text-[11px]">Récentes</span>
                    <Nuancier couleurs={recentes} courante={couleur} onChoisir={choisirLaCouleur} />
                  </div>
                )}
                {couleurs.length > 0 && (
                  <div className="flex flex-col gap-[4px]">
                    <span className="text-[11px]">Palette du jeu</span>
                    <Nuancier couleurs={couleurs} courante={couleur} onChoisir={choisirLaCouleur} />
                  </div>
                )}
              </section>
              <section className="flex flex-col gap-[4px]">
                <span>Zoom</span>
                <div className="flex items-center gap-[4px]">
                  <button type="button" aria-label="dézoomer" onClick={() => setZoom(Math.max(1, facteur - 1))} className={bouton(false)}>−</button>
                  <span className="min-w-[34px] text-center text-encre-2">×{facteur}</span>
                  <button type="button" aria-label="zoomer" onClick={() => setZoom(Math.min(64, facteur + 1))} className={bouton(false)}>+</button>
                  <button type="button" onClick={() => setZoom(null)} className={bouton(zoom === null)}>Ajuster</button>
                </div>
              </section>
              <section className="flex gap-[4px]">
                <button type="button" onClick={defaire} disabled={!coups.length} className={`${bouton(false)} flex-1 disabled:opacity-50`}>Défaire</button>
                <button type="button" onClick={refaire} disabled={!defaits.length} className={`${bouton(false)} flex-1 disabled:opacity-50`}>Refaire</button>
              </section>
            </aside>

            {/* ── L'image ── */}
            <div
              ref={zone}
              className="defile flex min-h-0 min-w-0 flex-1 overflow-auto bg-pourtour p-[14px]"
            >
              <div className="relative m-auto shrink-0 damier-papier" style={{ width: large * facteur, height: haut * facteur }}>
                <canvas
                  ref={toile}
                  data-toile-editeur
                  width={large}
                  height={haut}
                  className="absolute inset-0 h-full w-full touch-none"
                  style={{ imageRendering: "pixelated", cursor: outil === "pipette" ? "copy" : "crosshair" }}
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    if (e.button !== 0 && e.button !== 2) return
                    e.preventDefault()
                    const [x, y] = point(e)
                    if (e.button === 0 && outil === "pipette") { prendreLaCouleur(x, y); return }
                    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointeur déjà relâché */ }
                    const sorte = e.button === 2 || outil === "gomme" ? "effacer" : "peindre"
                    geste.current = { sorte, points: [], rayon, couleur }
                    tracer(x, y)
                  }}
                  onPointerMove={(e) => {
                    const [x, y] = point(e)
                    setVise([x, y])
                    tracer(x, y)
                  }}
                  onPointerUp={finir}
                  onPointerCancel={finir}
                  onPointerLeave={() => setVise(null)}
                />
                {facteur >= 8 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(to right, color-mix(in srgb, var(--color-encre) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-encre) 8%, transparent) 1px, transparent 1px)",
                      backgroundSize: `${facteur}px ${facteur}px`,
                    }}
                  />
                )}
                {vise && outil !== "pipette" && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute border border-signal"
                    style={{ left: (vise[0] - rayon) * facteur, top: (vise[1] - rayon) * facteur, width: taille * facteur, height: taille * facteur }}
                  />
                )}
              </div>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte px-[22px] py-[14px]">
            <p role="status" className="text-[12px] text-encre-3">
              {coups.length === 0 ? "Aucune modification." : `${coups.length} modification${coups.length > 1 ? "s" : ""}${vise ? ` · pixel ${vise[0]}, ${vise[1]}` : ""}`}
            </p>
            <div className="flex gap-[8px]">
              <button type="button" onClick={onFermer} className="h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px]">Annuler</button>
              <button type="button" data-valider-les-pixels disabled={!coups.length} onClick={() => onValider(coups)} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">
                Valider les modifications
              </button>
            </div>
          </footer>
        </div>
      }
    />
  )
}

function Nuancier({ couleurs, courante, onChoisir }: { couleurs: readonly string[]; courante: string; onChoisir: (c: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-[4px]">
      {couleurs.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`couleur ${c}`}
          aria-pressed={c.toLowerCase() === courante.toLowerCase()}
          title={c}
          onClick={() => onChoisir(c)}
          className={`h-[22px] rounded-5 border ${c.toLowerCase() === courante.toLowerCase() ? "border-encre ring-1 ring-encre" : "border-trait"}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}
