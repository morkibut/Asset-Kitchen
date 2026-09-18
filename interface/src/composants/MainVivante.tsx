/**
 * **La Main en direct** (16 septembre 2026) — effacer ou peindre se voit tout
 * de suite, comme dans un logiciel de dessin.
 *
 * Avant, chaque trait attendait l'aperçu du serveur (une seconde et demie) :
 * on voyait le trait orange, puis rien, puis le résultat. Maintenant l'écran
 * rejoue lui-même, sur la frame déjà rendue, les traits que le serveur n'a
 * pas encore rendus. Quand l'aperçu revient, il remplace ce dessin.
 *
 * Le pinceau est celui du serveur (`pinceau`, `retoucher` dans
 * `atelier/image/traitement.py`) : les points reliés d'un trait d'un pixel,
 * puis un carré de côté 2 × rayon + 1 posé sur chaque pixel du chemin.
 *
 * Deux gestes ne se devinent pas ici, et attendent le serveur :
 * - remettre un pixel effacé (sa couleur n'est plus lisible dans la planche) —
 *   on montre la zone en blanc translucide ;
 * - effacer sur un calque de dessin (ce qu'il y avait dessous n'est pas connu).
 */

import { useEffect, useRef, useState } from "react"
import type { Main, Trait } from "../api"

export type CalqueEnAttente = { visible: boolean; passages: Trait[] }
export type Attente = { opacite: Trait[]; calques: CalqueEnAttente[] }

const pareil = (a: Trait, b: Trait) => a === b || JSON.stringify(a) === JSON.stringify(b)

/** Les passages `voulus` que la frame `rendue` n'a pas encore. **Seulement si
 *  l'un prolonge l'autre** : après un « Défaire », il n'y a rien à rejouer, et
 *  on attend le serveur plutôt que de montrer une image fausse. */
export function passagesEnAttente(rendue: Main | null | undefined, voulue: Main | null | undefined): Attente | null {
  if (!voulue) return null
  const avant: Main = rendue ?? { opacite: [], calques: [] }
  const suite = (deja: Trait[], tous: Trait[]): Trait[] | null => {
    if (deja.length > tous.length) return null
    for (let i = 0; i < deja.length; i++) if (!pareil(deja[i], tous[i])) return null
    return tous.slice(deja.length)
  }
  const opacite = suite(avant.opacite, voulue.opacite)
  if (!opacite || avant.calques.length > voulue.calques.length) return null
  const calques: CalqueEnAttente[] = []
  for (const [i, calque] of voulue.calques.entries()) {
    const reste = suite(avant.calques[i]?.passages ?? [], calque.passages)
    if (!reste) return null
    calques.push({ visible: calque.visible, passages: reste })
  }
  return { opacite, calques }
}

/** Les pixels couverts par un trait, sur une case `largeur` × `hauteur`. */
export function couverture(largeur: number, hauteur: number, trait: Trait): Uint8Array {
  const masque = new Uint8Array(largeur * hauteur)
  const rayon = Math.max(0, Math.floor(trait.rayon))
  const tamponner = (cx: number, cy: number) => {
    for (let y = Math.max(0, cy - rayon); y <= Math.min(hauteur - 1, cy + rayon); y++)
      for (let x = Math.max(0, cx - rayon); x <= Math.min(largeur - 1, cx + rayon); x++)
        masque[y * largeur + x] = 1
  }
  const borne = ([x, y]: [number, number]): [number, number] => [
    Math.max(0, Math.min(largeur - 1, Math.floor(x))),
    Math.max(0, Math.min(hauteur - 1, Math.floor(y))),
  ]
  const points = trait.points.map(borne)
  if (points.length === 1) tamponner(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) {
    // Bresenham : un pixel par pas, sans trou.
    let [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let erreur = dx + dy
    for (;;) {
      tamponner(x0, y0)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * erreur
      if (e2 >= dy) { erreur += dy; x0 += sx }
      if (e2 <= dx) { erreur += dx; y0 += sy }
    }
  }
  return masque
}

const rvb = (hexa: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexa.trim())
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Rejouer les passages en attente sur les pixels RGBA d'une frame. */
export function rejouer(pixels: Uint8ClampedArray, largeur: number, hauteur: number, attente: Attente): void {
  for (const trait of attente.opacite) {
    const masque = couverture(largeur, hauteur, trait)
    for (let i = 0; i < masque.length; i++) {
      if (!masque[i]) continue
      const o = i * 4
      if (!trait.garde) pixels[o + 3] = 0
      else if (pixels[o + 3] === 0) { pixels[o] = 255; pixels[o + 1] = 255; pixels[o + 2] = 255; pixels[o + 3] = 110 }
    }
  }
  for (const calque of attente.calques) {
    if (!calque.visible) continue
    for (const trait of calque.passages) {
      if (!trait.garde) continue
      const [r, v, b] = rvb(trait.couleur)
      const masque = couverture(largeur, hauteur, trait)
      for (let i = 0; i < masque.length; i++) {
        if (!masque[i]) continue
        const o = i * 4
        pixels[o] = r; pixels[o + 1] = v; pixels[o + 2] = b; pixels[o + 3] = 255
      }
    }
  }
}

/** La frame `rang` de la planche, avec les traits pas encore rendus par-dessus.
 *
 *  Tant que la planche n'est pas chargée dans la toile (et dans les essais, où
 *  elle ne l'est jamais), c'est l'image de fond d'avant qui se voit. Une
 *  planche neuve ne remplace le dessin qu'une fois chargée : pas d'éclair vide
 *  entre deux aperçus. */
export function FrameVivante({
  planche,
  rang,
  compte,
  large,
  haut,
  facteur,
  attente,
}: {
  planche: string
  rang: number
  compte: number
  large: number
  haut: number
  facteur: number
  attente: Attente | null
}) {
  const toile = useRef<HTMLCanvasElement | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [dessinee, setDessinee] = useState(false)

  useEffect(() => {
    if (typeof Image === "undefined") return
    let vivant = true
    const chargee = new Image()
    chargee.onload = () => { if (vivant) setImage(chargee) }
    chargee.src = planche
    return () => { vivant = false }
  }, [planche])

  useEffect(() => {
    const element = toile.current
    if (!element || !image || !large || !haut) return
    try {
      const contexte = element.getContext("2d", { willReadFrequently: true })
      if (!contexte) return
      contexte.clearRect(0, 0, large, haut)
      contexte.drawImage(image, rang * large, 0, large, haut, 0, 0, large, haut)
      if (attente && (attente.opacite.length || attente.calques.some((c) => c.passages.length))) {
        const donnees = contexte.getImageData(0, 0, large, haut)
        rejouer(donnees.data, large, haut, attente)
        contexte.putImageData(donnees, 0, 0)
      }
      setDessinee(true)
    } catch {
      /* la toile ne se lit pas : l'image de fond reste */
    }
  }, [image, rang, large, haut, attente])

  return (
    <>
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${planche})`,
          backgroundSize: `${large * compte * facteur}px ${haut * facteur}px`,
          backgroundPosition: `-${rang * large * facteur}px 0`,
          imageRendering: "pixelated",
          visibility: dessinee ? "hidden" : undefined,
        }}
      />
      <canvas
        ref={toile}
        data-frame-vivante
        aria-hidden
        width={large}
        height={haut}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />
    </>
  )
}
