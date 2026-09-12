import { lazy, Suspense, useEffect, useState } from "react"
import { Refus, type Personnage } from "../api"
import { sources3d, type Personnage3D, type Rendu3D, type Source3D } from "../api-3d"
import { CadreDialogue } from "./CadreDialogue"
import { Parcours3D } from "./Fabrication3D"

const ApercuModele3D = lazy(() => import("./ApercuModele3D"))

const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const phrase = (e: unknown) => e instanceof Refus ? e.message : "Impossible de relire les sources 3D. Les copies déjà importées restent disponibles."
const CHAMPS: Record<string, string> = { animation: "Animation", angle: "Caméra", style: "Style", moteur_3d: "Modèle", eclairage: "Éclairage", nombre_images: "Frames", taille_images: "Taille", cadrage: "Cadrage", contraste: "Contraste", exposition: "Exposition", saturation: "Saturation" }

export function Sources3D({ personnage, onBande }: { personnage: Personnage; onBande?: (id: string) => void }) {
  const [sources, setSources] = useState<Source3D[]>([])
  const [adresse, setAdresse] = useState("")
  const [bibliotheque, setBibliotheque] = useState<Personnage3D[] | null>(null)
  const [externe, setExterne] = useState("")
  const [rendus, setRendus] = useState<Rendu3D[]>([])
  const [choisi, setChoisi] = useState("")
  const [recherche, setRecherche] = useState("")
  const [pose, setPose] = useState("")
  const [direction, setDirection] = useState("")
  const [nom, setNom] = useState("")
  const [cadence, setCadence] = useState(8)
  const [erreur, setErreur] = useState("")
  const [attente, setAttente] = useState(false)
  const [revision, setRevision] = useState(0)
  const [apercu, setApercu] = useState<{ url: string; nom: string } | null>(null)
  const projet = personnage.projet
  const directions = personnage.cases.find((c) => c.pose === pose)?.directions ?? []
  const rendu = rendus.find((r) => r.identifiant === choisi)
  useEffect(() => {
    let vivant = true
    sources3d.lister(projet, personnage.identifiant).then((r) => { if (vivant) setSources(r.sources) }).catch((e) => { if (vivant) setErreur(phrase(e)) })
    sources3d.connexion().then((r) => { if (vivant) setAdresse(r.adresse) }).catch((e) => { if (vivant) setErreur(phrase(e)) })
    return () => { vivant = false }
  }, [projet, personnage.identifiant, revision])
  useEffect(() => {
    setRendus([]); setChoisi("")
    if (!externe) return
    let vivant = true
    sources3d.rendus(externe).then((r) => { if (vivant) setRendus(r.rendus) }).catch((e) => { if (vivant) setErreur(phrase(e)) })
    return () => { vivant = false }
  }, [externe])
  const connecter = async () => {
    setAttente(true); setErreur("")
    try { await sources3d.configurer(adresse); const r = await sources3d.personnages(); setBibliotheque(r.personnages) }
    catch (e) { setErreur(phrase(e)) }
    finally { setAttente(false) }
  }
  const importer = async () => {
    if (!rendu) return
    setAttente(true); setErreur("")
    try { await sources3d.importer(projet, { personnage_externe: externe, rendu: rendu.identifiant, personnage: personnage.identifiant, pose, direction, nom: nom || `${personnage.nom} · ${pose || "rendu 3D"}`, cadence }); setChoisi(""); setRevision((r) => r + 1) }
    catch (e) { setErreur(phrase(e)) }
    finally { setAttente(false) }
  }
  return <section aria-label="Sources 3D du personnage" className="mt-[22px] rounded-8 border border-trait bg-carte p-[22px]">
    <h2 className="font-serif text-[25px] text-encre">Ses sources 3D</h2>
    <p className="mt-[8px] text-[13px] text-encre-3">Un modèle, son squelette et plusieurs rendus peuvent servir au même personnage. Les copies importées restent utilisables quand asset3d est éteint.</p>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    <div className="mt-[14px] grid grid-cols-2 gap-[14px]">{sources.map((s) => <article key={s.identifiant} className="rounded-7 border border-trait bg-papier p-[14px]">
      <img alt={`Première frame de ${s.nom}`} src={sources3d.fichier(s, "frame-0000.png")} className="damier-papier h-[128px] w-full object-contain" />
      <h3 className="mt-[8px] text-[14px] font-medium">{s.nom}</h3><p className="mt-[4px] text-[12px] text-encre-3">{s.images} frames · {s.largeur} × {s.hauteur} px · {s.cadence} i/s</p>
      <div className="mt-[14px] flex flex-wrap gap-[8px]">{onBande && s.bandes.map((b) => <button key={b} className={CHAMP} onClick={() => onBande(b)}>Retoucher l’animation</button>)}{("rig.glb" in s.fichiers || "modele.glb" in s.fichiers) && <button className={CHAMP} onClick={() => setApercu({ url: sources3d.fichier(s, "rig.glb" in s.fichiers ? "rig.glb" : "modele.glb"), nom: s.nom })}>Inspecter en 3D</button>}{["modele.glb", "rig.glb"].filter((n) => n in s.fichiers).map((n) => <a key={n} className={`${CHAMP} inline-flex items-center`} href={sources3d.fichier(s, n)} download>{n === "modele.glb" ? "Modèle 3D" : "Modèle animé"}</a>)}</div>
      {"rig.glb" in s.fichiers && <p className="mt-[8px] text-[12px] text-encre-3">{s.provenance.rig_origine === "copie_du_travail" ? "Modèle animé conservé avec les corrections exactes de ce travail." : "Modèle animé copié avec les corrections présentes chez asset3d à l’import. Les frames conservent leur rendu d’origine."}</p>}
      {s.provenance.camera && <p className="mt-[8px] text-[12px] text-encre-3">Caméra du rendu · azimut {s.provenance.camera.azimut}° · élévation {s.provenance.camera.elevation}°</p>}
      {s.provenance.plage && <p className="mt-[4px] text-[12px] text-encre-3">Portion du mouvement : {s.provenance.plage.debut} à {s.provenance.plage.fin} %</p>}
      <details className="mt-[14px] text-[12px] text-encre-3"><summary className="cursor-pointer">Réglages de ce rendu conservé</summary><dl className="mt-[8px] space-y-[4px]">{Object.entries(s.provenance.reglages).map(([k, v]) => <div key={k} className="flex justify-between gap-[14px]"><dt>{CHAMPS[k] || k}</dt><dd>{String(v)}</dd></div>)}</dl></details>
    </article>)}</div>
    {!sources.length && <p className="mt-[14px] text-[13px] text-encre-3">Aucune source 3D importée pour ce personnage.</p>}
    {apercu && <CadreDialogue titre={`Inspecter ${apercu.nom}`} onFermer={() => setApercu(null)} enfants={<div className="flex min-h-0 flex-1 flex-col gap-[14px] p-[22px]"><header className="flex items-center justify-between gap-[22px]"><div><h2 className="font-serif text-[25px]">{apercu.nom}</h2><p className="text-[13px] text-encre-3">Copie locale · vue 3D et animations du fichier</p></div><button className={CHAMP} onClick={() => setApercu(null)}>Fermer l’aperçu 3D</button></header><Suspense fallback={<p role="status">Chargement de la vue 3D…</p>}><ApercuModele3D url={apercu.url} nom={apercu.nom} /></Suspense></div>} />}
    <details className="mt-[22px]" open={!sources.length}><summary className="cursor-pointer text-[14px] text-encre">Importer un rendu existant depuis asset3d</summary>
      <p className="mt-[8px] text-[12px] text-encre-3">Renseignez le serveur déjà lancé. Consulter et importer ne lance ni génération, ni installation.</p>
      <div className="mt-[14px] flex items-end gap-[14px]"><label className="flex min-w-0 flex-1 flex-col gap-[4px] text-[12px]">Adresse locale d’asset3d<input aria-label="Adresse d’asset3d" placeholder="http://127.0.0.1:8000" className={CHAMP} value={adresse} onChange={(e) => setAdresse(e.target.value)} /></label><button className={CHAMP} disabled={!adresse.trim() || attente} onClick={() => void connecter()}>Consulter asset3d</button></div>
      {bibliotheque && <><label className="mt-[14px] flex flex-col gap-[4px] text-[12px]">Rechercher une source<input type="search" aria-label="Rechercher dans asset3d" className={CHAMP} value={recherche} onChange={(e) => setRecherche(e.target.value)} /></label><div className="mt-[14px] flex flex-wrap gap-[14px]">{bibliotheque.filter((p) => p.identifiant.toLocaleLowerCase("fr").includes(recherche.toLocaleLowerCase("fr"))).map((p) => <button key={p.identifiant} aria-pressed={externe === p.identifiant} className="w-[128px] rounded-7 border border-trait p-[8px] text-left aria-pressed:border-signal" onClick={() => setExterne(p.identifiant)}><img alt="" src={sources3d.photo(p.identifiant)} className="h-[128px] w-full object-contain" /><span className="mt-[4px] block break-words text-[12px]">{p.identifiant}</span>{p.indisponible_parce_que && <span className="mt-[4px] block text-[11px] text-encre-3">{p.indisponible_parce_que}</span>}</button>)}</div>{!bibliotheque.length && <p className="mt-[14px] text-[13px]">La bibliothèque d’asset3d est vide.</p>}</>}
      {externe && <div className="mt-[14px] flex flex-col gap-[8px]">{rendus.map((r) => <button key={r.identifiant} aria-pressed={choisi === r.identifiant} disabled={r.actif || !r.images.length} className={`${CHAMP} h-auto py-[8px] text-left aria-pressed:border-signal`} onClick={() => { setChoisi(r.identifiant); setNom(`${personnage.nom} · ${r.reglages.animation || "rendu 3D"}`) }}>{String(r.reglages.animation || r.identifiant)} · {String(r.reglages.angle || "vue libre")} · {String(r.reglages.style || "style d’origine")} · {r.images.length} frames {r.actif ? "· en cours" : ""}</button>)}{!rendus.length && <p className="text-[13px] text-encre-3">Aucun rendu disponible pour cette source.</p>}</div>}
      {rendu && <div className="mt-[22px] rounded-7 border border-trait bg-papier p-[14px]">
        <h3 className="text-[14px] font-medium">Ranger ce rendu dans le jeu</h3><p className="mt-[4px] text-[12px] text-encre-3">Les frames sont copiées avec leur transparence et leur cadre commun. Le rendu original reste chez asset3d.</p>
        <label className="mt-[14px] flex flex-col gap-[4px] text-[12px]">Nom de l’animation<input aria-label="Nom du rendu importé" className={CHAMP} value={nom} onChange={(e) => setNom(e.target.value)} /></label>
        <div className="mt-[14px] flex flex-wrap items-end gap-[14px]"><label className="flex flex-col gap-[4px] text-[12px]">Mouvement<select aria-label="Mouvement du rendu 3D" className={CHAMP} value={pose} onChange={(e) => { setPose(e.target.value); setDirection(personnage.cases.find((c) => c.pose === e.target.value)?.directions[0]?.identifiant ?? "") }}><option value="">À classer</option>{personnage.plan.filter((p) => !personnage.ecartees.includes(p.identifiant)).map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label>
          {!!directions.length && <label className="flex flex-col gap-[4px] text-[12px]">Direction<select aria-label="Direction du rendu 3D" className={CHAMP} value={direction} onChange={(e) => setDirection(e.target.value)}>{directions.map((d) => <option key={d.identifiant} value={d.identifiant}>{d.nom}</option>)}</select></label>}
          <label className="flex flex-col gap-[4px] text-[12px]">Images par seconde<input type="number" aria-label="Cadence du rendu importé" min={1} max={120} className={`${CHAMP} w-[128px]`} value={cadence} onChange={(e) => setCadence(Number(e.target.value))} /></label>
          <button className={CHAMP} disabled={attente || !nom.trim() || cadence <= 0} onClick={() => void importer()}>{attente ? "Copie des fichiers…" : "Importer et créer l’animation"}</button>
        </div>
      </div>}
    </details>
    <Parcours3D personnage={personnage} onBande={onBande} />
  </section>
}
