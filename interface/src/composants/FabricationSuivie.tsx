import { SuiviFabrication3D } from "./Fabrication3D"
import { useEffect, useRef, useState } from "react"
import { api, dollars, prix, Refus, type Asset, type EtatDuMoteur, type Modele, type ModeleVideo, type Mouvement, type MouvementDeLaPose, type Personnage } from "../api"
import { nomDuTravail, travaux, NOM_DE_L_ETAPE, NOM_DE_L_ETAT, type CaseSerie, type DemandeTravail, type Serie, type Travail, type TravailSuivi } from "../api-travaux"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { vignetteAsset } from "./Apercu"
import { CadreDialogue } from "./CadreDialogue"
import { duree } from "./Clip"
import { MemoireLocale } from "./MemoireLocale"
import { libelleModele } from "./pieces"
import { RelectureEquipement } from "./RelectureEquipement"
import { FabricationVideoLibre } from "./FabricationVideoLibre"
import { FabricationAudio } from "./FabricationAudio"
import { FabricationImageLocale } from "./WorkflowsLocaux"
import type { CibleCalque } from "../api-calques"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"

// **RV5** : le nombre de clips que la fenêtre propose d'un coup — la même
// borne que l'ancien lot de `Clip.tsx` (`SERIE_MAX` côté serveur).
const NOMBRES_DE_CLIPS = [1, 2, 4, 8] as const

/** **Le bouton porte le prix, ou le temps — jamais les deux** (RV5). Un local
 *  ne se paie pas : ce qu'il coûte, c'est du temps. `total` ne paraît que pour
 *  plus d'un clip, pour ne jamais laisser croire qu'on paie pour un seul. */
function libelleLancement(locale: boolean, secondes: number | null, reservationUsd: number, total: number): string {
  if (locale) return `Lancer · ≈ ${duree(secondes ?? 0)}`
  return total > 1 ? `Lancer ${total} clips · ${dollars(reservationUsd)}` : `Lancer · ${dollars(reservationUsd)}`
}

const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const BOUTON = `${CHAMP} hover:border-encre-3`
// Les deux états du même bouton (relecture / lancement) sont exclusifs.
const PRINCIPAL = "h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50"
// Les deux tables vivent dans `api-travaux.ts` depuis `RP16` : le tiroir des
// brouillons les écrit aussi, et deux copies auraient divergé au premier mot.
const ETATS = NOM_DE_L_ETAT
const ETAPES = NOM_DE_L_ETAPE
const message = (e: unknown) => e instanceof Refus ? e.message : "Impossible de relire cette fabrication. Réessayez."
// Le prix s'écrivait ici pour la troisième fois du produit ; il s'écrit
// désormais une seule fois, dans `api.ts` (RP4).
const nouvelle = (personnage = ""): DemandeTravail => ({ cle: crypto.randomUUID(), personnage, pose: "", direction: "", modele_video: "", prompt_video: "", secondes: 5, resolution: "480p", proportions: "1:1", nombre_images: 8, cadence: 8, sens: "boucle" })

/** Une demande relue est immuable. Revenir en édition crée une nouvelle clé,
 * tandis que la reprise conserve l'identifiant payé et ses références figées. */
export function FabricationSuivie({ projet, personnages, onClip, onBande, onLivraisons, onFermer, initiale, modeleInitial, cibleInitiale, autonome = true }: {
  projet: string; personnages: readonly Personnage[]; initiale?: Travail; modeleInitial?: string
  cibleInitiale?: { personnage: string; pose: string; direction: string }
  onClip: (id: string) => void; onBande?: (id: string) => void
  /** L'écran de la sortie, pour livrer la bande obtenue sans repasser par le carnet. */
  onLivraisons?: () => void
  onFermer: () => void
  /** **Sa propre fenêtre, ou le corps d'une autre** (RP4). Dans la fenêtre
   *  unique de préparation, le cadre, le titre et le bouton *Fermer*
   *  appartiennent à celle-ci : ce corps n'en pose pas un second. */
  autonome?: boolean
}) {
  const [depart] = useState<DemandeTravail>(() => {
    if (initiale) return initiale.demande
    const sujet = personnages.find(p => p.identifiant === cibleInitiale?.personnage) ?? personnages[0]
    const sortie = sujet?.objectif?.sorties.find(s => s.nature === "animation" && s.quantite > 0)
    const pose = cibleInitiale?.pose ?? sortie?.pose ?? ""
    const sortieDePose = sujet?.objectif?.sorties.find(s => s.nature === "animation" && s.pose === pose && s.quantite > 0)
    return { ...nouvelle(sujet?.identifiant),
      pose,
      direction: cibleInitiale?.direction || sortieDePose?.direction || sujet?.cases.find(c => c.pose === pose)?.directions[0]?.identifiant || "",
      cadence: sujet?.objectif?.cadence ?? 8,
      modele_video: modeleInitial ?? "" }
  })
  const [demande, setDemande] = useState<DemandeTravail>(depart)
  const [travail, setTravail] = useState<Travail | null>(initiale ?? null)
  const [edition, setEdition] = useState(!initiale)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [modeles, setModeles] = useState<Modele[]>([])
  const [videos, setVideos] = useState<ModeleVideo[]>([])
  const [images, setImages] = useState<Asset[]>([])
  const [recherche, setRecherche] = useState("")
  const [favoris, setFavoris] = useState(false)
  const [choix, setChoix] = useState<"depart" | "reference" | null>(null)
  const [totalImages, setTotalImages] = useState(0)
  const defilement = useRef<HTMLDivElement>(null)
  const [plafondImages, setPlafondImages] = useState(48)
  const [optionsVideo, setOptionsVideo] = useState(JSON.stringify(demande.options_video ?? {}, null, 2))
  const [optionsImage, setOptionsImage] = useState(JSON.stringify(demande.options_image ?? {}, null, 2))
  const [videosLues, setVideosLues] = useState(false)
  const [moteur, setMoteur] = useState<EtatDuMoteur | null>(null)
  // **RV5** : la bibliothèque des mouvements, ce que la case choisie
  // composerait par défaut, les directions cochées en plus de celle du champ
  // « Direction », le nombre de clips par case, et la série obtenue à la
  // relecture (`null` pour un travail seul, inchangé).
  const [mouvements, setMouvements] = useState<Mouvement[]>([])
  const [composition, setComposition] = useState<MouvementDeLaPose | null>(null)
  const [correctionOuverte, setCorrectionOuverte] = useState(false)
  const [autresDirections, setAutresDirections] = useState<string[]>([])
  const [nombre, setNombre] = useState<number>(1)
  const [serie, setSerie] = useState<Serie | null>(null)
  const personnage = personnages.find((p) => p.identifiant === demande.personnage)
  const brouillon = useBrouillonLocal({
    cle: `fabrication-video:${projet}:${initiale?.identifiant ?? (cibleInitiale ? `${cibleInitiale.personnage}:${cibleInitiale.pose}:${cibleInitiale.direction}` : "nouvelle")}:${modeleInitial ?? "auto"}`, pret: edition,
    reference: { demande: depart, optionsVideo: JSON.stringify(depart.options_video ?? {}, null, 2), optionsImage: JSON.stringify(depart.options_image ?? {}, null, 2) },
    etat: { demande, optionsVideo, optionsImage },
    ecran: "Une animation",
    quoi: [personnage?.nom ?? demande.personnage,
      personnage?.plan.find((p) => p.identifiant === demande.pose)?.nom ?? demande.pose,
      personnage?.cases.find((c) => c.pose === demande.pose)?.directions.find((d) => d.identifiant === demande.direction)?.nom ?? demande.direction].filter(Boolean).join(" · "),
    signature: ({ demande: { cle: _cle, ...champs }, ...options }) => JSON.stringify({ demande: champs, ...options }),
    appliquer: (recu) => { setDemande({ ...recu.demande, cle: crypto.randomUUID() }); setOptionsVideo(recu.optionsVideo); setOptionsImage(recu.optionsImage); setErreur("") },
  })
  const cases = personnage?.objectif?.sorties.filter((s) => s.nature === "animation" && s.quantite > 0)
  const poses = personnage?.plan.filter((p) => !personnage.ecartees.includes(p.identifiant) && (!cases || cases.some((s) => s.pose === p.identifiant))) ?? []
  const directions = personnage?.cases.find((c) => c.pose === demande.pose)?.directions.filter((d) => !cases || cases.some((s) => s.pose === demande.pose && s.direction === d.identifiant)) ?? []
  const video = videos.find((m) => m.identifiant === demande.modele_video)
  const image = modeles.find((m) => m.identifiant === demande.modele_image)
  const changer = (champs: Partial<DemandeTravail>) => { setDemande((d) => ({ ...d, ...champs })); setErreur("") }
  const choisirPose = (pose: string) => {
    const direction = personnage?.cases.find((c) => c.pose === pose)?.directions.find((d) => !cases || cases.some((s) => s.pose === pose && s.direction === d.identifiant))?.identifiant ?? ""
    // Une autre pose n'a pas forcément les mêmes directions ni le même
    // mouvement par défaut : la série et le geste repartent de zéro.
    setAutresDirections([])
    changer({ pose, direction, mouvement: undefined, correction_geste: "" })
  }
  // **Les directions d'une série** (RV5) : celle du champ « Direction », plus
  // celles cochées en plus. Sans case cochée en plus, c'est le `preparer`
  // d'un clip seul, inchangé.
  const directionsChoisies = [demande.direction, ...autresDirections].filter((d, i, tous) => d && tous.indexOf(d) === i)
  const enSerie = directionsChoisies.length > 1 || nombre > 1
  const basculerDirection = (identifiant: string) => {
    setAutresDirections((liste) => liste.includes(identifiant) ? liste.filter((d) => d !== identifiant) : [...liste, identifiant])
  }
  const choisirMouvement = (mouvement: string) => {
    // **Un texte figé ne part jamais avec un mouvement choisi** (`_composer_texte`,
    // serveur) : le serveur refuse un `prompt_video` qui ne serait pas
    // exactement le composé. Le vider ici, c'est laisser le serveur composer.
    changer({ mouvement: mouvement || null, prompt_video: "", correction_geste: "" })
    setCorrectionOuverte(false)
  }
  useEffect(() => { if (defilement.current) defilement.current.scrollTop = 0 }, [edition])

  useEffect(() => {
    if (!edition) return
    let vivant = true
    api.modeles(demande.proportions, demande.references_image?.length ?? 0, personnage?.type, demande.personnage)
      .then((c) => { if (vivant) setModeles(c.modeles) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    return () => { vivant = false }
  }, [edition, demande.proportions, demande.personnage, demande.references_image?.length, personnage?.type])
  useEffect(() => {
    if (!edition) return
    let vivant = true
    api.modelesVideo(demande.secondes, demande.resolution, demande.proportions)
      .then((c) => { if (vivant) { setVideos(c.modeles); setVideosLues(true) } }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    return () => { vivant = false }
  }, [edition, demande.secondes, demande.resolution, demande.proportions])
  // **RV2 : la carte prévient avant de lancer**, seulement quand le modèle
  // choisi est local — un modèle payant n'a pas de carte à regarder.
  useEffect(() => {
    if (!edition || !video?.de_la_maison) { setMoteur(null); return }
    let vivant = true
    api.etatDuMoteur().then((e) => { if (vivant) setMoteur(e) }).catch(() => { if (vivant) setMoteur(null) })
    return () => { vivant = false }
  }, [edition, video?.de_la_maison])
  useEffect(() => {
    if (!choix) return
    let vivant = true
    api.assets({ recherche, favoris, limite: plafondImages }).then((r) => { if (vivant) { setImages(r.assets); setTotalImages(r.total) } }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    return () => { vivant = false }
  }, [choix, recherche, favoris, plafondImages])
  useEffect(() => {
    if (!travail || travail.etat !== "en_cours") return
    let vivant = true
    const intervalle = window.setInterval(() => { void travaux.lire(projet, travail.identifiant).then((t) => { if (vivant) setTravail(t) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) }) }, 2000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet, travail?.identifiant, travail?.etat])
  // **La série suit chacun de ses travaux**, même bascule à 2 s que pour un
  // travail seul, tant qu'il en reste un « en_cours ».
  const serieEnCours = !!serie?.travaux.some((t) => t.etat === "en_cours")
  useEffect(() => {
    if (!serie || !serieEnCours) return
    let vivant = true
    const cle = serie.serie.cle
    const intervalle = window.setInterval(() => {
      void Promise.all(serie.travaux.map((t) => travaux.lire(projet, t.identifiant)))
        .then((liste) => { if (vivant) setSerie((s) => s && s.serie.cle === cle ? { ...s, travaux: liste } : s) })
        .catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    }, 2000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet, serie, serieEnCours])
  // **La bibliothèque des mouvements** (RV5) : chargée une fois par ouverture
  // de la fenêtre, comme sur l'écran « Faire une vidéo ».
  useEffect(() => {
    if (!edition) return
    let vivant = true
    api.mouvements(projet).then((b) => { if (vivant) setMouvements(b.mouvements) }).catch(() => { if (vivant) setMouvements([]) })
    return () => { vivant = false }
  }, [edition, projet])
  // **Ce que la case composerait**, lue au serveur et jamais recomposée ici
  // (SC3) : le nom français du mouvement, son texte anglais, et son geste
  // seul pour la correction. Sans mouvement choisi par l'auteur, le mouvement
  // par défaut de la case s'installe une seule fois.
  useEffect(() => {
    if (!edition || !demande.pose) { setComposition(null); return }
    let vivant = true
    api.mouvementDeLaPose(demande.pose, projet, demande.direction || undefined, demande.personnage || undefined, demande.mouvement ?? undefined)
      .then((recu) => {
        if (!vivant) return
        setComposition(recu)
        if (demande.mouvement === undefined && recu.mouvement) changer({ mouvement: recu.mouvement.identifiant })
      })
      .catch(() => { if (vivant) setComposition(null) })
    return () => { vivant = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `changer` est stable ; seuls ces champs font relire la composition.
  }, [edition, demande.pose, demande.direction, demande.personnage, demande.mouvement, projet])
  // **RV5 : la durée proposée suit le modèle choisi**, et seulement quand il
  // change — sinon un réglage manuel serait effacé à chaque rendu.
  useEffect(() => {
    if (!edition || !video || !video.duree_par_defaut) return
    changer({ secondes: video.duree_par_defaut })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontaire : seul un changement de modèle réarme la durée.
  }, [edition, video?.identifiant])

  async function relire() {
    setOccupe(true); setErreur("")
    try {
      const d = { ...demande, options_video: JSON.parse(optionsVideo), options_image: JSON.parse(optionsImage) } as DemandeTravail
      if (enSerie) {
        const { pose: _p, direction: _d, ...commune } = d
        const cases: CaseSerie[] = directionsChoisies.map((direction) => ({ pose: d.pose, direction }))
        const s = await travaux.preparerSerie(projet, commune, cases, nombre)
        brouillon.effacer()
        setSerie(s); setTravail(null); setEdition(false)
      } else {
        const t = await travaux.preparer(projet, d)
        brouillon.effacer()
        setDemande(t.demande); setTravail(t); setSerie(null); setEdition(false)
      }
    } catch (e) { setErreur(e instanceof SyntaxError ? "Les paramètres avancés doivent être un objet JSON valide, par exemple {\"seed\": 42}." : message(e)) }
    finally { setOccupe(false) }
  }
  async function lancer(reprise = false) {
    setOccupe(true); setErreur("")
    try {
      if (serie) setSerie(await travaux.demarrerSerie(projet, serie.serie.cle))
      else if (travail) setTravail(await (reprise ? travaux.reprendre : travaux.demarrer)(projet, travail.identifiant))
    }
    catch (e) { setErreur(message(e)) }
    finally { setOccupe(false) }
  }
  function modifier() {
    if (!travail) return
    setDemande({ ...travail.demande, cle: crypto.randomUUID(),
      ...(travail.envoi_image ? { prompt_image: travail.envoi_image.prompt, repris_image: true } : {}) })
    setOptionsImage(JSON.stringify(travail.demande.options_image ?? {}, null, 2))
    setOptionsVideo(JSON.stringify(travail.demande.options_video ?? {}, null, 2))
    setAutresDirections([]); setNombre(1); setSerie(null)
    setEdition(true); setErreur("")
  }
  // **« Garder pour le jeu »** (RV5) : la correction du geste s'écrit dans la
  // bibliothèque — le style du personnage s'il porte ce texte, le mouvement
  // sinon —, exactement comme le fait l'écran « Faire une vidéo » (`Clip.tsx`).
  async function garderPourLeJeu() {
    const geste = (demande.correction_geste ?? "").trim()
    if (!composition?.mouvement || !geste) return
    setOccupe(true); setErreur("")
    try {
      if (composition.origine_du_style === "choisi" || composition.origine_du_style === "piece") {
        await api.reglerStyle(composition.style!.identifiant, { textes: { [composition.mouvement.identifiant]: geste } }, projet)
      } else {
        await api.reglerMouvement(composition.mouvement.identifiant, { texte: geste }, projet)
      }
      const recu = await api.mouvementDeLaPose(demande.pose, projet, demande.direction || undefined, demande.personnage || undefined, demande.mouvement ?? undefined)
      setComposition(recu)
      changer({ correction_geste: "" })
      setCorrectionOuverte(false)
    } catch (e) { setErreur(message(e)) }
    finally { setOccupe(false) }
  }

  const corps = <section className="flex min-h-0 flex-1 flex-col bg-papier">
    {autonome
      ? <header className="flex shrink-0 items-center justify-between gap-[14px] border-b border-trait p-[22px]"><div><h1 className="font-serif text-[38px] text-encre">{edition ? "Préparer une animation" : "Relire et suivre l’animation"}</h1><p className="mt-[4px] text-[13px] text-encre-3">Image de départ → clip vidéo → images → animation{demande.livrer_provisoire ? " → Godot" : ""}</p></div><button className={BOUTON} onClick={onFermer}>Fermer</button></header>
      : <p className="shrink-0 border-b border-trait p-[22px] text-[13px] text-encre-3">Image de départ → clip vidéo → images → animation{demande.livrer_provisoire ? " → Godot" : ""}</p>}
    <div ref={defilement} className="defile min-h-0 flex-1 overflow-y-auto p-[22px]">
      {erreur && <p role="alert" className="mb-[14px] rounded-7 border border-trait-echec bg-fond-echec p-[14px] text-echec">{erreur}</p>}
      {edition ? <div className="mx-auto max-w-[880px] space-y-[22px]">
        <AvisBrouillon brouillon={brouillon} />
        {demande.modele_video && videosLues && (!video || video.grise) && <p role="status" className="rounded-7 border border-trait-attention bg-fond-attention p-[14px] text-[13px]">Le modèle choisi « {demande.modele_video} » est indisponible : {video?.grise || "il n’est plus proposé par le catalogue"}. Modifie les réglages du clip ou choisis un autre modèle.</p>}
        <fieldset className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">1. Animation à créer</legend><div className="grid grid-cols-3 gap-[14px]">
          <label className="flex flex-col gap-[4px] text-[12px]">Sujet<select className={CHAMP} value={demande.personnage} onChange={(e) => changer({ personnage: e.target.value, pose: "", direction: "", reference_asset: null })}>{personnages.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>
          <label className="flex flex-col gap-[4px] text-[12px]">Mouvement<select className={CHAMP} value={demande.pose} onChange={(e) => choisirPose(e.target.value)}><option value="">Choisir…</option>{poses.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>
          <label className="flex flex-col gap-[4px] text-[12px]">Direction<select className={CHAMP} value={demande.direction} onChange={(e) => { setAutresDirections((l) => l.filter((d) => d !== e.target.value)); changer({ direction: e.target.value }) }}>{!directions.length && <option value="">Sans direction</option>}{directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>
        </div>{!poses.length && <p className="mt-[14px] text-[13px] text-encre-3">Ajoute d’abord une animation demandée dans « Objectif & règles » de cet asset.</p>}
        {/* **RV5** : d'autres directions cochées en plus font une série — un
            travail par case, lancés d'un seul geste. */}
        {directions.length > 1 && <div className="mt-[14px]"><p className="text-[12px] text-encre-3">Lancer aussi ces directions dans le même geste</p><div className="mt-[8px] flex flex-wrap gap-[14px]">{directions.filter((d) => d.identifiant !== demande.direction).map((d) => <label key={d.identifiant} className="flex items-center gap-[4px] text-[13px]"><input type="checkbox" checked={autresDirections.includes(d.identifiant)} onChange={() => basculerDirection(d.identifiant)} />{d.nom}</label>)}</div></div>}
        <label className="mt-[14px] flex flex-col gap-[4px] text-[12px]">Combien de clips par case<select aria-label="Nombre de clips" className={CHAMP} value={nombre} onChange={(e) => setNombre(Number(e.target.value))}>{NOMBRES_DE_CLIPS.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        {nombre > 1 && !demande.reference_asset && <p className="mt-[8px] text-[12px] text-encre-attention">Plusieurs clips d’une même case partent d’une image existante : choisis une image de départ, sinon chacun paierait la sienne.</p>}</fieldset>
        <fieldset className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">2. Image de départ</legend>
          <p className="text-[13px] text-encre-3">La référence existante du personnage sera proposée à la relecture. Tu peux en choisir une autre ; si aucune n’existe, le modèle d’image la créera.</p>
          <div className="mt-[14px] flex items-center gap-[14px]">{demande.reference_asset && <img alt="Image de départ choisie" src={api.vignette(demande.reference_asset, "", 128)} className="h-[128px] w-[128px] object-contain" />}<button className={BOUTON} onClick={() => setChoix("depart")}>Choisir dans la bibliothèque</button>{demande.reference_asset && <button className={BOUTON} onClick={() => changer({ reference_asset: null })}>‹ La proposition</button>}</div>
          {!demande.reference_asset && <div className="mt-[14px] space-y-[14px]"><label className="flex flex-col gap-[4px] text-[12px]">Modèle pour créer la référence si elle manque<select className={CHAMP} value={demande.modele_image ?? ""} onChange={(e) => changer({ modele_image: e.target.value || null })}><option value="">Utiliser seulement une image existante</option>{modeles.map((m) => <option key={m.identifiant} value={m.identifiant} disabled={!!m.refus}>{libelleModele(m)}{m.refus ? ` — ${m.refus}` : ""}</option>)}</select></label>
          {demande.modele_image && <><label className="flex flex-col gap-[4px] text-[12px]">{demande.repris_image ? "Texte complet de l’image, édité pour cet envoi" : "Description de l’image à créer"}<textarea rows={3} value={demande.prompt_image ?? ""} onChange={(e) => changer({ prompt_image: e.target.value })} className="rounded-7 border border-contour bg-papier p-[14px] text-[13px]" /></label><label className="flex flex-col gap-[4px] text-[12px]">Réservation estimée pour l’image, en dollars (si son coût n’est pas encore mesuré)<input type="number" min={0} step="0.01" className={CHAMP} value={demande.plafond_image_usd ?? ""} onChange={(e) => changer({ plafond_image_usd: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          <div className="flex flex-wrap gap-[8px]">{(demande.references_image ?? []).map((id) => <button key={id} className="rounded-7 border border-contour p-[4px]" title="Retirer cette référence" onClick={() => changer({ references_image: demande.references_image?.filter((r) => r !== id) })}><img className="h-[54px] w-[54px] object-contain" src={api.vignette(id, "", 128)} alt="Référence jointe, cliquer pour retirer" /></button>)}<button className={BOUTON} onClick={() => setChoix("reference")}>Ajouter des références</button></div>
          {travail?.references.filter((r) => r.asset && !(demande.references_image_ecartees ?? []).includes(r.asset)).map((r) => <div className="flex items-center gap-[8px]" key={r.nom}><img alt="Référence composée à la relecture" src={r.url} className="h-[54px] w-[54px] object-contain" /><button className={BOUTON} onClick={() => changer({ references_image_ecartees: [...(demande.references_image_ecartees ?? []), r.asset!] })}>Retirer de cet envoi</button></div>)}
          <details><summary className="cursor-pointer text-[12px] text-encre-3">Paramètres du modèle d’image</summary><p className="my-[8px] text-[12px] text-encre-3">Paramètres disponibles : {Object.keys(image?.options ?? {}).join(", ") || "aucun paramètre supplémentaire déclaré"}.</p><textarea aria-label="Paramètres d’image JSON" className="mesure w-full rounded-7 border border-contour p-[14px] text-[12px]" rows={3} value={optionsImage} onChange={(e) => setOptionsImage(e.target.value)} /></details></> }</div>}
        </fieldset>
        <fieldset className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">3. Mouvement et clip vidéo</legend>
          <label className="flex flex-col gap-[4px] text-[12px]">Geste<select aria-label="Geste" className={CHAMP} value={demande.mouvement ?? ""} onChange={(e) => choisirMouvement(e.target.value)}><option value="">— texte libre —</option>{mouvements.map((m) => <option key={m.identifiant} value={m.identifiant}>{m.nom}</option>)}</select></label>
          {demande.mouvement ? <div className="mt-[14px]">
            <p className="text-[12px] text-encre-3">{composition?.style ? `Style : ${composition.style.nom}${composition.origine_du_style === "piece" ? ` (hérité de ${composition.piece_du_style?.nom ?? "une pièce"})` : ""}` : "Aucun style de combat n’ajoute son texte ici."}</p>
            <details className="mt-[8px]"><summary className="cursor-pointer text-[12px] text-encre-3">Voir le texte anglais envoyé</summary><p data-texte-du-mouvement className="mt-[8px] whitespace-pre-wrap rounded-7 border border-contour bg-papier p-[14px] text-[13px]">{(demande.correction_geste?.trim() ? composition?.direction ? `${composition.direction} ${demande.correction_geste.trim()}` : demande.correction_geste.trim() : composition?.texte) || "choisis une case — c’est elle qui écrit ce qui part"}</p></details>
            <div className="mt-[8px] flex items-center gap-[14px]">
              <button type="button" className="text-[12px] text-signal hover:opacity-70" onClick={() => setCorrectionOuverte((o) => !o)}>{correctionOuverte ? "fermer la correction" : "corriger le geste ›"}</button>
              {!!demande.correction_geste?.trim() && <button type="button" className="text-[12px] text-signal hover:opacity-70" onClick={() => changer({ correction_geste: "" })}>remettre le texte du mouvement</button>}
            </div>
            {correctionOuverte && <div className="mt-[8px] space-y-[8px]">
              <textarea aria-label="Corriger le geste pour cet appel" rows={2} className="mesure w-full rounded-7 border border-signal bg-carte p-[14px] text-[13px]" value={demande.correction_geste ?? ""} onChange={(e) => changer({ correction_geste: e.target.value })} placeholder={composition?.geste || "geste en anglais"} />
              <p className="text-[12px] text-encre-3">Cette correction part avec cet appel ; le mouvement de la bibliothèque ne bouge pas.</p>
              <button type="button" className={BOUTON} disabled={occupe || !demande.correction_geste?.trim()} onClick={() => void garderPourLeJeu()}>Garder pour le jeu</button>
            </div>}
          </div> : <label className="mt-[14px] flex flex-col gap-[4px] text-[12px]">Décrire l’animation<textarea rows={3} className="rounded-7 border border-contour p-[14px] text-[13px]" value={demande.prompt_video} onChange={(e) => changer({ prompt_video: e.target.value })} placeholder="Le personnage marche sur place, cycle régulier, caméra fixe…" /></label>}
          <div className="mt-[14px] grid grid-cols-3 gap-[14px]"><label className="flex flex-col gap-[4px] text-[12px]">Durée du clip<select className={CHAMP} value={demande.secondes} onChange={(e) => changer({ secondes: Number(e.target.value) })}>{[...new Set([demande.secondes, ...(video?.durees ?? [])])].sort((a, b) => a - b).map((n) => <option key={n} value={n} disabled={!!video && !video.durees.includes(n)}>{n} s{video && !video.durees.includes(n) ? " — non accepté par ce modèle" : ""}</option>)}</select></label><label className="flex flex-col gap-[4px] text-[12px]">Résolution<select className={CHAMP} value={demande.resolution} onChange={(e) => changer({ resolution: e.target.value })}>{[...new Set([demande.resolution, ...videos.flatMap((m) => m.resolutions)])].map((v) => <option key={v}>{v}</option>)}</select></label><label className="flex flex-col gap-[4px] text-[12px]">Proportions<select className={CHAMP} value={demande.proportions} onChange={(e) => changer({ proportions: e.target.value })}>{[...new Set([demande.proportions, ...videos.flatMap((m) => m.proportions)])].map((v) => <option key={v}>{v}</option>)}</select></label></div>
          <label className="mt-[14px] flex flex-col gap-[4px] text-[12px]">{CHAMP_DU_MODELE}<select className={CHAMP} value={demande.modele_video} onChange={(e) => changer({ modele_video: e.target.value })}><option value="">Choisir un modèle…</option>{demande.modele_video && !video && <option value={demande.modele_video} disabled>{videosLues ? "modèle indisponible" : "chargement…"}</option>}{videos.map((m) => <option key={m.identifiant} value={m.identifiant} disabled={!!m.grise}>{libelleModele(m)}{m.grise ? ` — ${m.grise}` : m.de_la_maison ? " · local" : ` · ${prix(m.prix.montant)}`}</option>)}</select></label>
          {video?.de_la_maison && <div className="mt-[8px]"><MemoireLocale etat={moteur} /></div>}
          <details className="mt-[14px]"><summary className="cursor-pointer text-[12px] text-encre-3">Paramètres avancés du workflow</summary><p className="my-[8px] text-[12px] text-encre-3">Réglages nommés du workflow, par exemple la seed. Le fournisseur vérifie les paramètres avant l’envoi.</p><textarea aria-label="Paramètres vidéo JSON" className="mesure w-full rounded-7 border border-contour p-[14px] text-[12px]" rows={3} value={optionsVideo} onChange={(e) => setOptionsVideo(e.target.value)} /></details>
        </fieldset>
        <fieldset className="rounded-8 border border-trait bg-carte p-[22px]"><legend className="font-serif text-[25px]">4. Animation à obtenir</legend><div className="grid grid-cols-3 gap-[14px]"><label className="flex flex-col gap-[4px] text-[12px]">Images à extraire<input className={CHAMP} type="number" min={1} max={64} value={demande.nombre_images} onChange={(e) => changer({ nombre_images: Number(e.target.value) })} /></label><label className="flex flex-col gap-[4px] text-[12px]">Cadence (images/s)<input className={CHAMP} type="number" min={0.1} max={120} step={0.1} value={demande.cadence} onChange={(e) => changer({ cadence: Number(e.target.value) })} /></label><label className="flex flex-col gap-[4px] text-[12px]">Lecture<select className={CHAMP} value={demande.sens} onChange={(e) => changer({ sens: e.target.value as DemandeTravail["sens"] })}><option value="boucle">En boucle</option><option value="aller-retour">Aller-retour</option></select></label></div><label className="mt-[14px] flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={!!demande.livrer_provisoire} onChange={(e) => changer({ livrer_provisoire: e.target.checked })} />Livrer automatiquement cette première version dans le projet Godot associé</label><p className="mt-[8px] text-[12px] text-encre-3">Le clip et ses images restent conservés. Le montage permet ensuite de choisir un passage, réordonner les images et retoucher chaque image.</p></fieldset>
      </div> : travail ? <div className="mx-auto max-w-[880px] space-y-[22px]">
        <div className="rounded-8 border border-trait bg-carte p-[22px]"><div className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px]">{personnage?.nom ?? travail.demande.personnage}</h2><span role="status" className="text-[13px] text-encre-3">{ETATS[travail.etat]} · {ETAPES[travail.etape] ?? travail.etape}</span></div><p className="mt-[8px] text-[13px]">{personnage?.plan.find((p) => p.identifiant === travail.demande.pose)?.nom ?? travail.demande.pose} · {travail.demande.direction || "Sans direction"} · {travail.demande.nombre_images} images à {travail.demande.cadence} i/s · {travail.objectif.largeur} × {travail.objectif.hauteur} px</p>{travail.raison && <p className="mt-[14px] text-[13px] text-echec">{travail.raison}</p>}</div>
        <div className="grid grid-cols-2 gap-[22px]">
          <article className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Image de départ</h2>{travail.entree_video ? <><img className="mt-[14px] h-[128px] w-full object-contain" src={travail.entree_video.url} alt="Image exacte envoyée à la vidéo" /><p className="mt-[8px] text-[12px] text-encre-3">Image conservée et préparée au format du clip.</p></> : <><p className="mesure mt-[14px] break-words text-[12px]">{(() => { const m = modeles.find((v) => v.identifiant === travail.demande.modele_image); return m ? libelleModele(m) : travail.demande.modele_image })()}</p><p className="mt-[14px] whitespace-pre-wrap text-[13px]">{travail.envoi_image?.prompt ?? travail.demande.prompt_image}</p><p className="mt-[14px] text-[13px]">Estimation : {dollars(travail.annonce.image_usd)}</p></>}<div className="mt-[14px] flex flex-wrap gap-[8px]">{travail.references.map((r) => <img key={r.nom} src={r.url} alt="Référence exacte envoyée pour créer l’image" className="h-[54px] w-[54px] rounded-7 border border-trait object-contain" />)}</div></article>
          <article className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Vidéo à fabriquer</h2><p className="mesure mt-[14px] break-words text-[12px]">{(() => { const m = videos.find((v) => v.identifiant === travail.demande.modele_video); return m ? libelleModele(m) : travail.demande.modele_video })()}</p><p className="mt-[14px] whitespace-pre-wrap text-[13px]">{travail.demande.prompt_video}</p><p className="mt-[14px] text-[13px]">1 clip · {travail.demande.secondes} s · {travail.demande.resolution} · {travail.demande.proportions}</p><p className="mt-[8px] text-[13px]">{travail.annonce.video_locale ? `Local · ${travail.annonce.temps_local ? `${Math.ceil(travail.annonce.temps_local.secondes)} s mesurées` : "temps non mesuré"}` : `Estimation vidéo : ${prix(travail.annonce.video.montant)}`}</p><dl className="mt-[14px] text-[12px] text-encre-3">{Object.entries(travail.demande.options_video ?? {}).map(([k, v]) => <div key={k} className="flex justify-between gap-[14px]"><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl></article>
        </div><div className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">{travail.annonce.appels} génération{travail.annonce.appels > 1 ? "s" : ""} prévue{travail.annonce.appels > 1 ? "s" : ""}</h2><p className="mt-[8px] text-[14px]">Réservation totale : {dollars(travail.annonce.reservation_usd)}</p><p className="mt-[8px] text-[12px] text-encre-3">{travail.annonce.limite}</p>{travail.consommations.map((c, i) => <p key={i} className="mesure mt-[8px] text-[12px]">{c.modele} : {c.consomme} {c.unite || "usd"} consommé{c.consomme > 1 ? "s" : ""}</p>)}</div>
        {travail.clip && <button className={BOUTON} onClick={() => onClip(travail.clip!)}>Ouvrir le clip et son montage</button>}{travail.bandes.map((id) => onBande && <button key={id} className={`${BOUTON} ml-[8px]`} onClick={() => onBande(id)}>Retoucher l’animation</button>)}{onLivraisons && !!travail.bandes.length && <button className={`${BOUTON} ml-[8px]`} onClick={onLivraisons}>{travail.livraison ? "Voir la livraison dans La sortie" : "Livrer dans le jeu"}</button>}{travail.livraison && <p className="mesure text-[13px]">Livraison terminée. Retrouvez les fichiers et la révision dans « La sortie ».</p>}
      </div> : serie ? <RelectureDeSerie serie={serie} personnage={personnage} onClip={onClip} /> : null}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte p-[14px]"><p className="text-[12px] text-encre-3">{edition ? "Rien ne part avant la relecture." : "La demande et ses résultats restent accessibles depuis Fabrications."}</p><div className="flex gap-[8px]">{edition ? <button disabled={occupe || !demande.pose || !video || !!video.grise || !(demande.mouvement || demande.prompt_video.trim())} onClick={() => void relire()} className={PRINCIPAL}>{occupe ? "Préparation…" : VERS_LA_RELECTURE}</button> : serie ? (serie.travaux.every((t) => t.etat === "prepare") && <button className={PRINCIPAL} disabled={occupe} onClick={() => void lancer()}>{libelleLancement(serie.annonce_serie.locale, serie.annonce_serie.temps_s, serie.annonce_serie.reservation_usd, serie.serie.total)}</button>) : travail && <>{travail.etat === "prepare" && <><button className={BOUTON} onClick={modifier}>Modifier le texte et les images</button><button className={PRINCIPAL} disabled={occupe} onClick={() => void lancer()}>{libelleLancement(travail.annonce.video_locale, travail.annonce.temps_local?.secondes ?? null, travail.annonce.reservation_usd, 1)}</button></>}{["a_reprendre", "a_verifier"].includes(travail.etat) && <button className={BOUTON} disabled={occupe} onClick={() => void lancer(true)}>Reprendre ce travail</button>}{["termine", "annule"].includes(travail.etat) && <button className={BOUTON} onClick={modifier}>Préparer une nouvelle version</button>}</>}</div></footer>
    {choix && <CadreDialogue titre="Choisir des images dans la bibliothèque" onFermer={() => setChoix(null)} enfants={<div className="flex min-h-0 flex-1 flex-col bg-papier p-[22px]"><header className="flex items-center justify-between"><h2 className="font-serif text-[38px]">{choix === "depart" ? "Choisir l’image de départ" : "Joindre des références"}</h2><button className={BOUTON} onClick={() => setChoix(null)}>Terminer le choix</button></header><div className="my-[22px] flex items-center gap-[14px]"><input type="search" aria-label="Rechercher une image" className={`${CHAMP} flex-1`} value={recherche} onChange={(e) => { setRecherche(e.target.value); setPlafondImages(48) }} /><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={favoris} onChange={(e) => setFavoris(e.target.checked)} />Retenues seulement</label><span className="text-[12px] text-encre-3">{totalImages} images</span></div><div className="defile flex min-h-0 flex-1 flex-wrap content-start gap-[14px] overflow-y-auto">{images.map((a) => <button key={a.identifiant} aria-pressed={choix === "depart" ? demande.reference_asset === a.identifiant : (demande.references_image ?? []).includes(a.identifiant)} className="w-[128px] rounded-8 border border-contour bg-carte p-[8px] aria-pressed:border-signal" onClick={() => { if (choix === "depart") { changer({ reference_asset: a.identifiant }); setChoix(null) } else changer({ references_image: [...new Set([...(demande.references_image ?? []), a.identifiant])] }) }}><img alt={a.label || "Image sans nom"} className="h-[128px] w-full object-contain" src={vignetteAsset(a, 128)} /><span className="mt-[4px] block truncate text-[12px]">{a.label || "Image sans nom"}</span></button>)}{images.length < totalImages && <button className={BOUTON} onClick={() => setPlafondImages((n) => n + 48)}>Afficher davantage d’images</button>}</div></div>} />}
  </section>
  return autonome ? <CadreDialogue titre="Fabrication d’une animation" onFermer={onFermer} enfants={corps} /> : corps
}

/** **La relecture d'une série** (RV5) : un en-tête commun — ce qui vaut pour
 *  toutes les cases —, puis chaque case, repliée. Un travail seul reste la
 *  relecture d'avant ; c'est ici seulement pour plus d'un clip. */
function RelectureDeSerie({ serie, personnage, onClip }: {
  serie: Serie; personnage: Personnage | undefined; onClip: (id: string) => void
}) {
  const premier = serie.travaux[0]
  return <div className="mx-auto max-w-[880px] space-y-[22px]">
    <div className="rounded-8 border border-trait bg-carte p-[22px]">
      <div className="flex items-center justify-between gap-[14px]"><h2 className="font-serif text-[25px]">{personnage?.nom ?? premier?.demande.personnage}</h2><span className="text-[13px] text-encre-3">{serie.serie.total} clip{serie.serie.total > 1 ? "s" : ""}</span></div>
      <p className="mt-[8px] text-[13px]">{personnage?.plan.find((p) => p.identifiant === premier?.demande.pose)?.nom ?? premier?.demande.pose} · {premier?.demande.secondes} s · {premier?.demande.resolution} · {premier?.demande.proportions}</p>
      <p className="mt-[8px] text-[14px]">{serie.annonce_serie.locale ? `Local · ${serie.annonce_serie.temps_s ? `≈ ${duree(serie.annonce_serie.temps_s)}` : "temps non mesuré"}` : `Réservation totale : ${dollars(serie.annonce_serie.reservation_usd)}`}</p>
    </div>
    <div className="space-y-[8px]">{serie.travaux.map((t) => {
      const direction = personnage?.cases.find((c) => c.pose === t.demande.pose)?.directions.find((d) => d.identifiant === t.demande.direction)?.nom ?? t.demande.direction ?? "Sans direction"
      return <details key={t.identifiant} className="rounded-8 border border-trait bg-carte p-[14px]">
        <summary className="flex cursor-pointer items-center justify-between gap-[14px] text-[13px]"><span>{direction}</span><span className="text-encre-3">{ETATS[t.etat]}</span></summary>
        <p className="mt-[8px] whitespace-pre-wrap text-[13px]">{t.demande.prompt_video}</p>
        {t.raison && <p className="mt-[8px] text-[13px] text-echec">{t.raison}</p>}
        {t.clip && <button className={BOUTON} onClick={() => onClip(t.clip!)}>Ouvrir le clip et son montage</button>}
      </details>
    })}</div>
  </div>
}

type OuvrirCalqueEquipement = (piece: string, emploi: string, cible: CibleCalque, variante?: string) => void

function FenetreDuTravail({ travail, projet, personnages, onClip, onBande, onFermer, onCalqueEquipement, onAsset, onToile, onSon }: {
  travail: TravailSuivi; projet: string; personnages: readonly Personnage[]
  onClip: (id: string) => void; onBande?: (id: string) => void; onFermer: () => void; onCalqueEquipement?: OuvrirCalqueEquipement; onAsset?: (id: string) => void; onToile?: (id: string) => void; onSon?: (id: string) => void
}) {
  if (travail.nature === "audio") return <FabricationAudio projet={projet} identifiantInitial={travail.identifiant} onSon={onSon} onFermer={onFermer} />
  if (travail.nature === "3d") return <SuiviFabrication3D initiale={travail} onFermer={onFermer} onBande={onBande} />
  if (travail.nature === "equipement") return <RelectureEquipement chemin={{ projet, piece: travail.piece, emploi: travail.emploi }} initiale={travail} onFermer={onFermer} onCalque={onCalqueEquipement ? (c, v) => onCalqueEquipement(travail.piece, travail.emploi, c, v) : undefined} />
  if (travail.nature === "video-libre") return <FabricationVideoLibre projet={projet} identifiantInitial={travail.identifiant} onClip={onClip} onFermer={onFermer} />
  if (travail.nature === "image-locale") return <FabricationImageLocale projet={projet} identifiantInitial={travail.identifiant} onAsset={onAsset} onToile={onToile} onFermer={onFermer} />
  return <FabricationSuivie projet={projet} personnages={personnages} initiale={travail} onClip={onClip} onBande={onBande} onFermer={onFermer} />
}

export function SuiviDesTravaux({ projet, personnages, onClip, onBande, onCalqueEquipement, onAsset, onToile, onSon, onPreparer }: {
  projet: string; personnages: readonly Personnage[]; onClip: (id: string) => void; onBande?: (id: string) => void; onCalqueEquipement?: OuvrirCalqueEquipement; onAsset?: (id: string) => void; onToile?: (id: string) => void; onSon?: (id: string) => void
  /** **Une animation neuve passe par la fenêtre unique** (RP4) : c'était la
   *  neuvième porte de préparation du produit. */
  onPreparer?: (type: "clip") => void
}) {
  const [liste, setListe] = useState<TravailSuivi[]>([])
  const [ouvert, setOuvert] = useState<TravailSuivi | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let vivant = true
    const lire = () => void travaux.lister(projet).then((r) => { if (vivant) setListe(r) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    lire(); const intervalle = window.setInterval(lire, 5000)
    return () => { vivant = false; window.clearInterval(intervalle) }
  }, [projet, ouvert])
  return <section aria-label="Fabrications suivies" className="mt-[22px] rounded-8 border border-trait bg-carte p-[22px]">
    <div className="flex items-center justify-between gap-[14px]"><div><h2 className="font-serif text-[25px]">Créer et suivre les fabrications</h2><p className="mt-[8px] text-[13px] text-encre-3">Images, clips, équipements et sons : retrouvez chaque demande et ses résultats ici.</p></div><button className={BOUTON} disabled={!personnages.length || !onPreparer} onClick={() => onPreparer?.("clip")}>Nouvelle animation</button></div>
    {erreur && <p role="alert" className="mt-[14px] text-echec">{erreur}</p>}
    <div className="mt-[14px] space-y-[8px]">{liste.map((t) => <button key={t.identifiant} className="flex w-full items-center justify-between gap-[14px] rounded-7 border border-trait p-[14px] text-left hover:border-contour" onClick={() => setOuvert(t)}>
      <span className="text-[13px]">{nomDuTravail(t, personnages)}<small className="mt-[4px] block text-encre-3">{t.acteur === "agent" ? "Agent" : "Création manuelle"} · {new Date(t.cree_le * 1000).toLocaleString("fr-FR")}</small></span><span className="text-[12px] text-encre-3">{ETATS[t.etat]}</span>
    </button>)}</div>
    {ouvert && <FenetreDuTravail key={ouvert.identifiant} travail={ouvert} projet={projet} personnages={personnages} onClip={onClip} onBande={onBande} onFermer={() => setOuvert(null)} onCalqueEquipement={onCalqueEquipement} onAsset={onAsset} onToile={onToile} onSon={onSon} />}
  </section>
}

export function TravailConserve({ projet, identifiant, personnages, onClip, onBande, onFermer, onCalqueEquipement, onAsset, onToile, onSon }: {
  projet: string; identifiant: string; personnages: readonly Personnage[]
  onClip: (id: string) => void; onBande: (id: string) => void; onFermer: () => void; onCalqueEquipement?: OuvrirCalqueEquipement; onAsset?: (id: string) => void; onToile?: (id: string) => void; onSon?: (id: string) => void
}) {
  const [lu, setLu] = useState<TravailSuivi | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let vivant = true
    setLu(null); setErreur("")
    travaux.lireSuivi(projet, identifiant).then((t) => { if (vivant) setLu(t) }).catch((e: unknown) => { if (vivant) setErreur(message(e)) })
    return () => { vivant = false }
  }, [projet, identifiant])
  if (!lu) return <main className="flex flex-1 flex-col gap-[14px] p-[22px]"><p role={erreur ? "alert" : "status"}>{erreur || "Lecture de la fabrication…"}</p><button className={BOUTON} onClick={onFermer}>Revenir</button></main>
  return <FenetreDuTravail key={lu.identifiant} travail={lu} projet={projet} personnages={personnages} onClip={onClip} onBande={onBande} onFermer={onFermer} onCalqueEquipement={onCalqueEquipement} onAsset={onAsset} onToile={onToile} onSon={onSon} />
}
