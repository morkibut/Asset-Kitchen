import { useState } from "react"
import { api, type Asset, type Personnage, type Pose } from "../api"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"
type Entree = { nom: string; asset?: Asset; doublon?: boolean; erreur?: string }

/** L’original entre d’abord en galerie, puis le rangement est appliqué. Un
 * problème de rangement ne fait jamais disparaître le fichier importé. */
export function ImporterPourUnSujet({ personnage, plan, onFermer, onChange, onOuvrir }: {
  personnage: Personnage; plan: Pose[]; onFermer: () => void; onChange: () => void; onOuvrir: (id: string) => void
}) {
  const poses = plan.filter(p => personnage.cases.some(c => c.pose === p.identifiant))
  const [pose, setPose] = useState(poses[0]?.identifiant ?? "")
  const [direction, setDirection] = useState("")
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [occupe, setOccupe] = useState(false)
  const directions = personnage.cases.find(c => c.pose === pose)?.directions ?? []
  async function rattacher(asset: Asset) {
    if (!pose) return asset
    return api.designer(asset.identifiant, personnage.identifiant, pose, direction || null)
  }
  async function importer(fichiers: File[]) {
    if (occupe) return
    setOccupe(true)
    for (const fichier of fichiers) {
      let asset: Asset | null = null
      try {
        const resultat = await api.televerser(fichier)
        asset = resultat.asset
        if (resultat.doublon) setEntrees(deja => [...deja, { nom: fichier.name, asset: resultat.doublon!, doublon: true }])
        else if (asset) { asset = await rattacher(asset); setEntrees(deja => [...deja, { nom: fichier.name, asset: asset! }]); onChange() }
      } catch (e) { setEntrees(deja => [...deja, { nom: fichier.name, asset: asset ?? undefined, erreur: `${asset ? "L’image est conservée dans la galerie ; son rangement a échoué. " : ""}${e instanceof Error ? e.message : "Import impossible."}` }]) }
    }
    setOccupe(false)
  }
  async function rangerExistante(entree: Entree) {
    if (!entree.asset || occupe) return
    setOccupe(true)
    try { const asset = await rattacher(entree.asset); setEntrees(deja => deja.map(e => e === entree ? { ...e, asset, doublon: false, erreur: undefined } : e)); onChange() }
    catch (e) { setEntrees(deja => deja.map(l => l === entree ? { ...l, erreur: e instanceof Error ? e.message : "Rangement refusé." } : l)) }
    finally { setOccupe(false) }
  }
  return <CadreDialogue titre={`Importer pour ${personnage.nom}`} format="preparation" onFermer={onFermer} enfants={<>
    <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait p-[22px]"><div><h1 className="font-serif text-[25px]">Importer des images</h1><p className="mt-[8px] text-[13px] text-encre-3">{personnage.nom} · Les originaux restent conservés.</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[22px] text-[13px]">
      <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px]">Ranger les images dans<select className={CHAMP} disabled={occupe} value={pose} onChange={e => { setPose(e.target.value); setDirection("") }}><option value="">Galerie du jeu, sans mouvement</option>{poses.map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{pose && directions.length > 0 && <label className="flex flex-col gap-[8px]">Direction<select className={CHAMP} disabled={occupe} value={direction} onChange={e => setDirection(e.target.value)}><option value="">À préciser ensuite</option>{directions.map(d => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}</div>
      <label className={`${CHAMP} flex min-h-[128px] cursor-pointer flex-col items-center justify-center gap-[14px] border-dashed`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importer([...e.dataTransfer.files]) }}><span>{occupe ? "Import en cours…" : "Choisir des images ou les déposer ici"}</span><input type="file" accept="image/*" multiple disabled={occupe} aria-label="Images à importer" onChange={e => { void importer([...(e.target.files ?? [])]); e.target.value = "" }} /></label>
      <p className="text-encre-3">Une planche de plusieurs sprites s’importe entière : ouvre ensuite « Découper une image ». Pour une vidéo ou un modèle 3D, utilise Sources & clips.</p>
      <div className="space-y-[14px]">{entrees.map((e, i) => <article key={i} className="flex items-start gap-[14px] rounded-7 border border-trait bg-carte p-[14px]">{e.asset && <img src={api.fichier(e.asset.identifiant)} alt={e.nom} className="damier-papier h-[76px] w-[76px] object-contain" />}<div className="min-w-0 flex-1"><p className="truncate font-medium">{e.nom}</p><p className="mt-[8px] text-encre-3">{e.doublon ? "Cette image existe déjà. Son classement est conservé." : e.asset && !e.erreur ? "Image importée et rangée." : ""}</p>{e.erreur && <p role="alert" className="mt-[8px] text-echec">{e.erreur}</p>}<div className="mt-[8px] flex flex-wrap gap-[8px]">{e.asset && <button className={CHAMP} onClick={() => onOuvrir(e.asset!.identifiant)}>Ouvrir l’image</button>}{e.asset && pose && (e.doublon || e.erreur) && <button className={CHAMP} disabled={occupe} onClick={() => void rangerExistante(e)}>Ranger dans {personnage.nom} · {poses.find(p => p.identifiant === pose)?.nom}</button>}</div></div></article>)}</div>
    </div>
  </>} />
}
