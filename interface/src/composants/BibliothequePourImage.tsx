import { useEffect, useState } from "react"
import { api, type Asset, type Collection } from "../api"
import { sujetAsset, useVisee } from "./Apercu"

/**
 * Une image de la grille de choix.
 *
 * **Elle se regarde en grand avant d'être choisie** : le pointeur la vise, la
 * barre d'espace l'ouvre, Échap referme l'aperçu seul et laisse la grille — et
 * la fenêtre qui a demandé la référence — exactement où elles étaient. C'est la
 * visée du reste du produit (`useVisee`, `Apercu.tsx`), pas une seconde : une
 * vignette de 128 px ne suffit pas à décider ce qu'on va payer, et le geste
 * existait déjà dans l'ancienne grille.
 *
 * La tuile garde l'image qu'elle affichait ; **l'aperçu, lui, vise le fichier
 * entier** (`sujetAsset`), parce que le moment où l'on veut les pixels vrais
 * est exactement celui où l'on ouvre.
 */
function TuileDeChoix({ asset, onChoisir }: { asset: Asset; onChoisir: (asset: Asset) => void }) {
  const visee = useVisee(sujetAsset(asset))
  return <button type="button" aria-label={`Choisir ${asset.label}`} onClick={() => onChoisir(asset)} onPointerEnter={visee.entrer} onPointerLeave={visee.sortir} className="flex flex-col rounded-7 border border-trait bg-carte p-[8px] text-left hover:border-signal">
    <img src={api.rendu(asset.identifiant, asset.empreinte)} alt="" className="damier-papier h-[128px] w-full object-contain" style={{ imageRendering: "pixelated" }} />
    <span className="mt-[8px] w-full truncate text-[12px]">{asset.label}</span><span className="mesure text-[11px] text-encre-3">{asset.rendu_largeur || asset.largeur} × {asset.rendu_hauteur || asset.hauteur}</span>
  </button>
}

/** Choisir une image dans toute la bibliothèque, sans modifier son classement. */
export function BibliothequePourImage({ voisines = [], onChoisir, onFermer }: {
  voisines?: Asset[]; onChoisir: (asset: Asset) => void; onFermer: () => void
}) {
  const [recherche, setRecherche] = useState("")
  const [collection, setCollection] = useState("")
  const [favoris, setFavoris] = useState(false)
  const [limite, setLimite] = useState(60)
  const [images, setImages] = useState<Asset[]>(voisines)
  const [collections, setCollections] = useState<Collection[]>([])
  const [total, setTotal] = useState(voisines.length)
  const [erreur, setErreur] = useState("")
  const [attente, setAttente] = useState(true)
  useEffect(() => { let vivant = true; api.arbre().then((b) => { if (vivant) setCollections(b.collections ?? []) }).catch((e) => vivant && setErreur(String(e))); return () => { vivant = false } }, [])
  useEffect(() => {
    let vivant = true; setAttente(true); setErreur("")
    api.assets({ recherche, collection: collection || null, favoris, limite }).then((recu) => {
      if (vivant) { setImages(recu.assets); setTotal(recu.total); setAttente(false) }
    }).catch((e) => { if (vivant) { setErreur(String(e)); setAttente(false) } })
    return () => { vivant = false }
  }, [recherche, collection, favoris, limite])
  return <section aria-label="Choisir dans la bibliothèque" className="flex min-h-0 flex-1 flex-col gap-[8px] overflow-hidden p-[14px]">
    <div className="flex items-center justify-between"><h2 className="titre text-[25px]">Choisir une image</h2><button type="button" onClick={onFermer}>Revenir au travail</button></div>
    <div className="flex flex-wrap items-center gap-[8px]">
      <input aria-label="Rechercher une image" placeholder="Nom, description…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setLimite(60) }} className="min-w-0 flex-1 rounded-7 border border-trait bg-carte p-[8px]" />
      <select aria-label="Collection des images" value={collection} onChange={(e) => { setCollection(e.target.value); setLimite(60) }} className="rounded-7 border border-trait bg-carte p-[8px]"><option value="">Toutes les collections</option>{collections.map((c) => <option key={c.identifiant} value={c.identifiant}>{c.nom}</option>)}</select>
      <label className="text-[12px]"><input type="checkbox" checked={favoris} onChange={(e) => { setFavoris(e.target.checked); setLimite(60) }} /> Favoris</label>
    </div>
    {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    <p role="status" className="text-[12px] text-encre-3">{attente ? "Chargement…" : `${total} image${total > 1 ? "s" : ""}`}</p>
    <div className="defile grid min-h-0 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[8px] overflow-auto">
      {images.map((asset) => <TuileDeChoix key={asset.identifiant} asset={asset} onChoisir={onChoisir} />)}
    </div>
    {!attente && images.length < total && <button type="button" onClick={() => setLimite((n) => n + 60)}>Afficher les suivantes</button>}
    {!attente && images.length === 0 && <p>Aucune image ne correspond à ces filtres.</p>}
  </section>
}
