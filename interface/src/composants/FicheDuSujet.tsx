import { useEffect, useMemo, useState } from "react"
import { api, type Collection, type GroupeDeRangement, type ObjectifDuPersonnage, type Personnage, type Pose } from "../api"
import { BandeQuiTourne, vignetteAsset } from "./Apercu"
import { portraitDe } from "./FicheChose"
import { CadreDialogue } from "./CadreDialogue"

const BOUTON = "h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"

/** Résumé toujours visible ; les champs n'apparaissent qu'à la demande. */
export function FicheDuSujet({ personnage, plan, collections, groupes, onRange, onPersonnage, onErreur, onImages, onObjectif }: {
  personnage: Personnage; plan: Pose[]; collections: Collection[] | null; groupes: GroupeDeRangement[];
  onRange: () => void; onPersonnage: (p: Personnage & { supprime?: boolean }) => void; onErreur: (e: unknown, defaut: string) => void;
  onImages: () => void; onObjectif: () => void;
}) {
  const [edition, setEdition] = useState(false)
  const [nom, setNom] = useState(personnage.nom)
  const [description, setDescription] = useState(personnage.description)
  const [objectif, setObjectif] = useState<ObjectifDuPersonnage | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [survol, setSurvol] = useState(false)
  const [collection, setCollection] = useState("")
  const portrait = useMemo(() => portraitDe(personnage, plan), [personnage, plan])
  const images = [...new Map(personnage.cases.flatMap(c => c.images).filter(a => !a.piece && !a.supprime_le).map(a => [a.identifiant, a])).values()]
  const bandes = [...new Map(personnage.cases.flatMap(c => c.bandes ?? []).filter(b => !b.piece && !b.supprime).map(b => [b.identifiant, b])).values()]
  const bande = bandes.find(b => b.favori) ?? bandes[0]
  const retenus = images.filter(a => a.favori).length + bandes.filter(b => b.favori).length
  const modifie = nom !== personnage.nom || description !== personnage.description
  const ouvrir = () => { setNom(personnage.nom); setDescription(personnage.description); setEdition(true) }
  const fermer = () => { if (!modifie || window.confirm("Abandonner les modifications de la fiche ?")) setEdition(false) }
  useEffect(() => { setEdition(false) }, [personnage.identifiant])
  useEffect(() => {
    let vivant = true
    setObjectif(null)
    api.objectifPersonnage(personnage.identifiant, personnage.projet).then(o => { if (vivant && o.couverture) setObjectif(o) }).catch(e => { if (vivant) onErreur(e, "L’objectif ne peut pas être relu.") })
    return () => { vivant = false }
  }, [personnage, onErreur])
  useEffect(() => { if (!edition || !modifie) return; const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }; window.addEventListener("beforeunload", avertir); return () => window.removeEventListener("beforeunload", avertir) }, [edition, modifie])
  const garder = async () => {
    setOccupe(true)
    try { const resultat = await api.reglerPersonnage(personnage.identifiant, { nom: nom.trim(), description }); onPersonnage(resultat.personnage); setEdition(false) }
    catch (e) { onErreur(e, "La fiche n’a pas pu être conservée.") }
    finally { setOccupe(false) }
  }
  const ranger = async (id: string, retirer = false) => {
    setOccupe(true)
    try { if (retirer) await api.retirerSujet(id, personnage.projet, personnage.identifiant); else await api.rangerSujet(id, personnage.projet, personnage.identifiant); setCollection(""); onRange() }
    catch (e) { onErreur(e, "Le rangement n’a pas pu être conservé.") }
    finally { setOccupe(false) }
  }
  const retirer = async () => {
    if (!window.confirm(`Retirer « ${personnage.nom} » du jeu ? Ses fichiers restent conservés dans la bibliothèque.`)) return
    setOccupe(true)
    try { await api.supprimerPersonnage(personnage.identifiant); onPersonnage({ ...personnage, supprime: true }); setEdition(false) }
    catch (e) { onErreur(e, "L’asset n’a pas pu être retiré.") }
    finally { setOccupe(false) }
  }
  return <>
    <section aria-label="Résumé de l’asset" className="flex shrink-0 items-center gap-[22px] rounded-8 border border-trait bg-carte p-[14px]">
      <button data-portrait-du-sujet className="damier-papier flex h-[128px] w-[128px] shrink-0 items-center justify-center overflow-hidden rounded-7" onClick={onImages} onMouseEnter={() => setSurvol(true)} onMouseLeave={() => setSurvol(false)} title="Voir ses images et références">
        {portrait ? <img src={vignetteAsset(portrait.asset, 256)} alt={`Référence de ${personnage.nom}`} className="h-full w-full object-contain" style={{ imageRendering: "pixelated" }} /> : bande ? <BandeQuiTourne bande={bande} cote={128} joue={survol} titre={`Animation de ${personnage.nom}`} /> : <span className="px-[14px] text-center text-[12px] text-encre-4">Référence à créer</span>}
      </button>
      <div className="min-w-0 flex-1 space-y-[8px]">
        <p className="line-clamp-2 whitespace-pre-line text-[13px] leading-relaxed text-encre-2">{personnage.description || "Décrivez sa silhouette, son rôle et les détails à conserver d’une fabrication à l’autre."}</p>
        <div className="flex flex-wrap items-center gap-[8px] text-[12px] text-encre-3"><span className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{images.length + bandes.length} résultat{images.length + bandes.length > 1 ? "s" : ""}</span><span className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{retenus} retenu{retenus > 1 ? "s" : ""} pour le jeu</span>{collections?.map(c => <span key={c.identifiant} className="rounded-5 bg-papier-cote px-[8px] py-[4px]">{c.nom}</span>)}<button className={BOUTON} onClick={ouvrir}>Modifier la fiche</button></div>
        {objectif && <div className="flex flex-wrap items-center gap-[8px] text-[12px] text-encre-3">{([['animations', 'animation', 'animations'], ['images', 'image fixe', 'images fixes']] as const).map(([cle, singulier, pluriel]) => { const c = objectif.couverture[cle]; return c.demande > 0 && <span key={cle}>{c.retenu} / {c.demande} {c.demande > 1 ? pluriel : singulier} retenue{c.demande > 1 ? "s" : ""}{c.manquant ? ` · ${c.manquant} à fabriquer` : c.a_retenir ? ` · ${c.a_retenir} à juger` : ""}</span> })}<button className="underline" onClick={onObjectif}>{objectif.objectif.sorties.length ? "Revoir l’objectif" : "Définir l’objectif"}</button></div>}
      </div>
    </section>
    {edition && <CadreDialogue titre="La fiche de l’asset" format="preparation" onFermer={fermer} enfants={<>
      <header className="flex items-center justify-between border-b border-trait p-[22px]"><h2 className="font-serif text-[25px]">La fiche de l’asset</h2><button className={BOUTON} onClick={fermer}>Fermer</button></header>
      <div className="defile space-y-[22px] overflow-y-auto p-[22px]">
        <label className="flex flex-col gap-[8px] text-[13px]">Nom<input aria-label="Nom du sujet" className="h-[34px] rounded-7 border border-contour bg-carte px-[14px]" value={nom} onChange={e => setNom(e.target.value)} /></label>
        <label className="flex flex-col gap-[8px] text-[13px]">Ce qui le caractérise<textarea aria-label="Description du sujet" className="min-h-[128px] resize-y rounded-7 border border-contour bg-carte p-[14px]" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <p className="text-[12px] text-encre-3">Cette description accompagne ses fabrications. Les références et le texte exact seront relus avant chaque envoi.</p>
        <details className="text-[13px]"><summary className="cursor-pointer">Rangement et retrait du jeu</summary><p className="mt-[8px] text-[12px] text-encre-3">Type : {personnage.type || personnage.famille}. Retirer l’asset du jeu conserve ses fichiers et ses images.</p><button className={`${BOUTON} mt-[14px] text-echec`} disabled={occupe} onClick={() => void retirer()}>Le retirer du jeu</button></details>
        <section><h3 className="text-[13px] font-medium">Collections</h3><div className="mt-[8px] flex flex-wrap gap-[8px]">{collections?.map(c => <span key={c.identifiant} data-collection-du-sujet={c.identifiant} className="flex items-center gap-[8px] rounded-5 bg-papier-cote px-[8px] py-[4px] text-[13px]">{c.nom}<button disabled={occupe} aria-label={`Retirer de ${c.nom}`} onClick={() => void ranger(c.identifiant, true)}>×</button></span>)}</div><div className="mt-[14px] flex gap-[8px]"><select aria-label="Ajouter à une collection" className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[8px] text-[13px]" value={collection} onChange={e => setCollection(e.target.value)}><option value="">Choisir une collection</option>{groupes.filter(g => !collections?.some(c => c.identifiant === g.identifiant)).map(g => <option key={g.identifiant} value={g.identifiant}>{g.nom}</option>)}</select><button className={BOUTON} disabled={occupe || !collection} onClick={() => void ranger(collection)}>Ranger</button></div><p className="mt-[8px] text-[12px] text-encre-3">Le rangement est conservé immédiatement. Il ne change pas les règles de fabrication.</p></section>
      </div>
      <footer className="flex justify-end gap-[8px] border-t border-trait p-[14px]"><button className={BOUTON} onClick={fermer}>Annuler</button><button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50" disabled={occupe || !nom.trim() || !modifie} onClick={() => void garder()}>Garder la fiche</button></footer>
    </>} />}
  </>
}
