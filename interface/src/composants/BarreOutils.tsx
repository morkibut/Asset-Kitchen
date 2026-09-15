// La barre d'outils de la grille — 34 px, `docs/DESIGN.md` § Spacing.
//
// Elle porte ce qui agit sur **la grille** : chercher, filtrer, et ce qu'on
// fait d'une sélection. Rien de ce qui agit sur une image seule n'est ici —
// ça, c'est la fiche.
//
// **C'est aussi la fente de l'annulation.** Le bandeau d'annulation de la liste
// close du § Motion n'a nulle part où être un bandeau : le 27 août, le repli
// hors ligne a été sorti d'un bandeau au motif qu'un bandeau est du châssis en
// travers de la grille. Il se pose donc dans une fente qui existe déjà, dans
// **la même forme que la fente sous Générer** — tiret de 8 px, mono 10.5 px,
// lien `--signal` pour le geste — et il n'ajoute aucune hauteur.
//
// **Portée au papier le 11 septembre 2026 (`D4`)**, avec `Arbre.tsx` : aucune
// planche ne la dessine — `Galerie.dc.html` (`D3`) ne couvre que la grille, la
// tuile, la fiche et le pied. Même structure, même hauteur de 34 px ; seuls
// ses jetons et ses tailles passent au vocabulaire papier de `pieces.tsx` et
// aux listes fermées de `docs/DESIGN.md`.

import { useEffect, useState } from "react"
import type { Collection, Jugement, Projet, RoleDeGalerie, TriDeGalerie } from "../api"
import { LIBELLES_ZOOM, Segments, ZOOMS, type Zoom } from "./pieces"
import { Importer, type Import } from "./Import"

export type Annulation = { identifiants: string[]; expireLe: number }

/** Les libellés des trois listes fermées de RP11 — les mots de la maquette
 *  pour le tri, les mots de `docs/vocabulaire.html` pour le reste. Ils vivent
 *  ici parce que c'est le seul écran qui les montre ; leurs **valeurs**, elles,
 *  sont celles de la route et de l'agent (`api.ts`, `TRIS_DE_GALERIE` /
 *  `ROLES_DE_GALERIE` / `JUGEMENTS`). */
const LIBELLES_TRI: Record<TriDeGalerie, string> = {
  recent: "plus récents",
  ancien: "plus anciens",
  nom: "nom A → Z",
}

const LIBELLES_ROLE: Record<RoleDeGalerie, string> = {
  tous: "tous les rôles",
  origine: "origines",
  derivee: "dérivées",
  calque: "calques",
  equipement: "équipements",
  seule: "images seules",
}

const LIBELLES_JUGEMENT: Record<Jugement, string> = {
  tous: "jugés ou non",
  favori: "favoris",
  "non-juge": "non jugés",
}

export function BarreOutils({
  recherche,
  onRecherche,
  tri,
  onTri,
  role,
  onRole,
  jugement,
  onJugement,
  groupe,
  onGroupe,
  famille,
  onFamille,
  collection,
  collections,
  projets,
  selection,
  onRanger,
  onFavori,
  onSupprimer,
  onVider,
  onAnimer,
  raisonAnimer,
  onExporter,
  exportEnCours,
  entree,
  annulation,
  onAnnuler,
  compte,
  zoom,
  onZoom,
  zoomsIndisponibles,
  zoomRendu,
  sansRecherche = false,
}: {
  recherche: string
  onRecherche: (v: string) => void
  /** L'ordre de la grille (RP11). Il est **choisi ici et appliqué par le
   *  serveur** : trier la page déjà coupée trierait deux cents images sur cinq
   *  cents, et l'auteur croirait voir la plus ancienne de la bibliothèque. */
  tri: TriDeGalerie
  onTri: (tri: TriDeGalerie) => void
  /** Ce qu'une image est — le premier des deux filtres de RP11. */
  role: RoleDeGalerie
  onRole: (role: RoleDeGalerie) => void
  /** Ce que l'auteur en a décidé — le second. **Il a mangé le bouton
   *  *Favoris*** : deux contrôles pour une seule question, c'est exactement ce
   *  que `docs/vocabulaire.html` § Un mot, une chose interdit. */
  jugement: Jugement
  onJugement: (jugement: Jugement) => void
  /** Poser chaque image sous l'origine de sa filiation. */
  groupe: boolean
  onGroupe: (groupe: boolean) => void
  /** La famille qu'on regarde, `""` pour toutes, `"aucune"` pour ce qui
   *  n'appartient à aucune chose du jeu, `"clips"` pour eux seuls — un clip
   *  n'ayant lui-même aucune famille (B22). */
  famille: string
  onFamille: (famille: string) => void
  collection: string | null
  collections: Collection[]
  projets: Projet[]
  selection: string[]
  onRanger: (rangement: { projet?: string | null; collection?: string | null }) => void
  onFavori: (favori: boolean) => void
  onSupprimer: () => void
  onVider: () => void
  /** **En faire une animation** (`RP21`, chemin 2). Un geste de plus sur la
   *  sélection, à côté de Favori et Supprimer — jamais un écran séparé, la
   *  sélection est déjà celle qui compte. */
  onAnimer: () => void
  /** Pourquoi le geste ne se propose pas — grisé, jamais caché, avec sa
   *  raison à côté (`docs/design-motifs.md` § Le grisé porte sa raison). `null`
   *  quand la sélection s'y prête. */
  raisonAnimer: string | null
  /** L'export (US-76). **Permanent**, contrairement aux trois précédents :
   *  c'est le seul geste de sélection que le produit doive montrer *grisé*
   *  quand il n'y a rien à faire (US-77), et un contrôle caché n'apprend
   *  rien. */
  onExporter: () => void
  exportEnCours: boolean
  /** **L'import, et le sort qu'il réserve à ce qui entre** (R3). Ancré à droite
   *  contre l'export, parce que ce sont les deux portes de la bibliothèque et
   *  qu'une porte qui se déplace est une porte qu'on cherche. */
  entree: Import
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
  /** La galerie unifiée porte déjà sa recherche en tête ; ne pas la dupliquer. */
  sansRecherche?: boolean
}) {
  return (
    <div className="flex h-[34px] shrink-0 items-center gap-3 border-b border-trait bg-papier-cote px-4">
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
          sert pas pendant qu'on agit sur une sélection.

          **Et il fallait le dire à la mise en page** — corrigé le 31 août 2026.
          La phrase ci-dessus était l'intention ; le rendu faisait l'inverse.
          Tout vivait dans un seul défilement, donc **ce qui sortait était la
          queue de la rangée**, c'est-à-dire précisément les gestes de la
          sélection : mesuré au navigateur, *Supprimer* s'affichait coupé en
          plein mot et *Désélectionner* était entièrement hors du cadre. Rien
          ne l'annonçait — le défilement horizontal ne dessine aucune barre à
          cette hauteur-là, et un contrôle rogné en silence est un contrôle qui
          n'existe plus.

          Deux groupes, donc, et un seul cède : **ce qui consulte** — chercher,
          filtrer, le compte, le zoom — se replie et défile ; **ce qui agit sur
          la sélection** ne bouge jamais. C'est la même règle que le fil
          d'Ariane de la barre du haut, qui cède en dernier parce qu'il porte ce
          qui ne se devine pas. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden">
        <div className="flex min-w-24 shrink items-center gap-2 overflow-x-auto overflow-y-hidden">
          {/* **Chercher et filtrer ne disparaissent jamais.** Une sélection ajoute
              des gestes ; elle ne prend pas la place de ceux qui étaient là. Sans
              ça, ouvrir une fiche — qui sélectionne — effacerait le filtre posé, et
              « se retrouver exactement où l'on était » (US-37) deviendrait faux
              sans que rien ne l'ait dit. */}
          {!sansRecherche && <input
            value={recherche}
            onChange={(e) => onRecherche(e.target.value)}
            placeholder="Chercher"
            aria-label="Chercher dans la bibliothèque"
            className="mesure h-[26px] w-40 min-w-18 shrink rounded-5 border border-trait bg-carte px-2 text-[11px] text-encre placeholder:text-encre-4"
          />}
          {/* **Le filtre par famille, et sa dernière valeur** (E4). Il range la
              grille par ce que les images appartiennent — et il a **une valeur
              pour ce qui n'appartient à aucune chose du jeu**, parce que c'est un
              état réel et le cas de neuf appels sur vingt-huit : un essai, une
              texture, une image apportée. La taire ferait de ces images-là des
              introuvables, alors que la galerie est leur domicile. */}
          <select
            value={famille}
            onChange={(e) => onFamille(e.target.value)}
            aria-label="Ne montrer qu'une famille, ou les clips"
            // `shrink` et un plancher, plutôt que `shrink-0` : quand la rangée
            // manque de place, un filtre dont le nom se rogne vaut mieux qu'un
            // geste de sélection qui sort du cadre. La liste déroulée, elle,
            // montre les noms entiers — ce n'est pas elle qui est bornée.
            className="mesure h-[26px] w-40 min-w-26 shrink rounded-5 border border-trait bg-carte px-1 text-[11px] text-encre-2"
          >
            <option value="">toutes les familles</option>
            <option value="personnages">personnages</option>
            <option value="decors">décors</option>
            <option value="objets">objets</option>
            <option value="interface">interface</option>
            <option value="aucune">sans sujet</option>
            {/* **Distinct des familles, pas une septième** (B22) : un clip
                n'appartient à aucune chose du jeu, il vient d'une animation.
                Le séparer par une ligne creuse le dit sans un second contrôle,
                que la largeur de cette barre ne laisse pas loger. Une valeur
                à elle, jamais choisissable, pour ne pas la confondre avec
                « toutes les familles » qui vaut déjà la chaîne vide. */}
            <option value="---" disabled>
              ──────────
            </option>
            <option value="clips">clips</option>
          </select>
          {/* **Les deux filtres de RP11, dans la forme du filtre voisin** : même
              hauteur, même largeur, même arrondi, mêmes jetons. Ils ne portent
              aucune taille neuve — un écran qui en réclamerait une est un écran
              mal découpé (`docs/DESIGN.md`).

              **Le jugement remplace le bouton *Favoris*.** Il en disait la
              moitié : *favoris*, et rien pour *ce que je n'ai pas encore jugé*,
              qui est justement la question de l'écran d'ouverture. Deux
              contrôles pour un seul axe, c'était aussi deux mots pour la même
              chose. */}
          <select
            value={role}
            onChange={(e) => onRole(e.target.value as RoleDeGalerie)}
            aria-label="Ne montrer qu'un rôle"
            className="mesure h-[26px] w-40 min-w-26 shrink rounded-5 border border-trait bg-carte px-1 text-[11px] text-encre-2"
          >
            {(Object.keys(LIBELLES_ROLE) as RoleDeGalerie[]).map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_ROLE[valeur]}
              </option>
            ))}
          </select>
          <select
            value={jugement}
            onChange={(e) => onJugement(e.target.value as Jugement)}
            aria-label="Ne montrer qu'un jugement"
            className="mesure h-[26px] w-40 min-w-26 shrink rounded-5 border border-trait bg-carte px-1 text-[11px] text-encre-2"
          >
            {(Object.keys(LIBELLES_JUGEMENT) as Jugement[]).map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_JUGEMENT[valeur]}
              </option>
            ))}
          </select>
          {/* **Le tri est une liste, pas des segments** : trois valeurs dont
              l'une est deux fois plus longue que les autres, et la barre fait
              34 px — des segments auraient poussé les gestes de la sélection
              hors du cadre, ce qui est nommément le défaut mesuré le 31 août
              2026 quelques lignes plus haut. */}
          <select
            value={tri}
            onChange={(e) => onTri(e.target.value as TriDeGalerie)}
            aria-label="Trier la grille"
            className="mesure h-[26px] w-40 min-w-26 shrink rounded-5 border border-trait bg-carte px-1 text-[11px] text-encre-2"
          >
            {(Object.keys(LIBELLES_TRI) as TriDeGalerie[]).map((valeur) => (
              <option key={valeur} value={valeur}>
                {LIBELLES_TRI[valeur]}
              </option>
            ))}
          </select>
          {/* Le regroupement reste une bascule : il n'a que deux états, et
              c'est la forme qu'avait déjà *Favoris* à cette place. */}
          <button
            type="button"
            onClick={() => onGroupe(!groupe)}
            aria-pressed={groupe}
            className={[
              "mesure h-[26px] shrink-0 rounded-7 border px-2 text-[11px] transition-colors duration-120",
              groupe
                ? "border-signal bg-ligne-ouverte text-signal"
                : "border-trait bg-carte text-encre-2 hover:bg-papier-cote",
            ].join(" ")}
          >
            Regrouper
          </button>
          <span className="mesure shrink-0 text-[10.5px] text-encre-4">
            {compte} image{compte > 1 ? "s" : ""}
          </span>

          {/* **Le zoom de la grille**, dans la fente qui existe déjà : aucune
              hauteur neuve sur une barre de 34 px. Trois crans, les mêmes que les
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
              <span className="mesure flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-encre-4">
                <span aria-hidden className="inline-block h-px w-2 bg-encre-4" />
                {zoom}× ne tient pas ici — rendu en {zoomRendu}×
              </span>
            )}
          </div>
        </div>

        {/* **Ce qui agit sur la sélection ne cède jamais.** `shrink-0`, hors du
            défilement du groupe précédent : ces quatre-là ne paraissent que
            parce qu'on vient de choisir des images, et ce qu'on choisit, on
            veut en faire quelque chose tout de suite. */}
        {selection.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <span aria-hidden className="h-4 w-px shrink-0 bg-trait" />
            <span className="mesure shrink-0 text-[10.5px] text-encre-2">
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
              className="mesure h-[26px] shrink-0 px-1 text-[10.5px] text-encre-2 hover:text-signal"
            >
              Favori
            </button>
            <button
              type="button"
              onClick={onSupprimer}
              aria-label="Supprimer la sélection"
              className="mesure h-[26px] shrink-0 px-1 text-[10.5px] text-encre-2 hover:text-echec"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={onAnimer}
              disabled={raisonAnimer !== null}
              title={raisonAnimer ?? undefined}
              aria-label="En faire une animation"
              className="mesure h-[26px] shrink-0 px-1 text-[10.5px] text-encre-2 hover:text-signal disabled:text-encre-4 disabled:hover:text-encre-4"
            >
              En faire une animation
            </button>
            <button
              type="button"
              onClick={onVider}
              className="mesure h-[26px] shrink-0 px-1 text-[10.5px] text-encre-4 hover:text-encre-2"
            >
              Désélectionner
            </button>
          </div>
        )}
      </div>

      {/* **L'export est ancré à droite, et il ne bouge plus.** Les trois gestes
          ci-dessus paraissent avec la sélection et disparaissent avec elle ;
          celui-ci reste, parce que le produit doit dire *pourquoi* il est fermé
          quand rien n'est sélectionné — c'est nommément l'un des grisés de
          `docs/design-motifs.md` § Le grisé porte sa raison. L'y mêler ferait sauter sa
          place d'un rendu à l'autre, et un contrôle qui se déplace au moment où
          on va le cliquer est un contrôle qu'on rate. */}
      <div className="flex shrink-0 items-center gap-3">
        {annulation && <FenteAnnulation annulation={annulation} onAnnuler={onAnnuler} />}
        <Importer etat={entree} />
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
 * La raison se pose **à côté** et non dessous : la barre fait 34 px, et le §
 * Layout de `docs/DESIGN.md` interdit d'ajouter une hauteur ici. C'est la forme
 * qu'a déjà prise le grisé du zoom dans cette même barre — tiret de 8 px, mono
 * 10.5 px, `--encre-4` —, donc rien de neuf à apprendre pour l'œil.
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
        <span className="mesure flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-encre-4">
          <span aria-hidden className="inline-block h-px w-2 bg-encre-4" />
          aucune image sélectionnée
        </span>
      )}
      <button
        type="button"
        onClick={onExporter}
        disabled={vide || enCours}
        aria-label="Exporter la sélection"
        className={[
          "mesure h-[26px] rounded-7 border px-2 text-[11px] transition-colors duration-120",
          "disabled:cursor-not-allowed",
          vide || enCours
            ? "border-trait bg-carte text-encre-4"
            : "border-contour bg-carte text-encre hover:bg-papier-cote",
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
 * L'annulation courte (US-27), dans la forme de `docs/design-motifs.md`, *Le revers*.
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
    <p className="mesure arrivee flex items-center gap-1.5 text-[10.5px] leading-4 whitespace-nowrap text-encre-attention">
      <span aria-hidden className="inline-block h-px w-2 bg-encre-attention" />
      <span>
        {combien} supprimé{combien > 1 ? "s" : ""} · {Math.ceil(reste)} s
      </span>
      <button
        type="button"
        onClick={onAnnuler}
        className="text-signal hover:opacity-70"
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
      className="mesure h-[26px] w-26 shrink-0 rounded-5 border border-trait bg-carte px-1 text-[11px] text-encre-2"
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
