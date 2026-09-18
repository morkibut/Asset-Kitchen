// **Un jeu de variantes** : les tirages gardés ensemble, que le jeu jouera au
// hasard. Il se nomme ici ; chaque son se règle sur sa fiche. Un signalement se
// montre et n'enlève rien : l'auteur décide.
import { useState } from "react"
import { jeuxDeVariantes, type JeuVariantes } from "../api-series-son"
import { mesuresTexte } from "../son-textes"
import { ApercuLivraisonSon } from "./ApercuLivraisonSon"

const PETIT = "min-h-[26px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const message = (e: unknown) => e instanceof Error ? e.message : "Le jeu ne peut pas être renommé."

export function JeuDeVariantes({ projet, jeu, onJeu, onRegler }: {
  projet: string; jeu: JeuVariantes; onJeu: (jeu: JeuVariantes) => void; onRegler?: (son: string) => void
}) {
  const [nom, setNom] = useState(jeu.nom)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [livrer, setLivrer] = useState(false)
  const renommer = async () => {
    const propre = nom.trim()
    if (!propre || propre === jeu.nom) { setNom(jeu.nom); return }
    setOccupe(true); setErreur("")
    try { const j = await jeuxDeVariantes.renommer(projet, jeu.identifiant, propre); onJeu(j); setNom(j.nom) } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  return <section aria-label={`Jeu de variantes ${jeu.nom}`} className="rounded-8 border border-trait-ok bg-fond-ok p-[14px]">
    <div className="flex flex-wrap items-center gap-[14px]">
      <strong className="text-[13px]">Jeu de {jeu.membres.length} variante{jeu.membres.length > 1 ? "s" : ""}</strong>
      <label className="flex items-center gap-[8px] text-[12px]">Nom
        <input aria-label="Nom du jeu" className="min-h-[30px] w-[240px] rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={nom} disabled={occupe}
          onChange={(e) => setNom(e.target.value)} onBlur={() => void renommer()} onKeyDown={(e) => { if (e.key === "Enter") void renommer() }} />
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
