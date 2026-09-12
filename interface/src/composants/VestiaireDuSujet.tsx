/**
 * Le vestiaire d'un sujet — **ce qu'il porte, en images** (`B19`).
 *
 * La planche `docs/pistes-2026-09-04/carnet/Main.dc.html` le range dans ses
 * trois manques, sous *Le vestiaire — choisir qui porte quoi* : « Une liste
 * par personnage, cochée pièce par pièce. Décocher ne supprime rien : les
 * calques déjà faits restent sur le disque. »
 *
 * (Le renvoi nomme le fichier et non une section : le banc des documents
 * n'indexe aucun titre dans les planches `.dc.html`, et un « § » vers l'une
 * d'elles est cassé par construction.)
 *
 * **Ce n'est pas un lieu** (§ *Ce qui n'est pas un lieu*, en tête de
 * `lieux.ts`) : c'est une section de l'onglet *Sa fiche*, pas un endroit où
 * l'on descend. La page d'une pièce, elle, en est un — et cette section-ci y
 * mène.
 *
 * **Deux gestes, et un seul écrit une relation neuve** :
 *
 * 1. *Nommer une pièce ici l'attribue d'emblée à ce sujet* — c'est le premier
 *    critère de la tranche. Nommer puis dire qui la porte aurait fait deux
 *    gestes là où l'auteur n'en voit qu'un.
 * 2. *Retirer un porteur ne supprime aucune image.* Elles restent dans la
 *    galerie, détachées, et gardent l'identifiant de la pièce comme celui du
 *    sujet : remettre l'emploi les remet dans sa colonne.
 *
 * ⚠️ **Une pièce n'a pas d'image à elle.** La vignette montrée est celle du
 * *calque* retenu sur ce sujet-là — la pièce apparue sur ce corps-ci. C'est
 * pour cette raison que le vestiaire d'un sujet montre des images quand la page
 * de la pièce, elle, n'en montre aucune.
 *
 * **Ce que la planche demande et qui n'est pas ici** : le nombre d'emplacements
 * de corps libres. Un emplacement ne place rien — c'est un nom et un rang
 * (`atelier/domaine/equipement.py`) —, et deux pièces peuvent parfaitement citer
 * le même sans que rien ne s'y oppose. Écrire « les mains sont prises » aurait
 * annoncé une règle que le produit ne tient pas.
 */

import { useEffect, useState, type ReactNode } from "react"
import { api, type Asset, type Personnage, type PieceEtSesEmplois, type VestiaireDuJeu } from "../api"
import { vignetteAsset } from "./Apercu"
import { apiCalques, type CiblesEmploi } from "../api-calques"

/** Ce qu'une pièce portée montre — la pièce, son emploi sur ce sujet-ci, et le
 *  calque retenu qui le représente. */
type Portee = {
  sien: PieceEtSesEmplois
  emploi: PieceEtSesEmplois["emplois"][number]
  /** Le calque retenu qui la représente, ou `null` — elle lui est attribuée
   *  mais rien n'a encore été fabriqué. */
  calque: Asset | null
}

/**
 * Ce que ce sujet porte, lu **une fois** dans le vestiaire résolu du jeu.
 *
 * Le calcul est ici plutôt que dans la page parce qu'il ne sert qu'ici, et il
 * ne recompte rien : `fait` et `attendu` viennent du serveur, qui les mesure
 * avec la même règle que la charge d'un sujet. Un second compte à l'écran
 * aurait fini par contredire le premier sur la première pose écartée.
 */
export function ceQuIlPorte(
  personnage: Personnage,
  vestiaire: VestiaireDuJeu,
): Portee[] {
  // Le calque retenu de chaque pièce, pose par pose — le premier trouvé suffit
  // à la représenter : c'est une vignette, pas une matrice. `retenus` est ce
  // que le serveur a départagé, jamais un choix repris ici : deux règles à deux
  // endroits finiraient par désigner deux images différentes.
  const retenus = new Map<string, Asset>()
  personnage.cases.forEach((une) => {
    Object.entries(une.retenus).forEach(([piece, identifiant]) => {
      if (retenus.has(piece)) return
      const calque = (une.calques[piece] ?? []).find(
        (a) => a.identifiant === identifiant,
      )
      if (calque) retenus.set(piece, calque)
    })
  })

  return vestiaire.pieces.flatMap((sien) => {
    const emploi = sien.emplois.find(
      (e) => e.genre === "porte" && e.porteur === personnage.identifiant,
    )
    if (!emploi) return []
    return [{ sien, emploi, calque: retenus.get(sien.piece.identifiant) ?? null }]
  })
}

function Etiquette({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {children}
    </span>
  )
}

export function VestiaireDuSujet({
  personnage,
  vestiaire,
  onPiece,
  onCreerPiece,
  onRetirerLEmploi,
  onEmploi,
}: {
  personnage: Personnage
  /** Le vestiaire résolu du jeu, ou `null` tant qu'on ne le sait pas. La
   *  section ne va pas le chercher elle-même : elle montre ce que la page a lu,
   *  comme le carnet montre les collections que la grille a lues. */
  vestiaire: VestiaireDuJeu | null
  onPiece: (piece: string) => void
  /** Nommer une pièce **que ce sujet porte** — un seul aller-retour. */
  onCreerPiece: (nom: string) => void
  onRetirerLEmploi: (piece: string, emploi: string) => void
  onEmploi?: (piece: string, emploi: string) => void
}) {
  const [nom, setNom] = useState("")
  const [pieceCommune, setPieceCommune] = useState("")
  const [attente, setAttente] = useState(false)
  const [erreur, setErreur] = useState("")
  const [precis, setPrecis] = useState<Record<string, CiblesEmploi>>({})
  const liens = vestiaire ? ceQuIlPorte(personnage, vestiaire) : []
  const signature = liens.map((p) => `${p.sien.piece.identifiant}:${p.emploi.identifiant}`).join("|")
  useEffect(() => {
    if (!onEmploi || !personnage.projet) return
    let vivant = true
    Promise.all(liens.map(async ({ sien, emploi }) => [sien.piece.identifiant, await apiCalques.cibles({ projet: personnage.projet, piece: sien.piece.identifiant, emploi: emploi.identifiant })] as const))
      .then((r) => { if (vivant) setPrecis(Object.fromEntries(r)) })
      .catch((e: unknown) => { if (vivant) setErreur(e instanceof Error ? e.message : "Impossible de relire les calques précis.") })
    return () => { vivant = false }
    // Les fichiers sont relus quand la fiche revient, ou quand ses emplois changent.
  }, [personnage.identifiant, personnage.projet, signature, Boolean(onEmploi)])

  // **Ce qu'une famille ne peut pas avoir n'existe pas dans son établi** (E15).
  // Un décor n'a pas de vestiaire, et ce n'est pas une section grisée : elle
  // n'est pas là. Le grisé est réservé à ce qui viendra.
  if (!personnage.equipable) return null

  const portees = vestiaire ? ceQuIlPorte(personnage, vestiaire) : []

  const nommer = () => {
    const propre = nom.trim()
    if (!propre) return
    setNom("")
    onCreerPiece(propre)
  }

  return (
    <section
      data-vestiaire-du-sujet
      aria-label={`Le vestiaire de ${personnage.nom}`}
      className="flex flex-col gap-[8px] border-t border-trait pt-[14px]"
    >
      <span className="flex items-baseline justify-between">
        <Etiquette>Son vestiaire</Etiquette>
        <span className="text-[11.5px] text-encre-4">
          ce qu'il porte, lui — pas l'équipement du jeu
        </span>
      </span>

      {vestiaire === null ? (
        <p className="text-[12px] leading-[1.45] text-encre-4">
          Il se lit avec les pièces du jeu.
        </p>
      ) : portees.length === 0 ? (
        <p className="text-[12.5px] leading-[1.45] text-encre-3">
          Il ne porte rien encore. Une pièce nommée ici lui est attribuée
          d'emblée ; les autres pièces du jeu ne lui sont pas proposées.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-[14px]">
          {portees.map(({ sien, emploi, calque }) => (
            <div
              key={sien.piece.identifiant}
              data-piece-portee={sien.piece.identifiant}
              className="flex flex-col gap-[4px]"
            >
              <button
                type="button"
                onClick={() => onEmploi ? onEmploi(sien.piece.identifiant, emploi.identifiant) : onPiece(sien.piece.identifiant)}
                aria-label={`Ouvrir ${sien.piece.nom}`}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-8 border border-trait bg-pourtour transition-colors duration-120 hover:border-encre-4"
              >
                {precis[sien.piece.identifiant]?.variantes.some((v) => v.utilisable) ? <img src={apiCalques.image({ projet: personnage.projet, piece: sien.piece.identifiant, emploi: emploi.identifiant }, precis[sien.piece.identifiant].variantes.find((v) => v.utilisable)!)} alt={`${sien.piece.nom} sur ${personnage.nom}`} className="max-h-full max-w-full object-contain" /> : calque ? (
                  <img
                    src={vignetteAsset(calque, 300)}
                    alt={calque.label}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  /* **Le manque n'a aucune couleur d'alerte** : une case vide
                     est vide, et ce qui la rend visible est le trou dans une
                     rangée pleine. */
                  <span className="px-[14px] text-center text-[12px] text-eteint">
                    aucun calque encore
                  </span>
                )}
              </button>
              <span className="flex items-baseline gap-[4px]">
                <span className="truncate text-[13px] text-encre">
                  {sien.piece.nom}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onRetirerLEmploi(sien.piece.identifiant, emploi.identifiant)
                  }
                  aria-label={`Il ne porte plus ${sien.piece.nom}`}
                  title="ses calques restent, détachés"
                  className="ml-auto shrink-0 text-[12.5px] text-encre-4 transition-colors duration-120 hover:text-echec"
                >
                  ✕
                </button>
              </span>
              <span className="mesure text-[11px] text-encre-4">
                {precis[sien.piece.identifiant] ? `${precis[sien.piece.identifiant].calques_retenus} calques précis retenus · ${precis[sien.piece.identifiant].images_disponibles} cibles disponibles` : onEmploi ? "Lecture des calques…" : `${emploi.fait} / ${emploi.attendu}`} ·{" "}
                {emploi.emplacement_nom || "sans emplacement"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* **Nommer, c'est créer — et l'attribuer** (le premier critère de la
          tranche). Le champ ne propose pas les pièces du jeu : les proposer
          toutes est très exactement ce que la tranche retire. */}
      <div className="flex gap-[8px]">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") nommer()
          }}
          placeholder="nommer une pièce qu'il porte"
          aria-label="Nommer une pièce qu'il porte"
          className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre outline-none placeholder:text-eteint focus:border-encre-4"
        />
        <button
          type="button"
          onClick={nommer}
          disabled={!nom.trim()}
          className="h-[34px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:text-eteint"
        >
          La lui donner
        </button>
      </div>
      <p className="text-[11.5px] leading-[1.45] text-encre-4">
        Elle lui appartient dès qu'elle est nommée. Une pièce nommée ailleurs ne
        porte personne tant qu'on ne le dit pas.
      </p>
      {onEmploi && vestiaire && <div className="mt-[14px] flex flex-col gap-[8px] border-t border-trait pt-[14px]"><label className="flex flex-col gap-[4px] text-[13px] text-encre">Ou utiliser une pièce commune du jeu<select aria-label="Pièce commune à attribuer" value={pieceCommune} onChange={(e) => setPieceCommune(e.target.value)} className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[13px] text-encre-controle"><option value="">Choisir une pièce existante…</option>{vestiaire.pieces.filter((p) => !portees.some((v) => v.sien.piece.identifiant === p.piece.identifiant)).map((p) => <option value={p.piece.identifiant} key={p.piece.identifiant}>{p.piece.nom}</option>)}</select></label><button disabled={!pieceCommune || attente} className="h-[34px] self-start rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle" onClick={async () => { setAttente(true); setErreur(""); try { const r = await api.ajouterEmploi(pieceCommune, { genre: "porte", porteur: personnage.identifiant }); onEmploi(pieceCommune, r.emploi.identifiant) } catch (e) { setErreur(e instanceof Error ? e.message : "La pièce n’a pas pu être attribuée.") } finally { setAttente(false) } }}>Créer son emploi pour {personnage.nom}</button><p className="text-[11px] text-encre-3">La pièce garde son identité commune. Ce personnage possède ses propres calques et placements.</p></div>}
      {erreur && <p role="alert" className="text-[13px] text-echec">{erreur}</p>}
    </section>
  )
}
