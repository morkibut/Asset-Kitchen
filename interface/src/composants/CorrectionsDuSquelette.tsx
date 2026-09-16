import { lazy, Suspense, useEffect, useState } from "react"
import { sources3d, type Corrections3D } from "../api-3d"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"

const ApercuModele3D = lazy(() => import("./ApercuModele3D"))
const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const forme = (valeur: Corrections3D["corrections"]) => JSON.stringify(Object.fromEntries(Object.entries(valeur).sort().map(([os, axes]) => [os, Object.fromEntries(Object.entries(axes).filter(([, v]) => v !== 0).sort())]).filter(([, axes]) => Object.keys(axes).length)))

/** Corriger le rig externe ne remplace aucune copie déjà importée. La remise
 * à zéro est elle aussi un brouillon jusqu’au bouton Enregistrer. */
export function CorrectionsDuSquelette({ personnage, animation, onChangement, onBloquer }: { personnage: string; animation: string; onChangement?: () => void; onBloquer?: (bloque: boolean) => void }) {
  const [catalogue, setCatalogue] = useState<Corrections3D | null>(null)
  const [valeurs, setValeurs] = useState<Corrections3D["corrections"]>({})
  const [os, setOs] = useState("")
  const [attente, setAttente] = useState(false)
  const [erreur, setErreur] = useState("")
  const [message, setMessage] = useState("")
  const [apercu, setApercu] = useState(false)
  const [revision, setRevision] = useState(0)
  const brouillon = useBrouillonLocal({ cle: `corrections-3d:${catalogue?.adresse}:${personnage}`, pret: !!catalogue, reference: catalogue?.corrections ?? {}, etat: valeurs, appliquer: setValeurs, signature: forme,
    ecran: "Les corrections du squelette", quoi: animation ? `${personnage} · ${animation}` : personnage })
  const modifie = !!catalogue && forme(valeurs) !== forme(catalogue.corrections)
  useEffect(() => {
    let vivant = true
    sources3d.corrections(personnage).then((r) => { if (vivant) { setCatalogue(r); setValeurs(r.corrections); setOs(r.os[0]?.cle || "") } }).catch((e) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de lire les corrections du squelette.") })
    return () => { vivant = false }
  }, [personnage])
  useEffect(() => { onBloquer?.(modifie || attente); return () => onBloquer?.(false) }, [modifie, attente, onBloquer])
  const selection = catalogue?.os.find((o) => o.cle === os)
  const bornes = catalogue?.bornes
  const ajuster = (axe: string, valeur: number) => {
    if (!bornes || !Number.isFinite(valeur)) return
    setMessage("")
    setValeurs((avant) => ({ ...avant, [os]: { ...avant[os], [axe]: Math.min(bornes.maximum, Math.max(bornes.minimum, valeur)) } }))
  }
  const enregistrer = async () => {
    setAttente(true); setErreur(""); setMessage("")
    try {
      const r = await sources3d.poserCorrections(personnage, JSON.parse(forme(valeurs)), animation || undefined)
      setCatalogue(r); setValeurs(r.corrections); brouillon.effacer(); setRevision((v) => v + 1)
      setMessage(r.message || "Corrections enregistrées pour les prochains rendus."); onChangement?.()
    } catch (e) { setErreur(e instanceof Error ? e.message : "L’enregistrement des corrections a échoué. Vos réglages restent ici.") }
    finally { setAttente(false) }
  }
  return <section aria-label="Corrections du squelette" className="rounded-8 border border-trait bg-papier p-[22px]">
    <h3 className="font-serif text-[25px]">Ajuster le squelette</h3>
    <p className="mt-[8px] text-[13px] text-encre-3">Ces rotations corrigent la pose sur les prochains rendus de cette source. Les frames et les modèles déjà conservés dans le jeu gardent leurs corrections d’origine. Gauche et droite désignent celles du personnage.</p>
    {erreur && <p role="alert" className="mt-[14px] text-[13px] text-echec">{erreur}</p>}
    {!catalogue && !erreur && <p role="status" className="mt-[14px] text-[13px]">Lecture des os et des corrections…</p>}
    {catalogue && <><AvisBrouillon brouillon={brouillon} />
      <fieldset disabled={attente} className="mt-[14px] space-y-[14px]">
        <label className="flex flex-col gap-[4px] text-[13px]">Partie du squelette<select aria-label="Os à corriger" className={CHAMP} value={os} onChange={(e) => setOs(e.target.value)}>{catalogue.os.map((o) => <option key={o.cle} value={o.cle}>{o.libelle}{Object.values(valeurs[o.cle] || {}).some((v) => v !== 0) ? " · corrigé" : ""}</option>)}</select></label>
        {selection && <p className="text-[12px] text-encre-3">{selection.aide}</p>}
        {selection?.axes.map((axe) => <div key={axe.nom}><label className="block text-[13px]" htmlFor={`rotation-${personnage}-${axe.nom}`}>{axe.libelle}</label><div className="mt-[4px] flex items-center gap-[14px]"><input className="min-w-0 flex-1 accent-signal" type="range" aria-label={`${axe.libelle} du squelette — curseur`} min={bornes!.minimum} max={bornes!.maximum} step={bornes!.pas} value={valeurs[os]?.[axe.nom] ?? bornes!.defaut} onChange={(e) => ajuster(axe.nom, Number(e.target.value))} /><input id={`rotation-${personnage}-${axe.nom}`} aria-label={`${axe.libelle} du squelette`} className={`${CHAMP} w-[70px]`} type="number" min={bornes!.minimum} max={bornes!.maximum} step={bornes!.pas} value={valeurs[os]?.[axe.nom] ?? bornes!.defaut} onChange={(e) => ajuster(axe.nom, Number(e.target.value))} /><span className="text-[12px] text-encre-3">°</span></div><p className="mt-[4px] text-[12px] text-encre-3">{axe.aide}</p></div>)}
        <div className="flex flex-wrap gap-[8px]"><button className={CHAMP} onClick={() => setValeurs((v) => ({ ...v, [os]: {} }))}>Remettre cet os à zéro</button><button className={CHAMP} onClick={() => setValeurs({})}>Remettre tout à zéro</button><button className={CHAMP} disabled={!modifie} onClick={() => { setValeurs(catalogue.corrections); brouillon.effacer(); setMessage("") }}>Annuler les changements</button></div>
      </fieldset>
      <div className="mt-[22px] flex flex-wrap items-center gap-[14px]"><button className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50" disabled={!modifie || attente} onClick={() => void enregistrer()}>{attente ? "Enregistrement et aperçu…" : "Enregistrer les corrections"}</button><button className={CHAMP} disabled={attente} onClick={() => setApercu((v) => !v)}>{apercu ? "Masquer la vue 3D" : "Voir le squelette animé"}</button></div>
      <p className="mt-[8px] text-[12px] text-encre-3">Enregistrer actualise l’aperçu avec Blender, sans génération IA. {modifie ? "La vue montre encore les corrections enregistrées. Enregistrez ou annulez avant de préparer un rendu." : "Vous pouvez ensuite préparer un rendu pour vérifier les images."}</p>
      {message && <p role="status" className="mt-[14px] text-[13px] text-encre">{message}</p>}
      {apercu && <div className="mt-[22px] flex h-[60vh] min-h-[380px] flex-col"><Suspense fallback={<p role="status">Ouverture de la vue animée…</p>}><ApercuModele3D url={sources3d.rig(personnage, animation, revision)} nom="Squelette avec les corrections enregistrées" /></Suspense></div>}
    </>}
  </section>
}
