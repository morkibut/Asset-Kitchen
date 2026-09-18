import { useEffect, useState } from "react"
import { api, type Asset, type Piece, type StyleDeCombat } from "../api"
import { apiCalques } from "../api-calques"
import { vignetteAsset } from "./Apercu"
import { BibliothequePourImage } from "./BibliothequePourImage"

const BOUTON = "h-[34px] rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle disabled:opacity-50"

export function ReferencePiece({ projet, piece, onChange }: { projet: string; piece: Piece; onChange: (p: Piece) => void }) {
  const [references, setReferences] = useState<Asset[]>([])
  const [choisir, setChoisir] = useState(false)
  const [edition, setEdition] = useState(false)
  const [description, setDescription] = useState(piece.description)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  // **Son style de combat** (SC4, 18 septembre 2026) — une pièce déclare un
  // style ou n'en déclare aucun ; qui la porte en calque en hérite, sauf s'il
  // a choisi le sien (voir `ServiceStyles.style_du_personnage`).
  const [catalogueStyles, setCatalogueStyles] = useState<StyleDeCombat[]>([])
  const [styleChoisi, setStyleChoisi] = useState<string | null>(null)
  useEffect(() => {
    let vivant = true
    Promise.all((piece.references ?? []).map(id => api.lireAsset(id))).then(r => { if (vivant) setReferences(r) }).catch(e => { if (vivant) setErreur(e.message) })
    return () => { vivant = false }
  }, [piece.references])
  useEffect(() => {
    let vivant = true
    api.styles(projet).then((recu) => { if (vivant) setCatalogueStyles(recu.styles) }).catch(() => { if (vivant) setCatalogueStyles([]) })
    api.styleDeLaPiece(piece.identifiant, projet).then((recu) => { if (vivant) setStyleChoisi(recu.style?.identifiant ?? null) }).catch(() => { if (vivant) setStyleChoisi(null) })
    return () => { vivant = false }
  }, [projet, piece.identifiant])
  const modifier = async (champs: { description?: string; references?: string[] }) => {
    setOccupe(true); setErreur("")
    try { const r = await apiCalques.reglerPiece(projet, piece.identifiant, champs); onChange(r.piece); setChoisir(false); setEdition(false) }
    catch (e) { setErreur(e instanceof Error ? e.message : "La référence n’a pas pu être conservée.") }
    finally { setOccupe(false) }
  }
  const poserStyle = async (style: string | null) => {
    setErreur("")
    try { const r = await api.choisirStyleDeLaPiece(piece.identifiant, style, projet); setStyleChoisi(r.style?.identifiant ?? null) }
    catch (e) { setErreur(e instanceof Error ? e.message : "Le style n’a pas pu être conservé.") }
  }
  return <section className="rounded-8 border border-trait bg-carte p-[22px]" aria-label="Définition commune de la pièce">
    <div className="flex items-start justify-between gap-[14px]"><div><h2 className="font-serif text-[25px]">La pièce commune</h2><p className="mt-[8px] text-[13px] text-encre-3">Son apparence et sa description servent de référence à tous ses emplois. Chaque héros garde ses adaptations par pose, direction et frame.</p></div><button className={BOUTON} onClick={() => { setDescription(piece.description); setEdition(v => !v) }}>Modifier la description</button></div>
    {erreur && <p role="alert" className="mt-[14px] text-echec">{erreur}</p>}
    {edition ? <div className="mt-[14px]"><textarea aria-label="Description de la pièce" className="min-h-[128px] w-full rounded-7 border border-contour bg-carte p-[14px] text-[13px]" value={description} onChange={e => setDescription(e.target.value)} /><button className={`${BOUTON} mt-[8px]`} disabled={occupe} onClick={() => void modifier({ description })}>Conserver la description</button></div> : <p className="mt-[14px] text-[13px]">{piece.description || "Décrivez sa matière, sa silhouette et ses détails reconnaissables."}</p>}
    <div className="mt-[14px] flex flex-wrap items-start gap-[14px]">{references.map(a => <figure key={a.identifiant} className="w-[128px]"><img className="damier-papier h-[128px] w-full object-contain" src={vignetteAsset(a, 128)} alt={a.label || "Référence de la pièce"} /><figcaption className="mt-[4px] text-[12px]">{a.label}</figcaption><button className="mt-[8px] text-[12px] underline" disabled={occupe} onClick={() => void modifier({ references: (piece.references ?? []).filter(id => id !== a.identifiant) })}>Retirer cette référence</button></figure>)}<button className={BOUTON} onClick={() => setChoisir(true)}>Choisir ou importer une référence</button></div>
    {!references.length && <p className="mt-[8px] text-[12px] text-encre-3">Aucune image de référence commune. Vous pouvez utiliser un dessin, une image importée ou un résultat de Fabrications.</p>}
    {choisir && <BibliothequePourImage retour={piece.nom} role="reference" onFermer={() => setChoisir(false)} onChoisir={async a => modifier({ references: [...new Set([...(piece.references ?? []), a.identifiant])] })} />}
    <div data-style-de-combat-de-la-piece className="mt-[22px] flex flex-col gap-[4px] border-t border-trait pt-[14px]">
      <label className="text-[13px] text-encre">Son style de combat
        <select
          aria-label="Style de combat de la pièce"
          className="mt-[4px] block h-[34px] w-full max-w-[280px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"
          value={styleChoisi ?? ""}
          onChange={(e) => void poserStyle(e.target.value || null)}
        >
          <option value="">aucun</option>
          {catalogueStyles.map((style) => <option key={style.identifiant} value={style.identifiant}>{style.nom}</option>)}
        </select>
      </label>
      <p className="text-[11.5px] leading-[1.45] text-encre-4">Qui la porte en calque en hérite, sauf s'il a choisi le sien.</p>
    </div>
  </section>
}
