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
import { LIBELLES_ZOOM, Segments, ZOOMS, type Zoom } from "./chassis"

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
  onExporter,
  exportEnCours,
  annulation,
  onAnnuler,
  compte,
  zoom,
  onZoom,
  zoomsIndisponibles,
  zoomRendu,
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
  /** L'export (US-76). **Permanent**, contrairement aux trois précédents :
   *  c'est le seul geste de sélection que le produit doive montrer *grisé*
   *  quand il n'y a rien à faire (US-77), et un contrôle caché n'apprend
   *  rien. */
  onExporter: () => void
  exportEnCours: boolean
  annulation: Annulation | null
  onAnnuler: () => void
  /** Ce que la grille montre en ce moment. Un compte est un fait mesuré : il
   *  est en mono, comme toute mesure du produit. */
  compte: number
  /** Le cran **choisi**. Il le reste même quand la colonne devient trop
   *  étroite : c'est la règle du modèle du catalogue (US-9), aucune
   *  substitution silencieuse. */
  zoom: Zoom
  onZoom: (zoom: Zoom) => void
  /** Les crans que la largeur courante ne peut pas honorer. **Grisés, pas
   *  cachés** (`docs/DESIGN.md` § Layout) : l'absence n'apprend rien. */
  zoomsIndisponibles: readonly Zoom[]
  /** Le cran auquel la grille rend vraiment. Il diffère du choisi quand celui-ci
   *  ne tient pas — et c'est alors qu'il faut le dire. */
  zoomRendu: Zoom
}) {
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-bord bg-fond-1 px-4">
      {/* **Deux blocs, et un seul cède.** Celui-ci porte tout ce qui varie — la
          sélection ajoute cinq contrôles d'un coup —, et il est le seul à
          pouvoir rétrécir.

          Sans `min-w-0`, une barre trop pleine élargit sa colonne, puis la
          page : mesuré le 27 août 2026 au navigateur, à 1280 px et panneaux
          ouverts, une image sélectionnée demandait 963 px pour 740 — l'export
          partait à 150 px hors de l'écran et l'atelier entier glissait vers la
          droite, en-tête et pied compris.

          **Et il défile plutôt qu'il ne rogne.** Une colonne centrale peut
          descendre à 520 px — 1440 px, quatre colonnes, fiche ouverte —, et
          aucune économie de largeur ne fait tenir 750 px de contrôles dans 390.
          Rogner cacherait Supprimer sans le dire ; défiler le rend atteignable
          et le montre, avec la barre de 9 px que le produit dessine déjà. Ce
          qui cède en premier reste le champ de recherche, celui dont on ne se
          sert pas pendant qu'on agit sur une sélection. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden">
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
          className="mesure h-[26px] w-[160px] min-w-[72px] shrink rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
        <button
          type="button"
          onClick={() => onFavoris(!favoris)}
          className={[
            "mesure h-[26px] shrink-0 rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
            favoris
              ? "border-signal bg-signal/13 text-signal"
              : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
          ].join(" ")}
        >
          Favoris
        </button>
        <span className="mesure shrink-0 text-[10px] text-texte-3">
          {compte} image{compte > 1 ? "s" : ""}
        </span>

        {/* **Le zoom de la grille**, dans la fente qui existe déjà : aucune
            hauteur neuve sur une barre de 38 px. Trois crans, les mêmes que les
            vignettes du tableau — un seul vocabulaire de taille dans tout le
            produit, et les deux contrôles ne cohabitent jamais. */}
        <div className="flex shrink-0 items-center gap-2">
          <Segments
            valeurs={ZOOMS}
            valeur={zoom}
            onChange={onZoom}
            indisponibles={zoomsIndisponibles}
            libelles={LIBELLES_ZOOM}
          />
          {/* Le seul endroit où le produit dit qu'il rend autre chose que ce qui
              est choisi. Il le dit plutôt que de corriger en silence : le cran
              reste celui qu'on a posé, et il redeviendra vrai dès que la colonne
              aura repris sa largeur — un panneau replié, la fiche fermée. */}
          {zoomRendu !== zoom && (
            <span className="mesure flex items-center gap-1.5 whitespace-nowrap text-[10px] text-texte-3">
              <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
              {zoom}× ne tient pas ici — rendu en {zoomRendu}×
            </span>
          )}
        </div>

        {selection.length > 0 && (
          <>
            <span aria-hidden className="h-4 w-px shrink-0 bg-bord" />
            <span className="mesure shrink-0 text-[10px] text-texte-2">
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
              className="mesure h-[26px] shrink-0 px-1 text-[10px] text-texte-2 hover:text-signal"
            >
              Favori
            </button>
            <button
              type="button"
              onClick={onSupprimer}
              aria-label="Supprimer la sélection"
              className="mesure h-[26px] shrink-0 px-1 text-[10px] text-texte-2 hover:text-echec"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={onVider}
              className="mesure h-[26px] shrink-0 px-1 text-[10px] text-texte-3 hover:text-texte-2"
            >
              Désélectionner
            </button>
          </>
        )}
      </div>

      {/* **L'export est ancré à droite, et il ne bouge plus.** Les trois gestes
          ci-dessus paraissent avec la sélection et disparaissent avec elle ;
          celui-ci reste, parce que le produit doit dire *pourquoi* il est fermé
          quand rien n'est sélectionné — c'est nommément l'un des grisés de
          `docs/DESIGN.md` § Le grisé porte sa raison. L'y mêler ferait sauter sa
          place d'un rendu à l'autre, et un contrôle qui se déplace au moment où
          on va le cliquer est un contrôle qu'on rate. */}
      <div className="flex shrink-0 items-center gap-3">
        {annulation && <FenteAnnulation annulation={annulation} onAnnuler={onAnnuler} />}
        <Exporter
          combien={selection.length}
          enCours={exportEnCours}
          onExporter={onExporter}
        />
      </div>
    </div>
  )
}

/**
 * « Exporter la sélection », et sa raison quand il n'y a rien à exporter.
 *
 * La raison se pose **à côté** et non dessous : la barre fait 38 px, et le §
 * Layout de `docs/DESIGN.md` interdit d'ajouter une hauteur ici. C'est la forme
 * qu'a déjà prise le grisé du zoom dans cette même barre — tiret de 8 px, mono
 * 10 px, `--texte-3` —, donc rien de neuf à apprendre pour l'œil.
 *
 * Elle est permanente et jamais au survol : « le produit interdit de proposer
 * puis refuser, l'apparence doit donc dire pourquoi sans qu'on ait à chercher ».
 */
function Exporter({
  combien,
  enCours,
  onExporter,
}: {
  combien: number
  enCours: boolean
  onExporter: () => void
}) {
  const vide = combien === 0
  return (
    <span className="flex items-center gap-1.5">
      {vide && (
        <span className="mesure flex items-center gap-1.5 whitespace-nowrap text-[10px] text-texte-3">
          <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
          aucune image sélectionnée
        </span>
      )}
      <button
        type="button"
        onClick={onExporter}
        disabled={vide || enCours}
        aria-label="Exporter la sélection"
        className={[
          "mesure h-[26px] rounded-[2px] border px-2 text-[11px] transition-colors duration-[80ms]",
          "disabled:cursor-not-allowed",
          vide || enCours
            ? "border-bord bg-fond-2 text-texte-3"
            : "border-bord-fort bg-fond-2 text-texte hover:bg-fond-3",
        ].join(" ")}
      >
        {/* Le compte est **dans** le bouton : c'est ce qui va sortir, et le
            savoir avant de cliquer évite d'exporter une sélection qu'on croyait
            avoir vidée. Une mesure, donc en mono, comme partout. */}
        {enCours ? "Export…" : vide ? "Exporter" : `Exporter ${combien}`}
      </button>
    </span>
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
 *
 * **Sa largeur est posée, pas déduite de ses options.** Un `select` se
 * dimensionne sur son option la plus longue : « collection · Décors du deuxième
 * acte » prendrait 260 px à lui seul et pousserait ses voisins hors de la barre
 * — sans plafond, puisque c'est l'auteur qui nomme ses projets. La largeur d'un
 * contrôle est une décision de mise en page, jamais une conséquence des
 * données ; la liste déroulée, elle, montre les noms entiers, et ce n'est pas
 * elle qui est bornée.
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
      className="mesure h-[26px] w-[104px] shrink-0 rounded-[2px] border border-bord bg-fond-2 px-1 text-[11px] text-texte-2"
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
