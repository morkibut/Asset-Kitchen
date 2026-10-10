import { useEffect, useMemo, useState } from "react"
import { duree, type Generation } from "../api"
import { useLignesDeFabrication, type LigneFabrication } from "../lignes-de-fabrication"

/** **Le pied du carnet : ce qui tourne, et ce qui est arrivé** — demandé par
 *  l'auteur le 27 septembre 2026 : « on lance des générations, on quitte la
 *  fenêtre pour faire autre chose, on n'a plus de visuel ». La liste est celle
 *  de l'écran Fabrications (`useLignesDeFabrication`), jamais une seconde.
 *
 *  **Une arrivée reste tant qu'on ne l'a pas ouverte**, rechargement compris.
 *  « Vue » se garde dans ce navigateur : c'est une commodité de lecteur, pas
 *  un état du jeu — l'agent n'en a que faire, et deux navigateurs peuvent ne
 *  pas avoir vu la même chose.
 *
 *  ⚠️ **Le premier jour n'a pas cent arrivées.** Sans repère, tout l'historique
 *  terminé paraîtrait « arrivé et pas vu ». Le repère (`depuis`) se pose à la
 *  première lecture : ne compte que ce qui est parti après lui, **ou** ce que
 *  l'encadré a vu tourner — une génération lancée juste avant reste suivie. */

const MAX_EN_COURS = 3
const MAX_ARRIVEES = 4
const PLAFOND_MEMOIRE = 300

type Memoire = { depuis: number; vus: string[]; suivis: string[] }
const cleMemoire = (projet: string) => `atelier.suivi-du-carnet.${projet}`
const maintenant = () => Date.now() / 1000

function lireMemoire(projet: string): Memoire {
  try {
    const brut = window.localStorage.getItem(cleMemoire(projet))
    if (brut) {
      const m = JSON.parse(brut) as Partial<Memoire>
      if (typeof m.depuis === "number") return { depuis: m.depuis, vus: m.vus ?? [], suivis: m.suivis ?? [] }
    }
  } catch { /* stockage fermé : on repart d'un repère neuf */ }
  const neuve = { depuis: maintenant(), vus: [], suivis: [] }
  ecrireMemoire(projet, neuve)
  return neuve
}
function ecrireMemoire(projet: string, m: Memoire) {
  try { window.localStorage.setItem(cleMemoire(projet), JSON.stringify({ ...m, vus: m.vus.slice(-PLAFOND_MEMOIRE), suivis: m.suivis.slice(-PLAFOND_MEMOIRE) })) } catch { /* sans stockage, la mémoire vit le temps de la page */ }
}

/** Une annulation n'est pas une arrivée : on l'a voulue. */
function annulee(l: LigneFabrication): boolean {
  return l.travail?.etat === "annule" || l.locale?.etat === "annule"
}

export function SuiviDuCarnet({ projet, personnages, chantier, clips, replie, onTravail, onClip, onAsset, onFabrications }: {
  projet: string | null; personnages: readonly { identifiant: string; nom: string }[]
  chantier: readonly Generation[]; clips: readonly Generation[]
  replie: boolean
  onTravail: (identifiant: string) => void; onClip: (identifiant: string) => void
  onAsset: (identifiant: string) => void; onFabrications: () => void
}) {
  const { lignes } = useLignesDeFabrication({ projet, personnages, chantier, clips })
  const [memoire, setMemoire] = useState<Memoire | null>(null)
  const [, setHorloge] = useState(0)
  useEffect(() => { setMemoire(projet ? lireMemoire(projet) : null) }, [projet])
  // L'âge d'une génération en cours avance sans que la liste change.
  useEffect(() => { const i = window.setInterval(() => setHorloge((n) => n + 1), 30000); return () => window.clearInterval(i) }, [])

  const enCours = useMemo(() => lignes.filter((l) => l.humeur === "en_cours"), [lignes])
  // Ce qu'on a vu tourner reste suivi jusqu'à son arrivée, même parti avant le repère.
  useEffect(() => {
    if (!projet || !memoire) return
    const neufs = enCours.map((l) => l.cle).filter((c) => !memoire.suivis.includes(c))
    if (!neufs.length) return
    const m = { ...memoire, suivis: [...memoire.suivis, ...neufs] }
    setMemoire(m); ecrireMemoire(projet, m)
  }, [enCours, memoire, projet])

  const arrivees = useMemo(() => !memoire ? [] : lignes.filter((l) =>
    (l.humeur === "terminee" || l.humeur === "ratee") && !annulee(l) && !memoire.vus.includes(l.cle)
    && (l.laceLe >= memoire.depuis || memoire.suivis.includes(l.cle))), [lignes, memoire])

  if (!projet || !memoire || (!enCours.length && !arrivees.length)) return null

  function marquerVue(l: LigneFabrication) {
    if (!projet || !memoire) return
    const m = { ...memoire, vus: [...memoire.vus, l.cle] }
    setMemoire(m); ecrireMemoire(projet, m)
  }
  function toutMarquerVu() {
    if (!projet) return
    const m = { depuis: maintenant(), vus: [], suivis: enCours.map((l) => l.cle) }
    setMemoire(m); ecrireMemoire(projet, m)
  }
  /** Ouvrir mène au résultat quand il y en a un, sinon à l'écran Fabrications. */
  function ouvrir(l: LigneFabrication) {
    if (l.travail) return onTravail(l.travail.identifiant)
    if (l.appel && l.humeur === "terminee") {
      if (l.generation?.clip) return onClip(l.appel.identifiant)
      if (l.appel.vignette) return onAsset(l.appel.vignette)
    }
    onFabrications()
  }

  if (replie) return <button type="button" onClick={onFabrications} title="Fabrications en cours et arrivées"
    aria-label={`${enCours.length} en cours · ${arrivees.length} arrivée${arrivees.length > 1 ? "s" : ""}`}
    className="mb-[8px] flex w-full flex-col items-center gap-[4px] rounded-7 border border-trait bg-carte py-[8px] text-[11px] hover:border-encre-3">
    {enCours.length > 0 && <span className="mesure text-signal">⟳ {enCours.length}</span>}
    {arrivees.length > 0 && <span className="mesure text-encre">✓ {arrivees.length}</span>}
  </button>

  const titre = "mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3"
  const reste = (n: number) => n > 0 && <button type="button" onClick={onFabrications} className="px-[4px] text-left text-[12px] text-encre-3 hover:text-signal">et {n} autre{n > 1 ? "s" : ""} ›</button>
  return <section aria-label="Suivi des fabrications" data-suivi-du-carnet className="mb-[14px] flex flex-col gap-[8px] rounded-7 border border-trait bg-carte p-[8px]">
    {enCours.length > 0 && <div className="flex flex-col gap-[4px]">
      <div className={`${titre} px-[4px]`}>En cours · {enCours.length}</div>
      {enCours.slice(0, MAX_EN_COURS).map((l) => <Ligne key={l.cle} ligne={l} etat={`depuis ${duree(Math.max(0, maintenant() - l.laceLe))}`} onOuvrir={() => ouvrir(l)} />)}
      {reste(enCours.length - MAX_EN_COURS)}
    </div>}
    {arrivees.length > 0 && <div className="flex flex-col gap-[4px]">
      <div className="flex items-center justify-between px-[4px]">
        <span className={titre}>Arrivé · {arrivees.length}</span>
        <button type="button" onClick={toutMarquerVu} className="text-[11px] text-encre-3 hover:text-signal">Tout marquer vu</button>
      </div>
      {arrivees.slice(0, MAX_ARRIVEES).map((l) => <Ligne key={l.cle} ligne={l} etat={l.humeur === "ratee" ? "ratée" : "à voir"} onOuvrir={() => { marquerVue(l); ouvrir(l) }} />)}
      {reste(arrivees.length - MAX_ARRIVEES)}
    </div>}
  </section>
}

function Ligne({ ligne: l, etat, onOuvrir }: { ligne: LigneFabrication; etat: string; onOuvrir: () => void }) {
  const couleur = l.humeur === "ratee" ? "text-echec" : l.humeur === "en_cours" ? "text-signal" : "text-encre-3"
  return <button type="button" onClick={onOuvrir} title={l.titre} aria-label={`Ouvrir ${l.titre} · ${etat}`}
    className="flex w-full items-center gap-[8px] rounded-7 px-[4px] py-[4px] text-left transition-colors duration-120 hover:bg-papier">
    {l.vignette.src
      ? <img src={l.vignette.src} alt="" className="h-[26px] w-[26px] shrink-0 rounded-7 border border-trait object-contain" />
      : <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-7 border border-trait bg-pourtour text-[10.5px] text-encre-3">{l.vignette.lettre}</span>}
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[12px] text-encre">{l.titre}</span>
      <span className={`block text-[11px] ${couleur}`}>{etat}</span>
    </span>
  </button>
}
