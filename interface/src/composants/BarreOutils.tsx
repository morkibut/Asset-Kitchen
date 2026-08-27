// La barre d'outils de la grille — 38 px, `docs/DESIGN.md` § Spacing.
//
// Elle porte ce qui agit sur **la grille** : chercher, filtrer, et ce qu'on
// fait d'une sélection. Rien de ce qui agit sur une image seule n'est ici —
// ça, c'est la fiche.
//
// **C'est aussi la fente de l'annulation.** Le bandeau d'annulation de la liste
// close du § Motion n'a nulle part où être un bandeau : le 27 août, le repli
// hors ligne a été sorti d'un bandeau au motif qu'un bandeau est du châssis en
// travers de la grille. Il se pose donc dans une fente qui existe déjà, dans
// **la même forme que la fente sous Générer** — tiret de 8 px, mono 10 px, lien
// `--signal` pour le geste — et il n'ajoute aucune hauteur.

import { useEffect, useState } from "react"
import type { Collection, Projet } from "../api"

export type Annulation = { identifiants: string[]; expireLe: number }

export function BarreOutils({
  recherche,
  onRecherche,
  favoris,
  onFavoris,
  collection,
  collections,
  projets,
  selection,
  onRanger,
  onFavori,
  onSupprimer,
  onVider,
  annulation,
  onAnnuler,
  compte,
}: {
  recherche: string
  onRecherche: (v: string) => void
  favoris: boolean
  onFavoris: (v: boolean) => void
  collection: string | null
  collections: Collection[]
  projets: Projet[]
  selection: string[]
  onRanger: (rangement: { projet?: string | null; collection?: string | null }) => void
  onFavori: (favori: boolean) => void
  onSupprimer: () => void
  onVider: () => void
  annulation: Annulation | null
  onAnnuler: () => void
  /** Ce que la grille montre en ce moment. Un compte est un fait mesuré : il
   *  est en mono, comme toute mesure du produit. */
  compte: number
}) {
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-bord bg-fond-1 px-4">
      {/* **Chercher et filtrer ne disparaissent jamais.** Une sélection ajoute
          des gestes ; elle ne prend pas la place de ceux qui étaient là. Sans
          ça, ouvrir une fiche — qui sélectionne — effacerait le filtre posé, et
          « se retrouver exactement où l'on était » (US-37) deviendrait faux
          sans que rien ne l'ait dit. */}
      <input
        value={recherche}
        onChange={(e) => onRecherche(e.target.value)}
        placeholder="Chercher"
        aria-label="Chercher dans la bibliothèque"
        className="mesure h-[26px] w-[160px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
      />
      <button
        type="button"
        onClick={() => onFavoris(!favoris)}
        className={[
          "mesure h-[26px] rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
          favoris
            ? "border-signal bg-signal/13 text-signal"
            : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
        ].join(" ")}
      >
        Favoris
      </button>
      <span className="mesure text-[10px] text-texte-3">
        {compte} image{compte > 1 ? "s" : ""}
      </span>

      {selection.length > 0 && (
        <>
          <span aria-hidden className="h-4 w-px bg-bord" />
          <span className="mesure text-[10px] text-texte-2">
            {selection.length} sélectionné{selection.length > 1 ? "s" : ""}
          </span>
          <ChoixRangement
            projets={projets}
            collections={collections}
            collection={collection}
            onRanger={onRanger}
          />
          <button
            type="button"
            onClick={() => onFavori(true)}
            aria-label="Marquer la sélection en favori"
            className="mesure h-[26px] px-1 text-[10px] text-texte-2 hover:text-signal"
          >
            Favori
          </button>
          <button
            type="button"
            onClick={onSupprimer}
            aria-label="Supprimer la sélection"
            className="mesure h-[26px] px-1 text-[10px] text-texte-2 hover:text-echec"
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={onVider}
            className="mesure h-[26px] px-1 text-[10px] text-texte-3 hover:text-texte-2"
          >
            Désélectionner
          </button>
        </>
      )}

      <div className="ml-auto">
        {annulation && <FenteAnnulation annulation={annulation} onAnnuler={onAnnuler} />}
      </div>
    </div>
  )
}

/**
 * L'annulation courte (US-27), dans la forme du § Motifs, *Le revers*.
 *
 * Elle décompte ce que le **serveur** a dit : c'est lui qui refuse au-delà du
 * délai, et deux délais écrits à deux endroits finiraient par se contredire.
 * Elle disparaît quand l'instant est passé — pas parce qu'elle a été comptée
 * juste, mais parce qu'à ce moment-là le geste n'existe plus.
 */
function FenteAnnulation({
  annulation,
  onAnnuler,
}: {
  annulation: Annulation
  onAnnuler: () => void
}) {
  const [reste, setReste] = useState(() => restant(annulation.expireLe))

  useEffect(() => {
    setReste(restant(annulation.expireLe))
    const battement = setInterval(() => setReste(restant(annulation.expireLe)), 250)
    return () => clearInterval(battement)
  }, [annulation.expireLe])

  if (reste <= 0) return null
  const combien = annulation.identifiants.length

  return (
    <p className="mesure arrivee flex items-center gap-1.5 text-[10px] leading-4 whitespace-nowrap text-epingle">
      <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
      <span>
        {combien} supprimé{combien > 1 ? "s" : ""} · {Math.ceil(reste)} s
      </span>
      <button
        type="button"
        onClick={onAnnuler}
        className="text-signal hover:text-signal-clair"
      >
        Annuler ›
      </button>
    </p>
  )
}

const restant = (expireLe: number) => Math.max(0, expireLe - Date.now() / 1000)

/**
 * Ranger une sélection. Deux niveaux, et pas un de plus.
 *
 * Une liste déroulante plutôt qu'une cible de glisser-déposer : on range une
 * sélection de douze images d'un geste, et douze images ne se traînent pas.
 */
function ChoixRangement({
  projets,
  collections,
  collection,
  onRanger,
}: {
  projets: Projet[]
  collections: Collection[]
  collection: string | null
  onRanger: (rangement: { projet?: string | null; collection?: string | null }) => void
}) {
  return (
    <select
      aria-label="Ranger la sélection"
      value=""
      onChange={(e) => {
        const [genre, identifiant] = e.target.value.split(":")
        if (genre === "projet")
          onRanger({ projet: identifiant || null, collection: null })
        if (genre === "collection") onRanger({ collection: identifiant || null })
        e.target.value = ""
      }}
      className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2"
    >
      <option value="">Ranger…</option>
      {projets.map((p) => (
        <option key={p.identifiant} value={`projet:${p.identifiant}`}>
          projet · {p.nom}
        </option>
      ))}
      <option value="projet:">projet · aucun</option>
      {collections.map((c) => (
        <option key={c.identifiant} value={`collection:${c.identifiant}`}>
          collection · {c.nom}
        </option>
      ))}
      {collection !== null && <option value="collection:">collection · aucune</option>}
    </select>
  )
}
