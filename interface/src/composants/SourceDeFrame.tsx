import { useEffect, useState } from "react"
import { type Recette } from "../api"
import { CadreDeRecadrage, PipetteSurImage, TraceSurImage } from "./Retouche"
import { SurfaceZoomable } from "./SurfaceZoomable"

/** La visée porte les pixels du fichier d'origine, jamais ceux de la case réduite. */
export function SourceDeFrame({ source, recette, passe, rectangle, onRecette, onFermer }: {
  source: string; recette: Recette; passe: number | null; rectangle: boolean
  onRecette: (recette: Recette) => void; onFermer: () => void
}) {
  const [dimensions, setDimensions] = useState<{ source: string; largeur: number; hauteur: number } | null>(null)
  const [erreur, setErreur] = useState("")
  useEffect(() => {
    let vivant = true; setErreur("")
    const image = new Image()
    image.onload = () => { if (vivant) setDimensions({ source, largeur: image.naturalWidth, hauteur: image.naturalHeight }) }
    image.onerror = () => { if (vivant) setErreur("L’image source de cette frame ne peut pas être lue.") }
    image.src = source
    return () => { vivant = false }
  }, [source])
  const actif = dimensions?.source === source ? dimensions : null
  const asset = actif ? { ...actif, identifiant: "", empreinte: "", label: "Source de la frame" } : null
  const reglage = passe === null ? null : recette.passes[passe]
  const appliquer = (suite: Recette) => { onRecette(suite); onFermer() }
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center justify-between gap-[8px] border-b border-trait p-[8px] text-[12px]"><p>Source de la frame · {rectangle ? "tracer le recadrage" : reglage?.moteur === "trace" ? "entourer le sujet" : "viser une couleur"}</p><button type="button" onClick={onFermer}>Revenir à la frame</button></div>
    {erreur && <p role="alert" className="p-[14px] text-echec">{erreur}</p>}
    {!asset && !erreur && <p className="p-[14px]">Chargement de l’image d’origine…</p>}
    {asset && <SurfaceZoomable largeur={asset.largeur} hauteur={asset.hauteur} libelle="la source de frame">
      {rectangle ? <CadreDeRecadrage source={source} asset={asset} obtenue={null} boite={recette.recadrage?.boite as [number, number, number, number] | null ?? null}
        onBoite={(boite) => appliquer({ ...recette, recadrage: { marge: 0, ...recette.recadrage, boite } })} />
        : reglage?.moteur === "trace" ? <TraceSurImage source={source} asset={asset} trace={reglage.trace} onTrace={(trace) => appliquer({ ...recette, passes: recette.passes.map((p, i) => i === passe ? { ...p, trace } : p) })} />
        : reglage?.moteur === "couleur" ? <PipetteSurImage source={source} asset={asset} point={reglage.point} onPoint={(point) => appliquer({ ...recette, passes: recette.passes.map((p, i) => i === passe ? { ...p, point } : p) })} /> : null}
    </SurfaceZoomable>}
  </div>
}
