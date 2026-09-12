import { lazy, Suspense, useState } from "react"
import { sources3d, type Camera3D, type Catalogue3D, type Demande3D } from "../api-3d"
const ApercuModele3D = lazy(() => import("./ApercuModele3D"))
const CHAMP = "h-[34px] min-w-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"

export function CameraDeRendu3D({ catalogue, demande, onChanger }: { catalogue: Catalogue3D; demande: Demande3D; onChanger: (champs: Partial<Demande3D>) => void }) {
  const [inspecter, setInspecter] = useState(false)
  const angle = catalogue.angles.find((v) => v.valeur === (demande.reglages.angle || catalogue.angle_defaut))
  const camera = demande.camera || { azimut: angle?.azimut ?? 0, elevation: angle?.elevation ?? 0 }
  const cadrer = (cle: keyof Camera3D, valeur: number) => {
    if (!Number.isFinite(valeur)) return
    const bornes = catalogue.camera_libre![cle]
    onChanger({ camera: { ...camera, [cle]: Math.min(bornes.maximum, Math.max(bornes.minimum, valeur)) } })
  }
  const plage = demande.plage
  const pose = !!plage && plage.debut === plage.fin
  const plageChanger = (cle: "debut" | "fin", valeur: number) => {
    if (!Number.isFinite(valeur)) return
    const v = Math.min(100, Math.max(0, valeur))
    onChanger({ plage: pose ? { debut: v, fin: v } : { debut: cle === "debut" ? Math.min(v, plage?.fin ?? 100) : plage?.debut ?? 0, fin: cle === "fin" ? Math.max(v, plage?.debut ?? 0) : plage?.fin ?? 100 } })
  }
  return <section aria-label="Caméra et frames à produire" className="space-y-[14px] rounded-8 border border-trait bg-papier p-[22px]">
    <h3 className="font-serif text-[25px]">Caméra et portion du mouvement</h3>
    {catalogue.camera_libre ? <><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={!!demande.camera} onChange={(e) => onChanger({ camera: e.target.checked ? camera : undefined })} />Choisir un angle libre</label>
      {demande.camera && <div className="grid grid-cols-2 gap-[22px]">{(["azimut", "elevation"] as const).map((cle) => <label key={cle} className="flex flex-col gap-[4px] text-[13px]">{cle === "azimut" ? "Tour autour du personnage" : "Hauteur de la caméra"}<div className="flex items-center gap-[8px]"><input aria-label={`${cle === "azimut" ? "Azimut" : "Élévation"} du rendu — curseur`} type="range" className="min-w-0 flex-1 accent-signal" min={catalogue.camera_libre![cle].minimum} max={catalogue.camera_libre![cle].maximum} step={catalogue.camera_libre![cle].pas} value={camera[cle]} onChange={(e) => cadrer(cle, Number(e.target.value))} /><input aria-label={`${cle === "azimut" ? "Azimut" : "Élévation"} du rendu`} type="number" className={`${CHAMP} w-[70px]`} min={catalogue.camera_libre![cle].minimum} max={catalogue.camera_libre![cle].maximum} step={catalogue.camera_libre![cle].pas} value={Number(camera[cle].toFixed(2))} onChange={(e) => cadrer(cle, Number(e.target.value))} /><span>°</span></div></label>)}</div>}
      {demande.personnage_externe && <button className={CHAMP} onClick={() => setInspecter((v) => !v)}>{inspecter ? "Refermer la caméra 3D" : "Choisir l’angle sur le modèle"}</button>}
      {inspecter && demande.personnage_externe && <div className="flex h-[60vh] min-h-[380px] flex-col"><Suspense fallback={<p>Ouverture du modèle animé…</p>}><ApercuModele3D url={sources3d.rig(demande.personnage_externe, String(demande.reglages.animation || catalogue.defaut), 0)} nom="Caméra du prochain rendu" cameraInitiale={camera} onCamera={(c) => onChanger({ camera: c })} /></Suspense></div>}
    </> : <p className="text-[13px] text-encre-3">Ce moteur propose les angles de son catalogue. Le pont Asset Kitchen ajoute la caméra libre.</p>}
    {catalogue.plage_animation && <><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={!!plage} onChange={(e) => onChanger({ plage: e.target.checked ? { debut: 0, fin: 100 } : undefined })} />Choisir une portion du mouvement</label>{plage && <><label className="flex items-center gap-[8px] text-[13px]"><input type="checkbox" checked={pose} onChange={(e) => onChanger({ plage: e.target.checked ? { debut: plage.debut, fin: plage.debut } : { debut: Math.min(plage.debut, 99), fin: 100 }, reglages: { ...demande.reglages, nombre_images: e.target.checked ? 1 : 8 } })} />Une seule frame (pose)</label><div className="grid grid-cols-2 gap-[22px]">{(pose ? ["debut"] as const : ["debut", "fin"] as const).map((cle) => <label className="flex flex-col gap-[4px] text-[13px]" key={cle}>{pose ? "Position dans le mouvement" : cle === "debut" ? "Début de la portion" : "Fin de la portion"}<div className="flex items-center gap-[8px]"><input aria-label={`${cle} du mouvement — curseur`} type="range" min={0} max={100} step={1} value={plage[cle]} onChange={(e) => plageChanger(cle, Number(e.target.value))} className="min-w-0 flex-1 accent-signal" /><input aria-label={`${cle} du mouvement`} type="number" min={0} max={100} step={1} value={plage[cle]} onChange={(e) => plageChanger(cle, Number(e.target.value))} className={`${CHAMP} w-[70px]`} /><span>%</span></div></label>)}</div></>}</>}
    <p className="text-[12px] text-encre-3">Sortie carrée transparente · même cadre pour toutes les frames, mesuré sur le mouvement entier. L’angle choisi sur le modèle est repris ; le zoom et le déplacement de consultation ne changent pas ce cadre.</p>
  </section>
}
