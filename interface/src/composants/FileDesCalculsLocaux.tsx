import { useEffect, useState } from "react"
import { Refus } from "../api"
import { fileLocale, type EtapeLocale, type FileLocale, type MoteurLocal } from "../api-file-locale"
import { nomDuModele } from "./Fiche"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const ETATS: Record<EtapeLocale["etat"], string> = { en_attente: "En attente", en_cours: "Calcul en cours", a_reprendre: "Suivi à reprendre", externe_inconnu: "Envoi à vérifier", termine: "Terminé", echoue: "Échec", annule: "Annulé" }
const NATURES: Record<EtapeLocale["nature"], string> = { image: "Image", video: "Vidéo", modele3d: "Modèle 3D", rig: "Rigging", rendu3d: "Rendu 3D", audio: "Son" }
const MOTEURS = { disponible: "Disponible", occupe: "Occupé", inconnu: "État inconnu" }
const TEMPERATURE = { froid: "avec chargement du modèle", chaud: "modèle déjà chargé", inconnue: "chargement non connu" }
const duree = (s: number) => s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
const fini = (e: EtapeLocale) => ["termine", "echoue", "annule"].includes(e.etat)

/** Le rafraîchissement observe uniquement. Reprendre reste un geste explicite,
 * y compris après fermeture du navigateur ou interruption du serveur. */
export function FileDesCalculsLocaux({ projet }: { projet: string | null }) {
  const [file, setFile] = useState<FileLocale | null>(null)
  const [moteurs, setMoteurs] = useState<MoteurLocal[]>([])
  const [erreur, setErreur] = useState("")
  const [diagnosticErreur, setDiagnosticErreur] = useState("")
  const [occupe, setOccupe] = useState<string | null>(null)
  const [historique, setHistorique] = useState(false)
  const [autresJeux, setAutresJeux] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let vivant = true
    let minuteur: ReturnType<typeof setTimeout>
    const lire = async () => {
      try { const r = await fileLocale.lire(); if (vivant) { setFile(r); setErreur("") } }
      catch (e) { if (vivant) setErreur(e instanceof Refus ? e.message : "Le suivi local ne répond pas. Les calculs peuvent encore tourner.") }
      if (vivant) minuteur = setTimeout(() => { void lire() }, 5000)
    }
    void lire()
    return () => { vivant = false; clearTimeout(minuteur) }
  }, [revision])
  useEffect(() => {
    let vivant = true
    setDiagnosticErreur("")
    fileLocale.moteurs().then((r) => { if (vivant) setMoteurs(r.moteurs) }).catch(() => { if (vivant) setDiagnosticErreur("Les moteurs ne peuvent pas être observés pour le moment.") })
    return () => { vivant = false }
  }, [revision])
  const agir = async (e: EtapeLocale, annuler: boolean) => {
    setOccupe(e.identifiant); setErreur("")
    try { await (annuler ? fileLocale.annuler(e.identifiant) : fileLocale.reprendre(e.identifiant)); setRevision((r) => r + 1) }
    catch (e) { setErreur(e instanceof Refus ? e.message : "Le geste n’a pas abouti. Relis le suivi avant de réessayer.") }
    finally { setOccupe(null) }
  }
  const visibles = file?.etapes.filter((e) => (autresJeux || e.projet === projet || e.projet === null) && (historique || !fini(e))) ?? []
  const ailleurs = file?.etapes.filter((e) => e.projet !== projet && e.projet !== null && !fini(e)).length ?? 0
  return <section aria-label="File des calculs locaux" className="rounded-8 border border-trait bg-carte p-[22px]">
    <header className="flex flex-wrap items-center justify-between gap-[14px]">
      <div><h2 className="font-serif text-[25px]">Les calculs locaux</h2><p className="mt-[4px] text-[13px] text-encre-3">Images, vidéos et 3D partagent la carte graphique.</p></div>
      <button className={BOUTON} onClick={() => setRevision((r) => r + 1)}>Actualiser les moteurs</button>
    </header>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    {diagnosticErreur && <p role="status" className="mt-[14px] text-[13px] text-encre-3">{diagnosticErreur}</p>}
    <div className="my-[14px] flex flex-wrap gap-[14px]">{moteurs.map((m) => <div key={m.identifiant} className="min-w-0 flex-1 rounded-7 border border-trait bg-papier p-[14px]">
      <p className="text-[13px] text-encre"><strong>{m.nom}</strong> · {MOTEURS[m.etat]}</p>
      <p className="mt-[4px] text-[12px] text-encre-3">{m.raison || (m.etat === "occupe" ? `${m.travaux.length} travail(s) observé(s)` : "Observation du moteur externe")}</p>
      <p className="mt-[4px] text-[11px] text-encre-3">Vérifié à {new Date(m.observe_le * 1000).toLocaleTimeString("fr-FR")}</p>
    </div>)}</div>
    <div className="mb-[14px] flex flex-wrap items-center gap-[22px] text-[13px]">
      <label className="flex items-center gap-[8px]"><input type="checkbox" checked={historique} onChange={(e) => setHistorique(e.target.checked)} />Afficher les calculs terminés</label>
      <label className="flex items-center gap-[8px]"><input type="checkbox" checked={autresJeux} onChange={(e) => setAutresJeux(e.target.checked)} />Tous les jeux{ailleurs > 0 ? ` · ${ailleurs} calcul(s) ailleurs` : ""}</label>
    </div>
    {!file && !erreur && <p role="status" className="text-[13px] text-encre-3">Lecture de la file…</p>}
    {file && !visibles.length && <p className="text-[13px] text-encre-3">Aucun calcul local {historique ? "conservé" : "en attente ou en cours"} pour ce jeu.</p>}
    <ol className="divide-y divide-trait">{visibles.map((e) => <li key={e.identifiant} className="flex flex-wrap items-start gap-[14px] py-[14px]">
      <div className="min-w-0 flex-1"><p className="text-[13px]"><strong>{NATURES[e.nature]}</strong> · {nomDuModele(e.modele)} · {ETATS[e.etat]}</p>
        <p className="mt-[4px] text-[12px] text-encre-3">{e.acteur === "agent" ? "Demandé par l’agent" : "Création manuelle"}{e.projet !== projet ? ` · ${e.projet || "sans jeu"}` : ""} · {new Date(e.cree_le * 1000).toLocaleString("fr-FR")}</p>
        <p className="mt-[8px] text-[13px] text-encre-2">{e.raison}</p>
        {e.travail_externe && <p className="mt-[4px] text-[11px] text-encre-3">En cours sur ta carte graphique.</p>}
        {e.duree_s !== null && <p className="mt-[4px] text-[12px] text-encre-3">Temps mesuré : {duree(e.duree_s)} · {TEMPERATURE[e.temperature]}</p>}
        {e.etat === "externe_inconnu" && <p className="mt-[4px] text-[12px] text-encre-3">Vérifie le travail dans le moteur. Cette demande reste réservée pour éviter un second envoi.</p>}
      </div>
      {e.etat === "a_reprendre" && <button disabled={occupe !== null} className={BOUTON} onClick={() => void agir(e, false)}>Reprendre le suivi</button>}
      {e.etat === "en_attente" && !e.soumission_engagee && <button disabled={occupe !== null} className={BOUTON} onClick={() => void agir(e, true)}>Annuler cette attente</button>}
    </li>)}</ol>
    {!!file?.mesures.length && <details className="mt-[14px] text-[12px] text-encre-3"><summary className="cursor-pointer">Les durées mesurées sur cette machine</summary><ul className="mt-[8px] space-y-[4px]">{file.mesures.map((m) => <li key={`${m.moteur}:${m.modele}:${m.temperature}`}>{nomDuModele(m.modele)} · {duree(m.mediane_s)} · {TEMPERATURE[m.temperature]} · {m.mesures} mesure(s)</li>)}</ul><p className="mt-[8px]">Ces durées décrivent les calculs terminés. Le chargement du modèle peut changer entre deux générations.</p></details>}
    <p className="mt-[14px] text-[12px] text-encre-3">{file?.regle || "L’état inconnu d’un moteur reste à vérifier. La file n’arrête jamais les calculs lancés par une autre application."}</p>
  </section>
}
