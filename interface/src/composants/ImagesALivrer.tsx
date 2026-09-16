import { useEffect, useRef, useState } from "react"
import { api, type Asset, type ApercuLivraison } from "../api"
import { livraisonImages } from "../api-livraison-images"
import { Libelle } from "./pieces"

const CHAMP = "rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px] text-encre-controle"
const BOUTON = `${CHAMP} disabled:opacity-50`

/** Le choix prépare un jeton commun. Le châssis de livraison affiche ensuite
 * les fichiers, leurs conflits et l’historique, quelle que soit leur nature. */
export function ImagesALivrer({ projet, personnage, associe, onApercu, onInvalider, onOccupation }: {
  projet: string; personnage: string; associe: boolean
  onApercu: (a: ApercuLivraison) => void; onInvalider: () => void
  onOccupation: (occupe: boolean) => void
}) {
  const [images, setImages] = useState<Asset[]>([])
  const [choisie, setChoisie] = useState("")
  const [recherche, setRecherche] = useState("")
  const [retenues, setRetenues] = useState(false)
  const [limite, setLimite] = useState(24)
  const [usage, setUsage] = useState<"monde" | "interface">("monde")
  const [pivot, setPivot] = useState({ x: "", y: "" })
  const [erreur, setErreur] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [lecture, setLecture] = useState(true)
  const requete = useRef(0)
  const image = images.find(a => a.identifiant === choisie)
  useEffect(() => {
    let vivant = true; setLecture(true); setChoisie("")
    livraisonImages.lister(projet, personnage).then(r => { if (vivant) { setImages(r.images); setUsage(r.usage_conseille) } })
      .catch(e => vivant && setErreur(e.message)).finally(() => vivant && setLecture(false))
    return () => { vivant = false; requete.current++ }
  }, [projet, personnage])
  function invalider() { requete.current++; setErreur(""); onInvalider() }
  async function prevoir() {
    const numero = ++requete.current; setOccupe(true); onOccupation(true); setErreur("")
    try {
      const r = await livraisonImages.prevoir(projet, { personnage, image: choisie, usage,
        ...(pivot.x !== "" ? { pivot_x: Number(pivot.x) } : {}), ...(pivot.y !== "" ? { pivot_y: Number(pivot.y) } : {}) })
      if (numero === requete.current) onApercu(r)
    } catch (e) { if (numero === requete.current) setErreur(e instanceof Error ? e.message : "L’image n’a pas pu être préparée.") }
    finally { setOccupe(false); onOccupation(false) }
  }
  const trouvees = images.filter(a => (!retenues || a.favori) && `${a.label} ${a.pose || ""} ${a.direction || ""}`.toLocaleLowerCase().includes(recherche.toLocaleLowerCase()))
  return <section aria-label="Images fixes à livrer" className="space-y-[14px]">
    <p className="text-[13px] text-encre-3"><Libelle aide="livraison.image-fixe">Une image existante, dans la bonne version</Libelle> · Le rendu retouché est livré avec sa source et sa recette.</p>
    {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    <div className="flex items-center gap-[14px]"><input type="search" aria-label="Chercher une version d’image" placeholder="Nom, pose ou direction…" value={recherche} onChange={e => { setRecherche(e.target.value); setLimite(24) }} className={`${CHAMP} min-w-0 flex-1`} /><label className="text-[13px]"><input type="checkbox" checked={retenues} onChange={e => setRetenues(e.target.checked)} /> Retenues seulement</label></div>
    {lecture ? <p role="status">Lecture des images…</p> : !trouvees.length ? <p className="text-[13px] text-encre-3">Aucune image pour ces filtres. Créez ou classez une image dans ce sujet, puis revenez la livrer.</p> : <div className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[14px]">{trouvees.slice(0, limite).map(a => <button key={a.identifiant} disabled={occupe} aria-pressed={choisie === a.identifiant} className="rounded-7 border border-trait bg-carte p-[8px] text-left aria-pressed:border-signal" onClick={() => { invalider(); setChoisie(a.identifiant) }}><img src={api.fichier(a.identifiant)} alt="" className="damier-papier aspect-square w-full object-contain" /><span className="mt-[8px] block truncate text-[13px]">{a.label || a.identifiant}</span><span className="mt-[4px] block text-[12px] text-encre-3">{a.pose || "Image libre"} · {a.direction || "sans direction"}{a.favori ? " · Retenue" : ""}</span></button>)}</div>}
    {trouvees.length > limite && <button className={BOUTON} onClick={() => setLimite(n => n + 24)}>Afficher davantage de versions</button>}
    {image && <div className="grid grid-cols-2 gap-[14px]"><label className="flex flex-col gap-[8px] text-[13px]">Utilisation dans Godot<select className={CHAMP} disabled={occupe} value={usage} onChange={e => { invalider(); setUsage(e.target.value as "monde" | "interface"); setPivot({ x: "", y: "" }) }}><option value="monde">Objet ou décor dans le monde · Sprite2D</option><option value="interface">Portrait ou interface · TextureRect</option></select></label><p className="text-[12px] text-encre-3">Modèle : {image.modele || "source importée"}. {image.epingle ? "Recette ajustée sur cette image." : "Réglages du jeu appliqués à cette image."}</p></div>}
    {image && <details><summary className="text-[13px]">Repère de l’image</summary><p className="my-[8px] text-[12px] text-encre-3">Pixels du rendu exporté. Vide : {usage === "interface" ? "coin supérieur gauche" : "centre du bord inférieur"}. Une nouvelle version de cette pose et direction remplace la même scène ; les autres images gardent leur adresse.</p><div className="flex gap-[14px]">{(["x", "y"] as const).map(axe => <label key={axe} className="text-[13px]">{axe.toUpperCase()}<input type="number" className={`${CHAMP} ml-[8px] w-[70px]`} value={pivot[axe]} onChange={e => { invalider(); setPivot(p => ({ ...p, [axe]: e.target.value })) }} /></label>)}</div></details>}
    <button className={BOUTON} disabled={!choisie || !associe || occupe} onClick={() => void prevoir()}>Relire l’image à livrer</button>
  </section>
}
