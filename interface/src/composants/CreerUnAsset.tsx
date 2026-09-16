import { useState } from "react"
import { api, type Personnage, type Piece } from "../api"
import { FAMILLES } from "./Carnet"
import { CadreDialogue } from "./CadreDialogue"

const CHAMP = "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"

/** Nommer et décrire l’asset précède ses fabrications. L’objectif détaillé
 * s’ouvre ensuite sur la fiche ; créer ne commande aucune image. */
export function CreerUnAsset({ familleInitiale, onFermer, onPersonnage, onPiece }: {
  familleInitiale: string; onFermer: () => void; onPersonnage: (p: Personnage) => void; onPiece: (p: Piece) => void
}) {
  const [nom, setNom] = useState("")
  const [description, setDescription] = useState("")
  const [famille, setFamille] = useState(familleInitiale || "personnages")
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")
  async function creer() {
    if (!nom.trim() || occupe) return
    setOccupe(true); setErreur("")
    try {
      if (famille === "equipement") onPiece((await api.ajouterPiece({ nom: nom.trim(), description: description.trim() })).piece)
      else onPersonnage((await api.creerPersonnage(nom.trim(), description.trim(), famille)).personnage)
    } catch (e) { setErreur(e instanceof Error ? e.message : "La création n’a pas abouti.") }
    finally { setOccupe(false) }
  }
  return <CadreDialogue titre="Créer un sujet" format="preparation" onFermer={onFermer} enfants={<form className="flex min-h-0 flex-col" onSubmit={e => { e.preventDefault(); void creer() }}>
    <header className="flex items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]"><div><h1 className="font-serif text-[25px]">Créer un sujet</h1><p className="mt-[8px] text-[13px] text-encre-3">Donne-lui sa place dans le jeu, avant de fabriquer ses images.</p></div><button type="button" className={CHAMP} onClick={onFermer} disabled={occupe}>Fermer</button></header>
    <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[30px] text-[13px]">
      <label className="flex flex-col gap-[8px]">Nom du sujet<input autoFocus required className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} placeholder="Le pèlerin, une épée divine, une auberge…" /></label>
      <label className="flex flex-col gap-[8px]">Famille<select className={CHAMP} value={famille} onChange={e => setFamille(e.target.value)}>{FAMILLES.map(f => <option key={f.cle} value={f.cle}>{f.nom}</option>)}</select></label>
      <label className="flex flex-col gap-[8px]">Description créative<textarea className={CHAMP} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Son rôle, sa silhouette et les détails à conserver dans ses différentes images…" /></label>
      <p className="text-encre-3">{famille === "equipement" ? "Sa fiche regroupera ses emplois : les personnages qui le portent et les calques propres à leurs poses, directions et frames." : "Tu définiras ensuite ses mouvements, directions et résultats attendus dans Objectif & règles. Les images fixes et les animations restent disponibles."}</p>
      {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]"><p className="text-[13px] text-encre-3">Aucune génération n’est lancée à cette étape.</p><button type="submit" disabled={!nom.trim() || occupe} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">{occupe ? "Création…" : "Créer le sujet"}</button></footer>
  </form>} />
}
