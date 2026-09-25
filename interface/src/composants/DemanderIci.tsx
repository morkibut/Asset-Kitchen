// La touche qui ouvre une ligne de question, là où l'on travaille (CM4,
// `docs/PLAN-assistant.md` § CM4). Posée **une fois, à l'échelle de l'application**
// (`DemanderIci`, monté par `App.tsx` avec l'écran que le guide calcule déjà,
// `ecranDuGuide`) depuis la relecture croisée du 25 septembre 2026 : CM4 ne l'avait
// posée que sur le tiroir des matières, en comptant sur CM7 pour l'étendre, et CM7
// ne portait que la marque « EN ». `AvecDemande` reste, pour une zone qui voudrait
// la sienne — elle ne réagit alors que si le focus est chez elle.
//
// **La touche, et pourquoi celle-là.** `Ctrl+/` (ou `Cmd+/`). Le recensement qui la
// prouve libre — dans le produit et dans les trois navigateurs visés (Chrome, Edge,
// Firefox, sous Windows) — est écrit sous CM4 dans `docs/PLAN-assistant.md` ;
// `touche-demander.test.ts` en tient la preuve exécutable. **Jamais un caractère
// imprimable seul** — le piège nommé par le plan : une touche nue se déclencherait en
// tapant dans un champ, une combinaison ne le peut pas.
//
// Les cinq critères du plan, et où ils tiennent ici :
// - **Elle ne vole aucun raccourci** : voir le recensement ci-dessus ;
// - **La ligne s'ouvre là où l'on travaille** : posée par `createPortal` sur
//   `document.body`, en **superposition** (`position: fixed`) près de l'élément qui
//   avait le focus au moment de la touche — jamais insérée dans le flux, donc rien
//   autour d'elle ne bouge, et l'écran qu'elle recouvre garde exactement son DOM ;
// - **Une question hors sujet répond « je ne sais pas »** : c'est la consigne du
//   métier « question » qui le garantit côté serveur
//   (`atelier/domaine/coup_de_main.py`, `JE_NE_SAIS_PAS`) — ici, l'écran compare la
//   réponse reçue à cette même phrase pour l'annoncer sobrement ;
// - **Échap referme sans trace** : le focus revient exactement sur l'élément qui
//   l'avait avant l'ouverture, l'appel en cours est coupé, aucun état ne survit à
//   la fermeture — et un seul Échap ne referme que la ligne, pas une proposition
//   « EN » restée ouverte dessous (`coup-de-main-commun.ts`) ;
// - **Au clavier seul** : `Ctrl+/` ouvre et pose le focus dans la ligne, Entrée
//   envoie, Échap ferme — jamais besoin de la souris pour le geste entier.
//
// **Ce qui part** : l'écran, la question, et **le nom du champ** qui avait le focus
// (son libellé, lu dans le `<label>` ou `aria-label`) — c'est lui qui rend « à quoi
// sert ce réglage ? » répondable. **Jamais sa valeur** : un champ du produit peut
// porter un chemin de fichier de la machine (l'installation, la livraison), et la
// décision 7 dit qu'aucun ne part.
//
// **Décision 6 du plan, ici sans marque à cacher** : indisponible (pas de clé,
// plafond atteint…), `Ctrl+/` **ne fait rien du tout** — rien ne s'ouvre, rien ne
// s'affiche. La disponibilité est lue par le même crochet que la marque « EN ».

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { coupDeMain, type CeQuiPart, type DemandeQuestion, type Morceau } from "../api-coup-de-main"
import { relireDisponibilite, useDisponibilite, useEchap } from "../coup-de-main-commun"
import { JE_NE_SAIS_PAS, estLaToucheDemander } from "../touche-demander"

const METIER = "question"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"
const LIEN = "text-[12px] text-encre-2 underline underline-offset-2 hover:text-encre"

/** Le plus long nom de champ qu'on emporte : un libellé, pas un paragraphe. */
const NOM_MAX = 120

type Reponse = { texte: string; fini: boolean }

/** Le focus est-il dans cette zone, ou nulle part en particulier (`body`) ? Sans
 *  zone (la pose de l'application), partout. */
function focusIci(zone: HTMLElement | null): boolean {
  if (!zone) return true
  const actif = document.activeElement
  return !actif || actif === document.body || zone.contains(actif)
}

/** Le texte du libellé **lui-même** : ses nœuds de texte directs, pas ce que la
 *  marque « EN » ou une proposition, posées dedans par erreur, y ajouteraient. */
function texteDuLibelle(libelle: Element): string {
  const direct = Array.from(libelle.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join(" ")
  return (direct.trim() ? direct : libelle.textContent ?? "").replace(/\s+/g, " ").trim()
}

/** Le nom du champ qui a le focus — son libellé, jamais sa valeur. `undefined`
 *  pour ce qui n'est pas un champ (un bouton, le fond de l'écran). */
export function nomDuChamp(el: Element | null): string | undefined {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return undefined
  const nom = el.labels?.[0] ? texteDuLibelle(el.labels[0])
    : el.getAttribute("aria-label") ?? ""
  const propre = nom.replace(/\s+/g, " ").trim().slice(0, NOM_MAX)
  return propre || undefined
}

function LigneDeQuestion({ ecran, zone }: { ecran: string; zone: HTMLElement | null | (() => HTMLElement | null) }) {
  const zoneDeQuestion = useRef<HTMLInputElement>(null)
  const rendreLeFocusA = useRef<HTMLElement | null>(null)
  const coupure = useRef<AbortController | null>(null)
  const [dispo, setDispo] = useDisponibilite()
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)
  const [champ, setChamp] = useState<string | undefined>(undefined)
  const [question, setQuestion] = useState("")
  const [reponse, setReponse] = useState<Reponse | null>(null)
  const [voir, setVoir] = useState<CeQuiPart | null>(null)

  function fermer() {
    coupure.current?.abort()
    coupure.current = null
    setPlace(null)
    setChamp(undefined)
    setQuestion("")
    setReponse(null)
    setVoir(null)
    rendreLeFocusA.current?.focus()
    rendreLeFocusA.current = null
  }

  // `Ctrl+/` ouvre — seulement si rien n'est déjà ouvert, et seulement depuis la
  // zone (ou partout, pour la pose de l'application). Écoutée sur `window`, comme
  // les autres raccourcis globaux du produit (App.tsx).
  useEffect(() => {
    if (place !== null || !dispo) return
    const touche = (e: KeyboardEvent) => {
      if (!estLaToucheDemander(e)) return
      const cadre = typeof zone === "function" ? zone() : zone
      if (typeof zone === "function" && !cadre) return
      if (!focusIci(cadre)) return
      e.preventDefault()
      const actif = document.activeElement
      rendreLeFocusA.current = actif instanceof HTMLElement && actif !== document.body ? actif : null
      const ancre = actif instanceof HTMLElement && actif !== document.body && (!cadre || cadre.contains(actif)) ? actif : cadre
      const rect = ancre?.getBoundingClientRect()
      setChamp(nomDuChamp(actif))
      setPlace(rect
        ? { top: rect.bottom + 6, left: Math.max(7, Math.min(rect.left, window.innerWidth - 316)) }
        : { top: 64, left: Math.max(7, window.innerWidth / 2 - 150) })
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [place, dispo, zone])

  // Échap, où que soit le focus tant que la ligne est ouverte : elle referme la
  // ligne, **et elle seule** — ni l'écran autour, ni une proposition ouverte avant.
  useEchap(place !== null, fermer)

  useEffect(() => {
    if (place) requestAnimationFrame(() => zoneDeQuestion.current?.focus())
  }, [place])

  // Refermer l'écran coupe l'appel en cours.
  useEffect(() => () => coupure.current?.abort(), [])

  /** Ce qui part — la même pour l'appel et pour « Voir ce qui part ». */
  const demande = (texte: string): DemandeQuestion => ({ texte, ecran, ...(champ ? { champ } : {}) })

  async function demander() {
    const texte = question.trim()
    if (!texte || reponse) return
    const coupe = new AbortController()
    coupure.current = coupe
    let recu = ""
    setReponse({ texte: "", fini: false })
    try {
      const fin = await coupDeMain.demander(METIER, demande(texte), (m: Morceau) => {
        if (coupe.signal.aborted) return
        if (m.genre === "texte") { recu += m.texte; setReponse({ texte: recu, fini: false }) }
      }, coupe.signal)
      if (coupe.signal.aborted) return
      if (fin?.genre === "fin" && fin.issue === "repondu" && recu.trim()) {
        setReponse({ texte: recu.trim(), fini: true })
        return
      }
      // Revenu sans réponse — indisponible, refusé, délai passé : elle se tait,
      // comme le coup de main d'améliorer (décision 6).
      if (fin?.genre === "indisponible") setDispo(false)
      else void relireDisponibilite()
      setReponse(null)
    } catch {
      if (!coupe.signal.aborted) { setDispo(false); setReponse(null) }
    }
  }

  async function basculerVoir() {
    if (voir) { setVoir(null); return }
    try { setVoir(await coupDeMain.ceQuiPart(METIER, demande(question.trim() || "…"))) } catch { setVoir(null) }
  }

  const jeNeSaisPas = reponse?.fini && reponse.texte.toLowerCase().replace(/[.!]+$/, "") === JE_NE_SAIS_PAS

  if (!place) return null
  return createPortal(
    <div
      role="group"
      aria-label="Demander"
      style={{ top: place.top, left: place.left }}
      className="fixed z-50 w-[300px] max-w-[calc(100vw-14px)] rounded-7 border border-trait bg-papier p-[8px] shadow-[0_4px_18px_rgba(0,0,0,.12)]"
    >
      <input
        ref={zoneDeQuestion}
        type="text"
        value={question}
        disabled={reponse !== null}
        // « Voir ce qui part » montre ce qui partirait : la question changée, ce
        // qui était montré ne l'est plus.
        onChange={(e) => { setQuestion(e.target.value); setVoir(null) }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void demander() } }}
        placeholder="Comment on fait ça, ici ?"
        aria-label="Ta question"
        className="min-h-[30px] w-full rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle disabled:opacity-70"
      />
      {reponse && (
        <p aria-live="polite" className="mt-[8px] text-[13px] text-encre">
          {jeNeSaisPas ? "Le coup de main ne sait pas répondre à ça." : (reponse.texte || "…")}
        </p>
      )}
      <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
        {!reponse && <button type="button" className={PETIT} disabled={!question.trim()} onClick={() => void demander()}>Demander</button>}
        <button type="button" className={LIEN} aria-expanded={voir !== null} onClick={() => void basculerVoir()}>
          {voir ? "Cacher ce qui part" : "Voir ce qui part"}
        </button>
        <small className="text-[12px] text-encre-3">Échap pour fermer</small>
      </div>
      {voir && <div className="mt-[8px] space-y-[8px]">
        {voir.morceaux.filter((m) => m.texte).map((m) => <div key={m.titre}>
          <div className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3">{m.titre}</div>
          <pre className="mesure mt-[4px] whitespace-pre-wrap rounded-5 border border-trait bg-carte p-[8px] text-[11px] text-encre-2">{m.texte}</pre>
        </div>)}
        <small className="block text-[12px] text-encre-3">{voir.jamais}</small>
      </div>}
    </div>,
    document.body,
  )
}

/** La touche posée **sur une zone** : elle n'ouvre que si le focus y est (ou
 *  nulle part en particulier). */
export function AvecDemande({ ecran, children }: {
  /** La clé d'écran, connue du serveur (`ECRANS`). */
  ecran: string
  children: ReactNode
}) {
  const zone = useRef<HTMLDivElement>(null)
  const lireZone = useCallback(() => zone.current, [])
  return <div ref={zone} className="relative">
    {children}
    <LigneDeQuestion ecran={ecran} zone={lireZone} />
  </div>
}

/** La touche posée **sur toute l'application**, avec l'écran où l'on est — la
 *  pose de `App.tsx`. Ne rend rien tant qu'on ne presse pas `Ctrl+/`. */
export function DemanderIci({ ecran }: { ecran: string }) {
  return <LigneDeQuestion ecran={ecran} zone={null} />
}
