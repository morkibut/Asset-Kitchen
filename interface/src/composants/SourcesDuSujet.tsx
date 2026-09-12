import { useMemo, useState } from "react"
import { api, type Generation, type Personnage, type Pose } from "../api"
import { Sources3D } from "./Sources3D"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"

/** Les sources du sujet sont les clips du dépôt, pas des séquences recomposées.
 * Le montage garde leur identifiant et se rouvre sur le même fichier payé. */
export function SourcesDuSujet({ personnage, clips, onMontage, onAnimer, onBande }: {
  personnage: Personnage
  clips: readonly Generation[]
  onMontage: (clip: string) => void
  onBande?: (id: string) => void
  onAnimer: (pose: Pose, direction: { identifiant: string; nom: string } | null) => void
}) {
  const [poseId, setPoseId] = useState("")
  const [directionId, setDirectionId] = useState("")
  const [recherche, setRecherche] = useState("")
  const poses = personnage.plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const pose = poses.find((p) => p.identifiant === poseId) ?? poses[0]
  const directions = personnage.cases.find((c) => c.pose === pose?.identifiant)?.directions ?? []
  const direction = directions.find((d) => d.identifiant === directionId) ?? directions[0] ?? null
  const sources = useMemo(() => clips.filter((g) => g.personnage === personnage.identifiant && g.clip && (!g.clip.nature || g.clip.nature === "video") && !g.clip.jete && `${g.demande.prompt} ${g.modele}`.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr"))), [clips, personnage.identifiant, recherche])
  return <section aria-label="Sources et clips du sujet" className="defile min-h-0 flex-1 overflow-y-auto pb-[22px]">
    <div className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px] text-encre">De l’image au clip, puis aux frames</h2><p className="mt-[8px] text-[13px] text-encre-3">Choisissez le mouvement et la direction. L’étape suivante prépare l’image de départ, le prompt, le modèle et les paramètres avant l’envoi.</p><div className="mt-[14px] flex flex-wrap items-end gap-[14px]"><label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Mouvement<select className={BOUTON} value={pose?.identifiant ?? ""} onChange={(e) => { setPoseId(e.target.value); setDirectionId("") }}><option disabled value="">Aucun mouvement défini</option>{poses.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{directions.length > 0 && <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Direction<select className={BOUTON} value={direction?.identifiant ?? ""} onChange={(e) => setDirectionId(e.target.value)}>{directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}<button disabled={!pose} onClick={() => pose && onAnimer(pose, direction)} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">Préparer un clip vidéo</button></div></div>
    <div className="mt-[22px] flex items-end justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">Clips conservés</h2><label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Rechercher un clip<input className={BOUTON} type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} /></label></div>
    {!sources.length && <p className="mt-[14px] rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">Aucun clip pour cet asset et cette recherche. Les clips terminés resteront ici après la fermeture de l’atelier.</p>}
    <div className="mt-[14px] grid grid-cols-2 gap-[14px]">{sources.map((g) => <article key={g.identifiant} className="overflow-hidden rounded-8 border border-trait bg-carte"><video controls preload="metadata" src={api.videoDuClip(g.identifiant)} aria-label={`Clip de ${personnage.nom} · ${g.identifiant}`} className="h-[128px] w-full bg-pourtour object-contain" /><div className="p-[14px]"><p className="line-clamp-2 text-[13px] text-encre">{g.demande.prompt}</p><p className="mesure mt-[8px] text-[11px] text-encre-3">{g.modele}</p><p className="mt-[8px] text-[12px] text-encre-3">{g.clip!.secondes} s demandées · {g.clip!.images} images mesurées à {g.clip!.cadence} i/s</p><p className="mt-[4px] text-[12px] text-encre-3">{personnage.plan.find((p) => p.identifiant === g.pose)?.nom ?? "Mouvement à préciser"}{g.direction ? ` · ${g.direction}` : ""}</p>{g.clip!.extraction_refus && <p className="mt-[8px] text-[12px] text-echec">{g.clip!.extraction_refus}</p>}<div className="mt-[14px] flex flex-wrap gap-[8px]"><button className={BOUTON} disabled={g.statut !== "reussie" || !g.clip!.images} onClick={() => onMontage(g.identifiant)}>Monter une animation</button><details><summary className="cursor-pointer py-[8px] text-[12px] text-encre-3">Demande et paramètres conservés</summary><dl className="mt-[8px] text-[12px] text-encre-3"><dt>Format</dt><dd>{g.clip!.resolution} · {g.clip!.proportions}</dd><dt className="mt-[8px]">Texte envoyé</dt><dd className="whitespace-pre-wrap">{g.demande.prompt}</dd><dt className="mt-[8px]">Paramètres</dt><dd className="mesure whitespace-pre-wrap">{JSON.stringify(g.parametres_resolus, null, 2)}</dd></dl></details></div></div></article>)}</div>
    <Sources3D personnage={personnage} onBande={onBande} />
  </section>
}
