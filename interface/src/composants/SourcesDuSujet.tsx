// « Ses sources » — ce dont on tire des animations : les clips vidéo et les
// modèles 3D. C'était l'onglet « Galerie » de la fiche d'un sujet ; depuis
// `RV12` (la fiche à quatre onglets), ce n'est plus un onglet mais une section
// repliable de l'onglet *Animations* — les images et les animations qu'elle
// montrait aussi faisaient double emploi avec les onglets *Images* et
// *Animations* eux-mêmes, qui les montrent déjà rangées par pose.
//
// **Chaque vignette dit à quoi elle sert** : le mouvement qu'elle a nourri, ou
// « pas utilisée ». Les filtres du haut valent pour les clips.
//
// Rien n'est enregistré ici. Les clips viennent de la liste que la page tient
// déjà ; les sources 3D vivent à part (`Sources3D.tsx`).

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { api, type Bande, type Generation, type Personnage, type Pose } from "../api"
import { sujetVideo, useVisee } from "./Apercu"
import { Sources3D } from "./Sources3D"
import { nomDuModele } from "./Fiche"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const PETIT = "h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle hover:border-encre-3 disabled:opacity-50"
const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })
/** Une date manquante ne casse pas la galerie : elle se dit. */
const dire = (format: Intl.DateTimeFormat, secondes: number | undefined) =>
  Number.isFinite(secondes) && secondes ? format.format(new Date(secondes * 1000)) : "date inconnue"

export type OngletDeGalerie = "clips" | "3d"
type Usage = "tout" | "utilises" | "libres"
type Ordre = "recent" | "ancien"

/** Une vignette de la galerie, quel que soit son type. */
type Element<T> = {
  cle: string
  date: number
  objet: T
  /** À quoi elle est rattachée, en clair. Vide : elle ne sert à rien encore. */
  liens: string[]
  /** Une remarque qui n'est pas un usage (écartée, commandée pour…). */
  note?: string
  /** Les mouvements qu'elle touche, pour le filtre. */
  poses: string[]
  texte: string
}

/** Une vidéo importée n'a rien coûté, et sa carte le dit. */
const importe = (g: Generation) => g.clip?.nature === "importe"

export function SourcesDuSujet({ personnage, clips, ongletInitial = "clips", onMontage, onAnimer, onBande, onClipsChange, onErreur }: {
  personnage: Personnage
  clips: readonly Generation[]
  ongletInitial?: OngletDeGalerie
  onMontage: (clip: string) => void
  onBande?: (id: string) => void
  onAnimer: (pose: Pose, direction: { identifiant: string; nom: string } | null) => void
  /** Une vidéo vient d'entrer ou de partir : la liste des clips est à relire. */
  onClipsChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const [onglet, setOnglet] = useState<OngletDeGalerie>(ongletInitial)
  const [usage, setUsage] = useState<Usage>("tout")
  const [mouvement, setMouvement] = useState("")
  const [ordre, setOrdre] = useState<Ordre>("recent")
  const [recherche, setRecherche] = useState("")
  const [attente, setAttente] = useState<{ animations: Bande[] }>({ animations: [] })

  // Une animation qui n'occupe aucune case n'est pas dans `personnage.cases` :
  // sans elle, un clip déjà taillé mais pas encore rangé se dirait « pas
  // utilisé » à tort.
  useEffect(() => {
    let vivant = true
    api.enAttenteDuSujet(personnage.identifiant, personnage.projet)
      .then((recu) => { if (vivant) setAttente({ animations: recu.animations ?? [] }) })
      .catch(() => { if (vivant) setAttente({ animations: [] }) })
    return () => { vivant = false }
  }, [personnage.identifiant, personnage.projet, personnage.cases])

  const poses = personnage.plan.filter((p) => !personnage.ecartees.includes(p.identifiant))
  const nomPose = (id: string | null) => personnage.plan.find((p) => p.identifiant === id)?.nom ?? id ?? ""
  const nomDirection = (pose: string | null, id: string | null) => {
    if (!id) return ""
    const d = personnage.cases.find((c) => c.pose === pose)?.directions?.find((x) => x.identifiant === id)
    return d?.nom ?? id
  }
  const ouEst = (pose: string | null, direction: string | null) => [nomPose(pose), nomDirection(pose, direction)].filter(Boolean).join(" · ")

  /** Toutes les animations du sujet, écartées comprises — pour dire d'un clip
   *  qu'une bande en est déjà taillée. */
  const bandes = useMemo(() => {
    const toutes = new Map<string, { bande: Bande; ecartee: boolean }>()
    for (const c of personnage.cases) {
      for (const b of [...(c.bandes ?? []), ...(c.directions ?? []).flatMap((d) => d.bandes ?? [])]) toutes.set(b.identifiant, { bande: b, ecartee: false })
      for (const b of [...(c.bandes_ecartees ?? []), ...(c.directions ?? []).flatMap((d) => d.bandes_ecartees ?? [])]) toutes.set(b.identifiant, { bande: b, ecartee: true })
    }
    for (const b of attente.animations) if (!toutes.has(b.identifiant)) toutes.set(b.identifiant, { bande: b, ecartee: false })
    return [...toutes.values()]
  }, [personnage.cases, attente.animations])

  const videos = useMemo<Element<Generation>[]>(() => clips
    .filter((g) => g.personnage === personnage.identifiant && g.clip && (!g.clip.nature || g.clip.nature === "video" || g.clip.nature === "importe") && !g.clip.jete)
    .map((g) => {
      const tirees = bandes.filter(({ bande }) => bande.clip === g.identifiant || bande.clips?.includes(g.identifiant))
      return {
        cle: g.identifiant,
        date: g.cree_le,
        objet: g,
        liens: tirees.map(({ bande, ecartee }) => `Animation « ${bande.nom} »${bande.pose ? ` · ${nomPose(bande.pose)}` : ""}${ecartee ? " · écartée" : ""}`),
        note: g.pose ? `Commandé pour ${ouEst(g.pose, g.direction ?? null)}` : undefined,
        poses: [...new Set([g.pose, ...tirees.map(({ bande }) => bande.pose)].filter((p): p is string => !!p))],
        texte: `${g.demande.prompt || g.demande.nom || ""} ${g.modele}`,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  , [clips, personnage.identifiant, bandes])

  const filtrer = <T,>(liste: Element<T>[]) => {
    const cherche = recherche.trim().toLocaleLowerCase("fr")
    return liste
      .filter((e) => usage === "tout" || (usage === "utilises") === e.liens.length > 0)
      .filter((e) => !mouvement || e.poses.includes(mouvement))
      .filter((e) => !cherche || e.texte.toLocaleLowerCase("fr").includes(cherche))
      .sort((a, b) => ordre === "recent" ? (b.date || 0) - (a.date || 0) : (a.date || 0) - (b.date || 0))
  }
  const vus = { clips: filtrer(videos) }

  const ONGLETS: { clef: OngletDeGalerie; nom: string; compte?: number }[] = [
    { clef: "clips", nom: "Clips vidéo", compte: vus.clips.length },
    { clef: "3d", nom: "Sources 3D" },
  ]
  const filtrable = onglet === "clips"

  return <section aria-label="Ses sources — clips et modèles 3D" className="flex flex-col gap-[14px]">
    <nav aria-label="Type de source" className="flex flex-wrap gap-[4px]">
      {ONGLETS.map(({ clef, nom, compte }) => <button key={clef} type="button" aria-pressed={onglet === clef} onClick={() => setOnglet(clef)}
        className={`h-[30px] rounded-7 border px-[14px] text-[12px] ${onglet === clef ? "border-signal bg-ligne-ouverte text-signal" : "border-trait bg-carte text-encre-2 hover:bg-papier-cote"}`}>
        {nom}{compte !== undefined && <span className="mesure ml-[8px] text-encre-4">{compte}</span>}
      </button>)}
    </nav>

    {filtrable && <div role="group" aria-label="Filtres de la galerie" className="flex flex-wrap items-end gap-[14px] rounded-8 border border-trait bg-carte p-[14px]">
      <div className="flex flex-col gap-[4px] text-[12px] text-encre-3">Utilisation
        <div className="flex gap-[4px]">{([["tout", "Tout"], ["utilises", "Utilisés"], ["libres", "Pas utilisés"]] as const).map(([valeur, nom]) =>
          <button key={valeur} type="button" aria-pressed={usage === valeur} onClick={() => setUsage(valeur)} className={`${PETIT} ${usage === valeur ? "border-signal text-signal" : ""}`}>{nom}</button>)}</div>
      </div>
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Mouvement
        <select aria-label="Filtrer par mouvement" className={PETIT} value={mouvement} onChange={(e) => setMouvement(e.target.value)}>
          <option value="">Tous</option>
          {poses.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Date de création
        <select aria-label="Ordre des dates" className={PETIT} value={ordre} onChange={(e) => setOrdre(e.target.value as Ordre)}>
          <option value="recent">Plus récents d’abord</option>
          <option value="ancien">Plus anciens d’abord</option>
        </select>
      </label>
      <label className="flex min-w-[128px] flex-1 flex-col gap-[4px] text-[12px] text-encre-3">Rechercher
        <input type="search" aria-label="Rechercher dans la galerie" className={PETIT} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, prompt, modèle…" />
      </label>
    </div>}

    {onglet === "clips" && <>
      <PreparerUnClip personnage={personnage} poses={poses} onAnimer={onAnimer} onClipsChange={onClipsChange} onErreur={onErreur} />
      <ParJour elements={vus.clips} vide="Aucun clip pour ces filtres. Les clips terminés restent ici après la fermeture de l’atelier." rendu={(e) => <CarteClip key={e.cle} element={e} personnage={personnage} onMontage={onMontage} onClipsChange={onClipsChange} onErreur={onErreur} />} />
    </>}
    {onglet === "3d" && <Sources3D personnage={personnage} onBande={onBande} />}
  </section>
}

/** Les vignettes, groupées par jour de création, dans l'ordre déjà trié. */
function ParJour<T>({ elements, vide, rendu }: { elements: Element<T>[]; vide: string; rendu: (e: Element<T>) => ReactNode }) {
  if (!elements.length) return <p className="rounded-8 border border-dashed border-contour p-[22px] text-[13px] text-encre-3">{vide}</p>
  const jours: { jour: string; liste: Element<T>[] }[] = []
  for (const e of elements) {
    const jour = dire(JOUR, e.date)
    const dernier = jours[jours.length - 1]
    if (dernier?.jour === jour) dernier.liste.push(e)
    else jours.push({ jour, liste: [e] })
  }
  return <>{jours.map(({ jour, liste }) => <section key={jour} aria-label={jour}>
    <h3 className="text-[13px] text-encre-3 first-letter:uppercase">{jour} · {liste.length}</h3>
    <div className="mt-[8px] grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[14px]">{liste.map(rendu)}</div>
  </section>)}</>
}

/** Le bas commun des cartes : ce à quoi la chose sert, ou qu'elle ne sert pas. */
function Rattachement({ liens, note }: { liens: string[]; note?: string }) {
  return <div className="flex flex-col gap-[4px]">
    {liens.length
      ? liens.map((l) => <p key={l} className="rounded-7 bg-ligne-ouverte px-[8px] py-[4px] text-[12px] text-signal">{l}</p>)
      : <p className="text-[12px] text-encre-4">Pas utilisé</p>}
    {note && <p className="text-[11px] text-encre-3">{note}</p>}
  </div>
}

function CarteClip({ element, personnage, onMontage, onClipsChange, onErreur }: {
  element: Element<Generation>
  personnage: Personnage
  onMontage: (clip: string) => void
  onClipsChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const g = element.objet
  const [confirme, setConfirme] = useState(false)
  const [avis, setAvis] = useState<{ ton: "fait" | "refus"; texte: string } | null>(null)
  const utilise = element.liens.length > 0
  const pret = g.statut === "reussie" && !!g.clip!.images
  const visee = useVisee(g.statut === "reussie" ? sujetVideo(g.identifiant, `Clip de ${personnage.nom}`) : null)

  /** Supprimer pour de bon : la vidéo quitte le disque, la dépense reste au
   *  journal. Deux clics, parce que rien ne se défait ensuite. */
  async function supprimer() {
    setConfirme(false)
    try {
      await api.effacerClip(g.identifiant)
      onClipsChange?.()
    } catch (erreur) {
      setAvis({ ton: "refus", texte: erreur instanceof Error ? erreur.message : "Suppression impossible." })
      onErreur?.(erreur, "ce clip n’a pas pu être supprimé")
    }
  }

  async function poserSurLaToile() {
    setAvis(null)
    try {
      await api.poserClipSurToile(personnage.projet, g.identifiant)
      setAvis({ ton: "fait", texte: "Le clip est posé sur la toile du jeu." })
    } catch (erreur) {
      setAvis({ ton: "refus", texte: erreur instanceof Error ? erreur.message : "Impossible de poser ce clip." })
      onErreur?.(erreur, "ce clip n’a pas pu être posé sur la toile")
    }
  }

  return <article data-clip-source={g.identifiant} className="flex flex-col overflow-hidden rounded-8 border border-trait bg-carte">
    <video controls loop muted preload="metadata" onPointerEnter={visee.entrer} onPointerLeave={visee.sortir} src={api.videoDuClip(g.identifiant)} aria-label={`Clip de ${personnage.nom} · ${g.identifiant}`} className="aspect-square w-full bg-pourtour object-contain" />
    <div className="flex flex-1 flex-col gap-[6px] p-[8px]">
      <p className="mesure text-[11px] text-encre-4">{dire(HEURE, g.cree_le)} · {g.clip!.images} images · {g.clip!.cadence} i/s</p>
      <p className="mesure truncate text-[11px] text-encre-4">{importe(g) ? "vidéo importée · aucune génération" : nomDuModele(g.modele)}</p>
      <Rattachement liens={element.liens} note={element.note} />
      {g.clip!.extraction_refus && <p className="text-[12px] text-echec">{g.clip!.extraction_refus}</p>}
      {avis && <p role={avis.ton === "refus" ? "alert" : "status"} className={`text-[12px] ${avis.ton === "refus" ? "text-echec" : "text-signal"}`}>{avis.texte}</p>}
      <div className="mt-auto flex flex-wrap gap-[4px] pt-[4px]">
        <button className={PETIT} disabled={!pret} onClick={() => onMontage(g.identifiant)}>Monter une animation</button>
        <button className={PETIT} disabled={!pret} onClick={() => void poserSurLaToile()}>Poser sur la toile</button>
        {utilise
          ? <button className={PETIT} disabled title="Une animation est taillée dans ce clip : supprime-la d’abord.">Supprimer</button>
          : confirme
            ? <button className={`${PETIT} border-trait-echec text-echec`} onClick={() => void supprimer()}>Confirmer la suppression</button>
            : <button className={PETIT} disabled={g.statut === "en_attente" || g.statut === "en_cours"} onClick={() => setConfirme(true)}>Supprimer</button>}
      </div>
      {!importe(g) && <details><summary className="cursor-pointer py-[4px] text-[12px] text-encre-3">Demande et paramètres conservés</summary><dl className="text-[12px] text-encre-3"><dt>Format</dt><dd>{g.clip!.resolution} · {g.clip!.proportions}</dd><dt className="mt-[8px]">Texte envoyé</dt><dd className="whitespace-pre-wrap">{g.demande.prompt}</dd><dt className="mt-[8px]">Paramètres</dt><dd className="mesure whitespace-pre-wrap break-all">{JSON.stringify(g.parametres_resolus, null, 2)}</dd></dl></details>}
    </div>
  </article>
}

/** Commander ou importer un clip. La vidéo importée entre là où les sélecteurs
 *  pointent — la même destination que « Préparer un clip vidéo ». */
function PreparerUnClip({ personnage, poses, onAnimer, onClipsChange, onErreur }: {
  personnage: Personnage
  poses: Pose[]
  onAnimer: (pose: Pose, direction: { identifiant: string; nom: string } | null) => void
  onClipsChange?: () => void
  onErreur?: (erreur: unknown, defaut: string) => void
}) {
  const [poseId, setPoseId] = useState("")
  const [directionId, setDirectionId] = useState("")
  const [importEnCours, setImportEnCours] = useState(false)
  const [avis, setAvis] = useState<{ ton: "fait" | "refus"; texte: string } | null>(null)
  const pose = poses.find((p) => p.identifiant === poseId) ?? poses[0]
  const directions = personnage.cases.find((c) => c.pose === pose?.identifiant)?.directions ?? []
  const direction = directions.find((d) => d.identifiant === directionId) ?? directions[0] ?? null

  async function importer(fichier: File | undefined) {
    if (!fichier || importEnCours) return
    setImportEnCours(true)
    setAvis(null)
    try {
      const recu = await api.importerClip(fichier, { nom: fichier.name, personnage: personnage.identifiant, pose: pose?.identifiant ?? null, direction: direction?.identifiant ?? null })
      if (recu.doublon) setAvis({ ton: "fait", texte: `« ${fichier.name} » était déjà là : son clip est conservé tel quel.` })
      else if (recu.clip) setAvis({ ton: "fait", texte: `« ${fichier.name} » est entrée · ${recu.clip.clip!.images} images tirées à ${recu.clip.clip!.cadence} i/s.` })
      onClipsChange?.()
    } catch (erreur) {
      setAvis({ ton: "refus", texte: erreur instanceof Error ? erreur.message : "Import impossible." })
      onErreur?.(erreur, "cette vidéo n’a pas pu entrer")
    } finally {
      setImportEnCours(false)
    }
  }

  return <div className="rounded-8 border border-trait bg-carte p-[14px]">
    <p className="text-[13px] text-encre">Nouveau clip : commander ou importer une vidéo</p>
    <div className="mt-[8px] flex flex-wrap items-end gap-[14px]">
      <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Mouvement<select className={BOUTON} value={pose?.identifiant ?? ""} onChange={(e) => { setPoseId(e.target.value); setDirectionId("") }}><option disabled value="">Aucun mouvement défini</option>{poses.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>
      {directions.length > 0 && <label className="flex flex-col gap-[4px] text-[12px] text-encre-3">Direction<select className={BOUTON} value={direction?.identifiant ?? ""} onChange={(e) => setDirectionId(e.target.value)}>{directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}
      <button disabled={!pose} onClick={() => pose && onAnimer(pose, direction)} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">Préparer un clip vidéo</button>
      <label className={`${BOUTON} inline-flex cursor-pointer items-center`}>{importEnCours ? "Import en cours…" : "Importer une vidéo"}<input type="file" accept="video/*,.mp4,.webm,.mov,.mkv,.avi" className="sr-only" aria-label="Vidéo à importer" disabled={importEnCours} onChange={(e) => { void importer(e.target.files?.[0]); e.target.value = "" }} /></label>
    </div>
    <p className="mt-[8px] text-[12px] text-encre-3">Une vidéo importée devient un clip comme un autre, sans rien dépenser.</p>
    {avis && <p role={avis.ton === "refus" ? "alert" : "status"} className={`mt-[8px] text-[12px] ${avis.ton === "refus" ? "text-echec" : "text-signal"}`}>{avis.texte}</p>}
  </div>
}
