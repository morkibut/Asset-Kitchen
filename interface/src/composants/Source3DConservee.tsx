import { lazy, Suspense } from "react"
import { sources3d, type Source3D } from "../api-3d"
import { CadreDialogue } from "./CadreDialogue"

const ApercuModele3D = lazy(() => import("./ApercuModele3D"))
const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"
const NOMS: Record<string, string> = { animation: "Animation", angle: "Caméra", style: "Style", moteur_3d: "Modèle", eclairage: "Éclairage", nombre_images: "Frames", taille_images: "Taille", cadrage: "Cadrage", contraste: "Contraste", exposition: "Exposition", saturation: "Saturation" }

/** Relecture locale d'une source déjà conservée. Aucun accès à asset3d : les
 * adresses viennent du dépôt de l'atelier et l'aperçu ne charge qu'un GLB. */
export function Source3DConservee({ source, onFermer, onBande, onPersonnage }: {
  source: Source3D; onFermer: () => void; onBande: (id: string) => void; onPersonnage?: (id: string) => void
}) {
  const modele = source.fichiers["rig.glb"] ? "rig.glb" : source.fichiers["modele.glb"] ? "modele.glb" : null
  const frame = source.fichiers["frame-0000.png"] ? sources3d.fichier(source, "frame-0000.png") : null
  return <CadreDialogue titre={`Source 3D · ${source.nom}`} format="atelier" onFermer={onFermer} enfants={<main className="flex min-h-0 flex-1 flex-col gap-[14px] bg-papier p-[22px]" aria-label={`Source 3D ${source.nom}`}>
    <header className="flex shrink-0 items-start justify-between gap-[22px]"><div><h1 className="font-serif text-[25px]">{source.nom}</h1><p className="mt-[4px] text-[13px] text-encre-3">Source conservée · {source.images} frames · {source.largeur} × {source.hauteur} px · {source.cadence} i/s</p></div><button className={BOUTON} onClick={onFermer}>Fermer</button></header>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-[22px]">
      <section className="flex min-h-0 flex-col rounded-8 border border-trait bg-carte p-[14px]" aria-label="Aperçu de la source">
        {modele ? <Suspense fallback={<p role="status">Chargement de la vue 3D…</p>}><ApercuModele3D url={sources3d.fichier(source, modele)} nom={source.nom} cameraInitiale={source.provenance.camera} /></Suspense> : frame ? <><img src={frame} alt={`Première image de ${source.nom}`} className="damier-papier min-h-0 flex-1 object-contain" /><p className="mt-[8px] text-[12px] text-encre-3">Seules les images rendues ont été conservées pour cette source.</p></> : <p className="flex min-h-[240px] items-center justify-center text-[13px] text-encre-3">Aucun modèle ni première image conservée pour cette source.</p>}
      </section>
      <aside className="defile min-h-0 overflow-y-auto rounded-8 border border-trait bg-carte p-[14px]" aria-label="Résumé de la source">
        <h2 className="font-serif text-[25px]">Réglages conservés</h2><dl className="mt-[14px] space-y-[8px] text-[12px]">{Object.entries(source.provenance.reglages).map(([cle, valeur]) => <div key={cle} className="flex justify-between gap-[14px]"><dt className="text-encre-3">{NOMS[cle] ?? cle}</dt><dd className="text-right">{String(valeur)}</dd></div>)}</dl>
        <p className="mt-[14px] text-[12px] text-encre-3">Origine : {source.origine}</p><p className="mt-[4px] break-words text-[12px] text-encre-3">Provenance : {source.provenance.adresse}</p>
        <div className="mt-[14px] flex flex-wrap gap-[8px]">{["modele.glb", "rig.glb"].filter(n => source.fichiers[n]).map(n => <a key={n} className={`${BOUTON} inline-flex items-center`} href={sources3d.fichier(source, n)} download>{n === "rig.glb" ? "Modèle animé" : "Modèle 3D"}</a>)}{source.personnage && onPersonnage && <button className={BOUTON} onClick={() => onPersonnage(source.personnage!)}>Ouvrir le personnage</button>}</div>
        {!!source.bandes.length && <div className="mt-[22px] border-t border-trait pt-[14px]"><h2 className="font-serif text-[25px]">Animations conservées</h2><div className="mt-[8px] flex flex-col gap-[8px]">{source.bandes.map((id, index) => <button key={id} className={`${BOUTON} text-left`} onClick={() => onBande(id)}>Retoucher l’animation {source.bandes.length > 1 ? index + 1 : ""}</button>)}</div></div>}
      </aside>
    </div>
  </main>} />
}
