import { useState } from "react"
import { api, type Asset, type Personnage, type Pose } from "../api"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"
type Entree = { nom: string; asset?: Asset; doublon?: boolean; reprise?: boolean; erreur?: string }

/** L’original entre d’abord en galerie, puis le rangement est appliqué. Un
 * problème de rangement ne fait jamais disparaître le fichier importé.
 *
 * **Deux provenances, un seul rangement.** Un fichier du disque passe par
 * `televerser` ; une image déjà dans la bibliothèque saute cette étape et n'est
 * que *désignée*. Les deux finissent sur le même `rattacher`, donc sur la même
 * case, et une image reprise de la bibliothèque n'est jamais recopiée.
 *
 * `poseInitiale` et `directionInitiale` : ouvert depuis une rangée vide de
 * *Images fixes* ou depuis « Fabriquer… », le dialogue arrive déjà pointé sur
 * la case qu'on regardait — sans quoi on rechoisirait à la main ce qu'on
 * venait de désigner du doigt. */
export function ImporterPourUnSujet({ personnage, plan, onFermer, onChange, onOuvrir, poseInitiale, directionInitiale }: {
  personnage: Personnage; plan: Pose[]; onFermer: () => void; onChange: () => void; onOuvrir: (id: string) => void
  poseInitiale?: string; directionInitiale?: string
}) {
  const poses = plan.filter(p => personnage.cases.some(c => c.pose === p.identifiant))
  const visee = poseInitiale && poses.some(p => p.identifiant === poseInitiale) ? poseInitiale : ""
  const [pose, setPose] = useState(visee || poses[0]?.identifiant || "")
  const [direction, setDirection] = useState(visee ? directionInitiale ?? "" : "")
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [occupe, setOccupe] = useState(false)
  const [bibliotheque, setBibliotheque] = useState(false)
  const directions = personnage.cases.find(c => c.pose === pose)?.directions ?? []
  /** **Toujours au sujet, même sans mouvement** (`AU20`).
   *
   *  Sans pose, ce rattachement ne se faisait pas du tout : l'image entrait
   *  dans la bibliothèque du jeu et quittait la fiche où on venait de la faire
   *  entrer. Le mouvement se choisit plus tard, dans « Pas encore rangé » ;
   *  l'appartenance au sujet, elle, se décide au moment où l'on importe *pour
   *  lui*, et c'est le seul moment où on la connaît à coup sûr. */
  async function rattacher(asset: Asset) {
    return api.designer(asset.identifiant, personnage.identifiant, pose || null, direction || null)
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
  /** Une image que la bibliothèque tient déjà : rien à téléverser, rien à
   *  payer — on la désigne, et elle est dans la case. */
  async function reprendre(asset: Asset) {
    setBibliotheque(false)
    if (occupe) return
    setOccupe(true)
    const nom = asset.label || asset.identifiant
    try { const range = await rattacher(asset); setEntrees(deja => [...deja, { nom, asset: range, reprise: true }]); onChange() }
    catch (e) { setEntrees(deja => [...deja, { nom, asset, reprise: true, erreur: e instanceof Error ? e.message : "Rangement refusé." }]) }
    finally { setOccupe(false) }
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
      <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px]">Ranger les images dans<select className={CHAMP} disabled={occupe} value={pose} onChange={e => { setPose(e.target.value); setDirection("") }}><option value="">{personnage.nom}, sans mouvement encore</option>{poses.map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{pose && directions.length > 0 && <label className="flex flex-col gap-[8px]">Direction<select className={CHAMP} disabled={occupe} value={direction} onChange={e => setDirection(e.target.value)}><option value="">À préciser ensuite</option>{directions.map(d => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}</div>
      <label className={`${CHAMP} flex min-h-[128px] cursor-pointer flex-col items-center justify-center gap-[14px] border-dashed`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importer([...e.dataTransfer.files]) }}><span>{occupe ? "Import en cours…" : "Choisir des images ou les déposer ici"}</span><input type="file" accept="image/*" multiple disabled={occupe} aria-label="Images à importer" onChange={e => { void importer([...(e.target.files ?? [])]); e.target.value = "" }} /></label>
      <div className="flex flex-wrap items-center gap-[14px]">
        <button className={CHAMP} disabled={occupe} onClick={() => setBibliotheque(true)}>Reprendre une image de la bibliothèque</button>
        <span className="text-encre-3">Elle n’est pas recopiée, ni refabriquée : elle est simplement rangée ici.</span>
      </div>
      <p className="text-encre-3">Une planche de plusieurs sprites s’importe entière : ouvre ensuite « Découper une image ». Pour une vidéo ou un modèle 3D, utilise Sources & clips.</p>
      <div className="space-y-[14px]">{entrees.map((e, i) => <article key={i} className="flex items-start gap-[14px] rounded-7 border border-trait bg-carte p-[14px]">{e.asset && <img src={api.fichier(e.asset.identifiant)} alt={e.nom} className="damier-papier h-[76px] w-[76px] object-contain" />}<div className="min-w-0 flex-1"><p className="truncate font-medium">{e.nom}</p><p className="mt-[8px] text-encre-3">{e.doublon ? "Cette image existe déjà. Son classement est conservé." : e.asset && !e.erreur ? e.reprise ? "Image de la bibliothèque, rangée ici." : "Image importée et rangée." : ""}</p>{e.erreur && <p role="alert" className="mt-[8px] text-echec">{e.erreur}</p>}<div className="mt-[8px] flex flex-wrap gap-[8px]">{e.asset && <button className={CHAMP} onClick={() => onOuvrir(e.asset!.identifiant)}>Ouvrir l’image</button>}{e.asset && pose && (e.doublon || e.erreur) && <button className={CHAMP} disabled={occupe} onClick={() => void rangerExistante(e)}>Ranger dans {personnage.nom} · {poses.find(p => p.identifiant === pose)?.nom}</button>}</div></div></article>)}</div>
    </div>
    {bibliotheque && <CadreDialogue titre="Reprendre une image de la bibliothèque" onFermer={() => setBibliotheque(false)} enfants={<BibliothequePourImage retour="Importer…" onFermer={() => setBibliotheque(false)} onChoisir={a => void reprendre(a)} />} />}
  </>} />
}
