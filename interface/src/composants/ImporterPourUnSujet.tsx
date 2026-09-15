// L'écran d'import d'une fiche — **un seul**, depuis `RP5`.
//
// Il y en avait deux : un bouton du bandeau qui ne demandait rien et devinait
// ce qu'on lui donnait, et cette fenêtre-ci qui demandait la pose et la
// direction **avant** d'accepter les fichiers. La fenêtre reste, la règle de
// l'autre gagne.
//
// **La règle, en quatre lignes** (`docs/PLAN-remise-a-plat.md` § RP5) :
//
// 1. *Rien ne se demande avant de savoir ce qu'on donne* (`AU21`). Le fichier
//    entre, se rattache au sujet, et la case se pose après.
// 2. *La case se déduit d'un seul endroit : le clic.* Ouvert depuis une rangée
//    vide d'« Images fixes », ce qui entre va dans cette case-là. **Ni le nom du
//    fichier ni l'onglet ouvert ne la déduisent** : une case est prise dès
//    qu'une image la porte, donc une case devinée de travers cache ce qui
//    manque — alors qu'une image sans case se voit dans « Pas encore rangé ».
// 3. *Deux natures sur trois n'ont pas de case du tout.* Une vidéo devient un
//    clip et ouvre le montage ; une planche ouvre la découpe. La case visée est
//    laissée de côté, et l'écran le dit.
// 4. *Quand il ne sait pas, il range quand même* (`AU20`) : sur le sujet, sans
//    case, visible dans « Pas encore rangé ». Le choix est offert après coup,
//    jamais exigé.
//
// ⚠️ **La détection de planche passe avant le rattachement, et c'est un
// changement d'ordre assumé.** L'écran d'avant rattachait puis regardait : il
// aurait donc rangé la planche dans la case visée avant de savoir que c'en
// était une. La détection reste **sans promesse** — si elle échoue, on n'en
// tient pas compte et le rattachement se fait quand même, si bien que ce qui
// est entré est sur la fiche dans tous les cas.

import { useState } from "react"
import { api, type Asset, type Personnage, type Pose } from "../api"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"

/** Une vidéo se reconnaît à son type, et à son extension quand le système
 *  n'en donne pas. */
const VIDEO = /\.(mp4|webm|mov|mkv|avi|m4v)$/i

/** Deux cases détectées, c'est une planche. Une seule, c'est une image — le
 *  détourage en trouve toujours au moins une, et ouvrir la découpe pour un
 *  seul rectangle serait un écran de plus pour rien. */
const PLANCHE_DES = 2

type Entree = {
  nom: string
  asset?: Asset
  /** Le clip né d'une vidéo. Il ne prend jamais de case. */
  clip?: string
  images?: number
  /** Le nombre de cases détectées, quand c'en est une planche. */
  planche?: number
  doublon?: boolean
  reprise?: boolean
  /** Rattachée au sujet, mais sans case : elle attend dans « Pas encore rangé ». */
  sansCase?: boolean
  erreur?: string
}

/** Ce qui peut encore recevoir une case : une image du sujet qui n'en a pas.
 *  Une planche n'en est jamais une — ce sont ses morceaux qui se rangent. */
function rangeable(e: Entree) {
  return Boolean(e.asset) && !e.planche && !e.clip && (e.doublon || Boolean(e.erreur) || Boolean(e.sansCase))
}

export function ImporterPourUnSujet({ personnage, plan, onFermer, onChange, onOuvrir, onDecouper, onMonter, poseInitiale, directionInitiale }: {
  personnage: Personnage; plan: Pose[]; onFermer: () => void; onChange: () => void; onOuvrir: (id: string) => void
  /** Ouvrir la découpe sur la planche qui vient d'entrer. */
  onDecouper?: (asset: string) => void
  /** Ouvrir le montage sur le clip qui vient d'entrer. */
  onMonter?: (clip: string) => void
  poseInitiale?: string; directionInitiale?: string
}) {
  const poses = plan.filter(p => personnage.cases.some(c => c.pose === p.identifiant))
  const visee = poseInitiale && poses.some(p => p.identifiant === poseInitiale) ? poseInitiale : ""
  const [pose, setPose] = useState(visee || "")
  const [direction, setDirection] = useState(visee ? directionInitiale ?? "" : "")
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [occupe, setOccupe] = useState(false)
  const [bibliotheque, setBibliotheque] = useState(false)
  const directions = personnage.cases.find(c => c.pose === pose)?.directions ?? []
  /** **Le choix de la case ne paraît que lorsqu'il y a une case à montrer** :
   *  celle qu'on a désignée du doigt en ouvrant, ou celle qu'il reste à donner
   *  à ce qui vient d'entrer. Depuis le bandeau, avant le premier fichier, il
   *  n'y a donc aucun réglage — seulement la zone où déposer. */
  const reglages = Boolean(visee) || entrees.some(rangeable)

  /** **Toujours au sujet, même sans mouvement** (`AU20`).
   *
   *  Sans pose, ce rattachement ne se faisait pas du tout : l'image entrait
   *  dans la bibliothèque du jeu et quittait la fiche où on venait de la faire
   *  entrer. Le mouvement se choisit plus tard, dans « Pas encore rangé » ;
   *  l'appartenance au sujet, elle, se décide au moment où l'on importe *pour
   *  lui*, et c'est le seul moment où on la connaît à coup sûr. */
  async function rattacher(asset: Asset, sa: { pose: string; direction: string }) {
    return api.designer(asset.identifiant, personnage.identifiant, sa.pose || null, sa.direction || null)
  }

  /** Une vidéo devient un clip du sujet, **et on ne lui pose pas de case** : ce
   *  qui se range sur un mouvement, c'est la bande qu'on y taillera. */
  async function uneVideo(fichier: File): Promise<Entree> {
    const recu = await api.importerClip(fichier, { nom: fichier.name, personnage: personnage.identifiant })
    const clip = recu.clip ?? recu.doublon
    if (!clip) return { nom: fichier.name, erreur: "Cette vidéo n’a pas pu entrer." }
    return { nom: fichier.name, clip: clip.identifiant, images: clip.clip?.images, doublon: Boolean(recu.doublon) }
  }

  /** Une image entre, **puis** on regarde si c'est une planche, **puis** on la
   *  range. La détection est sans promesse : elle échoue sans rien empêcher. */
  async function uneImage(fichier: File, sa: { pose: string; direction: string }): Promise<Entree> {
    const recu = await api.televerser(fichier)
    if (recu.doublon) return { nom: fichier.name, asset: recu.doublon, doublon: true }
    const entre = recu.asset
    if (!entre) return { nom: fichier.name, erreur: "Cette image n’a pas pu entrer." }

    let cases = 0
    try {
      cases = (await api.decoupeProposee(entre.identifiant, { mode: "auto" })).boites.length
    } catch {
      cases = 0
    }
    const planche = cases >= PLANCHE_DES && Boolean(onDecouper)
    try {
      const range = await rattacher(entre, planche ? { pose: "", direction: "" } : sa)
      return planche
        ? { nom: fichier.name, asset: range, planche: cases }
        : { nom: fichier.name, asset: range, sansCase: !sa.pose }
    } catch (e) {
      return {
        nom: fichier.name,
        asset: entre,
        planche: planche ? cases : undefined,
        erreur: `L’image est conservée dans la galerie ; son rangement a échoué. ${e instanceof Error ? e.message : "Import impossible."}`,
      }
    }
  }

  /** **La suite ne s'ouvre d'elle-même que pour un fichier seul.** Un lot, on
   *  l'a déposé pour qu'il entre en entier : partir au montage au troisième
   *  fichier abandonnerait les suivants. Les lignes portent le bouton dans les
   *  deux cas, donc rien n'est perdu — seul l'enchaînement est retenu. */
  async function importer(fichiers: File[]) {
    if (occupe || !fichiers.length) return
    setOccupe(true)
    const sa = { pose, direction }
    const nouvelles: Entree[] = []
    for (const fichier of fichiers) {
      let entree: Entree
      try {
        entree = fichier.type.startsWith("video/") || VIDEO.test(fichier.name)
          ? await uneVideo(fichier)
          : await uneImage(fichier, sa)
      } catch (e) {
        entree = { nom: fichier.name, erreur: e instanceof Error ? e.message : "Import impossible." }
      }
      nouvelles.push(entree)
      setEntrees(deja => [...deja, entree])
      if (!entree.erreur) onChange()
    }
    setOccupe(false)
    if (fichiers.length === 1) {
      const seule = nouvelles[0]
      if (seule.clip) onMonter?.(seule.clip)
      else if (seule.planche && seule.asset) onDecouper?.(seule.asset.identifiant)
    }
  }

  /** Une image que la bibliothèque tient déjà : rien à téléverser, rien à
   *  payer — on la désigne, et elle est dans la case. */
  async function reprendre(asset: Asset) {
    setBibliotheque(false)
    if (occupe) return
    setOccupe(true)
    const nom = asset.label || asset.identifiant
    try { const range = await rattacher(asset, { pose, direction }); setEntrees(deja => [...deja, { nom, asset: range, reprise: true, sansCase: !pose }]); onChange() }
    catch (e) { setEntrees(deja => [...deja, { nom, asset, reprise: true, erreur: e instanceof Error ? e.message : "Rangement refusé." }]) }
    finally { setOccupe(false) }
  }

  async function rangerExistante(entree: Entree) {
    if (!entree.asset || occupe) return
    setOccupe(true)
    try { const asset = await rattacher(entree.asset, { pose, direction }); setEntrees(deja => deja.map(e => e === entree ? { ...e, asset, doublon: false, sansCase: !pose, erreur: undefined } : e)); onChange() }
    catch (e) { setEntrees(deja => deja.map(l => l === entree ? { ...l, erreur: e instanceof Error ? e.message : "Rangement refusé." } : l)) }
    finally { setOccupe(false) }
  }

  function dire(e: Entree) {
    if (e.erreur) return ""
    if (e.clip) return e.doublon
      ? "Cette vidéo était déjà là. Son clip s’ouvre au montage, et ne prend pas de case."
      : `Vidéo entrée comme clip${e.images ? ` · ${e.images} images` : ""}. Elle ne prend pas de case : c’est la bande qu’on y taille qui se range.`
    if (e.planche) return `${e.planche} cases détectées : c’est une planche. Elle est sur ${personnage.nom} sans case — la découpe range ses morceaux.`
    if (e.doublon) return "Cette image existe déjà. Son classement est conservé."
    if (e.reprise) return e.sansCase ? "Image de la bibliothèque, rangée sur le sujet · Pas encore rangé." : "Image de la bibliothèque, rangée ici."
    if (e.sansCase) return `Image importée, rangée sur ${personnage.nom} · Pas encore rangé.`
    return "Image importée et rangée."
  }

  return <CadreDialogue titre={`Importer pour ${personnage.nom}`} format="preparation" onFermer={onFermer} enfants={<>
    <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait p-[22px]"><div><h1 className="font-serif text-[25px]">Importer…</h1><p className="mt-[8px] text-[13px] text-encre-3">{personnage.nom} · Les originaux restent conservés.</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[22px] text-[13px]">
      <label className={`${CHAMP} flex min-h-[128px] cursor-pointer flex-col items-center justify-center gap-[14px] border-dashed`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void importer([...e.dataTransfer.files]) }}><span>{occupe ? "Import en cours…" : "Choisir des fichiers ou les déposer ici"}</span><input type="file" accept="image/*,video/*" multiple disabled={occupe} aria-label="Fichiers à importer" onChange={e => { void importer([...(e.target.files ?? [])]); e.target.value = "" }} /></label>
      <div className="flex flex-wrap items-center gap-[14px]">
        <button className={CHAMP} disabled={occupe} onClick={() => setBibliotheque(true)}>Reprendre une image de la bibliothèque</button>
        <span className="text-encre-3">Elle n’est pas recopiée, ni refabriquée : elle est simplement rangée ici.</span>
      </div>
      <p className="text-encre-3">Une vidéo ouvre le montage, une planche ouvre la découpe : ni l’une ni l’autre ne prend de case. Une image qui n’en a pas attend dans « Pas encore rangé », et sa case se choisit après.</p>
      {reglages && <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px]">Ranger les images dans<select className={CHAMP} disabled={occupe} value={pose} onChange={e => { setPose(e.target.value); setDirection("") }}><option value="">{personnage.nom}, sans mouvement encore</option>{poses.map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{pose && directions.length > 0 && <label className="flex flex-col gap-[8px]">Direction<select className={CHAMP} disabled={occupe} value={direction} onChange={e => setDirection(e.target.value)}><option value="">À préciser ensuite</option>{directions.map(d => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}</div>}
      <div className="space-y-[14px]">{entrees.map((e, i) => <article key={i} className="flex items-start gap-[14px] rounded-7 border border-trait bg-carte p-[14px]">{e.asset && <img src={api.fichier(e.asset.identifiant)} alt={e.nom} className="damier-papier h-[76px] w-[76px] object-contain" />}<div className="min-w-0 flex-1"><p className="truncate font-medium">{e.nom}</p><p className="mt-[8px] text-encre-3">{dire(e)}</p>{e.erreur && <p role="alert" className="mt-[8px] text-echec">{e.erreur}</p>}<div className="mt-[8px] flex flex-wrap gap-[8px]">{e.clip && onMonter && <button className={CHAMP} onClick={() => onMonter(e.clip!)}>Ouvrir le montage</button>}{e.planche && e.asset && onDecouper && <button className={CHAMP} onClick={() => onDecouper(e.asset!.identifiant)}>Ouvrir la découpe</button>}{e.asset && <button className={CHAMP} onClick={() => onOuvrir(e.asset!.identifiant)}>Ouvrir l’image</button>}{rangeable(e) && pose && <button className={CHAMP} disabled={occupe} onClick={() => void rangerExistante(e)}>Ranger dans {personnage.nom} · {poses.find(p => p.identifiant === pose)?.nom}</button>}</div></div></article>)}</div>
    </div>
    {bibliotheque && <CadreDialogue titre="Reprendre une image de la bibliothèque" onFermer={() => setBibliotheque(false)} enfants={<BibliothequePourImage retour="Importer…" onFermer={() => setBibliotheque(false)} onChoisir={a => void reprendre(a)} />} />}
  </>} />
}
