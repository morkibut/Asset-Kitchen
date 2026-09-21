import { useEffect, useState } from "react"
import { api, type Asset, type Collection } from "../api"
import { imageAsset, sujetAsset, useVisee, vignetteAsset } from "./Apercu"
import type { RoleCalque } from "../api-calques"

const CONTROLE = "h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
const TAILLE_PAGE = 60

/**
 * Une image de la grille de choix.
 *
 * **Elle se regarde en grand avant d'être choisie** : le pointeur la vise, la
 * barre d'espace l'ouvre, Échap referme l'aperçu seul et laisse la grille — et
 * la fenêtre qui a demandé l'image — exactement où elles étaient. C'est la
 * visée du reste du produit (`useVisee`, `Apercu.tsx`), pas une seconde : une
 * vignette de 128 px ne suffit pas à décider ce qu'on va payer, et le geste
 * existait déjà dans l'ancienne grille.
 *
 * La tuile garde l'image qu'elle affichait ; **l'aperçu, lui, vise le fichier
 * entier** (`sujetAsset`), parce que le moment où l'on veut les pixels vrais
 * est exactement celui où l'on ouvre.
 */
function TuileDeChoix({ asset, choisie, onChoisir }: { asset: Asset; choisie: boolean; onChoisir: (asset: Asset) => void }) {
  const visee = useVisee(sujetAsset(asset))
  return <button type="button" aria-label={`Choisir ${asset.label}`} aria-pressed={choisie} onClick={() => onChoisir(asset)} onPointerEnter={visee.entrer} onPointerLeave={visee.sortir} className={`flex flex-col rounded-7 border p-[8px] text-left hover:border-signal ${choisie ? "border-signal bg-ligne-ouverte" : "border-trait bg-carte"}`}>
    <img src={vignetteAsset(asset, 128)} alt="" className="damier-papier h-[128px] w-full object-contain" style={{ imageRendering: "pixelated" }} />
    <span className="mt-[8px] w-full truncate text-[12px]">{asset.label}</span><span className="mesure text-[11px] text-encre-3">{asset.rendu_largeur || asset.largeur} × {asset.rendu_hauteur || asset.hauteur}</span>
  </button>
}

const EXPLICATION: Record<RoleCalque, string> = {
  "source-equipee": "Le personnage complet reste une source. L’extraction créera une nouvelle image transparente à vérifier.",
  calque: "Le calque doit contenir uniquement l’équipement. Vérifie sa superposition avant de le retenir.",
  reference: "Cette image décrit la pièce ; elle ne remplit pas la cible et ne se superpose pas au personnage.",
}

/**
 * **La seule grille de choix d'image du produit** (RP6). Elle sait tout ce que
 * les deux grilles d'avant savaient séparément : chercher dans toute la
 * bibliothèque, filtrer par collection ou par favoris, importer un fichier
 * depuis le disque, et — seulement là où celui qui l'ouvre en a besoin —
 * demander le rôle de l'image choisie avant de la rendre.
 *
 * **Sans rôle demandé**, un clic sur une tuile choisit l'image tout de suite :
 * c'est le geste le plus court, et rien ne le justifie d'en ajouter un second
 * là où personne ne lit le rôle.
 *
 * **Un rôle demandé** (`role="choix"` ou `role="reference"`) ouvre au
 * contraire un temps de relecture : l'image choisie se voit en grand, son
 * rôle se règle ou se rappelle, et un bouton confirme — parce que le rôle
 * change ce qui va se passer ensuite (une extraction, un calque à vérifier),
 * et que ça ne se décide pas à l'aveugle.
 *
 * Cette grille n'est pas *la* grille d'assets du produit (RP7) : elle n'a ni
 * tri, ni vue liste, ni sélection multiple — un seul filtre à la fois, un seul
 * choix à la fin.
 */
export function BibliothequePourImage({ voisines = [], retour, onChoisir, onFermer, role }: {
  voisines?: Asset[]
  /** Le nom de l'écran d'où l'on vient, pour le bouton « ‹ {retour} ». */
  retour: string
  onFermer: () => void
  /** Absent : un clic choisit l'image tout de suite. `"choix"` : on règle le
   *  rôle parmi les trois possibles avant de confirmer. `"reference"` : le
   *  rôle est toujours *référence*, et ne se règle pas. */
  role?: "choix" | "reference"
  onChoisir: (asset: Asset, role?: RoleCalque) => void | Promise<void>
}) {
  const [recherche, setRecherche] = useState("")
  const [collection, setCollection] = useState("")
  const [favoris, setFavoris] = useState(false)
  const [limite, setLimite] = useState(TAILLE_PAGE)
  const [page, setPage] = useState(0)
  const [images, setImages] = useState<Asset[]>(voisines)
  const [collections, setCollections] = useState<Collection[]>([])
  const [total, setTotal] = useState(voisines.length)
  const [chargement, setChargement] = useState(true)
  const [selection, setSelection] = useState<Asset | null>(null)
  const [roleChoisi, setRoleChoisi] = useState<RoleCalque>(role === "reference" ? "reference" : "source-equipee")
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  useEffect(() => { let vivant = true; api.arbre().then((b) => { if (vivant) setCollections(b.collections ?? []) }).catch((e) => vivant && setErreur(String(e))); return () => { vivant = false } }, [])
  useEffect(() => {
    let vivant = true; setChargement(true); setErreur("")
    api.assets({ recherche, collection: collection || null, favoris, limite }).then((recu) => {
      if (vivant) { setImages(recu.assets); setTotal(recu.total); setChargement(false) }
    }).catch((e) => { if (vivant) { setErreur(String(e)); setChargement(false) } })
    return () => { vivant = false }
  }, [recherche, collection, favoris, limite])

  async function importer(fichier?: File) {
    if (!fichier) return
    setOccupe(true); setErreur("")
    try {
      const r = await api.televerser(fichier), asset = r.asset ?? r.doublon
      if (!asset) return
      if (role) setSelection(asset)
      else await onChoisir(asset)
    } catch (e) { setErreur(e instanceof Error ? e.message : "L’image n’a pas pu être importée.") }
    finally { setOccupe(false) }
  }
  async function confirmer() {
    if (!selection) return
    setOccupe(true); setErreur("")
    try { await onChoisir(selection, roleChoisi) }
    catch (e) { setErreur(e instanceof Error ? e.message : "L’image n’a pas pu être associée.") }
    finally { setOccupe(false) }
  }
  const choisirTuile = (asset: Asset) => { if (role) setSelection(asset); else void onChoisir(asset) }
  const titre = role === "reference" ? "Choisir la référence commune" : role === "choix" ? "Associer une image à cette cible" : "Choisir une image"
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE))
  const visibles = images.slice(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE)
  function suivant() {
    const cible = page + 1
    setLimite((l) => Math.max(l, Math.min(total, (cible + 1) * TAILLE_PAGE)))
    setPage(cible)
  }

  return <section aria-label={titre} className="flex min-h-0 flex-1 flex-col gap-[8px] overflow-hidden p-[14px]">
    <div className="flex items-center justify-between gap-[14px]"><h2 className="titre text-[25px]">{titre}</h2><button type="button" onClick={onFermer} disabled={occupe} className={CONTROLE}>‹ {retour}</button></div>
    <div className="flex flex-wrap items-center gap-[8px]">
      <input aria-label="Rechercher une image" placeholder="Nom, description…" value={recherche} onChange={(e) => { setRecherche(e.target.value); setLimite(TAILLE_PAGE); setPage(0) }} className="min-w-0 flex-1 rounded-7 border border-trait bg-carte p-[8px]" />
      <select aria-label="Collection des images" value={collection} onChange={(e) => { setCollection(e.target.value); setLimite(TAILLE_PAGE); setPage(0) }} className="rounded-7 border border-trait bg-carte p-[8px]"><option value="">Toutes les collections</option>{collections.map((c) => <option key={c.identifiant} value={c.identifiant}>{c.nom}</option>)}</select>
      <label className="text-[12px]"><input type="checkbox" checked={favoris} onChange={(e) => { setFavoris(e.target.checked); setLimite(TAILLE_PAGE); setPage(0) }} /> Favoris</label>
      <label className={`${CONTROLE} flex cursor-pointer items-center`}>Importer une image<input type="file" accept="image/*" disabled={occupe} className="sr-only" onChange={(e) => void importer(e.target.files?.[0])} /></label>
    </div>
    {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    <p role="status" className="text-[12px] text-encre-3">{chargement ? "Chargement…" : `${total} image${total > 1 ? "s" : ""}`}</p>
    <div className="defile grid min-h-0 grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[8px] overflow-auto">
      {visibles.map((asset) => <TuileDeChoix key={asset.identifiant} asset={asset} choisie={selection?.identifiant === asset.identifiant} onChoisir={choisirTuile} />)}
    </div>
    {!chargement && total > TAILLE_PAGE && <div className="flex items-center gap-[14px] text-[12px] text-encre-3">
      <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="text-encre-controle disabled:text-eteint">Précédent</button>
      <span className="mesure">Page {page + 1} / {pages}</span>
      <button type="button" disabled={(page + 1) * TAILLE_PAGE >= total} onClick={suivant} className="text-encre-controle disabled:text-eteint">Suivant</button>
    </div>}
    {!chargement && images.length === 0 && <p>Aucune image ne correspond à ces filtres.</p>}
    {role && selection && <div className="mt-[8px] flex items-start gap-[14px] rounded-8 border border-contour bg-carte p-[14px]">
      <img src={imageAsset(selection)} alt={selection.label} className="damier-papier w-[128px] shrink-0 object-contain" />
      <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
        {role === "choix" && <label className="flex flex-col gap-[4px] text-[13px] text-encre">Cette image représente<select aria-label="Rôle de cette image" value={roleChoisi} onChange={(e) => setRoleChoisi(e.target.value as RoleCalque)} className={CONTROLE}><option value="source-equipee">Le personnage équipé — à extraire</option><option value="calque">Un calque transparent — déjà extrait</option><option value="reference">Une référence d’apparence</option></select></label>}
        <p className="text-[12px] text-encre-3">{EXPLICATION[role === "reference" ? "reference" : roleChoisi]}</p>
        <button type="button" onClick={() => void confirmer()} disabled={occupe} className={`${CONTROLE} self-start`}>{occupe ? "Association…" : role === "reference" ? "Définir comme référence de la pièce" : "Associer cette image"}</button>
      </div>
    </div>}
  </section>
}
