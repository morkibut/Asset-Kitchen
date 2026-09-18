import { useMemo, useState } from "react"
import { api, type Generation, type Personnage, type Pose } from "../api"
import { Sources3D } from "./Sources3D"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"

/** Ce qu'un clip de cette liste a coûté, en une phrase.
 *
 * **Une vidéo importée n'a appelé personne**, et l'écran doit le dire : sans
 * cette ligne, elle s'afficherait comme un clip payé dont on aurait perdu le
 * montant. La phrase vient du serveur (`Clip.montant_dit`) pour qu'il n'y ait
 * qu'une rédaction. */
const importe = (g: Generation) => g.clip?.nature === "importe"

/** Les sources du sujet sont les clips du dépôt, pas des séquences recomposées.
 * Le montage garde leur identifiant et se rouvre sur le même fichier payé.
 *
 * **Une vidéo importée est un clip de cette liste**, et pas une catégorie à
 * côté : elle se rejoue, on y taille des bandes et on en prélève des images par
 * les mêmes gestes. Ce qui la distingue tient à ce qu'elle a coûté — rien — et
 * l'écran l'écrit sur sa carte plutôt que dans une seconde grille. */
export function SourcesDuSujet({ personnage, clips, onMontage, onAnimer, onBande, onClipsChange, onErreur }: {
  personnage: Personnage
  clips: readonly Generation[]
  onMontage: (clip: string) => void
  onBande?: (id: string) => void
  onAnimer: (pose: Pose, direction: { identifiant: string; nom: string } | null) => void
  /** Une vidéo vient d'entrer : la liste des clips est à relire. */
  onClipsChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const [poseId, setPoseId] = useState("")
  const [directionId, setDirectionId] = useState("")
  const [recherche, setRecherche] = useState("")
  const [importEnCours, setImportEnCours] = useState(false)
  /** Ce que le dernier import a donné, en une phrase à l'écran. Il ne remplace
   *  pas la liste : le clip importé y est déjà, et cette ligne dit seulement ce
   *  qui vient de se passer — entré, déjà là, ou refusé. */
  const [avis, setAvis] = useState<{ ton: "fait" | "refus"; texte: string } | null>(null)
  /** Le clip dont la suppression attend un second clic. */
  const [confirme, setConfirme] = useState<string | null>(null)
  /** Les clips dont une animation est taillée — y compris une animation écartée. */
  const utilises = useMemo(() => new Set(personnage.cases.flatMap((c) => [...(c.bandes ?? []), ...(c.bandes_ecartees ?? []), ...(c.directions ?? []).flatMap((d) => [...(d.bandes ?? []), ...(d.bandes_ecartees ?? [])])]).map((b) => b.clip)), [personnage.cases])
  const poses = personnage.plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const pose = poses.find((p) => p.identifiant === poseId) ?? poses[0]
  const directions = personnage.cases.find((c) => c.pose === pose?.identifiant)?.directions ?? []
  const direction = directions.find((d) => d.identifiant === directionId) ?? directions[0] ?? null
  const sources = useMemo(() => clips.filter((g) => g.personnage === personnage.identifiant && g.clip && (!g.clip.nature || g.clip.nature === "video" || g.clip.nature === "importe") && !g.clip.jete && `${g.demande.prompt} ${g.modele}`.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr"))), [clips, personnage.identifiant, recherche])

  /** La vidéo entre **là où les sélecteurs d'à côté pointent** — même
   *  destination que « Préparer un clip vidéo », posée juste au-dessus. Deux
   *  gestes voisins qui rangeraient à deux endroits différents seraient un
   *  piège, et c'est le mouvement choisi qui fait foi pour les deux. */
  async function importer(fichier: File | undefined) {
    if (!fichier || importEnCours) return
    setImportEnCours(true)
    setAvis(null)
    try {
      const recu = await api.importerClip(fichier, {
        nom: fichier.name,
        personnage: personnage.identifiant,
        pose: pose?.identifiant ?? null,
        direction: direction?.identifiant ?? null,
      })
      if (recu.doublon) setAvis({ ton: "fait", texte: `« ${fichier.name} » était déjà là : son clip est conservé tel quel.` })
      else if (recu.clip) setAvis({ ton: "fait", texte: `« ${fichier.name} » est entrée · ${recu.clip.clip!.images} images tirées à ${recu.clip.clip!.cadence} i/s.` })
      onClipsChange?.()
    } catch (erreur) {
      const texte = erreur instanceof Error ? erreur.message : "Import impossible."
      setAvis({ ton: "refus", texte })
      onErreur?.(erreur, "cette vidéo n’a pas pu entrer")
    } finally {
      setImportEnCours(false)
    }
  }

  /** **Supprimer pour de bon** : la vidéo quitte le disque, la dépense reste
   *  au journal. Deux clics, parce que rien ne se défait ensuite. */
  async function supprimer(clip: string) {
    setConfirme(null)
    setAvis(null)
    try {
      await api.effacerClip(clip)
      setAvis({ ton: "fait", texte: "Le clip est supprimé. Sa dépense reste au journal." })
      onClipsChange?.()
    } catch (erreur) {
      setAvis({ ton: "refus", texte: erreur instanceof Error ? erreur.message : "Suppression impossible." })
      onErreur?.(erreur, "ce clip n’a pas pu être supprimé")
    }
  }

  /** Le clip paraît sur la toile du jeu, où il se rejoue. Rien n'est recopié :
   *  la carte pointe vers le fichier du clip. */
  async function poserSurLaToile(clip: string) {
    setAvis(null)
    try {
      await api.poserClipSurToile(personnage.projet, clip)
      setAvis({ ton: "fait", texte: "Le clip est posé sur la toile du jeu." })
    } catch (erreur) {
      setAvis({ ton: "refus", texte: erreur instanceof Error ? erreur.message : "Impossible de poser ce clip." })
      onErreur?.(erreur, "ce clip n’a pas pu être posé sur la toile")
    }
  }

  return <section aria-label="Sources et clips du sujet">
    <div className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px] text-encre">De l’image au clip, puis aux frames</h2><p className="mt-[8px] text-[13px] text-encre-3">Choisissez le mouvement et la direction. L’étape suivante prépare l’image de départ, le prompt, le modèle et les paramètres avant l’envoi.</p><div className="mt-[14px] flex flex-wrap items-end gap-[14px]"><label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Mouvement<select className={BOUTON} value={pose?.identifiant ?? ""} onChange={(e) => { setPoseId(e.target.value); setDirectionId("") }}><option disabled value="">Aucun mouvement défini</option>{poses.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>{directions.length > 0 && <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Direction<select className={BOUTON} value={direction?.identifiant ?? ""} onChange={(e) => setDirectionId(e.target.value)}>{directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}<button disabled={!pose} onClick={() => pose && onAnimer(pose, direction)} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">Préparer un clip vidéo</button><label className={`${BOUTON} inline-flex cursor-pointer items-center`}>{importEnCours ? "Import en cours…" : "Importer une vidéo"}<input type="file" accept="video/*,.mp4,.webm,.mov,.mkv,.avi" className="sr-only" aria-label="Vidéo à importer" disabled={importEnCours} onChange={(e) => { void importer(e.target.files?.[0]); e.target.value = "" }} /></label></div><p className="mt-[8px] text-[12px] text-encre-3">Une vidéo importée devient un clip comme un autre : ses images sont tirées à l’entrée, et rien n’est dépensé.</p>{avis && <p role={avis.ton === "refus" ? "alert" : "status"} className={`mt-[8px] text-[12px] ${avis.ton === "refus" ? "text-echec" : "text-signal"}`}>{avis.texte}</p>}</div>
    <div className="mt-[22px] flex items-end justify-between gap-[14px]"><h2 className="font-serif text-[25px] text-encre">Clips conservés</h2><label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Rechercher un clip<input className={BOUTON} type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} /></label></div>
    {!sources.length && <p className="mt-[14px] rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">Aucun clip pour ce sujet et cette recherche. Les clips terminés resteront ici après la fermeture de l’atelier.</p>}
    {[{ titre: "Pas encore utilisés", liste: sources.filter((g) => !utilises.has(g.identifiant)) }, { titre: "Utilisés pour des animations", liste: sources.filter((g) => utilises.has(g.identifiant)) }].filter(({ liste }) => liste.length > 0).map(({ titre, liste }) => <section key={titre} aria-label={titre} className="mt-[22px]">
      <h3 className="text-[13px] text-encre-3">{titre} · {liste.length}</h3>
      <div className="mt-[8px] grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[14px]">{liste.map((g) => <article key={g.identifiant} data-clip-source={g.identifiant} className="flex flex-col overflow-hidden rounded-8 border border-trait bg-carte">
        <video controls loop muted preload="metadata" src={api.videoDuClip(g.identifiant)} aria-label={`Clip de ${personnage.nom} · ${g.identifiant}`} className="aspect-square w-full bg-pourtour object-contain" />
        <div className="flex flex-1 flex-col gap-[4px] p-[14px]">
          <p className="text-[13px] text-encre">{personnage.plan.find((p) => p.identifiant === g.pose)?.nom ?? "Mouvement à préciser"}{g.direction ? ` · ${g.direction}` : ""}</p>
          <p className="text-[12px] text-encre-3">{g.clip!.images} images · {g.clip!.cadence} i/s</p><p className="mesure truncate text-[11px] text-encre-4">{importe(g) ? "vidéo importée · aucune génération" : g.modele}</p>
          {g.clip!.extraction_refus && <p className="text-[12px] text-echec">{g.clip!.extraction_refus}</p>}
          <div className="mt-auto flex flex-wrap gap-[8px] pt-[8px]">
            <button className={BOUTON} disabled={g.statut !== "reussie" || !g.clip!.images} onClick={() => onMontage(g.identifiant)}>Monter une animation</button>
            <button className={BOUTON} disabled={g.statut !== "reussie" || !g.clip!.images} onClick={() => void poserSurLaToile(g.identifiant)}>Poser sur la toile</button>
            {utilises.has(g.identifiant)
              ? <button className={BOUTON} disabled title="Une animation est taillée dans ce clip : supprimez-la d’abord.">Supprimer</button>
              : confirme === g.identifiant
                ? <button className={`${BOUTON} border-trait-echec text-echec`} onClick={() => void supprimer(g.identifiant)}>Confirmer la suppression</button>
                : <button className={BOUTON} disabled={g.statut === "en_attente" || g.statut === "en_cours"} onClick={() => setConfirme(g.identifiant)}>Supprimer</button>}
          </div>
          {!importe(g) && <details><summary className="cursor-pointer py-[8px] text-[12px] text-encre-3">Demande et paramètres conservés</summary><dl className="text-[12px] text-encre-3"><dt>Format</dt><dd>{g.clip!.resolution} · {g.clip!.proportions}</dd><dt className="mt-[8px]">Texte envoyé</dt><dd className="whitespace-pre-wrap">{g.demande.prompt}</dd><dt className="mt-[8px]">Paramètres</dt><dd className="mesure whitespace-pre-wrap break-all">{JSON.stringify(g.parametres_resolus, null, 2)}</dd></dl></details>}
        </div>
      </article>)}</div>
    </section>)}
    <Sources3D personnage={personnage} onBande={onBande} />
  </section>
}
