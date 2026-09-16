import { lazy, Suspense, useEffect, useState } from "react"
import { api, type Personnage } from "../api"
import { CHAMP_DU_MODELE, VERS_LA_RELECTURE } from "../fabrication"
import { sources3d, type Catalogue3D, type Demande3D, type Personnage3D, type Travail3D } from "../api-3d"
import { travaux } from "../api-travaux"
import { BibliothequePourImage } from "./BibliothequePourImage"
import { CadreDialogue } from "./CadreDialogue"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"
import { CorrectionsDuSquelette } from "./CorrectionsDuSquelette"
import { CameraDeRendu3D } from "./CameraDeRendu3D"

const ApercuModele3D = lazy(() => import("./ApercuModele3D"))
const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const ETAPES = { modele_3d: "Créer le modèle 3D", rig: "Poser le squelette et son mouvement", rendu: "Produire les frames" }
const ETATS = { prepare: "À relire", en_cours: "En cours", a_reprendre: "À reprendre", a_verifier: "À vérifier", externe_inconnu: "Acceptation à retrouver", termine: "Étape terminée", annule: "Annulée" }
const raison = (e: unknown) => e instanceof Error ? e.message : "La fabrication 3D ne répond pas. Les résultats déjà copiés sont conservés."

export function SuiviFabrication3D({ initiale, onFermer, onSuite, onBande }: { initiale: Travail3D; onFermer: () => void; onSuite?: (t: Travail3D) => void; onBande?: (id: string) => void }) {
  const [t, setT] = useState(initiale)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [inspecter, setInspecter] = useState(false)
  const agir = async (action: () => Promise<Travail3D>) => {
    setOccupe(true); setErreur("")
    try { setT(await action()) } catch (e) { setErreur(raison(e)) } finally { setOccupe(false) }
  }
  useEffect(() => {
    if (t.etat !== "en_cours") return
    const intervalle = window.setInterval(() => void sources3d.travail(t.projet, t.identifiant).then(setT).catch((e) => setErreur(raison(e))), 2000)
    return () => window.clearInterval(intervalle)
  }, [t.etat, t.identifiant, t.projet])
  const fichier = "rig.glb" in t.fichiers_3d ? "rig.glb" : "modele.glb" in t.fichiers_3d ? "modele.glb" : null
  return <CadreDialogue titre={ETAPES[t.etape]} onFermer={onFermer} enfants={<>
    <header className="flex shrink-0 items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]"><div><h1 className="font-serif text-[38px]">{ETAPES[t.etape]}</h1><p className="mt-[8px] text-[13px] text-encre-3">{t.demande.nom || t.demande.personnage || "Source 3D"} · {ETATS[t.etat]}</p></div><button className={CHAMP} onClick={onFermer}>Fermer</button></header>
    <div className="defile min-h-0 flex-1 space-y-[22px] overflow-y-auto p-[30px]">
      {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}{t.raison && <p role="status" className="text-[13px] text-encre-3">{t.raison}</p>}
      <section className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Une seule étape sera exécutée</h2><p className="mt-[8px] text-[13px]">{t.modele} · moteur local · aucun coût fournisseur en argent</p><p className="mt-[8px] text-[12px] text-encre-3">{t.annonce.limite}</p>{t.annonce.mesures.length ? t.annonce.mesures.map((m, i) => <p key={i} className="mt-[8px] text-[13px]">{Math.round(m.mediane_s)} s mesurées · {m.temperature === "froid" ? "chargement inclus" : m.temperature === "chaud" ? "modèle déjà chargé" : "chargement non identifié"} · {m.mesures} essais</p>) : <p className="mt-[8px] text-[13px]">Durée encore inconnue pour cette méthode sur cette machine.</p>}{t.apercu_3d.prerequis.poids_verifies === false && <p className="mt-[8px] text-[12px] text-encre-3">Les fichiers d’exécution ont été vérifiés. Le moteur confirmera ses poids locaux à l’ouverture ; aucun téléchargement n’est demandé.</p>}</section>
      {!!t.references.length && <section><h2 className="font-serif text-[25px]">Image exacte envoyée</h2>{t.references.map((r) => <img key={r.empreinte} src={r.url} alt="Référence du modèle 3D" className="damier-papier mt-[14px] h-[300px] max-w-full object-contain" />)}</section>}
      {t.apercu_3d.sortie && <section className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Cadre et caméra conservés</h2><p className="mt-[8px] text-[13px]">{t.apercu_3d.sortie.largeur} × {t.apercu_3d.sortie.hauteur} px · transparent · cadre commun à toute l’animation</p>{t.apercu_3d.camera && <p className="mt-[8px] text-[13px]">Azimut {t.apercu_3d.camera.azimut}° · élévation {t.apercu_3d.camera.elevation}°</p>}{t.apercu_3d.plage && <p className="mt-[8px] text-[13px]">{t.apercu_3d.plage.debut === t.apercu_3d.plage.fin ? `Pose à ${t.apercu_3d.plage.debut} % du mouvement` : `Mouvement de ${t.apercu_3d.plage.debut} à ${t.apercu_3d.plage.fin} %`}</p>}<p className="mt-[8px] text-[12px] text-encre-3">{Object.keys(t.apercu_3d.corrections || {}).length} os corrigés · corrections figées lors de cette relecture</p></section>}
      <section className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Réglages conservés</h2><dl className="mt-[14px] grid grid-cols-2 gap-[8px] text-[13px]">{Object.entries(t.apercu_3d.reglages).filter(([k]) => !t.apercu_3d.parametres_actifs || t.apercu_3d.parametres_actifs.includes(k)).map(([k, v]) => <div key={k} className="flex justify-between gap-[14px] border-b border-trait-faible py-[8px]"><dt>{k.replaceAll("_", " ")}</dt><dd>{String(v)}</dd></div>)}</dl></section>
      {fichier && <section className="rounded-8 border border-trait bg-carte p-[22px]"><h2 className="font-serif text-[25px]">Résultat conservé dans l’atelier</h2><div className="mt-[14px] flex gap-[8px]"><button className={CHAMP} onClick={() => setInspecter(true)}>Inspecter en 3D</button>{Object.keys(t.fichiers_3d).map((f) => <a key={f} href={sources3d.fichierTravail(t, f)} download className={`${CHAMP} inline-flex items-center`}>Télécharger {f === "rig.glb" ? "le modèle animé" : "le modèle"}</a>)}</div></section>}
      {t.bandes.map((id) => onBande && <button key={id} className={CHAMP} onClick={() => onBande(id)}>Retoucher l’animation obtenue</button>)}
      {t.consommations.map((c, i) => <p key={i} className="text-[12px] text-encre-3">{Math.round(c.consomme)} {c.unite} mesurées · {c.modele}</p>)}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[14px] border-t border-trait bg-carte px-[30px] py-[14px]"><p className="text-[12px] text-encre-3">Fermer conserve l’étape. Le squelette et les rendus suivants partent sur demande.</p><div className="flex shrink-0 gap-[8px]">{t.etat === "externe_inconnu" ? <button className={CHAMP} disabled={occupe} onClick={() => void agir(() => sources3d.reconcilier(t))}>Retrouver l’envoi</button> : ["prepare", "a_reprendre", "a_verifier"].includes(t.etat) && <button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50" disabled={occupe} onClick={() => void agir(() => sources3d.lancer(t))}>{t.etat === "prepare" ? "Lancer cette étape locale" : "Reprendre cette étape"}</button>}{t.etat === "termine" && onSuite && <button className={CHAMP} onClick={() => onSuite(t)}>{t.etape === "modele_3d" ? "Préparer le squelette" : "Préparer un rendu"}</button>}</div></footer>
    {inspecter && fichier && <CadreDialogue titre="Inspecter le résultat 3D" onFermer={() => setInspecter(false)} enfants={<div className="flex min-h-0 flex-1 flex-col gap-[14px] p-[22px]"><button className={`${CHAMP} self-end`} onClick={() => setInspecter(false)}>Revenir à l’étape</button><Suspense fallback={<p>Ouverture du modèle…</p>}><ApercuModele3D url={sources3d.fichierTravail(t, fichier)} nom={t.demande.nom || ETAPES[t.etape]} /></Suspense></div>} />}
  </>} />
}

export function Parcours3D({ personnage, onBande, autonome = true }: {
  personnage: Personnage; onBande?: (id: string) => void
  /** **Sa propre section, ou le corps de la fenêtre unique** (RP4). Dans la
   *  fenêtre unique, le titre est celui de la fenêtre et le parcours s'ouvre
   *  tout seul : on a déjà dit qu'on préparait un rendu 3D en le choisissant. */
  autonome?: boolean
}) {
  const [catalogue, setCatalogue] = useState<Catalogue3D | null>(null)
  const [externes, setExternes] = useState<Personnage3D[]>([])
  const [liste, setListe] = useState<Travail3D[]>([])
  const [depart] = useState<Demande3D>({ cle: crypto.randomUUID(), etape: "modele_3d", personnage: personnage.identifiant, cadence: 8, reglages: {} })
  const [d, setD] = useState<Demande3D>(depart)
  const [ouvert, setOuvert] = useState(false)
  const [choix, setChoix] = useState(false)
  const [travail, setTravail] = useState<Travail3D | null>(null)
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [corriger, setCorriger] = useState(false)
  const [correctionsEnCours, setCorrectionsEnCours] = useState(false)
  const relire = () => travaux.lister(personnage.projet).then((ts) => setListe(ts.filter((t): t is Travail3D => t.nature === "3d" && t.demande.personnage === personnage.identifiant)))
  const brouillon = useBrouillonLocal({ cle: `3d:${personnage.projet}:${personnage.identifiant}`, pret: true, reference: depart, etat: d, appliquer: setD, signature: ({ cle: _cle, ...champs }) => JSON.stringify(champs),
    ecran: "Une source 3D", quoi: personnage.nom })
  useEffect(() => { void relire().catch((e) => setErreur(raison(e))) }, [personnage.projet, personnage.identifiant])
  // Dans la fenêtre unique, le parcours est déjà demandé : on ne fait pas
  // cliquer une seconde fois sur *Préparer une étape 3D* (RP4).
  useEffect(() => { if (!autonome && !ouvert) void consulter() }, [autonome])
  const consulter = async () => {
    setOuvert(true); setOccupe(true); setErreur("")
    try { const [c, p] = await Promise.all([sources3d.catalogue(), sources3d.personnages()]); setCatalogue(c); setExternes(p.personnages) } catch (e) { setErreur(raison(e)) } finally { setOccupe(false) }
  }
  const preparer = async () => {
    setOccupe(true); setErreur("")
    try { setTravail(await sources3d.preparer(personnage.projet, d)); brouillon.effacer(); await relire() } catch (e) { setErreur(raison(e)) } finally { setOccupe(false) }
  }
  const changer = (valeurs: Partial<Demande3D>) => setD((avant) => ({ ...avant, ...valeurs, ...(valeurs.etape && valeurs.etape !== "rendu" ? { camera: undefined, plage: undefined } : {}), cle: crypto.randomUUID() }))
  const param = (cle: string, valeur: string | number | boolean) => changer({ reglages: { ...d.reglages, [cle]: valeur } })
  const choisir = (nom: string, cle: string, valeurs: { valeur: string; libelle: string }[], defaut: string) => cle === "angle" && d.camera ? <p className="text-[13px] text-encre-3">Caméra libre : {d.camera.azimut}° / {d.camera.elevation}°</p> : <label className="flex min-w-0 flex-col gap-[4px] text-[13px]">{nom}<select aria-label={nom} className={CHAMP} value={String(d.reglages[cle] ?? defaut)} onChange={(e) => param(cle, e.target.value)}>{valeurs.map((v) => <option key={v.valeur} value={v.valeur}>{v.libelle}</option>)}</select></label>
  return <section className="mt-[22px] rounded-8 border border-trait bg-carte p-[22px]" aria-label="Fabriquer en 3D"><header className="flex items-center justify-between gap-[14px]"><div>{autonome && <h2 className="font-serif text-[25px]">De l’image aux sprites en 3D</h2>}<p className="mt-[8px] text-[13px] text-encre-3">Une image de référence → un modèle → son squelette et son mouvement → les frames. Chaque étape se relit séparément.</p></div>{autonome && <button className={CHAMP} onClick={() => void consulter()}>Préparer une étape 3D</button>}</header>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    {liste.map((t) => <button key={t.identifiant} className="mt-[14px] flex w-full items-center justify-between gap-[14px] rounded-7 border border-trait p-[14px] text-left text-[13px]" onClick={() => setTravail(t)}><span>{ETAPES[t.etape]} · {t.demande.nom || t.modele}</span><span>{ETATS[t.etat]}</span></button>)}
    {ouvert && <div className="mt-[22px] space-y-[14px]"><AvisBrouillon brouillon={brouillon} /><label className="flex flex-col gap-[4px] text-[13px]">Étape<select aria-label="Étape 3D à préparer" className={CHAMP} value={d.etape} onChange={(e) => changer({ etape: e.target.value as Demande3D["etape"], reglages: {} })}>{Object.entries(ETAPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {d.etape === "modele_3d" ? <><p className="text-[13px] text-encre-3">Choisissez une référence avec le corps entier et les membres dégagés. Pour partir d’un texte, fabriquez d’abord cette image dans l’atelier.</p><button className={CHAMP} onClick={() => setChoix(true)}>{d.reference_asset ? "Changer l’image de départ" : "Choisir l’image de départ"}</button>{d.reference_asset && <img src={api.fichier(d.reference_asset)} alt="Image de départ choisie" className="damier-papier h-[128px] max-w-full object-contain" />}</> : <label className="flex flex-col gap-[4px] text-[13px]">Source 3D existante<select aria-label="Source 3D à réutiliser" className={CHAMP} value={d.personnage_externe || ""} onChange={(e) => changer({ personnage_externe: e.target.value })}><option value="">Choisir un modèle…</option>{externes.map((p) => <option key={p.identifiant} value={p.identifiant} disabled={!p.complet}>{p.identifiant}{p.indisponible_parce_que ? ` · ${p.indisponible_parce_que}` : ""}</option>)}</select></label>}
      {catalogue && <div className="grid grid-cols-2 gap-[14px]">{d.etape === "modele_3d" ? choisir(CHAMP_DU_MODELE, "moteur_3d", catalogue.moteurs_3d, catalogue.moteur_3d_defaut) : choisir("Mouvement 3D", "animation", catalogue.animations.map((v) => ({ valeur: v, libelle: v })), catalogue.defaut)}{d.etape === "rendu" && <>{choisir("Angle de caméra", "angle", catalogue.angles, catalogue.angle_defaut)}{choisir("Style du rendu", "style", catalogue.styles, catalogue.style_defaut)}{choisir("Éclairage", "eclairage", catalogue.eclairages, catalogue.eclairage_defaut)}</>}{catalogue.bornes.filter((b) => (d.etape === "modele_3d" ? ["normal_res", "ao_res", "ao_samples", "steps_forme"] : d.etape === "rendu" ? ["nombre_images", "contraste", "exposition", "saturation", "taille_images", "cadrage"] : []).includes(b.nom)).filter((b) => !(b.nom === "nombre_images" && d.plage && d.plage.debut === d.plage.fin)).map((b) => <label key={b.nom} className="flex flex-col gap-[4px] text-[13px]">{b.libelle}<input aria-label={b.libelle} type="number" className={CHAMP} min={b.minimum} max={b.maximum} step={b.pas} value={Number(d.reglages[b.nom] ?? b.defaut)} onChange={(e) => param(b.nom, Number(e.target.value))} /><small className="text-[12px] text-encre-3">{b.aide}</small></label>)}</div>}
      {d.etape === "rendu" && <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[4px] text-[13px]">Mouvement dans le jeu<select aria-label="Mouvement des sprites 3D" className={CHAMP} value={d.pose || ""} onChange={(e) => changer({ pose: e.target.value, direction: personnage.cases.find((c) => c.pose === e.target.value)?.directions[0]?.identifiant || "" })}><option value="">À classer</option>{personnage.plan.map((p) => <option key={p.identifiant} value={p.identifiant}>{p.nom}</option>)}</select></label><label className="flex flex-col gap-[4px] text-[13px]">Direction dans le jeu<select aria-label="Direction des sprites 3D" className={CHAMP} value={d.direction || ""} onChange={(e) => changer({ direction: e.target.value })}><option value="">Sans direction</option>{personnage.cases.find((c) => c.pose === d.pose)?.directions.map((v) => <option key={v.identifiant} value={v.identifiant}>{v.nom}</option>)}</select></label><label className="flex flex-col gap-[4px] text-[13px]">Cadence de l’animation<input aria-label="Cadence des sprites 3D" type="number" min={1} max={120} className={CHAMP} value={d.cadence} onChange={(e) => changer({ cadence: Number(e.target.value) })} /></label></div>}
      {catalogue && d.etape !== "modele_3d" && d.personnage_externe && <><button className={CHAMP} onClick={() => setCorriger((v) => !v)}>{corriger ? "Refermer les corrections" : "Inspecter et corriger le squelette"}</button>{corriger && <CorrectionsDuSquelette key={`${d.personnage_externe}:${d.reglages.animation || catalogue.defaut}`} personnage={d.personnage_externe} animation={String(d.reglages.animation || catalogue.defaut)} onBloquer={setCorrectionsEnCours} onChangement={() => changer({})} />}</>}
      {catalogue && d.etape === "rendu" && <CameraDeRendu3D catalogue={catalogue} demande={d} onChanger={changer} />}
      <button className={CHAMP} disabled={occupe || correctionsEnCours || !catalogue || (d.etape === "modele_3d" ? !d.reference_asset : !d.personnage_externe)} onClick={() => void preparer()}>{VERS_LA_RELECTURE}</button>
    </div>}
    {choix && <CadreDialogue titre="Image de départ du modèle 3D" onFermer={() => setChoix(false)} enfants={<BibliothequePourImage retour="Fabriquer en 3D" onChoisir={(a) => { changer({ reference_asset: a.identifiant, personnage_externe: undefined }); setChoix(false) }} onFermer={() => setChoix(false)} />} />}
    {travail && <SuiviFabrication3D initiale={travail} onFermer={() => { setTravail(null); void relire() }} onBande={onBande} onSuite={(t) => { changer({ etape: t.etape === "modele_3d" ? "rig" : "rendu", personnage_externe: t.resultat_3d?.personnage, reglages: {} }); setTravail(null); void consulter() }} />}
  </section>
}
