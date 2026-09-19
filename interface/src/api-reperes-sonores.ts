// Les repères sonores d'un sujet (SN7) : « cette animation joue ce son à
// l'image N ». Un repère se pose sur une image d'une bande (comptée depuis 1)
// et désigne un emplacement du sujet (SN6). Les routes :
// `atelier/api/reperes_sonores.py`.
import { useCallback, useEffect, useRef, useState } from "react"
import { appeler } from "./api"

export type RepereSonore = {
  bande: string; image: number; cle: string
  /** Le nom de l'emplacement, et ce qu'on sait de la bande (null si elle n'existe plus). */
  nom: string | null; nom_bande: string | null; pose: string | null; direction: string | null
  compte: number | null; cadence: number | null
  /** Ce qui empêche le repère de sonner, en clair ; null s'il sonne. */
  signal: string | null
}
export type ReperesSonores = {
  projet: string; sujet: string; reperes: RepereSonore[]
  /** Pour chaque emplacement désigné : les sons que la salle d'essai joue. */
  sons: Record<string, string[]>
  revision: number
}

const base = (p: string, s: string) => `/projects/${encodeURIComponent(p)}/subjects/${encodeURIComponent(s)}/sound-cues`
const un = (p: string, s: string, bande: string, image: number, cle: string) =>
  `${base(p, s)}/${encodeURIComponent(bande)}/${image}/${encodeURIComponent(cle)}`

export const reperesSonores = {
  lire: (p: string, s: string) => appeler<ReperesSonores>(base(p, s)),
  poser: (p: string, s: string, bande: string, image: number, cle: string) => appeler<ReperesSonores>(un(p, s, bande, image, cle), { method: "PUT" }),
  retirer: (p: string, s: string, bande: string, image: number, cle: string) => appeler<ReperesSonores>(un(p, s, bande, image, cle), { method: "DELETE" }),
}

/** L'adresse d'écoute d'un son (sa révision courante). */
export const ecouteDuSon = (projet: string, son: string) =>
  `/api/projects/${encodeURIComponent(projet)}/sounds/${encodeURIComponent(son)}/preview.wav`

/** Une variante au hasard parmi `n`, **jamais deux fois la même de suite** —
 *  la règle de l'`AudioStreamRandomizer` livré (`playback_mode = 0`). */
export function variante(n: number, derniere: number | null, hasard: () => number = Math.random): number {
  if (n <= 1) return 0
  if (derniere === null || derniere < 0 || derniere >= n) return Math.floor(hasard() * n)
  const k = Math.floor(hasard() * (n - 1))
  return k >= derniere ? k + 1 : k
}

/** Les images traversées entre deux pas du métronome, `(avant, apres]`, rendues
 *  en numéros d'image (depuis 1) : un réveil en retard qui saute une image ne
 *  doit pas faire taire son repère. */
export function imagesTraversees(avant: number, apres: number, rang: (pas: number) => number): number[] {
  const vues: number[] = []
  for (let p = Math.max(avant + 1, apres - 64); p <= apres; p++) vues.push(rang(p) + 1)
  return vues
}

/** Les repères d'un sujet et de quoi les faire entendre : `jouer(cle)` lance
 *  une variante de l'emplacement. `actif` faux : rien n'est lu. */
export function useSonsCales(projet: string, sujet: string, actif = true) {
  const [vue, setVue] = useState<ReperesSonores | null>(null)
  const dernieres = useRef<Record<string, number>>({})
  const relire = useCallback(() => reperesSonores.lire(projet, sujet)
    .then((v) => setVue(v && Array.isArray(v.reperes) ? v : null)).catch(() => setVue(null)), [projet, sujet])
  useEffect(() => { if (actif) void relire() }, [actif, relire])
  const jouer = useCallback((cle: string) => {
    const sons = vue?.sons[cle] ?? []
    if (!sons.length) return
    const k = variante(sons.length, dernieres.current[cle] ?? null)
    dernieres.current[cle] = k
    try {
      const lecture = new Audio(ecouteDuSon(projet, sons[k]))
      void lecture.play()?.catch(() => {})
    } catch { /* un navigateur sans son : l'essai continue en silence */ }
  }, [projet, vue])
  return { vue, setVue, relire, jouer }
}
