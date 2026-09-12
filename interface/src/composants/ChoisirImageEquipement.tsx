import { useEffect, useState } from "react"
import { api, type Asset } from "../api"
import { imageAsset, vignetteAsset } from "./Apercu"
import type { RoleCalque } from "../api-calques"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"

/** Une image entre d’abord en bibliothèque. L’association précise conserve son
 * identité et son rôle ; importer un personnage équipé n’en fait pas un calque. */
export function ChoisirImageEquipement({ onChoisir, onFermer, referenceSeulement = false }: {
  onChoisir: (asset: Asset, role: RoleCalque) => Promise<void>
  onFermer: () => void
  referenceSeulement?: boolean
}) {
  const [recherche, setRecherche] = useState("")
  const [favoris, setFavoris] = useState(false)
  const [limite, setLimite] = useState(60)
  const [liste, setListe] = useState<Asset[]>([])
  const [total, setTotal] = useState(0)
  const [selection, setSelection] = useState<Asset | null>(null)
  const [role, setRole] = useState<RoleCalque>(referenceSeulement ? "reference" : "source-equipee")
  const [attente, setAttente] = useState(false)
  const [erreur, setErreur] = useState("")
  const [lecture, setLecture] = useState(false)
  useEffect(() => {
    let vivant = true
    setLecture(true)
    const timer = window.setTimeout(() => {
      api.assets({ recherche, favoris, limite }).then((r) => {
        if (vivant) { setListe(r.assets.filter((a) => a.type_media.startsWith("image/"))); setTotal(r.total) }
      }).catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire la bibliothèque.") })
        .finally(() => { if (vivant) setLecture(false) })
    }, recherche ? 180 : 0)
    return () => { vivant = false; window.clearTimeout(timer) }
  }, [recherche, favoris, limite])

  const importer = async (fichier?: File) => {
    if (!fichier) return
    setAttente(true); setErreur("")
    try { const r = await api.televerser(fichier); setSelection(r.asset ?? r.doublon) }
    catch (e) { setErreur(e instanceof Error ? e.message : "L’image n’a pas pu être importée.") }
    finally { setAttente(false) }
  }
  const associer = async () => {
    if (!selection) return
    setAttente(true); setErreur("")
    try { await onChoisir(selection, role) }
    catch (e) { setErreur(e instanceof Error ? e.message : "L’image n’a pas pu être associée.") }
    finally { setAttente(false) }
  }
  return <section aria-label="Choisir une image pour cet équipement" className="defile min-h-0 flex-1 overflow-y-auto p-[22px]">
    <div className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">{referenceSeulement ? "Choisir la référence commune" : "Associer une image à cette cible"}</h2><button className={CONTROLE} onClick={onFermer} disabled={attente}>Fermer</button></div>
    <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
      <input type="search" aria-label="Rechercher une image" placeholder="Rechercher dans les images du jeu…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setLimite(60) }} className={`${CONTROLE} min-w-0 flex-1`} />
      <label className="flex items-center gap-[8px] text-[13px] text-encre-3"><input type="checkbox" checked={favoris} onChange={(e) => setFavoris(e.target.checked)} />Favoris</label>
      <label className={`${CONTROLE} flex cursor-pointer items-center`}>Importer une image<input type="file" accept="image/*" disabled={attente} className="sr-only" onChange={(e) => void importer(e.target.files?.[0])} /></label>
    </div>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    {lecture && <p role="status" className="mt-[14px] text-[12px] text-encre-3">Lecture des images…</p>}
    <div className="mt-[14px] grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[8px]">{liste.map((a) => <button key={a.identifiant} aria-pressed={selection?.identifiant === a.identifiant} onClick={() => setSelection(a)} className={`overflow-hidden rounded-7 border p-[8px] text-left ${selection?.identifiant === a.identifiant ? "border-signal bg-ligne-ouverte" : "border-trait bg-carte"}`}><img src={vignetteAsset(a, 128)} alt="" loading="lazy" className="damier-papier aspect-square w-full object-contain" /><span className="mt-[4px] block truncate text-[12px] text-encre">{a.label || a.identifiant}</span></button>)}</div>
    {!lecture && !liste.length && <p className="mt-[14px] text-[13px] text-encre-3">Aucune image pour ces filtres. Importez une image ou changez la recherche.</p>}
    {total > limite && <button className={`${CONTROLE} mt-[14px]`} onClick={() => setLimite((n) => n + 60)}>Afficher les images suivantes</button>}
    {selection && <div className="mt-[22px] flex items-start gap-[14px] rounded-8 border border-contour bg-carte p-[14px]">
      <img src={imageAsset(selection)} alt={selection.label} className="damier-papier w-[128px] shrink-0 object-contain" />
      <div className="flex min-w-0 flex-1 flex-col gap-[14px]">{!referenceSeulement && <label className="flex flex-col gap-[4px] text-[13px] text-encre">Cette image représente<select aria-label="Rôle de cette image" value={role} onChange={(e) => setRole(e.target.value as RoleCalque)} className={CONTROLE}><option value="source-equipee">Le personnage équipé — à extraire</option><option value="calque">Un calque transparent — déjà extrait</option><option value="reference">Une référence d’apparence</option></select></label>}
        <p className="text-[12px] text-encre-3">{role === "source-equipee" ? "Le personnage complet reste une source. L’extraction créera une nouvelle image transparente à vérifier." : role === "calque" ? "Le calque doit contenir uniquement l’équipement. Vérifiez sa superposition avant de le retenir." : "Cette image décrit la pièce ; elle ne remplit pas la cible et ne se superpose pas au personnage."}</p>
        <button onClick={() => void associer()} disabled={attente} className={`${CONTROLE} self-start`}>{attente ? "Association…" : referenceSeulement ? "Définir comme référence de la pièce" : "Associer cette image"}</button>
      </div>
    </div>}
  </section>
}
