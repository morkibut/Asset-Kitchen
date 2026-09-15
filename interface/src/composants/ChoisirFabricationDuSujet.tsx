import { useState } from "react"
import type { Personnage, Pose } from "../api"
import { CadreDialogue } from "./CadreDialogue"
const CHAMP = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px]"

/** **Trois portes, et les trois commandent au fournisseur.**
 *
 *  ⚠️ **Les deux portes d'import en sont sorties en `AU21`**, et c'est ce qui
 *  rend cet écran-ci défendable. Il commence par demander *quel mouvement,
 *  quelle direction ?* — une question qui a un sens quand on va payer pour
 *  remplir une case précise, et aucun quand on pose un fichier qu'on a déjà :
 *  une vidéo ne se range pas sur un mouvement, c'est la bande qu'on y taille
 *  qui s'y range. Ce qui entre du disque passe donc par *Importer…*, qui
 *  regarde le fichier et enchaîne tout seul.
 *
 *  La ligne entre les deux boutons de la fiche est celle-là, et elle se dit en
 *  un mot : **ici on paie**. */
export function ChoisirFabricationDuSujet({ personnage, plan, onFermer, onImage, onVideo, on3D, onObjectif }: {
  personnage: Personnage; plan: Pose[]; onFermer: () => void;
  onImage: (pose: Pose, direction?: string) => void; onVideo: (pose: Pose, direction?: string) => void; on3D: (pose?: Pose, direction?: string) => void
  /** **Le renvoi vers l'endroit qui sait déclarer un mouvement** (RP13) —
   *  jusque-là ce texte nommait « Objectif & règles » sans que rien n'y
   *  mène, et cet onglet ne savait pas non plus le faire : deux écrans qui
   *  ne savaient pas, l'un le disant. */
  onObjectif?: () => void
}) {
  const objectifsAnimes = personnage.objectif?.sorties.filter(s => s.nature === "animation" && s.quantite > 0) ?? []
  const posesHistoriques = plan.filter(p => personnage.cases.some(c => c.pose === p.identifiant))
  const posesParIdentifiant = new Map<string, Pose>()
  objectifsAnimes.forEach(sortie => {
    const pose = plan.find(p => p.identifiant === sortie.pose)
    if (pose) posesParIdentifiant.set(pose.identifiant, pose)
  })
  posesHistoriques.forEach(pose => posesParIdentifiant.set(pose.identifiant, pose))
  const poses = [...posesParIdentifiant.values()]
  const prioritaire = objectifsAnimes.find(s => poses.some(p => p.identifiant === s.pose))
  const [pose, setPose] = useState(prioritaire?.pose ?? poses[0]?.identifiant ?? "")
  const [direction, setDirection] = useState(prioritaire?.direction ?? "")
  const choisie = poses.find(p => p.identifiant === pose)
  const directions = personnage.cases.find(c => c.pose === pose)?.directions ?? []
  const cible = choisie && direction ? ` pour ${choisie.nom} · ${directions.find(d => d.identifiant === direction)?.nom ?? direction}` : choisie ? ` pour ${choisie.nom}` : ""
  return <CadreDialogue titre={`Fabriquer pour ${personnage.nom}`} format="preparation" onFermer={onFermer} enfants={<div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[30px]">
    <header className="flex items-start justify-between gap-[22px]"><div><h1 className="font-serif text-[25px]">Fabriquer pour {personnage.nom}</h1><p className="mt-[8px] text-[13px] text-encre-3">Ces trois portes commandent au fournisseur. Pour un fichier que tu as déjà, c’est « Importer… ».</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    <div className="grid grid-cols-2 gap-[14px] text-[13px]"><label className="flex flex-col gap-[8px]">Mouvement ou pose<select className={CHAMP} value={pose} onChange={e => { const prochaine = e.target.value; setPose(prochaine); setDirection(objectifsAnimes.find(s => s.pose === prochaine)?.direction ?? "") }}>{!poses.length && <option value="">Définir un mouvement dans Objectif & règles</option>}{objectifsAnimes.length > 0 && <optgroup label="Dans l’objectif">{poses.filter(p => objectifsAnimes.some(s => s.pose === p.identifiant)).map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</optgroup>}{poses.some(p => !objectifsAnimes.some(s => s.pose === p.identifiant)) && <optgroup label="Autres poses du plan">{poses.filter(p => !objectifsAnimes.some(s => s.pose === p.identifiant)).map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</optgroup>}{!objectifsAnimes.length && poses.map(p => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{directions.length > 0 && <label className="flex flex-col gap-[8px]">Direction<select className={CHAMP} value={direction} onChange={e => setDirection(e.target.value)}><option value="">Direction par défaut de cette pose</option>{directions.map(d => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}</div>
    <div className="space-y-[14px]">{[
      { nom: "Une animation depuis une vidéo", detail: `Choisir l’image de départ, le modèle et le mouvement, puis monter le clip en frames${cible}.`, clic: () => choisie && onVideo(choisie, direction || undefined), indisponible: !choisie },
      { nom: "Une image fixe", detail: `Fabriquer une référence, une pose ou une illustration avec le modèle de ton choix${cible}.`, clic: () => choisie && onImage(choisie, direction || undefined), indisponible: !choisie },
      { nom: "Un modèle 3D et ses animations", detail: `Créer le modèle, préparer son squelette, choisir un mouvement, la caméra et le rendu des sprites${cible}.`, clic: () => on3D(choisie, direction || undefined), indisponible: false },
    ].map(m => <button key={m.nom} disabled={m.indisponible} onClick={m.clic} className="block w-full rounded-7 border border-contour bg-carte p-[22px] text-left hover:border-signal disabled:opacity-50"><span className="font-serif text-[25px]">{m.nom}</span><span className="mt-[8px] block text-[13px] text-encre-3">{m.detail}</span></button>)}</div>
    {!choisie && <p className="text-[13px] text-encre-3">Ajoute d’abord une pose ou un mouvement {onObjectif
      ? <button type="button" className="underline hover:text-encre" onClick={onObjectif}>dans Objectif & règles</button>
      : "dans Objectif & règles"} pour y ranger les images et animations.</p>}
  </div>} />
}
