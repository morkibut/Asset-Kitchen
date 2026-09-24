// La touche qui ouvre une ligne de question, là où l'on travaille (CM4,
// `docs/PLAN-assistant.md` § CM4). Un morceau qu'on pose autour d'**un écran**, pas
// autour d'un champ comme `AvecCoupDeMain` (CM3) : la touche marche depuis n'importe
// quel point de la zone qu'il enveloppe, tant qu'on y a le focus (ou aucun focus
// particulier) — pas seulement depuis un champ précis.
//
// **La touche, et pourquoi celle-là.** `Ctrl+/` (ou `Cmd+/`). Le recensement qui la
// prouve libre — dans le produit et dans les trois navigateurs visés (Chrome, Edge,
// Firefox, sous Windows) — est écrit sous CM4 dans `docs/PLAN-assistant.md` ;
// `DemanderIci.test.tsx` en tient la preuve exécutable : la liste recensée, rejouée
// contre un objet `KeyboardEvent`, ne contient `Ctrl+/` nulle part. **Jamais un
// caractère imprimable seul** — le piège nommé par le plan : une touche nue se
// déclencherait en tapant dans un champ, une combinaison ne le peut pas.
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
//   réponse reçue à cette même phrase pour l'annoncer sobrement plutôt que de la
//   montrer telle quelle, comme une réponse parmi d'autres ;
// - **Échap referme sans trace** : le focus revient exactement sur l'élément qui
//   l'avait avant l'ouverture, l'appel en cours est coupé (comme `AvecCoupDeMain`),
//   aucun état ne survit à la fermeture ;
// - **Au clavier seul** : `Ctrl+/` ouvre et pose le focus dans la ligne, Entrée
//   envoie, Échap ferme — jamais besoin de la souris pour le geste entier.
//
// **Décision 6 du plan, ici sans marque à cacher** : indisponible (pas de clé,
// plafond atteint…), `Ctrl+/` **ne fait rien du tout** — rien ne s'ouvre, rien ne
// s'affiche, comme la marque « EN » de `AvecCoupDeMain` qui ne paraît pas. La
// disponibilité se lit une fois au montage (`GET /api/assist`, comme CM3), sans
// dupliquer le hook de `CoupDeMain.tsx` : les deux fichiers restent indépendants,
// pour qu'ajouter à l'un ne force pas à toucher l'autre (CM7 travaille sur le
// second en parallèle de cette tranche).
//
// **Réutilisable par CM5** (« expliquer ce qui bloque ») : le contexte que ce
// composant envoie (`ecran`, `champ`, `valeur`, `blocage`) est composé côté serveur
// par `contexte_instant`, la même fonction que CM5 réutilisera avec `blocage` rempli.

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { coupDeMain, type CeQuiPart, type Morceau } from "../api-coup-de-main"
import { JE_NE_SAIS_PAS, estLaToucheDemander } from "../touche-demander"

/** Lue une fois au montage, comme `CoupDeMain.tsx` : tout échec vaut « non ». */
function useDisponible(): [boolean, (v: boolean) => void] {
  const [dispo, setDispo] = useState(false)
  useEffect(() => {
    let vivant = true
    coupDeMain.etat().then((e) => { if (vivant) setDispo(e.disponible === true) }).catch(() => undefined)
    return () => { vivant = false }
  }, [])
  return [dispo, setDispo]
}

const METIER = "question"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"
const LIEN = "text-[12px] text-encre-2 underline underline-offset-2 hover:text-encre"

type Reponse = { texte: string; fini: boolean }

/** Le focus est-il dans cette zone, ou nulle part en particulier (`body`) ? Une
 *  touche pressée dans une **autre** zone n'ouvre pas celle-ci — utile dès qu'un
 *  second écran sera enveloppé (CM7) : chacune ne réagit que sur son territoire. */
function focusIci(zone: HTMLElement): boolean {
  const actif = document.activeElement
  return !actif || actif === document.body || zone.contains(actif)
}

export function AvecDemande({ ecran, children }: {
  /** La clé d'écran, connue du serveur (`ECRANS`). */
  ecran: string
  children: ReactNode
}) {
  const zone = useRef<HTMLDivElement>(null)
  const zoneDeQuestion = useRef<HTMLInputElement>(null)
  const rendreLeFocusA = useRef<HTMLElement | null>(null)
  const coupure = useRef<AbortController | null>(null)
  const [dispo, setDispo] = useDisponible()
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null)
  const [question, setQuestion] = useState("")
  const [reponse, setReponse] = useState<Reponse | null>(null)
  const [voir, setVoir] = useState<CeQuiPart | null>(null)

  function fermer() {
    coupure.current?.abort()
    coupure.current = null
    setPlace(null)
    setQuestion("")
    setReponse(null)
    setVoir(null)
    rendreLeFocusA.current?.focus()
    rendreLeFocusA.current = null
  }

  // `Ctrl+/` ouvre — seulement si rien n'est déjà ouvert, et seulement depuis
  // cette zone (ou sans focus particulier). Capturée sur `window`, comme les
  // autres raccourcis globaux du produit (App.tsx).
  useEffect(() => {
    if (place !== null || !dispo) return
    const touche = (e: KeyboardEvent) => {
      if (!estLaToucheDemander(e)) return
      const cadre = zone.current
      if (!cadre || !focusIci(cadre)) return
      e.preventDefault()
      const actif = document.activeElement
      rendreLeFocusA.current = actif instanceof HTMLElement ? actif : null
      const ancre = actif instanceof HTMLElement && cadre.contains(actif) ? actif : cadre
      const rect = ancre.getBoundingClientRect()
      setPlace({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 316) })
    }
    window.addEventListener("keydown", touche)
    return () => window.removeEventListener("keydown", touche)
  }, [place, dispo])

  // Échap, où que soit le focus tant que la ligne est ouverte — en capture, comme
  // `AvecCoupDeMain` : elle referme la ligne, elle ne referme pas ce qui est autour.
  useEffect(() => {
    if (place === null) return
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault(); e.stopPropagation()
      fermer()
    }
    window.addEventListener("keydown", touche, true)
    return () => window.removeEventListener("keydown", touche, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place !== null])

  useEffect(() => {
    if (place) requestAnimationFrame(() => zoneDeQuestion.current?.focus())
  }, [place])

  // Refermer l'écran coupe l'appel en cours, comme `AvecCoupDeMain`.
  useEffect(() => () => coupure.current?.abort(), [])

  async function demander() {
    const texte = question.trim()
    if (!texte || reponse) return
    const coupe = new AbortController()
    coupure.current = coupe
    let recu = ""
    setReponse({ texte: "", fini: false })
    try {
      const fin = await coupDeMain.demander(METIER, { texte, ecran }, (m: Morceau) => {
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
      else coupDeMain.etat().then((e) => setDispo(e.disponible === true)).catch(() => setDispo(false))
      setReponse(null)
    } catch {
      if (!coupe.signal.aborted) { setDispo(false); setReponse(null) }
    }
  }

  async function basculerVoir() {
    if (voir) { setVoir(null); return }
    try { setVoir(await coupDeMain.ceQuiPart(METIER, { texte: question.trim() || "…", ecran })) } catch { setVoir(null) }
  }

  const jeNeSaisPas = reponse?.fini && reponse.texte.toLowerCase().replace(/[.!]+$/, "") === JE_NE_SAIS_PAS

  return <div ref={zone} className="relative">
    {children}
    {place && createPortal(
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
          onChange={(e) => setQuestion(e.target.value)}
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
    )}
  </div>
}
