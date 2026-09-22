import { useEffect, useState } from "react"
import { api, type ApercuLivraison } from "../api"
import { livraisonSon, type JeuVariantesSon } from "../api-livraison-son"
import type { Son } from "../api-sons"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] disabled:opacity-50"
const AUDIO = /\.(wav|ogg)$/
/** Ce qu'on voit d'un fichier : son nom. Le dossier, commun à tous, est dit une fois. */
const nomDe = (chemin: string) => chemin.split("/").at(-1) ?? chemin
const erreurDe = (e: unknown) => (e instanceof Error ? e.message : "L’aperçu de livraison n’a pas pu être lu.")

/** L'aperçu de livraison d'un son seul (`son`) ou d'un jeu de variantes
 *  (`jeu`) : les fichiers aux noms stables, `credits.json` visible, les
 *  `.import` repliés sous « Tous les fichiers ». La publication passe par la
 *  même route que le reste de l'atelier (`api.livrerGodot`) ; `onLivraisons`
 *  prévient l'appelant qu'une livraison a été faite, pour qu'il rafraîchisse
 *  sa liste ou rouvre l'écran « Livrer au jeu ». */
export function ApercuLivraisonSon({ projet, son, jeu, onLivraisons, onTrancherConflit }: {
  projet: string; son?: Son; jeu?: JeuVariantesSon; onLivraisons?: () => void
  /** Un conflit de fichier ouvert ne se tranche pas ici : ce lien renvoie vers
   *  « Livrer au jeu », où la décision se prend (branché côté `JeuDeVariantes`
   *  si besoin). Absent : le conflit reste affiché sans action possible. */
  onTrancherConflit?: () => void
}) {
  const [livraison, setLivraison] = useState<(ApercuLivraison & { etat?: string }) | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  // La révision d'un jeu de variantes fait partie de la clé : sans elle, un
  // renommage ou un membre ajouté/retiré ne relirait pas l'aperçu.
  const cle = son ? `son-${son.identifiant}-${son.revision}` : jeu ? `jeu-${jeu.identifiant}-${jeu.revision ?? 0}` : ""

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
  // Un signalement (« ce son sature… ») informe, il ne bloque rien : couleur
  // neutre, jamais celle d'une erreur.
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
  // La maquette ne montre que ce que l'auteur reconnaît : les sons, et la
  // ressource qui rassemble les variantes. Le reste est sous « Tous les fichiers ».
  const visibles = fichiers.filter(f => AUDIO.test(f.chemin) || (jeu && f.chemin.endsWith(".tres")))
  const nAudio = fichiers.filter(f => AUDIO.test(f.chemin)).length
  const detail = jeu ? `${nAudio} variantes · le jeu en joue une au hasard, jamais deux fois la même de suite`
    : son?.recette.boucle ? "en boucle" : "un son"
  const dossierRes = livraison?.scene.replace(/\/[^/]*$/, "/") ?? ""
  const conflitsOuverts = (livraison?.conflits ?? []).filter(c => !c.decision)

  return <section aria-label="Aperçu de livraison" className="space-y-[14px] rounded-8 border border-trait bg-carte p-[22px]">
    <h2 className="font-serif text-[25px]">Ce qui sera livré</h2>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {!livraison && !erreur && <p className="text-[13px] text-encre-3">Lecture de l’aperçu…</p>}
    {signalements.length > 0 && <ul className="space-y-[4px] text-[13px] text-encre-attention">{signalements.map(s => <li key={s.son}>{s.signal}</li>)}</ul>}
    {livraison && <>
      <p className="text-[13px] text-encre-3">Dossier du jeu : <span className="font-mono break-all">{dossierRes}</span></p>
      <p className="text-[13px]">{detail}</p>
      <ul className="flex flex-wrap gap-[8px] text-[13px]">{visibles.map(f => <li key={f.chemin} className="rounded-7 border border-trait px-[8px] py-[4px] font-mono">{nomDe(f.chemin)}{f.etat !== "nouveau" ? ` · ${f.etat}` : ""}</li>)}</ul>
      {credits && <p className="text-[13px] text-encre-3"><span className="font-mono">credits.json</span> · d’où vient chaque son : moteur, licence, graine, texte parti.</p>}
      <details className="text-[13px]"><summary className="cursor-pointer">Tous les fichiers · {fichiers.length}</summary>
        <ul className="mt-[8px] space-y-[4px] break-all text-[12px] text-encre-3">{fichiers.map(f => <li key={f.chemin}>{f.chemin} · {f.etat}</li>)}</ul>
        <p className="mt-[8px] text-[12px] text-encre-3">Chaque <span className="font-mono">.import</span> dit à Godot si le son boucle, et pour une musique son tempo et ses mesures.</p>
      </details>
      <p className="text-[12px] text-encre-3">Rien n’est écrit dans le jeu tant que tu n’as pas livré.</p>
      {conflitsOuverts.map(c => <p key={c.chemin} className="text-[13px] text-echec">{c.chemin} : {c.raison}{onTrancherConflit && <> · <button type="button" className="underline" onClick={onTrancherConflit}>Trancher dans Livrer au jeu</button></>}</p>)}
      <button className={`${BOUTON} border-signal bg-signal text-encre-sur-signal`}
        disabled={occupe || !livraison.pret || livraison.etat === "terminee"}
        onClick={() => void publier().then(() => onLivraisons?.())}>
        {livraison.etat === "terminee" ? "Livraison terminée" : "Livrer cette version"}
      </button>
    </>}
  </section>
}
