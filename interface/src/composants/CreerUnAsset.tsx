import { useState } from "react"
import { api, type Carte, type Personnage, type Piece } from "../api"
import { FAMILLES } from "./Carnet"
import { CadreDialogue } from "./CadreDialogue"
import { Libelle } from "./pieces"

const CHAMP = "min-h-[34px] rounded-7 border border-contour bg-carte px-[14px] py-[8px] text-[13px]"

/** TS2 — ce qu'une note de carte donne à une fenêtre de création : sa première
 *  ligne comme nom proposé, le reste comme description proposée. Le serveur
 *  fait le même calcul si le nom part vide — ici, on ne fait que le montrer
 *  d'avance, pour que l'auteur voie ce qui partira. */
function proposerDepuisLaNote(note: string): { nom: string; description: string } {
  const lignes = note.split("\n")
  const nom = (lignes[0] ?? "").trim()
  const description = lignes.slice(1).join("\n").trim()
  return { nom, description }
}

/** Nommer et décrire l’asset précède ses fabrications. L’objectif détaillé
 * s’ouvre ensuite sur la fiche ; créer ne commande aucune image.
 *
 * **TS2 — un sujet peut aussi naître d'une carte de la toile.** `carteInitiale`
 * arrive quand la fenêtre s'ouvre depuis le panneau d'une carte image ; sans
 * elle, `cartesImages` offre « Partir d'une image de la toile », qui fait le
 * même choix depuis l'intérieur du Codex. Dans les deux cas, la validation
 * passe par `api.creerSujetDepuisCarte` plutôt que `api.creerPersonnage` — et
 * une carte déjà concept art d'un sujet rend `deja` : on ouvre ce sujet-là au
 * lieu d'en créer un second, la forme du doublon au collage (`AGENTS.md`,
 * point 1 du plan TS2). */
export function CreerUnAsset({ familleInitiale, carteInitiale, cartesImages, onFermer, onPersonnage, onPiece, onDeja }: {
  familleInitiale: string
  onFermer: () => void
  onPersonnage: (p: Personnage) => void
  onPiece: (p: Piece) => void
  /** La carte déjà choisie — depuis le panneau d'une carte image. */
  carteInitiale?: Carte | null
  /** Les cartes image du jeu ouvert, pour « Partir d'une image de la toile ».
   *  Absente ou vide : le lien ne paraît pas. */
  cartesImages?: Carte[]
  /** Cette carte est déjà le concept art d'un sujet : on l'ouvre, on n'en crée
   *  pas un second. */
  onDeja?: (identifiant: string) => void
}) {
  const proposition = carteInitiale ? proposerDepuisLaNote(carteInitiale.note) : null
  const [nom, setNom] = useState(proposition?.nom ?? "")
  const [description, setDescription] = useState(proposition?.description ?? "")
  const [famille, setFamille] = useState(
    carteInitiale && carteInitiale.famille !== "tous" ? carteInitiale.famille : familleInitiale || "personnages",
  )
  const [carte, setCarte] = useState<Carte | null>(carteInitiale ?? null)
  const [choisirCarte, setChoisirCarte] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState("")

  const choisir = (c: Carte) => {
    const proposee = proposerDepuisLaNote(c.note)
    setCarte(c)
    setChoisirCarte(false)
    setNom(proposee.nom)
    setDescription(proposee.description)
    if (c.famille !== "tous") setFamille(c.famille)
  }

  async function creer() {
    if ((!carte && !nom.trim()) || occupe) return
    setOccupe(true); setErreur("")
    try {
      if (carte) {
        const reponse = await api.creerSujetDepuisCarte(carte.identifiant, {
          nom: nom.trim(),
          description: description.trim(),
          famille,
        })
        if (reponse.deja) onDeja?.(reponse.deja.identifiant)
        else if (reponse.personnage) onPersonnage(reponse.personnage)
      } else if (famille === "equipement") {
        onPiece((await api.ajouterPiece({ nom: nom.trim(), description: description.trim() })).piece)
      } else {
        onPersonnage((await api.creerPersonnage(nom.trim(), description.trim(), famille)).personnage)
      }
    } catch (e) { setErreur(e instanceof Error ? e.message : "La création n’a pas abouti.") }
    finally { setOccupe(false) }
  }

  return <CadreDialogue titre="Créer un sujet" format="preparation" onFermer={onFermer} enfants={<form className="flex min-h-0 flex-col" onSubmit={e => { e.preventDefault(); void creer() }}>
    <header className="flex items-center justify-between gap-[22px] border-b border-trait px-[30px] py-[22px]"><div><h1 className="font-serif text-[25px]">Créer un sujet</h1><p className="mt-[8px] text-[13px] text-encre-3">Donne-lui sa place dans le jeu, avant de fabriquer ses images.</p></div><button type="button" className={CHAMP} onClick={onFermer} disabled={occupe}>Fermer</button></header>
    <div className="defile min-h-0 space-y-[22px] overflow-y-auto p-[30px] text-[13px]">
      {carte && (
        <div className="flex items-center gap-[14px]">
          <img
            src={api.imageCarte(carte.identifiant, carte.empreinte)}
            alt=""
            className="h-[81px] w-[81px] rounded-7 border border-trait bg-pourtour object-contain"
          />
          <p className="text-encre-3">Cette image entre en bibliothèque comme portrait du sujet.</p>
        </div>
      )}
      {!carteInitiale && !carte && cartesImages && cartesImages.length > 0 && !choisirCarte && (
        <button type="button" className="text-signal hover:opacity-70" onClick={() => setChoisirCarte(true)}>
          Partir d’une image de la toile ›
        </button>
      )}
      {choisirCarte && cartesImages && (
        <div className="flex flex-col gap-[8px]">
          <Libelle aide="codex.depuis-toile">Choisir une carte</Libelle>
          <div className="grid grid-cols-6 gap-[8px]">
            {cartesImages.map((c) => (
              <button
                key={c.identifiant}
                type="button"
                aria-label={proposerDepuisLaNote(c.note).nom || "cette carte"}
                onClick={() => choisir(c)}
                className="aspect-square overflow-hidden rounded-7 border border-trait bg-pourtour hover:border-signal"
              >
                <img src={api.imageCarte(c.identifiant, c.empreinte)} alt="" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
          <button type="button" className="self-start text-encre-3 hover:text-signal" onClick={() => setChoisirCarte(false)}>Annuler</button>
        </div>
      )}
      <label className="flex flex-col gap-[8px]">
        Nom du sujet
        <input autoFocus={!carte} required={!carte} className={CHAMP} value={nom} onChange={e => setNom(e.target.value)} placeholder={carte ? "Vide : le nom vient de la carte" : "Le pèlerin, une épée divine, une auberge…"} />
      </label>
      <label className="flex flex-col gap-[8px]">Famille<select className={CHAMP} value={famille} onChange={e => { const f = e.target.value; setFamille(f); if (f === "equipement") setCarte(null) }}>{FAMILLES.map(f => <option key={f.cle} value={f.cle}>{f.nom}</option>)}</select></label>
      <label className="flex flex-col gap-[8px]">Description créative<textarea className={CHAMP} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Son rôle, sa silhouette et les détails à conserver dans ses différentes images…" /></label>
      <p className="text-encre-3">{famille === "equipement" ? "Sa fiche regroupera ses emplois : les personnages qui le portent et les calques propres à leurs poses, directions et frames." : "Tu définiras ensuite ses mouvements, directions et résultats attendus dans Objectif & règles. Les images fixes et les animations restent disponibles."}</p>
      {erreur && <p role="alert" className="text-echec">{erreur}</p>}
    </div>
    <footer className="flex shrink-0 items-center justify-between gap-[22px] border-t border-trait bg-carte px-[30px] py-[14px]"><p className="text-[13px] text-encre-3">Aucune génération n’est lancée à cette étape.</p><button type="submit" disabled={(!carte && !nom.trim()) || occupe} className="h-[34px] rounded-7 bg-signal px-[22px] text-[13px] text-encre-sur-signal disabled:opacity-50">{occupe ? "Création…" : "Créer le sujet"}</button></footer>
  </form>} />
}
