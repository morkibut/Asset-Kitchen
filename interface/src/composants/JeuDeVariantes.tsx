// **Un jeu de variantes** : les tirages gardés ensemble, que le jeu jouera au
// hasard. Il se nomme ici ; chaque son se règle sur sa fiche. Un signalement se
// montre et n'enlève rien : l'auteur décide.
import { useEffect, useRef, useState } from "react"
import { jeuxDeVariantes, type JeuVariantes } from "../api-series-son"
import { mesuresTexte } from "../son-textes"
import { ApercuLivraisonSon } from "./ApercuLivraisonSon"

const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const message = (e: unknown) => e instanceof Error ? e.message : "Le jeu ne peut pas être renommé."
const messageGarder = (e: unknown) => e instanceof Error ? e.message : "Ce son n’a pas pu être gardé. Réessayez."

/** **Garder**, un seul geste qui écrit (maquette `son.js`, action `garder`) :
 *  le premier son gardé forme le jeu (`former`, qui pose les réglages de la
 *  famille en nouvelle version), les suivants s'y ajoutent avec les mêmes
 *  réglages, un son dégardé en sort. Les gestes partent un à un, dans
 *  l'ordre ; l'écran montre le choix tout de suite, et le reprend si le
 *  serveur refuse. */
export function useGarde({ projet, jeu, onJeu, former, apres }: {
  projet: string; jeu: JeuVariantes | null; onJeu: (jeu: JeuVariantes) => void
  /** Le premier gardé : forme le jeu (route `keep` d'une série, ou un jeu neuf). */
  former: (son: string) => Promise<JeuVariantes>
  /** Après chaque geste écrit : relire ce qui a changé (la version des sons). */
  apres?: () => unknown
}) {
  const courant = useRef(jeu)
  useEffect(() => { courant.current = jeu }, [jeu])
  const voulus = useRef(new Map<string, boolean>())
  const [, setTour] = useState(0)
  const [erreur, setErreur] = useState("")
  const file = useRef<Promise<void>>(Promise.resolve())
  const dedans = (j: JeuVariantes | null, son: string) => !!j?.membres.some((m) => m.son === son)
  const garde = (son: string) => voulus.current.get(son) ?? dedans(jeu, son)
  const poser = (son: string, voulu: boolean | null) => {
    if (voulu == null) voulus.current.delete(son)
    else voulus.current.set(son, voulu)
    setTour((t) => t + 1)
  }
  const basculer = (son: string) => {
    const voulu = !(voulus.current.get(son) ?? dedans(courant.current, son))
    poser(son, voulu)
    setErreur("")
    file.current = file.current.then(async () => {
      try {
        const j = courant.current
        let n: JeuVariantes | null = null
        if (voulu && !dedans(j, son)) n = j ? await jeuxDeVariantes.ajouter(projet, j.identifiant, son, true) : await former(son)
        else if (!voulu && j && dedans(j, son)) n = await jeuxDeVariantes.retirer(projet, j.identifiant, son)
        if (n) { courant.current = n; onJeu(n); await apres?.() }
      } catch (e) { setErreur(messageGarder(e)) } finally {
        if (voulus.current.get(son) === voulu) poser(son, null)
      }
    })
  }
  return { garde, basculer, erreur }
}

export function JeuDeVariantes({ projet, jeu, onJeu, onRegler }: {
  projet: string; jeu: JeuVariantes; onJeu: (jeu: JeuVariantes) => void; onRegler?: (son: string) => void
}) {
  const [nom, setNom] = useState(jeu.nom)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [livrer, setLivrer] = useState(false)
  const champ = useRef<HTMLInputElement>(null)
  const enCours = useRef(false)
  // Un nom changé ailleurs (le jeu relu après un « Garder ») se montre, sauf pendant qu'on l'écrit.
  useEffect(() => { if (document.activeElement !== champ.current) setNom(jeu.nom) }, [jeu.nom])
  const renommer = async () => {
    if (enCours.current) return
    const propre = nom.trim()
    if (!propre || propre === jeu.nom) { setNom(jeu.nom); return }
    enCours.current = true
    setOccupe(true); setErreur("")
    try { const j = await jeuxDeVariantes.renommer(projet, jeu.identifiant, propre); onJeu(j); setNom(j.nom) } catch (e) { setErreur(message(e)) } finally { enCours.current = false; setOccupe(false) }
  }
  return <section aria-label={`Jeu de variantes ${jeu.nom}`} className="rounded-8 border border-trait-ok bg-fond-ok p-[14px]">
    <div className="flex flex-wrap items-center gap-[14px]">
      <strong className="text-[13px]">{jeu.membres.length} gardé{jeu.membres.length > 1 ? "s" : ""}</strong>
      <label className="flex items-center gap-[8px] text-[12px]">Nom dans le jeu
        <input ref={champ} aria-label="Nom du jeu" className="min-h-[30px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={nom} disabled={occupe} spellCheck={false}
          // Entrée quitte le champ : c'est la sortie du champ qui renomme, une seule fois.
          onChange={(e) => setNom(e.target.value)} onBlur={() => void renommer()} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }} />
      </label>
      {jeu.membres.length > 1 && <span className="text-[12px] text-encre-3">Le jeu en jouera un au hasard.</span>}
      <button type="button" className={`${PETIT} ml-auto`} aria-expanded={livrer} onClick={() => setLivrer((v) => !v)}>Voir ce qui part au jeu</button>
    </div>
    {erreur && <p role="alert" className="mt-[8px] text-[13px] text-echec">{erreur}</p>}
    <ul className="mt-[8px] divide-y divide-trait-ok">
      {jeu.membres.map((m) => <li key={m.son} className="flex flex-wrap items-center gap-[14px] py-[8px] text-[13px]">
        <span className="min-w-[76px]">{m.rang != null ? `Tirage ${m.rang}` : m.nom ?? "Son supprimé"}</span>
        <span className="font-mono text-[11px] text-encre-3">{mesuresTexte(m.mesures)}</span>
        {m.signal && <span className="rounded-5 border border-trait-attention bg-fond-attention px-[8px] text-[12px] text-encre-attention">{m.signal}</span>}
        {onRegler && m.statut !== "supprime" && <button type="button" className={`${PETIT} ml-auto`} aria-label={`Régler ${m.rang != null ? `le tirage ${m.rang}` : m.nom ?? "ce son"}`} onClick={() => onRegler(m.son)}>Régler</button>}
      </li>)}
    </ul>
    {livrer && <div className="mt-[8px]"><ApercuLivraisonSon projet={projet} jeu={jeu} /></div>}
  </section>
}
