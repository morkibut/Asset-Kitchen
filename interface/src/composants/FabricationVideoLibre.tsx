import { useEffect, useState } from "react"
import { api, dollars, prix, type EtatDuMoteur, type Modele, type ModeleVideo, type Option } from "../api"
import { videoLibre, type DemandeVideoLibre, type TravailVideoLibre } from "../api-video-libre"
import { workflows, type ProfilWorkflow } from "../api-workflows"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { MemoireLocale } from "./MemoireLocale"
import { ChoixModele, Libelle, type Habitues } from "./pieces"

const CHAMP = "min-w-0 rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle"
const BOUTON = `${CHAMP} hover:border-encre-3 disabled:opacity-50`
const SURFACE = "rounded-8 border border-trait bg-carte p-[22px]"
const ETATS: Record<TravailVideoLibre["etat"], string> = { prepare: "Prête à lancer", en_cours: "Fabrication en cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "Acceptation à vérifier chez le fournisseur", termine: "Clip disponible", annule: "Fabrication annulée" }
const message = (e: unknown) => e instanceof Error ? e.message : "La fabrication n’a pas pu être relue. Réessayez."
const uniques = <T,>(valeurs: T[]) => [...new Set(valeurs)]
const defauts = (p?: ProfilWorkflow) => Object.fromEntries(Object.entries(p?.parametres || {}).map(([n, v]) => [n, v.defaut]))

/** Le clip est une source avant d’être une animation classée. La reprise suit
 * le même travail conservé ; elle ne reconstruit jamais une demande à envoyer. */
export function FabricationVideoLibre({ projet, identifiantInitial, modeleInitial, onClip, onFermer, autonome = true }: {
  projet: string; identifiantInitial?: string; modeleInitial?: string
  onClip: (id: string) => void; onFermer?: () => void
  /** **Sa propre fenêtre, ou le corps d'une autre** (RP4). */
  autonome?: boolean
}) {
  const [initiale] = useState<DemandeVideoLibre>(() => ({ cle: crypto.randomUUID(), modele_video: modeleInitial || "", prompt_video: "", secondes: 5, resolution: "480p", proportions: "1:1", nombre_images: 8, cadence: 8, sens: "boucle", references_image: [], options_image: {}, options_video: {} }))
  const [demande, setDemande] = useState(initiale)
  const [travail, setTravail] = useState<TravailVideoLibre | null>(null)
  const [edition, setEdition] = useState(!identifiantInitial)
  const [videos, setVideos] = useState<ModeleVideo[]>([])
  const [images, setImages] = useState<Modele[]>([])
  const [habituesImage, setHabituesImage] = useState<Habitues | null>(null)
  const [profils, setProfils] = useState<ProfilWorkflow[]>([])
  const [lecture, setLecture] = useState(true)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  const [choix, setChoix] = useState<"depart" | "reference" | null>(null)
  const [fabriquerImage, setFabriquerImage] = useState(false)
  const [moteur, setMoteur] = useState<EtatDuMoteur | null>(null)
  const brouillon = useBrouillonLocal({ cle: `video-libre:${projet}:${modeleInitial || "libre"}`, pret: edition,
    reference: initiale, etat: demande, signature: ({ cle: _cle, ...reste }) => JSON.stringify(reste),
    ecran: "Une vidéo libre", quoi: demande.prompt_video || "Sans texte",
    appliquer: d => { setDemande({ ...d, cle: crypto.randomUUID() }); setFabriquerImage(!!d.modele_image && !d.reference_asset) } })
  const video = videos.find(m => m.identifiant === demande.modele_video)
  const image = images.find(m => m.identifiant === demande.modele_image)
  const profilImage = profils.find(p => p.modele === demande.modele_image)
  const refs = demande.references_image || []
  function changer(champs: Partial<DemandeVideoLibre>) { setDemande(d => ({ ...d, ...champs })); setErreur("") }

  useEffect(() => {
    let vivant = true
    workflows.lister().then(r => {
      if (!vivant) return
      setProfils(r.profils)
      const p = r.profils.find(p => p.modele === modeleInitial && p.nature === "video")
      if (p && !identifiantInitial) setDemande(d => d.modele_video !== modeleInitial ? d : ({ ...d, secondes: p.durees[0], resolution: p.formats[0].resolution, proportions: p.formats[0].proportions, options_video: { ...defauts(p), ...d.options_video } }))
    }).catch(e => vivant && setErreur(message(e)))
    if (identifiantInitial) videoLibre.lire(projet, identifiantInitial).then(t => {
      if (vivant) { setTravail(t); setDemande(t.demande); setFabriquerImage(!t.demande.reference_asset && !!t.demande.modele_image) }
    }).catch(e => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [projet, identifiantInitial, modeleInitial])
  useEffect(() => {
    if (!edition) return
    let vivant = true; setLecture(true)
    api.modelesVideo(demande.secondes, demande.resolution, demande.proportions)
      .then(r => vivant && setVideos(r.modeles)).catch(e => vivant && setErreur(message(e))).finally(() => vivant && setLecture(false))
    return () => { vivant = false }
  }, [edition, demande.secondes, demande.resolution, demande.proportions])
  // **RV2 : la carte prévient avant de lancer**, seulement quand le modèle
  // choisi est local — un modèle payant n'a pas de carte à regarder.
  useEffect(() => {
    if (!edition || !video?.de_la_maison) { setMoteur(null); return }
    let vivant = true
    api.etatDuMoteur().then(e => vivant && setMoteur(e)).catch(() => vivant && setMoteur(null))
    return () => { vivant = false }
  }, [edition, video?.de_la_maison])
  useEffect(() => {
    if (!edition || !fabriquerImage) return
    let vivant = true
    api.modeles(demande.proportions_image || "1:1", refs.length).then(r => { if (vivant) { setImages(r.modeles); setHabituesImage(r.habitues) } }).catch(e => vivant && setErreur(message(e)))
    return () => { vivant = false }
  }, [edition, fabriquerImage, demande.proportions_image, refs.length])
  useEffect(() => {
    if (!travail || travail.etat !== "en_cours") return
    let vivant = true
    const timer = window.setInterval(() => { void videoLibre.lire(projet, travail.identifiant).then(t => vivant && setTravail(t)).catch(e => vivant && setErreur(message(e))) }, 1500)
    return () => { vivant = false; window.clearInterval(timer) }
  }, [projet, travail?.identifiant, travail?.etat])

  async function agir(geste: () => Promise<TravailVideoLibre>, effacer = false) {
    setOccupe(true); setErreur("")
    try { const t = await geste(); setTravail(t); setDemande(t.demande); setEdition(false); if (effacer) brouillon.effacer() }
    catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  async function importer(fichier?: File) {
    if (!fichier) return
    setOccupe(true); setErreur("")
    try {
      const r = await api.televerser(fichier), asset = r.asset || r.doublon
      if (!asset || asset.projet !== projet) throw new Error("L’image doit appartenir au jeu ouvert. Choisis une image de ce jeu dans la bibliothèque.")
      changer({ reference_asset: asset.identifiant, modele_image: null }); setFabriquerImage(false)
    } catch (e) { setErreur(message(e)) } finally { setOccupe(false) }
  }
  function modifier() {
    if (!travail) return
    setDemande({ ...travail.demande, cle: crypto.randomUUID(), ...(travail.envoi_image ? { prompt_image: travail.envoi_image.prompt, repris_image: true } : {}) })
    setFabriquerImage(!travail.demande.reference_asset && !!travail.demande.modele_image); setEdition(true)
  }
  const bloque = !demande.reference_asset && !fabriquerImage ? "Choisis ou importez une image de départ." : fabriquerImage && (!image || image.refus) ? image?.refus || "Choisis le modèle qui créera l’image de départ." : fabriquerImage && !demande.prompt_image?.trim() ? "Décris l’image de départ." : !video || video.grise ? video?.grise || "Choisis un modèle vidéo compatible avec le format." : !demande.prompt_video.trim() ? "Décris le mouvement à filmer." : ""
  if (choix) return <BibliothequePourImage retour="Vidéo libre" onFermer={() => setChoix(null)} onChoisir={a => {
    if (a.projet !== projet) { setErreur("Choisis une image du jeu ouvert."); setChoix(null); return }
    changer(choix === "depart" ? { reference_asset: a.identifiant, modele_image: null } : { references_image: [...refs, a.identifiant] })
    if (choix === "depart") setFabriquerImage(false)
    setChoix(null)
  }} />
  return <section aria-label="Fabriquer une vidéo libre" className="space-y-[22px] p-[22px] text-encre">
    <header className="flex items-start justify-between gap-[14px]"><div>{autonome && <h2 className="font-serif text-[38px]">{edition ? "Fabriquer une vidéo libre" : "Relire et suivre la vidéo"}</h2>}<p className="mt-[8px] text-[13px] text-encre-3"><Libelle aide="fabrication.video-libre">Image de départ → clip → montage et classement</Libelle></p></div>{autonome && onFermer && <button className={BOUTON} onClick={onFermer}>Fermer</button>}</header>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    {edition ? <form className="space-y-[22px]" onSubmit={e => { e.preventDefault(); if (!bloque) void agir(() => videoLibre.preparer(projet, demande), true) }}>
      <AvisBrouillon brouillon={brouillon} />
      <fieldset disabled={occupe} className={`${SURFACE} space-y-[14px]`}><legend className="font-serif text-[25px]">1. L’image de départ</legend>
        <p className="text-[13px] text-encre-3">Cette image sera envoyée au modèle vidéo. Le personnage et le mouvement de l’animation se choisiront au montage.</p>
        <div className="flex flex-wrap items-center gap-[8px]"><button type="button" className={BOUTON} onClick={() => setChoix("depart")}>Choisir dans la bibliothèque</button><label className={`${BOUTON} cursor-pointer`}>Importer l’image de départ<input className="sr-only" type="file" accept="image/*" onChange={e => void importer(e.target.files?.[0])} /></label><button type="button" className={BOUTON} aria-pressed={fabriquerImage} onClick={() => { setFabriquerImage(true); changer({ reference_asset: null }) }}>Fabriquer une nouvelle image</button></div>
        {demande.reference_asset && <img src={api.fichier(demande.reference_asset)} alt="Image de départ choisie" className="damier-papier h-[128px] w-[128px] object-contain" />}
        {fabriquerImage && <div className="space-y-[14px]">
          <label className="flex flex-col gap-[8px] text-[13px]">Modèle d’image<ChoixModele
            modeles={images}
            valeur={demande.modele_image || null}
            habitues={habituesImage}
            onChange={identifiant => {
              const p = profils.find(p => p.modele === identifiant), m = images.find(m => m.identifiant === identifiant)
              changer({ modele_image: identifiant || null, options_image: defauts(p), resolution_image: p?.formats[0].resolution || m?.resolutions[0] || null, proportions_image: p?.formats[0].proportions || m?.proportions[0] || "1:1" })
            }}
            ariaLabel="Modèle d’image"
          /></label>
          <label className="flex flex-col gap-[8px] text-[13px]">Description de l’image<textarea className={`${CHAMP} min-h-[128px]`} value={demande.prompt_image || ""} onChange={e => changer({ prompt_image: e.target.value })} /></label>
          <label className="text-[13px]"><input type="checkbox" checked={!demande.repris_image} onChange={e => changer({ repris_image: !e.target.checked })} /> Ajouter les règles de l’univers au texte de l’image</label>
          {(!profilImage || profilImage.liaisons.prompt_negatif) && <label className="flex flex-col gap-[8px] text-[13px]">Éviter dans l’image<textarea className={CHAMP} value={demande.prompt_negatif_image || ""} onChange={e => changer({ prompt_negatif_image: e.target.value })} /></label>}
          <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px] text-[13px]">Proportions de l’image<select className={CHAMP} value={demande.proportions_image || "1:1"} onChange={e => changer({ proportions_image: e.target.value })}>{uniques([demande.proportions_image || "1:1", ...images.flatMap(m => m.proportions)]).map(v => <option key={v}>{v}</option>)}</select></label><label className="flex flex-col gap-[8px] text-[13px]">Résolution de l’image<select className={CHAMP} value={demande.resolution_image || ""} onChange={e => changer({ resolution_image: e.target.value || null })}><option value="">Défaut du modèle</option>{image?.resolutions.map(v => <option key={v}>{v}</option>)}</select></label></div>
          <div className="flex flex-wrap gap-[14px]">{refs.map((id, i) => <div key={`${id}-${i}`}><img className="damier-papier h-[128px] w-[128px] object-contain" src={api.fichier(id)} alt={`Référence de l’image ${i + 1}`} /><button className={BOUTON} type="button" onClick={() => changer({ references_image: refs.filter((_, n) => n !== i) })}>Retirer la référence {i + 1}</button></div>)}</div>
          <button type="button" className={BOUTON} onClick={() => setChoix("reference")} disabled={!!image && refs.length >= image.references_max}>Ajouter une référence pour l’image</button>
          {profilImage && <p className="text-[12px] text-encre-3">Ce workflow demande {profilImage.references_min} référence(s), dans cet ordre.</p>}
          <Parametres options={image?.options || {}} valeurs={demande.options_image || {}} changer={options_image => changer({ options_image })} prefixe="Image" />
          {image && !image.locale && image.unite === "usd" && <label className="flex flex-col gap-[8px] text-[13px]">Réservation pour l’image, en dollars (facultative si un coût est déjà mesuré)<input type="number" min={0} step="0.01" className={CHAMP} value={demande.plafond_image_usd ?? ""} onChange={e => changer({ plafond_image_usd: e.target.value === "" ? null : Number(e.target.value) })} /></label>}
        </div>}
      </fieldset>
      <fieldset disabled={occupe} className={`${SURFACE} space-y-[14px]`}><legend className="font-serif text-[25px]">2. Le clip à fabriquer</legend>
        <label className="flex flex-col gap-[8px] text-[13px]">Mouvement et consignes pour la vidéo<textarea className={`${CHAMP} min-h-[128px]`} value={demande.prompt_video} onChange={e => changer({ prompt_video: e.target.value })} /></label>
        <div className="grid grid-cols-3 gap-[14px]"><label className="flex flex-col gap-[8px] text-[13px]">Durée du clip<select className={CHAMP} value={demande.secondes} onChange={e => changer({ secondes: Number(e.target.value) })}>{uniques([demande.secondes, ...videos.flatMap(m => m.durees)]).sort((a, b) => a - b).map(v => <option key={v} value={v}>{v} s</option>)}</select></label><label className="flex flex-col gap-[8px] text-[13px]">Résolution du clip<select className={CHAMP} value={demande.resolution} onChange={e => changer({ resolution: e.target.value })}>{uniques([demande.resolution, ...videos.flatMap(m => m.resolutions)]).map(v => <option key={v}>{v}</option>)}</select></label><label className="flex flex-col gap-[8px] text-[13px]">Proportions du clip<select className={CHAMP} value={demande.proportions} onChange={e => changer({ proportions: e.target.value })}>{uniques([demande.proportions, ...videos.flatMap(m => m.proportions)]).map(v => <option key={v}>{v}</option>)}</select></label></div>
        {/* **TS17, décision** : ce sélecteur choisit un modèle *vidéo*, pas
         *  un modèle d'image — `habitues` (TS17) ne compte que les
         *  générations d'images (`ServiceGenerations.habitues`, sur la table
         *  `generations` que le port vidéo n'alimente pas, `AGENTS.md`
         *  point 8bis : un appel vidéo se soumet et s'attend, ce n'est pas
         *  un modèle de plus). Le poser sous `ChoixModele` demanderait
         *  d'abord de compter les habitudes vidéo côté serveur — hors
         *  budget de cette tranche. Ce `<select>` reste donc tel quel, avec
         *  son prix par modèle. */}
        <label className="flex flex-col gap-[8px] text-[13px]">{CHAMP_DU_MODELE}<select className={CHAMP} value={demande.modele_video} onChange={e => changer({ modele_video: e.target.value, options_video: defauts(profils.find(p => p.modele === e.target.value)) })}><option value="">{lecture ? "Lecture des modèles…" : "Choisir une méthode compatible"}</option>{videos.map(m => <option key={m.identifiant} value={m.identifiant} disabled={!!m.grise}>{m.identifiant}{m.grise ? ` — ${m.grise}` : m.de_la_maison ? " · calcul local" : ` · ${prix(m.prix.montant)}`}</option>)}</select></label>
        {video?.grise && <p role="status" className="text-[13px] text-echec">{video.grise}</p>}
        {video?.de_la_maison && <p className="text-[12px] text-encre-3">{video.attente ? `Attente mesurée : ${Math.round(video.attente.secondes)} s · ${video.attente.mesure}` : "Aucune durée mesurée pour ces réglages. Le calcul reste local et gratuit."}</p>}
        {video?.de_la_maison && <MemoireLocale etat={moteur} />}
        <Parametres options={video?.options || {}} valeurs={demande.options_video || {}} changer={options_video => changer({ options_video })} prefixe="Vidéo" />
        <p className="text-[12px] text-encre-3">Cette demande fabrique un clip. Le montage choisira les images, leur cadence et leur classement dans un sujet.</p>
      </fieldset>
      <div className="flex items-center gap-[14px]"><button className={BOUTON} disabled={occupe || lecture || !!bloque}>{VERS_LA_RELECTURE}</button>{bloque && <p className="text-[12px] text-encre-3">{bloque}</p>}</div>
    </form> : travail && <div className="space-y-[22px]">
      <section className={`${SURFACE} space-y-[14px]`}><div className="flex justify-between gap-[14px]"><h3 className="font-serif text-[25px]">{ETATS[travail.etat]}</h3><button className={BOUTON} disabled={occupe || travail.etat === "en_cours"} onClick={modifier}>Modifier une nouvelle demande</button></div>
        <p className="text-[13px]">{travail.annonce.appels} génération(s) · réservation estimée : {dollars(travail.annonce.reservation_usd)}</p><p className="text-[12px] text-encre-3">{travail.annonce.limite}</p>
        {travail.envoi_image && <div className="space-y-[14px] rounded-7 border border-trait bg-papier p-[14px]"><h4 className="text-[14px]">Image à fabriquer · {travail.demande.modele_image}</h4><p className="whitespace-pre-wrap text-[13px]">{travail.envoi_image.prompt}</p>{travail.envoi_image.prompt_negatif && <p className="text-[13px]">Éviter : {travail.envoi_image.prompt_negatif}</p>}<p className="text-[12px]">{travail.envoi_image.resolution || "Résolution par défaut"} · {travail.envoi_image.proportions} · réservation {dollars(travail.annonce.image_usd)}</p><Reglages valeurs={travail.envoi_image.options} /><div className="flex flex-wrap gap-[14px]">{travail.references.map((r, i) => <img src={r.url} alt={`Référence envoyée pour l’image ${i + 1}`} key={r.nom} className="damier-papier h-[128px] w-[128px] object-contain" />)}</div></div>}
        <div className="space-y-[14px] rounded-7 border border-trait bg-papier p-[14px]"><h4 className="text-[14px]">Vidéo · {travail.demande.modele_video}</h4><p className="whitespace-pre-wrap text-[13px]">{travail.demande.prompt_video}</p><p className="text-[12px]">Un clip · {travail.demande.secondes} s · {travail.demande.resolution} · {travail.demande.proportions} · {prix(travail.annonce.video.montant)}</p><Reglages valeurs={travail.demande.options_video || {}} />{travail.entree_video ? <img className="damier-papier h-[128px] w-[128px] object-contain" src={travail.entree_video.url} alt="Image exacte envoyée à la vidéo" /> : <p className="text-[13px] text-encre-3">L’image préparée ci-dessus sera fabriquée puis envoyée au modèle vidéo.</p>}{travail.annonce.video_locale && <p className="text-[12px] text-encre-3">{travail.annonce.temps_local ? `Attente mesurée : ${Math.round(travail.annonce.temps_local.secondes)} s · ${travail.annonce.temps_local.mesure}` : "Temps de calcul encore non mesuré pour ce modèle et ces réglages."}</p>}</div>
        {travail.raison && <p role="status" className="text-[13px] text-encre-3">{travail.raison}</p>}
        <div className="flex flex-wrap gap-[8px]">{travail.etat === "prepare" && <button className={BOUTON} disabled={occupe} onClick={() => void agir(() => videoLibre.demarrer(projet, travail.identifiant))}>Lancer cette fabrication vidéo</button>}{["a_reprendre", "a_verifier"].includes(travail.etat) && <button className={BOUTON} disabled={occupe} onClick={() => void agir(() => videoLibre.reprendre(projet, travail.identifiant))}>Reprendre le suivi conservé</button>}<button className={BOUTON} disabled={occupe} onClick={() => void agir(() => videoLibre.lire(projet, travail.identifiant))}>Actualiser le suivi</button></div>
      </section>
      {travail.clip && travail.etat === "termine" && <section className={`${SURFACE} space-y-[14px]`}><h3 className="font-serif text-[25px]">Le clip est dans la galerie</h3><video controls aria-label="Clip produit" src={api.videoDuClip(travail.clip)} className="h-[300px] w-full object-contain" /><button className={BOUTON} onClick={() => onClip(travail.clip!)}>Ouvrir le montage et classer</button></section>}
    </div>}
  </section>
}

function Parametres({ options, valeurs, changer, prefixe }: { options: Record<string, Option>; valeurs: Record<string, unknown>; changer: (v: Record<string, unknown>) => void; prefixe: string }) {
  if (!Object.keys(options).length) return null
  return <div className="grid grid-cols-2 gap-[14px]">{Object.entries(options).map(([n, p]) => <label key={n} className="flex flex-col gap-[8px] text-[13px]">{prefixe} · {p.nom || n}{p.genre === "booleen" ? <input type="checkbox" checked={Boolean(valeurs[n])} onChange={e => changer({ ...valeurs, [n]: e.target.checked })} /> : p.genre === "choix" ? <select className={CHAMP} value={String(valeurs[n] ?? "")} onChange={e => { const v = { ...valeurs }; if (e.target.value) v[n] = e.target.value; else delete v[n]; changer(v) }}><option value="">Défaut du modèle</option>{p.valeurs.map(v => <option key={v}>{v}</option>)}</select> : <input type="number" className={CHAMP} min={p.minimum ?? undefined} max={p.maximum ?? undefined} value={valeurs[n] === undefined ? "" : Number(valeurs[n])} placeholder="Défaut du modèle" onChange={e => { const v = { ...valeurs }; if (e.target.value === "") delete v[n]; else v[n] = Number(e.target.value); changer(v) }} />}</label>)}</div>
}
function Reglages({ valeurs }: { valeurs: Record<string, unknown> }) {
  return <dl className="grid grid-cols-2 gap-[8px] text-[12px]">{Object.entries(valeurs).map(([n, v]) => <div key={n} className="contents"><dt>{n}</dt><dd>{String(v)}</dd></div>)}</dl>
}
