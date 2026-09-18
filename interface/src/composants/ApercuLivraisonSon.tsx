import { useEffect, useState } from "react"
import { api, type ApercuLivraison } from "../api"
import { livraisonSon, type JeuVariantesSon } from "../api-livraison-son"
import type { Son } from "../api-sons"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
const erreurDe = (e: unknown) => (e instanceof Error ? e.message : "L’aperçu de livraison n’a pas pu être lu.")

/** L'aperçu de livraison d'un son seul (`son`) ou d'un jeu de variantes
 *  (`jeu`) : les fichiers aux noms stables, `credits.json` visible, les
 *  `.import` repliés sous « Tous les fichiers ». La publication passe par la
 *  même route que le reste de l'atelier (`api.livrerGodot`) ; `onLivraisons`
 *  prévient l'appelant qu'une livraison a été faite, pour qu'il rafraîchisse
 *  sa liste ou rouvre l'écran « Livrer au jeu ». */
export function ApercuLivraisonSon({ projet, son, jeu, onLivraisons }: { projet: string; son?: Son; jeu?: JeuVariantesSon; onLivraisons?: () => void }) {
  const [livraison, setLivraison] = useState<(ApercuLivraison & { etat?: string }) | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const cle = son ? `son-${son.identifiant}-${son.revision}` : jeu ? `jeu-${jeu.identifiant}` : ""

  useEffect(() => {
    let actif = true
    setLivraison(null)
    setErreur("")
    if (!son && !jeu) return
    setOccupe(true)
    const relire = son ? livraisonSon.deSon(son) : livraisonSon.deJeu(projet, jeu!.identifiant)
    relire.then(v => { if (actif) setLivraison(v) }).catch(e => { if (actif) setErreur(erreurDe(e)) }).finally(() => { if (actif) setOccupe(false) })
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, projet])

  if (!son && !jeu) return null
  const signalements = jeu?.signalements ?? []
  const publier = async () => {
    if (!livraison) return
    setOccupe(true); setErreur("")
    try { setLivraison(await api.livrerGodot(projet, livraison.jeton)) }
    catch (e) { setErreur(erreurDe(e)) }
    finally { setOccupe(false) }
  }

  const fichiers = livraison?.fichiers ?? []
  const credits = fichiers.find(f => f.chemin.endsWith("credits.json"))
  const visibles = fichiers.filter(f => f !== credits && !f.chemin.endsWith(".import"))
  const conflitsOuverts = (livraison?.conflits ?? []).filter(c => !c.decision)

  return <section aria-label="Aperçu de livraison" className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
    <h2 className="font-serif text-[25px]">Ce qui sera livré</h2>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!livraison && !erreur && <p className="text-[13px] text-encre-3">Lecture de l’aperçu…</p>}
    {signalements.length > 0 && <ul className="space-y-[4px] text-[13px] text-echec">{signalements.map(s => <li key={s.son}>{s.signal}</li>)}</ul>}
    {livraison && <>
      <p className="text-[13px]">{livraison.dossier} · {livraison.scene}</p>
      <ul className="space-y-[4px] text-[13px]">{visibles.map(f => <li key={f.chemin}>{f.chemin} · {f.etat}</li>)}</ul>
      {credits && <p className="text-[13px] text-encre-3">{credits.chemin} · d’où vient chaque son : moteur, licence, graine, texte parti.</p>}
      <details className="text-[13px]"><summary className="cursor-pointer">Tous les fichiers · {fichiers.length}</summary>
        <ul className="mt-[8px] space-y-[4px] text-[12px] text-encre-3">{fichiers.map(f => <li key={f.chemin}>{f.chemin}</li>)}</ul>
      </details>
      {conflitsOuverts.map(c => <p key={c.chemin} className="text-[13px] text-echec">{c.chemin} : {c.raison}</p>)}
      <button className={`${BOUTON} border-signal bg-signal text-encre-sur-signal`}
        disabled={occupe || !livraison.pret || livraison.etat === "terminee"}
        onClick={() => void publier().then(() => onLivraisons?.())}>
        {livraison.etat === "terminee" ? "Livraison terminée" : "Livrer cette version"}
      </button>
    </>}
  </section>
}
