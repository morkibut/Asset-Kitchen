// Le coup de main au bout d'un champ (CM3, `docs/PLAN-assistant.md`) — la marque,
// la proposition à côté, « Garder » ou Échap.
//
// **Un morceau qu'on pose autour d'un champ, pas un écran.** Il enveloppe le champ
// que l'écran lui donne, sans rien savoir de lui : le texte à rendre, le nom du
// champ (une entrée de `CHAMPS` côté serveur, jamais un contexte libre) et ce qu'il
// faut faire quand l'auteur garde. C'est ce qui permettra à CM7 de le poser sur le
// champ de prompt partagé (`ChampPrompt.tsx`, décision 10) sans le réécrire. Posé
// en CM3 sur les deux champs du tiroir des matières, **en CM7 sur tout champ de
// prompt** (plan § CM7). ⚠️ À poser **autour** du `<label>` qui contient le champ,
// jamais dedans : la marque et la proposition entreraient dans le nom du champ.
//
// Les quatre règles du plan, et où elles tiennent :
//
// - **Il se tait quand il ne peut rien** (décision 6) : sans clé, sans réseau, ou
//   quand un appel revient sans réponse, la marque disparaît. Jamais une phrase
//   d'erreur, jamais un bouton qui déçoit. **Sauf au plafond du mois** (CM8,
//   décision de l'auteur) : là où la marque serait apparue, une ligne grise
//   discrète dit « coup de main au plafond du mois » — sans fenêtre, rien à
//   cliquer. C'est la seule exception au silence ; sans clé ou réseau coupé, le
//   silence reste entier.
// - **Il propose, il ne remplace jamais** (décision 2) : la proposition s'affiche
//   **sous** le champ, qui garde le texte de l'auteur tant qu'on n'a pas gardé.
// - **Échap l'oublie sans trace** : l'appel en cours est coupé (l'atelier raccroche
//   chez le fournisseur, CM1), la proposition disparaît, le champ n'a pas bougé.
// - **Rien ne part tout seul en génération** : « Garder » remplit le champ, et
//   c'est tout. Générer reste le bouton de l'écran, un second geste.
//
// « Voir ce qui part » demande au serveur la composition **mot pour mot** — la même
// fonction que l'appel (décision 7) —, pour le texte qui est parti, pas celui que
// le champ porte depuis.

import { useEffect, useRef, useState, type ReactNode } from "react"
import { coupDeMain, nettoyer, type CeQuiPart, type Demande } from "../api-coup-de-main"
import { relireDisponibilite, useDisponibilite, useEchap, useMotifDIndisponibilite } from "../coup-de-main-commun"

const METIER = "ameliorer"
const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle disabled:opacity-50"
const LIEN = "text-[12px] text-encre-2 underline underline-offset-2 hover:text-encre"

// La disponibilité et Échap sont **partagés** avec la ligne de question et
// « pourquoi › » (`coup-de-main-commun.ts`) : une seule lecture pour tous les
// champs d'un écran, et un Échap qui ne referme que le dernier ouvert.

type Proposition = { envoye: Demande; texte: string; fini: boolean }

export function AvecCoupDeMain({ champ, projet, texte, onGarder, children }: {
  /** Le champ, tel que le serveur le connaît (`CHAMPS`) : « matiere », « motif ». */
  champ: string
  /** Le jeu ouvert : le serveur y cherche les noms que le texte contient. */
  projet?: string
  /** Ce que le champ porte en ce moment. */
  texte: string
  /** « Garder » : le texte proposé, sur une ligne, remplace celui du champ. */
  onGarder: (texte: string) => void
  /** Le champ lui-même, avec son libellé : il n'est ni lu ni modifié ici. */
  children: ReactNode
}) {
  const [dispo, setDispo] = useDisponibilite()
  const motif = useMotifDIndisponibilite()
  const [proposition, setProposition] = useState<Proposition | null>(null)
  const [voir, setVoir] = useState<CeQuiPart | null>(null)
  const coupure = useRef<AbortController | null>(null)
  const cadre = useRef<HTMLDivElement>(null)

  function oublier() {
    coupure.current?.abort()
    coupure.current = null
    setProposition(null)
    setVoir(null)
  }

  // Refermer l'écran coupe l'appel en cours, comme Échap.
  useEffect(() => () => coupure.current?.abort(), [])

  // Échap, **où que soit le focus** tant qu'une proposition est ouverte — la marque
  // disparaît au clic, le focus peut être n'importe où. Il oublie la proposition, il
  // ne ferme pas ce qui est autour — et si une ligne de question s'est ouverte
  // par-dessus, c'est elle qu'il referme d'abord.
  useEchap(proposition !== null, oublier)

  async function proposer() {
    const envoye: Demande = { texte, champ, ...(projet ? { projet } : {}) }
    const coupe = new AbortController()
    coupure.current = coupe
    setVoir(null)
    setProposition({ envoye, texte: "", fini: false })
    requestAnimationFrame(() => cadre.current?.focus())
    let recu = ""
    try {
      const fin = await coupDeMain.demander(METIER, envoye, (m) => {
        if (coupe.signal.aborted) return
        if (m.genre === "texte") { recu += m.texte; setProposition({ envoye, texte: recu, fini: false }) }
      }, coupe.signal)
      if (coupe.signal.aborted) return
      if (fin?.genre === "fin" && fin.issue === "repondu" && nettoyer(recu)) {
        setProposition({ envoye, texte: recu, fini: true })
        return
      }
      // Revenu sans réponse — indisponible, refusé, délai passé : il se tait.
      if (fin?.genre === "indisponible") setDispo(false)
      else void relireDisponibilite()
      oublier()
    } catch {
      if (coupe.signal.aborted) return
      setDispo(false)
      oublier()
    }
  }

  function garder() {
    if (!proposition?.fini) return
    onGarder(nettoyer(proposition.texte))
    oublier()
  }

  async function basculerVoir() {
    if (voir || !proposition) { setVoir(null); return }
    try { setVoir(await coupDeMain.ceQuiPart(METIER, proposition.envoye)) } catch { setVoir(null) }
  }

  const marque = dispo && !proposition && !!texte.trim()
  // CM8 : là où « EN » serait apparu, une ligne grise dit le plafond — sans
  // fenêtre. Sans clé ou réseau coupé (`motif === "indisponible"`), le silence
  // de la décision 6 reste entier : rien ne la remplace.
  const auPlafond = !dispo && !proposition && !!texte.trim() && motif === "plafond"

  return <div>
    <div className="flex items-end gap-[8px]">
      <div className="min-w-0 flex-1">{children}</div>
      {marque && <button type="button" onClick={() => void proposer()} aria-label="Proposer en anglais"
        className="mesure min-h-[30px] shrink-0 rounded-7 border border-contour bg-carte px-[8px] text-[11px] text-encre-3 transition-colors duration-120 hover:text-encre">EN</button>}
      {auPlafond && <span className="mesure flex min-h-[30px] shrink-0 items-center px-[8px] text-[11px] text-encre-4">
        coup de main au plafond du mois</span>}
    </div>
    {proposition && <div ref={cadre} tabIndex={-1} role="group" aria-label="Proposition en anglais"
      className="mt-[8px] rounded-7 border border-trait bg-papier p-[8px] outline-none">
      <div className="text-[12px] text-encre-3">En anglais — ton texte reste tel quel tant que tu ne gardes pas.</div>
      <p lang="en" aria-live="polite" className="mt-[4px] text-[13px] text-encre">
        {nettoyer(proposition.texte) || "…"}</p>
      <div className="mt-[8px] flex flex-wrap items-center gap-[8px]">
        <button type="button" className={PETIT} disabled={!proposition.fini} onClick={garder}>Garder</button>
        <button type="button" className={LIEN} aria-expanded={voir !== null} onClick={() => void basculerVoir()}>
          {voir ? "Cacher ce qui part" : "Voir ce qui part"}</button>
        <small className="text-[12px] text-encre-3">Échap pour oublier</small>
      </div>
      {voir && <div className="mt-[8px] space-y-[8px]">
        {voir.morceaux.filter((m) => m.texte).map((m) => <div key={m.titre}>
          <div className="mesure text-[10.5px] uppercase tracking-[0.14em] text-encre-3">{m.titre}</div>
          <pre className="mesure mt-[4px] whitespace-pre-wrap rounded-5 border border-trait bg-carte p-[8px] text-[11px] text-encre-2">{m.texte}</pre>
        </div>)}
        <small className="block text-[12px] text-encre-3">{voir.jamais}</small>
      </div>}
    </div>}
  </div>
}
