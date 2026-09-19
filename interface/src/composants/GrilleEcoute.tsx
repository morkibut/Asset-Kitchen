// **Écouter une série au clavier** (SN3, `docs/archi-son.md` §4.4) : une forme
// d'onde par tirage, un clic pour écouter, ← → pour passer, Espace pour écouter,
// G pour garder. Les mesures informent : un tirage saturé est signalé, jamais
// retenu — il se garde comme les autres.
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { ecoute, type SonDuTirage, type TirageSerie } from "../api-series-son"
import type { OndeSon, Son } from "../api-sons"
import { mesuresTexte } from "../son-textes"

export type TuileSon = {
  rang: number
  etat: "pret" | "calcul" | "attente" | "arret"
  raison?: string
  son: { identifiant: string; revision: number; mesures?: SonDuTirage["mesures"]; sature?: boolean; silencieux?: boolean } | null
}

export function tuileDeTirage(t: TirageSerie): TuileSon {
  const s = t.son
  if (s && s.existe && s.revision) {
    const son = { identifiant: s.identifiant, revision: s.revision, mesures: s.mesures, sature: s.sature, silencieux: s.silencieux }
    return s.mesures ? { rang: t.rang, etat: "pret", son } : { rang: t.rang, etat: "arret", raison: s.raison || "Ce son n’a pas pu être lu.", son: null }
  }
  if (s && !s.existe) return { rang: t.rang, etat: "arret", raison: "Ce son n’existe plus dans la galerie.", son: null }
  if (t.etat === "en_cours") return { rang: t.rang, etat: "calcul", son: null }
  if (["a_reprendre", "a_verifier", "externe_inconnu", "annule", "termine"].includes(t.etat)) return { rang: t.rang, etat: "arret", raison: t.raison, son: null }
  return { rang: t.rang, etat: "attente", son: null }
}

export function tuileDeSon(s: Son, rang: number): TuileSon {
  return s.mesures
    ? { rang, etat: "pret", son: { identifiant: s.identifiant, revision: s.revision, mesures: s.mesures, sature: !!s.mesures.ecretes, silencieux: s.mesures.silencieux } }
    : { rang, etat: "arret", raison: s.raison || "Ce son n’a pas pu être lu.", son: null }
}

const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3"
const KBD = "rounded-5 border border-contour bg-carte px-[4px] font-mono text-[11px] text-encre-controle"
const ATTENTION = "rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[12px] text-encre-attention"

function Onde({ projet, son, hauteur, joue, position }: { projet: string; son: NonNullable<TuileSon["son"]>; hauteur: number; joue: boolean; position: number }) {
  const [onde, setOnde] = useState<OndeSon | null>(null)
  useEffect(() => {
    let vivant = true
    ecoute.onde(projet, son.identifiant, son.revision).then((o) => { if (vivant) setOnde(o) }).catch(() => {})
    return () => { vivant = false }
  }, [projet, son.identifiant, son.revision])
  const milieu = hauteur / 2
  const c = onde?.canaux_ondes[0]
  const n = c?.maximum.length ?? 0
  const x = (j: number) => (n > 1 ? (j / (n - 1)) * 1000 : 0).toFixed(1)
  const haut = (v: number) => (milieu - Math.max(0.6, Math.abs(v) * milieu * 0.94)).toFixed(1)
  const bas = (v: number) => (milieu + Math.max(0.6, Math.abs(v) * milieu * 0.94)).toFixed(1)
  const d = c && n ? `M${c.maximum.map((v, j) => `${x(j)},${haut(v)}`).join("L")}L${c.minimum.map((v, j) => `${x(j)},${bas(v)}`).reverse().join("L")}Z` : ""
  const svg = (classe: string, style?: CSSProperties) => <svg aria-hidden="true" viewBox={`0 0 1000 ${hauteur}`} preserveAspectRatio="none" className={`absolute inset-0 h-full w-full ${classe}`} style={style}><path d={d} /></svg>
  return <span className="relative block w-full overflow-hidden rounded-5 bg-papier-cote transition-colors group-hover:bg-ligne-ouverte" style={{ height: hauteur }}>
    {svg("fill-encre-4")}
    {svg("fill-encre-controle", { clipPath: `inset(0 ${((1 - (joue ? position : 0)) * 100).toFixed(2)}% 0 0)` })}
    {joue && <span className="absolute inset-y-0 w-0 border-l-2 border-encre" style={{ left: `${(position * 100).toFixed(2)}%` }} />}
  </span>
}

/** La grille. `gardes` et `onGarder` portent le choix ; la grille ne garde rien elle-même. */
export function GrilleEcoute({ projet, tuiles, gardes, onGarder, onRegler, longue = false }: {
  projet: string; tuiles: TuileSon[]; gardes: ReadonlySet<number>; onGarder: (rang: number) => void
  /** Ouvre la fiche d'un son gardé, pour le régler. */
  onRegler?: (son: string) => void
  /** Musique et chanson : des tuiles plus larges. */
  longue?: boolean
}) {
  const racine = useRef<HTMLDivElement>(null)
  const lecteur = useRef<HTMLAudioElement>(null)
  const [choisi, setChoisi] = useState<number | null>(null)
  const [joue, setJoue] = useState<number | null>(null)
  const [position, setPosition] = useState(0)
  const prets = tuiles.filter((t) => t.etat === "pret")
  const courant = prets.some((t) => t.rang === choisi) ? choisi : prets[0]?.rang ?? null
  const hauteur = longue ? 72 : 64

  const arreter = () => { lecteur.current?.pause(); setJoue(null); setPosition(0) }
  /** Écouter ce tirage depuis le début. `bascule` : un second geste sur le même l'arrête. */
  const ecouter = (rang: number, bascule = true) => {
    const t = prets.find((t) => t.rang === rang)
    if (!t?.son) return
    setChoisi(rang)
    const audio = lecteur.current
    if (!audio) return
    if (bascule && joue === rang) { arreter(); return }
    audio.pause()
    audio.src = ecoute.adresse(projet, t.son.identifiant, t.son.revision)
    setJoue(rang); setPosition(0)
    const lecture = audio.play() as Promise<void> | undefined
    lecture?.catch?.(() => setJoue(null))
  }
  // Le focus suit le tirage choisi (un seul tirage entre dans l'ordre de
  // tabulation) : Espace et G agissent toujours sur celui qu'on voit choisi.
  const focaliser = (rang: number) => racine.current?.querySelector<HTMLElement>(`[data-ecouter="${rang}"]`)?.focus()

  // Le clavier écoute la page entière, sauf quand on écrit, sauf quand un
  // autre dialogue est ouvert par-dessus (la fiche d'un son, par exemple : le
  // dernier dialogue ouvert du document doit être le nôtre).
  const clavier = useRef<(e: KeyboardEvent) => void>(() => {})
  clavier.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
    const cible = e.target instanceof Element ? e.target : null
    if (cible?.closest("input, textarea, select, [contenteditable=true]")) return
    const monDialogue = racine.current?.closest("dialog") ?? null
    const ouverts = document.querySelectorAll("dialog[open]")
    const dessus = ouverts.length ? ouverts[ouverts.length - 1] : null
    if (dessus !== monDialogue) return
    if (courant == null) return
    // Un bouton hors de la grille (« Lancer », « Tirer ») garde son Espace à lui.
    const dansLaGrille = !cible || cible === document.body || cible === document.documentElement || !!racine.current?.contains(cible)
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      const i = prets.findIndex((t) => t.rang === courant)
      const suivant = prets[(i + (e.key === "ArrowRight" ? 1 : -1) + prets.length) % prets.length]
      // Comme la maquette : passer, c'est écouter le tirage choisi.
      ecouter(suivant.rang, false)
      focaliser(suivant.rang)
    } else if (e.key === " " || e.key === "Spacebar") {
      if (!dansLaGrille) return
      e.preventDefault()
      ecouter(courant)
    } else if (e.key === "g" || e.key === "G") {
      e.preventDefault()
      onGarder(courant)
    }
  }
  useEffect(() => {
    const ecouteur = (e: KeyboardEvent) => clavier.current(e)
    document.addEventListener("keydown", ecouteur)
    return () => document.removeEventListener("keydown", ecouteur)
  }, [])

  return <div ref={racine}>
    <p className="mb-[8px] text-[12px] text-encre-3"><kbd className={KBD}>←</kbd> <kbd className={KBD}>→</kbd> passer · <kbd className={KBD}>Espace</kbd> écouter · <kbd className={KBD}>G</kbd> garder</p>
    <div role="list" aria-label="Les tirages" className={`grid gap-[14px] ${longue ? "grid-cols-[repeat(auto-fill,minmax(380px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(210px,1fr))]"}`}>
      {tuiles.map((t) => {
        const garde = gardes.has(t.rang)
        const estChoisi = t.rang === courant
        const bord = garde ? "border-trait-ok bg-fond-ok" : estChoisi ? "border-encre-4 bg-carte" : "border-trait bg-carte"
        return <article role="listitem" key={t.rang} data-rang={t.rang} aria-label={`Tirage ${t.rang}`} aria-current={estChoisi || undefined} className={`grid gap-[8px] rounded-8 border p-[8px] transition-colors ${bord}`}>
          <div className="flex min-h-[26px] items-center gap-[8px]">
            <span className="min-w-[14px] font-mono text-[12px] text-encre-3">{t.rang}</span>
            {t.son?.sature && <span className={ATTENTION}>saturé</span>}
            {t.son?.silencieux && <span className={ATTENTION}>silencieux</span>}
            <span className="ml-auto" />
            {t.etat === "pret" && <button type="button" tabIndex={estChoisi ? 0 : -1} className={`${PETIT} ${garde ? "border-trait-ok text-encre-ok" : ""}`} aria-pressed={garde} aria-label={`Garder le tirage ${t.rang}`} onClick={() => { setChoisi(t.rang); onGarder(t.rang) }}>{garde ? "✓ Gardé" : "Garder"}</button>}
          </div>
          {t.etat === "pret" && t.son
            ? <button type="button" data-ecouter={t.rang} tabIndex={estChoisi ? 0 : -1} className="group block w-full rounded-5 text-left" aria-label={`Écouter le tirage ${t.rang}`} onClick={() => ecouter(t.rang)}><Onde projet={projet} son={t.son} hauteur={hauteur} joue={joue === t.rang} position={position} /></button>
            : <span className={`flex items-center justify-center rounded-5 bg-papier-cote px-[8px] text-center text-[12px] ${t.etat === "calcul" ? "text-encre-controle" : "text-encre-3"}`} style={{ height: hauteur }}>{t.etat === "calcul" ? "en calcul" : t.etat === "attente" ? "en attente" : t.raison || "arrêté"}</span>}
          <div className="flex min-h-[26px] items-center justify-between gap-[8px]">
            <span className="font-mono text-[11px] text-encre-3">{mesuresTexte(t.son?.mesures)}</span>
            {garde && t.son && onRegler && <button type="button" className={PETIT} onClick={() => onRegler(t.son!.identifiant)}>Régler</button>}
          </div>
        </article>
      })}
    </div>
    <audio ref={lecteur} className="hidden" preload="none" onTimeUpdate={(e) => { const a = e.currentTarget; if (a.duration > 0) setPosition(Math.min(1, a.currentTime / a.duration)) }} onEnded={() => { setJoue(null); setPosition(0) }} />
  </div>
}
