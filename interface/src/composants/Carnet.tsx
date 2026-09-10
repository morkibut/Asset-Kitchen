/**
 * Le carnet — la colonne de gauche, 300 px, **jamais recouverte**.
 *
 * `docs/pistes-2026-09-04/carnet/Navigation.dc.html`. Il remplace les trois
 * onglets : le sommaire du jeu, toujours à l'écran, même pendant une
 * génération. On n'est jamais à plus de deux clics d'où que ce soit, et jamais
 * coincé.
 *
 * **Onze lignes au repos** — le nom du jeu, puis dix, quel que soit le nombre
 * de sujets. Trois sections, et sous elles le pied, qui ne compte pas dans les
 * dix : il est sous le trait, il ne bouge pas quand une section s'ouvre, et il
 * porte ce qui n'appartient à aucun jeu.
 *
 * **Trois règles le tiennent, et elles sont essayées** (`tests/test_b0.py`,
 * `App.test.tsx`) :
 *
 * 1. *Une seule ligne ouverte à la fois.* En ouvrir une referme l'autre.
 * 2. *Le carnet ne dépasse jamais trente lignes*, ouvert au plus grand. Au-delà,
 *    c'est qu'une règle a été enfreinte, pas que le jeu est trop gros.
 * 3. *Il ne se ferme jamais tout seul.* Aucun écran de travail ne prend la
 *    fenêtre entière — seules l'ouverture et le parcours de création le font, et
 *    les deux se demandent.
 *
 * **Ce qu'une famille déplie, ce sont ses collections, jamais ses sujets.**
 * Trois personnages ou cinquante-quatre, le carnet garde la même hauteur : les
 * sujets, c'est la grille qui les montre. `B0` n'en dépliait qu'une — « Tous » —
 * faute de vrai groupe ; `B8` les a écrits et `B9` est le premier écran qui s'en
 * sert, alors elles paraissent enfin.
 *
 * **Et une collection dépliée est une cible de dépôt** (`B9.5`) : c'est là qu'on
 * lâche les sujets choisis dans la grille, et c'est là que s'écrit le « 10 + 3 »
 * qui annonce ce que le groupe contiendra si l'on lâche ici.
 *
 * ⚠️ **La règle n°2 borne le nombre de collections dépliables**, et rien
 * d'autre ne le borne : un jeu à quarante groupes ferait quarante lignes de
 * plus, donc un carnet qui dépasse trente. Au-delà de `COLLECTIONS_AU_PLUS`, la
 * liste s'arrête et une note dit combien manquent — elles restent toutes
 * atteignables depuis le volet *Les ranger* de la grille, qui n'a pas de
 * plafond parce qu'il n'a pas cette règle-là à tenir.
 */

import { useState } from "react"
import { dollars, type GroupeDeRangement, type Projet } from "../api"
import { TOUCHE_DE_LA_BARRE } from "./Barre"
import { GLISSE_DES_SUJETS } from "./Famille"

/** Le plafond de la règle n°2, écrit une fois. */
export const LIGNES_AU_PLUS = 30

/** Combien de collections une famille déplie au plus.
 *
 *  Douze, et le chiffre se déduit de la règle n°2 plutôt que d'un goût : huit
 *  lignes au repos, plus « Tous », plus « + Nouvelle collection », plus douze —
 *  vingt-deux, sous les trente, avec de quoi ajouter une section demain. */
export const COLLECTIONS_AU_PLUS = 12

/**
 * Comment une famille se nomme **dans le carnet**, et nulle part ailleurs.
 *
 * Avec son article, comme la planche l'écrit. Ce n'est pas de la coquetterie :
 * la grille du codex a déjà des boutons nommés *Personnages*, et deux gestes
 * différents portant le même nom dans la même fenêtre ne se distinguent ni à
 * l'œil ni à l'oreille.
 */
export const NOM_DANS_LE_CARNET: Record<string, string> = {
  personnages: "Les personnages",
  objets: "Les objets",
  decors: "Les décors",
  interface: "L'interface",
  equipement: "Les équipements",
}

/**
 * Les cinq familles, sans article — reprises de l'ancien `Codex.tsx` (`C3`),
 * qui les portait seul avant que le carnet et `Famille.tsx` ne les montrent
 * chacun à leur tour. `NOM_DANS_LE_CARNET` ci-dessus porte l'article pour la
 * ligne du carnet ; ces noms-ci servent au fil d'Ariane, qui n'en veut pas.
 */
export const FAMILLES = [
  { cle: "personnages", nom: "Personnages" },
  { cle: "decors", nom: "Décors" },
  { cle: "objets", nom: "Objets" },
  { cle: "interface", nom: "Interface" },
  { cle: "equipement", nom: "Équipement" },
] as const

/** Le nom d'une famille ou d'un équipement pour le fil d'Ariane, sans article. */
export const NOM_DE_LA_RUBRIQUE: Record<string, string> = Object.fromEntries(
  FAMILLES.map((f) => [f.cle, f.nom]),
)

/** Ce qu'une ligne de famille montre. */
export type LigneDeFamille = {
  cle: string
  nom: string
  /** Le compte, ou `null` quand il n'y en a aucun — la ligne écrit « aucun »
   *  plutôt que zéro : *un chiffre affiché est un chiffre compté*, et zéro se
   *  dit mieux avec un mot. */
  compte: number | null
}

/** Les cinq derniers jeux travaillés, au plus, plus ce qu'on en sait. */
export type AutreJeu = { identifiant: string; nom: string; seconde: string }

/** Une pièce d'équipement dépliée sous sa ligne (`B19`).
 *
 *  **Ce que l'équipement déplie, ce sont ses pièces, pas des collections.** Une
 *  collection groupe des sujets ; une pièce n'en est pas un — elle n'a ni pose,
 *  ni direction, ni case —, et la ligne dépliait donc jusqu'ici les groupes du
 *  jeu, qui ne veulent rien dire d'elle. Le compte est celui de ses **emplois**,
 *  parce que c'est ce que la planche écrit : *Epée · 6 emplois*. */
export type LigneDePiece = {
  identifiant: string
  nom: string
  emplois: number
}

/** La clé de la famille qui n'en est pas une — écrite une fois. */
export const EQUIPEMENT = "equipement"

// ── Les pièces ──────────────────────────────────────────────────────────────

/** L'entête d'une section — mono 10.5, majuscules, +.14em. Elle ne se clique
 *  pas : ce n'est pas une ligne du carnet, c'est ce qui les groupe. */
function EnTete({ enfants }: { enfants: string }) {
  return (
    <div className="mesure px-[14px] pt-[14px] pb-[4px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {enfants}
    </div>
  )
}

/**
 * Une ligne du carnet — **trois états, pas quatre** : au repos, survolée,
 * ouverte. `docs/DESIGN.md` § Les onze pièces.
 *
 * Le compte est à droite, en chasse fixe : c'est un fait mesuré. Il ne porte
 * jamais de prix — sauf la ligne des dépenses, dont c'est le sujet.
 */
function Ligne({
  nom,
  compte,
  ouverte,
  decale,
  dit,
  pastille,
  onAller,
}: {
  nom: string
  compte?: string | null
  ouverte?: boolean
  decale?: boolean
  /** Le nom que la ligne **fait entendre**, quand il diffère de celui qu'elle
   *  montre. Un seul cas aujourd'hui : la galerie pendant qu'un lot est en
   *  route. La pastille se lit du coin de l'œil, mais elle ne se dit pas —
   *  mesuré en écrivant l'essai, le calcul du nom accessible ne descend pas
   *  chercher l'`aria-label` d'un enfant, et un nombre sans son unité est la
   *  seule chose du carnet qu'on ne pourrait pas comprendre en l'écoutant.
   *
   *  `undefined` partout ailleurs : **un nom accessible qu'on n'a pas besoin
   *  de réécrire ne se réécrit pas**, sinon il finit par diverger du mot
   *  affiché. */
  dit?: string
  /** Ce qui est payé et pas encore arrivé — **jamais un compte de plus**, mais
   *  ce qu'on attend. Plein, et non un chiffre en rouille : c'est ce qui le
   *  rend visible du coin de l'œil depuis un autre écran, et c'est tout son
   *  métier. */
  pastille?: number | null
  onAller: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAller}
      aria-current={ouverte ? "true" : undefined}
      aria-label={dit}
      data-ligne-du-carnet
      className={[
        "flex h-[30px] w-full shrink-0 items-center gap-[8px] text-left text-[14px]",
        decale ? "pl-[34px] pr-[14px]" : "px-[14px]",
        "transition-colors duration-120",
        ouverte
          ? "bg-ligne-ouverte text-encre"
          : "text-encre-controle hover:bg-papier",
      ].join(" ")}
    >
      <span className="truncate">{nom}</span>
      {pastille != null && pastille > 0 && (
        <span
          aria-hidden
          className="mesure shrink-0 rounded-5 border border-signal px-[4px] text-[10.5px] text-signal"
        >
          {pastille}
        </span>
      )}
      {compte != null && (
        <span className="mesure ml-auto shrink-0 text-[11px] text-encre-4">
          {compte}
        </span>
      )}
    </button>
  )
}

/**
 * Une collection dépliée sous sa famille — **et la cible où l'on lâche.**
 *
 * Trois choses à la fois, et c'est voulu : elle dit ce que le groupe contient,
 * elle l'ouvre dans la grille, et elle reçoit les sujets qu'on lui traîne
 * dessus. La planche les montre comme une seule ligne parce que c'est un seul
 * endroit — celui où l'on range.
 *
 * **Le compte projeté ne s'invente pas ici** : `arrivants` est ce que le parent
 * a calculé, c'est-à-dire les sujets choisis qui n'y sont **pas déjà**. Ranger
 * ce qui est rangé est un geste sans effet (`Collection.avec`) — annoncer
 * « + 3 » puis n'en ajouter qu'un serait mentir sur ce qui va se passer.
 *
 * ⚠️ **`getData` est vide pendant le survol**, dans tous les navigateurs : seul
 * `types` se lit. Ce qui s'affiche pendant le geste vient donc du parent, jamais
 * de la charge du glissement, qui n'est relue qu'au lâcher.
 */
function LigneDeCollection({
  nom,
  sujets,
  arrivants,
  ouverte,
  onAller,
  onDeposer,
}: {
  nom: string
  sujets: number
  /** Combien de sujets arriveraient si l'on lâchait ici, ou `null` quand rien
   *  n'est en train d'être glissé. Zéro n'est pas `null` : c'est « ils y sont
   *  déjà tous », et la ligne doit le dire autrement qu'en s'allumant. */
  arrivants: number | null
  ouverte: boolean
  onAller: () => void
  onDeposer: () => void
}) {
  const [survolee, setSurvolee] = useState(false)
  const vise = survolee && arrivants !== null && arrivants > 0

  return (
    <button
      type="button"
      onClick={onAller}
      aria-current={ouverte ? "true" : undefined}
      data-ligne-du-carnet
      data-collection-du-carnet
      onDragOver={(evenement) => {
        if (!evenement.dataTransfer.types.includes(GLISSE_DES_SUJETS)) return
        // Sans lui, `onDrop` ne part jamais — la règle du DOM, pas un détail.
        evenement.preventDefault()
        setSurvolee(true)
      }}
      onDragLeave={(evenement) => {
        // Passer d'un enfant à l'autre déclenche un `dragleave` : sans cette
        // garde, la ligne clignoterait sous le pointeur.
        if (evenement.currentTarget.contains(evenement.relatedTarget as Node)) return
        setSurvolee(false)
      }}
      onDrop={(evenement) => {
        if (!evenement.dataTransfer.types.includes(GLISSE_DES_SUJETS)) return
        evenement.preventDefault()
        setSurvolee(false)
        onDeposer()
      }}
      className={[
        "flex h-[30px] w-full shrink-0 items-center gap-[8px] pl-[34px] pr-[14px]",
        // Le trait est toujours là, transparent au repos : le poser au survol
        // décalerait la ligne d'un pixel sous le pointeur, juste au moment où
        // l'on vise.
        "border border-dashed border-transparent",
        "text-left text-[14px] transition-colors duration-120",
        vise
          ? "border-signal bg-ligne-ouverte text-signal"
          : ouverte
            ? "bg-ligne-ouverte text-encre"
            : "text-encre-controle hover:bg-papier",
      ].join(" ")}
    >
      <span className="truncate">{nom}</span>
      <span
        className={[
          "mesure ml-auto shrink-0 text-[11px]",
          vise ? "text-signal" : "text-encre-4",
        ].join(" ")}
      >
        {vise ? `${sujets} + ${arrivants}` : sujets}
      </span>
    </button>
  )
}

// ── Le carnet ───────────────────────────────────────────────────────────────

export function Carnet({
  jeu,
  seconde,
  familles,
  collections,
  collectionOuverte,
  piecesDuJeu,
  pieceOuverte,
  surUnePiece,
  arrivants,
  regles,
  lignesEcrites,
  images,
  enRoute,
  depense,
  autresJeux,
  ouvert,
  racine,
  surLeJeu,
  surLaFamille,
  surLaCollection,
  surNouvelleCollection,
  surDeposer,
  surLesRegles,
  surLesReglesDuJeu,
  surLaCreation,
  surLaGalerie,
  surLesDepenses,
  surLaSortie,
  surUnAutreJeu,
  surTousLesJeux,
  surCommencerUnJeu,
  surLaBarre,
  surLeGuide,
  surLInstallation,
  atelierMuet,
  surReessayer,
  cleAbsente,
}: {
  jeu: string
  /** « 45 images · 12 poses sur 18 » — jamais un prix : on ne choisit pas un
   *  jeu sur ce qu'il a coûté. */
  seconde: string
  familles: readonly LigneDeFamille[]
  /** Les collections du jeu, servies par la grille d'une famille (`B9.3`) —
   *  **avec ce qu'elles contiennent de ce jeu-ci**, jamais le total de l'arbre,
   *  qui additionne les univers. Vide tant qu'aucune famille n'a été ouverte :
   *  le carnet ne va pas les chercher lui-même, il montre ce que l'écran a lu. */
  collections: readonly GroupeDeRangement[]
  /** La collection ouverte sous la famille, ou `null` pour « Tous ». */
  collectionOuverte: string | null
  /** Les pièces d'équipement du jeu (`B19`) — ce que *cette* ligne-là déplie, à
   *  la place des collections. */
  piecesDuJeu: readonly LigneDePiece[]
  /** La pièce dont la page est ouverte, ou `null`. */
  pieceOuverte: string | null
  surUnePiece: (piece: string) => void
  /** Combien de sujets arriveraient dans chaque collection si l'on lâchait
   *  maintenant. Vide quand rien n'est glissé. */
  arrivants: Readonly<Record<string, number>>
  /** Ce que la toile de l'univers porte, ou `null`. */
  regles: number | null
  /** Combien des cinq lignes du monde sont écrites (`B14`), ou `null` tant
   *  qu'on ne le sait pas. Les deux autres — le rendu et la vue — ne se tapent
   *  pas : l'atelier les écrit depuis l'allure et la vue choisies. */
  lignesEcrites: number | null
  images: number
  /** Combien d'images sont payées et pas encore arrivées — **zéro la plupart
   *  du temps**, et alors rien ne paraît. La pastille suit d'un lieu à l'autre :
   *  le bloc « en route » du champ de prompt ne se voit que là où l'on a payé,
   *  et c'est ailleurs qu'on croit que rien ne s'est passé. */
  enRoute?: number
  depense: number
  autresJeux: readonly AutreJeu[]
  /** Le lieu où l'on est, pour que la ligne le dise. */
  ouvert: string | null
  /** La surface de repos sur laquelle la pile est posée. */
  racine: string
  surLeJeu: () => void
  surLaFamille: (cle: string) => void
  /** Ouvrir un groupe sous la famille, ou revenir à « Tous » avec `null`. */
  surLaCollection: (cle: string, collection: string | null) => void
  surNouvelleCollection: (cle: string) => void
  /** Lâcher ici. Le parent sait ce qu'on traîne — il l'a posé au départ du
   *  geste — et c'est lui qui range, parce que le carnet ne parle à personne. */
  surDeposer: (collection: string) => void
  surLesRegles: () => void
  /** Rouvrir le parcours des quatre étapes (`B14`) — les mêmes écrans qu'à la
   *  création, et les mêmes écritures. */
  surLesReglesDuJeu: () => void
  /** Demander une image — **l'un des deux endroits d'où l'argent part**,
   *  l'autre étant l'établi d'un sujet. */
  surLaCreation: () => void
  surLaGalerie: () => void
  surLesDepenses: () => void
  /** La sortie (`B21`) — l'écran d'où les fichiers du jeu s'en vont. */
  surLaSortie: () => void
  surUnAutreJeu: (identifiant: string) => void
  surTousLesJeux: () => void
  surCommencerUnJeu: () => void
  /** B6 — la barre. Le pied du carnet l'annonçait depuis `B0` sur un bouton
   *  éteint : elle existe, il s'allume. */
  surLaBarre: () => void
  surLeGuide: () => void
  surLInstallation: () => void
  /** L'atelier ne répond plus. **C'est le seul cas où le pied grandit**, et la
   *  ligne part dès qu'il répond. */
  atelierMuet?: boolean
  surReessayer?: () => void
  /** Aucune clé posée : un point rouille sur l'installation, et rien d'autre.
   *  Pas de bandeau, pas de fenêtre — le point suffit à dire où aller. */
  cleAbsente?: boolean
}) {
  /** **Une seule ligne dépliée à la fois**, et c'est la règle n°4 du design.
   *  Un seul état la tient : en ouvrir une referme l'autre par construction,
   *  plutôt que par une discipline qu'un écran de plus oublierait. */
  const [depliee, setDepliee] = useState<string | null>(null)
  const deplier = (cle: string) => setDepliee((deja) => (deja === cle ? null : cle))

  return (
    <nav
      aria-label="Le carnet"
      data-carnet
      /* La surface de repos sous la ligne allumée. **Le carnet n'allume que la
         ligne la plus profonde** — la famille ouverte, les dépenses —, et la
         racine sur laquelle elle repose ne se lit donc nulle part à l'écran.
         Les essais de navigation la lisent ici, comme ils lisaient l'onglet
         allumé avant `C9`. */
      data-racine={racine}
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-trait bg-papier-cote"
    >
      <div className="defile flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* ── Le nom du jeu — deux cibles sur une ligne ───────────────────── */}
        {/* Le nom ramène au tableau de bord : **c'est le seul chemin de
            retour**, partout ailleurs on descend dans le jeu. Le chevron
            déplie sur place, dans le carnet, comme une famille déplie ses
            collections — ce n'est pas un menu qui flotte, il n'y en a pas. */}
        <div className="flex items-start gap-[4px] px-[14px] pt-[14px] pb-[8px]">
          <button
            type="button"
            onClick={surLeJeu}
            /* Une marque, pas une étiquette : le nom accessible de ce bouton
               est déjà le bon — le nom du jeu et ce qu'il contient. Le
               réécrire en ferait deux vérités à tenir d'accord. */
            data-vers-le-tableau-de-bord
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate font-serif text-[25px] leading-[1.15] text-encre">
              {jeu}
            </span>
            <span className="mesure block truncate text-[11px] text-encre-4">
              {seconde}
            </span>
          </button>
          <button
            type="button"
            onClick={() => deplier("jeux")}
            aria-expanded={depliee === "jeux"}
            aria-label="Les autres jeux"
            className="mt-[4px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-5 text-[13px] text-encre-3 transition-colors duration-120 hover:bg-papier"
          >
            <span aria-hidden>{depliee === "jeux" ? "⌄" : "›"}</span>
          </button>
        </div>

        {depliee === "jeux" && (
          <div className="ligne-qui-souvre">
            {/* Cinq jeux au plus, les cinq derniers travaillés. Le reste est sur
                l'écran d'ouverture, qui les montre en grand et a sa recherche :
                aucun champ de recherche n'apparaît ici. Le jeu ouvert n'y est
                pas — c'est la ligne juste au-dessus. */}
            <EnTete enfants="Les autres jeux" />
            {autresJeux.map((autre) => (
              <button
                key={autre.identifiant}
                type="button"
                onClick={() => surUnAutreJeu(autre.identifiant)}
                className="flex h-[34px] w-full shrink-0 flex-col justify-center pl-[34px] pr-[14px] text-left transition-colors duration-120 hover:bg-papier"
              >
                <span className="truncate text-[13px] text-encre-controle">
                  {autre.nom}
                </span>
                <span className="mesure truncate text-[11px] text-encre-4">
                  {autre.seconde}
                </span>
              </button>
            ))}
            {autresJeux.length > 0 && (
              <Ligne nom="Tous les jeux…" decale onAller={surTousLesJeux} />
            )}
            <Ligne nom="＋ Commencer un jeu" decale onAller={surCommencerUnJeu} />
          </div>
        )}

        {/* ── Ce qui s'applique à tout le jeu ─────────────────────────────── */}
        <EnTete enfants="Les règles du jeu" />
        {/* **Le parcours de `B14`, rouvert.** La planche du carnet le met ici,
            juste sous le nom du jeu : les quatre réglages qui partent avec
            chaque demande d'image. Il porte le compte des lignes de bible
            écrites, parce qu'un carnet dont chaque ligne compte quelque chose
            n'a pas de raison d'en laisser une muette. */}
        <Ligne
          nom="Les règles du jeu"
          compte={lignesEcrites == null ? null : `${lignesEcrites} / 5`}
          ouverte={ouvert === "regles"}
          onAller={surLesReglesDuJeu}
        />
        <Ligne
          nom="La toile de l'univers"
          compte={regles == null ? null : String(regles)}
          ouverte={ouvert === "univers"}
          onAller={surLesRegles}
        />

        {/* ── Ce que le jeu contient ──────────────────────────────────────── */}
        <EnTete enfants="Ce que le jeu contient" />
        {familles.map((famille) => (
          <div key={famille.cle} className="contents">
            <Ligne
              nom={famille.nom}
              compte={famille.compte == null ? "aucun" : String(famille.compte)}
              ouverte={ouvert === famille.cle}
              onAller={() => {
                deplier(famille.cle)
                surLaFamille(famille.cle)
              }}
            />
            {/* ── L'équipement déplie ses pièces (`B19`) ──────────────────── */}
            {/* Elle n'a pas de collections : une collection groupe des sujets,
                et une pièce n'en est pas un. Elle n'a pas non plus de « Tous »
                qui mènerait à une grille — `famille_du_type` ne connaît pas
                l'équipement, et cette grille serait vide à jamais. Ce qu'il y a
                sous la ligne, ce sont les pièces, et chacune ouvre sa page. */}
            {depliee === famille.cle && famille.cle === EQUIPEMENT && (
              <div className="ligne-qui-souvre">
                {piecesDuJeu.length === 0 ? (
                  <div className="px-[14px] pl-[34px] text-[11px] text-encre-4">
                    aucune pièce — elles se nomment depuis la fiche de qui les
                    porte
                  </div>
                ) : (
                  piecesDuJeu.map((piece) => (
                    <Ligne
                      key={piece.identifiant}
                      nom={piece.nom}
                      decale
                      ouverte={pieceOuverte === piece.identifiant}
                      compte={
                        piece.emplois === 0
                          ? "aucun emploi"
                          : `${piece.emplois} ${piece.emplois > 1 ? "emplois" : "emploi"}`
                      }
                      onAller={() => surUnePiece(piece.identifiant)}
                    />
                  ))
                )}
              </div>
            )}

            {depliee === famille.cle && famille.cle !== EQUIPEMENT && (
              <div className="ligne-qui-souvre">
                {/* « Tous » d'abord — c'est la famille entière, et c'est là
                    qu'on retombe en refermant un groupe. */}
                <Ligne
                  nom="Tous"
                  decale
                  ouverte={ouvert === famille.cle && collectionOuverte === null}
                  compte={famille.compte == null ? "aucun" : String(famille.compte)}
                  onAller={() => surLaCollection(famille.cle, null)}
                />
                {collections.slice(0, COLLECTIONS_AU_PLUS).map((groupe) => (
                  <LigneDeCollection
                    key={groupe.identifiant}
                    nom={groupe.nom}
                    sujets={groupe.sujets}
                    arrivants={arrivants[groupe.identifiant] ?? null}
                    ouverte={collectionOuverte === groupe.identifiant}
                    onAller={() => surLaCollection(famille.cle, groupe.identifiant)}
                    onDeposer={() => surDeposer(groupe.identifiant)}
                  />
                ))}
                {collections.length > COLLECTIONS_AU_PLUS && (
                  <div className="px-[14px] pl-[34px] text-[11px] text-encre-4">
                    et {collections.length - COLLECTIONS_AU_PLUS} autres — le
                    volet de la grille les montre toutes
                  </div>
                )}
                <Ligne
                  nom="＋ Nouvelle collection"
                  decale
                  onAller={() => surNouvelleCollection(famille.cle)}
                />
              </div>
            )}
          </div>
        ))}

        {/* ── Toutes les images ───────────────────────────────────────────── */}
        <EnTete enfants="Toutes les images" />
        {/* **Demander une image, et c'est une ligne de plus que la planche**
            (`Navigation.dc.html` en compte dix). La planche dit « la barre pour
            faire quelque chose » ; mais la surface où l'on écrit ce qu'on veut
            fabriquer est un lieu — l'un des deux d'où l'argent part —, et elle
            n'avait plus de porte du tout une fois l'onglet *Créer* tombé
            (`C9`). Une racine sans ligne dans le carnet est une racine
            injoignable, et c'est très exactement la panne que `B0` a payée. */}
        <Ligne
          nom="Fabriquer une image"
          ouverte={ouvert === "creer"}
          onAller={surLaCreation}
        />
        <Ligne
          nom="La galerie"
          compte={String(images)}
          ouverte={ouvert === "galerie"}
          pastille={enRoute}
          dit={
            enRoute
              ? `La galerie · ${enRoute === 1 ? "1 image en route" : `${enRoute} images en route`}`
              : undefined
          }
          onAller={surLaGalerie}
        />
        <Ligne
          nom="Les dépenses"
          compte={dollars(depense)}
          ouverte={ouvert === "depenses"}
          onAller={surLesDepenses}
        />
        {/* ── La sortie (`B21`) ─────────────────────────────────────────────
            **Au-dessus du trait, et c'est une décision.** La planche l'ouvre
            « depuis le pied du carnet » ; le pied porte ce qui appartient à
            l'atelier et n'en porte que trois — la barre, le guide,
            l'installation. Or sortir appartient au *jeu* : le dossier où l'on
            dépose est gardé avec lui, et ce qui part est fait de ses sujets.
            La règle du carnet — ce qui est au jeu au-dessus, ce qui est à
            l'atelier en dessous — tranche donc contre la lettre de la planche,
            et le pied reste à trois boutons. */}
        <Ligne
          nom="La sortie"
          ouverte={ouvert === "sortie"}
          onAller={surLaSortie}
        />

        <div className="h-[14px] shrink-0" />
      </div>

      {/* ── Le pied — sous le trait, il ne compte pas dans les dix ────────── */}
      {/* Tout ce qui appartient au jeu est au-dessus du trait ; ce qui
          appartient à l'atelier est en dessous. Deux boutons, jamais trois, et
          chacun porte la touche qui l'ouvre : c'est le seul endroit du carnet
          qui ne bouge jamais, et on finit par savoir les touches sans les avoir
          apprises. */}
      <div data-pied-du-carnet className="shrink-0 border-t border-trait">
        <button
          type="button"
          onClick={surLaBarre}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          <span className="mesure rounded-5 border border-contour px-[4px] py-px text-[10.5px]">
            {TOUCHE_DE_LA_BARRE}
          </span>
          <span>chercher, ou faire</span>
        </button>
        <button
          type="button"
          onClick={surLeGuide}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          <span className="mesure rounded-5 border border-contour px-[4px] py-px text-[10.5px]">
            ?
          </span>
          <span>Le guide et les touches</span>
        </button>
        <button
          type="button"
          onClick={surLInstallation}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          {cleAbsente && (
            <span
              aria-label="aucune clé n'est posée"
              className="h-[4px] w-[4px] shrink-0 rounded-5 bg-signal"
            />
          )}
          <span>L'installation</span>
        </button>
        {atelierMuet && (
          <div className="flex h-[30px] items-center gap-[8px] border-t border-trait-echec bg-fond-echec px-[14px] text-[12.5px] text-echec">
            <span>l'atelier ne répond plus</span>
            {surReessayer && (
              <button
                type="button"
                onClick={surReessayer}
                className="ml-auto underline"
              >
                réessayer
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

/**
 * Les cinq derniers jeux travaillés, au plus — et **jamais l'ouvert**.
 *
 * ⚠️ **L'ordre devrait être celui du dernier passage, et il ne l'est pas
 * encore** : le serveur ne sait sortir la liste que par date de création, et la
 * date du dernier travail n'est servie par aucune route. C'est écrit dans la
 * planche comme *à écrire*, et ça reste vrai après `B0` — la liste est donc
 * celle de la création, à l'envers, et la seconde ligne dit ce qu'elle sait
 * vraiment : le compte d'images.
 */
export function derniersJeux(
  projets: readonly Projet[],
  courant: string | null,
): AutreJeu[] {
  return projets
    .filter((p) => p.identifiant !== courant)
    .slice(0, 5)
    .map((p) => ({
      identifiant: p.identifiant,
      nom: p.nom,
      seconde: p.assets === 0 ? "aucune image" : `${p.assets} images`,
    }))
}
