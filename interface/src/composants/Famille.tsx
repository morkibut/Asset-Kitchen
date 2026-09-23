/**
 * **La grille d'assets — il n'y en a qu'une** (`RP7`, 16 septembre 2026).
 *
 * Elle montre *toutes les familles* quand on ouvre la porte « Codex », et
 * *une seule* quand on en ouvre une. C'est le même composant, le même appel
 * (`api.familleDeSujets`), les mêmes filtres et les mêmes gestes : avant `RP7`
 * il y avait deux écrans, `BibliothequeDesAssets.tsx` pour la porte et
 * celui-ci pour la famille, et l'auteur atteignait les deux.
 *
 * `docs/PLAN.md` § Les invariants du produit dit ce qui n'est **pas** une
 * grille d'assets, et ne doit donc jamais être ramené ici : la matrice d'un
 * sujet, la réserve, les dépenses, la colonne des sœurs, la toile.
 *
 * **Le filtre, la recherche, la collection et le tri partent au serveur, jamais
 * recalculés ici** : les trois comptes de `filtres` portent sur la famille
 * entière, la page n'en montre qu'une partie. `complet` ne regarde que les
 * images ; les poses et les animations se lisent à côté, telles quelles. Une
 * seule exception, et elle est nommée : sur *toutes les familles*, quatre
 * réponses triées arrivent côte à côte et il faut bien les remettre dans
 * l'ordre — le tri local ne sert qu'à recoudre ces quatre listes, jamais à
 * trier une famille seule.
 *
 * **Un chiffre est en chasse fixe par la classe `mesure`**, la seule que
 * `index.css` déclare pour ça. Une classe inventée ne lève aucune erreur —
 * Tailwind ne produit rien pour un utilitaire inconnu, et le nombre s'affiche
 * simplement dans la chasse du texte, ce que personne ne voit.
 *
 * **Le glisser-déposer : un seul type, `GLISSE_DES_SUJETS`.** Les deux écrans
 * d'avant en employaient deux, incompatibles — du JSON sous
 * `application/x-asset-kitchen-library-subjects` d'un côté, des identifiants
 * séparés par un saut de ligne sous `application/x-sujets-atelier` de l'autre —
 * si bien qu'attraper une carte dans un écran et la lâcher dans l'autre ne
 * faisait rien. Le type retenu est le second ; la raison est écrite dans
 * `docs/PLAN-remise-a-plat.md` § RP7.
 *
 * **Deux cibles de dépôt, et c'est voulu** : les lignes de collection de la
 * colonne de gauche — qu'on voit toujours —, et les puces du volet de droite —
 * qu'on ne voit qu'avec une sélection. La seconde avait disparu avec le carnet
 * mort ; elle est revenue avec la colonne. ⚠️ `getData` est vide pendant
 * `dragover` : le compte projeté (« déjà + arrivants ») se calcule donc **au
 * `dragstart`**, et se garde le temps du geste. **Une collection additionne,
 * elle ne déplace rien** : ranger un sujet ne le retire d'aucune autre.
 *
 * **Aucune couleur d'alerte sur un manque** — ni sur une carte à `0 / N`, ni
 * dans le tableau des poses, ni dans le panneau « Ce qui leur manque » : c'est
 * la règle déjà tenue par `TableauDeBord.tsx` (E2), et le cahier des charges
 * l'impose explicitement pour la vue « Les poses ». La maquette, elle, teinte
 * ces chiffres en rouille — **contradiction assumée** : le rouille du système
 * ne sert qu'au bouton qui lance et au chiffre qui coûte
 * (`interface/src/index.css`), et un manque n'est ni l'un ni l'autre.
 *
 * ⚠️ Le fantôme du glisser est un unique rectangle penché portant le compte —
 * pas la pile de deux ou trois cartes de la maquette : construire proprement
 * une pile aurait demandé plus de temps que ce panneau n'en valait.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  api,
  Refus,
  UNIVERS_VIDE,
  type FiltreDeFamille,
  type GroupeDeRangement,
  type Personnage,
  type Piece,
  type SujetDeLaGrille,
  type Univers,
} from "../api"
import { vignetteAsset } from "./Apercu"
import { FAMILLES } from "./Carnet"
import { useEtatDuParcours } from "./MemoireDuParcours"
import { nomsDesNaturesMatiere, type NatureDuJeu } from "../natures"

/** **Le seul type de glisser d'un ou plusieurs sujets du produit.**
 *
 *  Charge utile : les identifiants, séparés par un saut de ligne. Pas de JSON —
 *  une liste plate se relit sans `JSON.parse` ni `try`, et un `DataTransfer`
 *  doublé dans un essai tient en trois lignes. */
export const GLISSE_DES_SUJETS = "application/x-sujets-atelier"

/** Ce qu'on écrit dans le presse-papier du glisser. */
export function ecrireLeGlisser(identifiants: readonly string[]): string {
  return identifiants.join("\n")
}

/** Ce qu'on y relit. Rend une liste vide plutôt que de lever : un navigateur
 *  peut rendre une chaîne vide, et un `DataTransfer` d'essai peut n'avoir aucun
 *  `getData`. */
export function lireLeGlisser(transfert: DataTransfer | null | undefined): string[] {
  let brut = ""
  try {
    brut = transfert?.getData?.(GLISSE_DES_SUJETS) ?? ""
  } catch {
    brut = ""
  }
  return brut
    .split("\n")
    .map((identifiant) => identifiant.trim())
    .filter(Boolean)
}

// ── Les mots de chaque famille ───────────────────────────────────────────────

const FAMILLES_DE_SUJETS = FAMILLES.filter((f) => f.cle !== "equipement")

const MOTS_DE_FAMILLE: Record<string, { pluriel: string; singulier: string }> = {
  personnages: { pluriel: "personnages", singulier: "personnage" },
  objets: { pluriel: "objets", singulier: "objet" },
  decors: { pluriel: "décors", singulier: "décor" },
  interface: { pluriel: "éléments d'interface", singulier: "élément d'interface" },
  equipement: { pluriel: "équipements", singulier: "équipement" },
}

/** Sans famille, on parle de *sujets* — le mot de `docs/vocabulaire.html` pour
 *  une chose du jeu, quelle que soit sa famille. */
function motsDe(famille: string | null): { pluriel: string; singulier: string } {
  if (famille === null) return { pluriel: "sujets", singulier: "sujet" }
  return MOTS_DE_FAMILLE[famille] ?? { pluriel: famille, singulier: famille }
}

/** Une nature du barème s'écrit en minuscules (`docs/PLAN-rangement.md` D1) —
 *  on ne lui invente pas de pluriel, on lui donne juste sa majuscule. */
function capitaliser(mot: string): string {
  return mot.length > 0 ? mot[0]!.toLocaleUpperCase("fr") + mot.slice(1) : mot
}

/** L'exemple que porte le champ qui nomme, famille par famille (repris de
 *  l'ancien codex, `C3`) — **un exemple, pas une étiquette**. */
const PLACEHOLDER_DE_LA_FAMILLE: Record<string, string> = {
  personnages: "nommer un sujet du jeu",
  decors: "les cavernes du nord, une salle du trône…",
  objets: "un tonneau cerclé de fer, un coffre…",
  interface: "un bouton, un cadre, une jauge…",
}

/** Les trois onglets à zéro — ce qu'on montre pendant le chargement et après un
 *  refus, plutôt qu'un chiffre gardé d'une famille précédente. */
const AUCUN_COMPTE: Record<FiltreDeFamille, number> = {
  tous: 0,
  incomplets: 0,
  "sans-description": 0,
}

export type TriDesSujets = "nom" | "nom-desc" | "resultats"

/** Un sujet de la page, et la famille d'où il vient — utile seulement sur
 *  *toutes les familles*, où quatre listes se mélangent. */
type SujetAffiche = SujetDeLaGrille & { famille: string }

function trierLesSujets(sujets: SujetAffiche[], tri: TriDesSujets): SujetAffiche[] {
  return [...sujets].sort((a, b) =>
    tri === "resultats"
      ? b.compte.images.pretes +
        b.compte.animations.pretes -
        (a.compte.images.pretes + a.compte.animations.pretes) ||
        a.nom.localeCompare(b.nom, "fr")
      : (tri === "nom-desc" ? -1 : 1) * a.nom.localeCompare(b.nom, "fr"),
  )
}

// ── Ce qu'une collection contient déjà, et ce qui arriverait ────────────────

function estDansCollection(sujet: SujetDeLaGrille, collection: string): boolean {
  return sujet.collections.some((c) => c.identifiant === collection)
}

/** Parmi `ids`, combien sont déjà dans `collection` — cherché dans les sujets
 *  de la page en mémoire, jamais dans `GroupeDeRangement.sujets` qui compte
 *  tout le jeu. */
function dejaParmi(
  sujets: readonly SujetDeLaGrille[],
  ids: readonly string[],
  collection: string,
): number {
  return ids.filter((id) => {
    const sujet = sujets.find((s) => s.identifiant === id)
    return sujet != null && estDansCollection(sujet, collection)
  }).length
}

/** Parmi `ids`, ceux qui n'y sont **pas** déjà — jamais le nombre choisi tout
 *  court : ranger ce qui est déjà rangé serait sans effet, et l'annoncer
 *  mentirait. */
function arrivantsParmi(
  sujets: readonly SujetDeLaGrille[],
  ids: readonly string[],
  collection: string,
): string[] {
  return ids.filter((id) => {
    const sujet = sujets.find((s) => s.identifiant === id)
    return sujet == null || !estDansCollection(sujet, collection)
  })
}

// ── Les pièces ────────────────────────────────────────────────────────────

const BOUTON =
  "h-[34px] rounded-7 border border-trait bg-carte px-[14px] text-[13px] text-encre transition-colors duration-120 hover:border-contour disabled:opacity-50"

function Onglet({
  actif,
  onClic,
  children,
}: {
  actif: boolean
  onClic: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={actif}
      onClick={onClic}
      className={[
        "flex h-[26px] items-center rounded-7 px-[14px] text-[13px] transition-colors duration-120",
        actif ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

/** La vignette d'un sujet — un cadre `bg-pourtour`, une image en `lazy` par
 *  dessus, ou rien quand `vignette` est `null` : **jamais l'image entière**,
 *  seulement la réduite (`docs/archive/audit-design-post-v21.html` défaut n° 06). */
function Vignette({
  sujet,
  cote,
  className,
}: {
  sujet: SujetDeLaGrille
  cote: number
  className: string
}) {
  return (
    <span className={`overflow-hidden rounded-5 bg-pourtour ${className}`}>
      {sujet.vignette && (
        <img
          src={api.vignette(sujet.vignette.identifiant, sujet.vignette.empreinte, cote)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </span>
  )
}

function CarteDeGrille({
  sujet,
  choisi,
  onChoisir,
  onPrendreEnMain,
  onFinDeGlissement,
}: {
  sujet: SujetDeLaGrille
  choisi: boolean
  onChoisir: () => void
  onPrendreEnMain: (e: React.DragEvent<HTMLButtonElement>) => void
  onFinDeGlissement: () => void
}) {
  const { animations, images } = sujet.compte
  const pct = animations.demandees > 0 ? Math.round((animations.pretes / animations.demandees) * 100) : 0
  return (
    <button
      type="button"
      draggable
      onDragStart={onPrendreEnMain}
      onDragEnd={onFinDeGlissement}
      onClick={onChoisir}
      aria-pressed={choisi}
      aria-label={`${sujet.nom}, ${animations.pretes} sur ${animations.demandees} animations`}
      data-carte-de-sujet={sujet.identifiant}
      className={[
        "relative flex flex-col gap-[8px] rounded-8 border bg-carte p-[8px] text-left transition-colors duration-120",
        choisi ? "border-signal ring-2 ring-signal/20" : "border-trait hover:border-contour",
      ].join(" ")}
    >
      {choisi && (
        <span
          aria-hidden
          className="absolute right-[8px] top-[8px] flex h-[14px] w-[14px] items-center justify-center rounded-full bg-encre"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--color-carte)" strokeWidth="3.4">
            <path d="M5 12l5 5 9-9" />
          </svg>
        </span>
      )}
      <Vignette sujet={sujet} cote={128} className="aspect-square" />
      <span className="line-clamp-2 min-h-0 text-[12.5px] font-medium leading-[1.25] text-encre">
        {sujet.nom}
      </span>
      <span className="block h-[4px] overflow-hidden rounded-5 bg-papier-cote">
        <span className="block h-full rounded-5 bg-ok" style={{ width: `${pct}%` }} />
      </span>
      <span className="flex items-center justify-between text-[10.5px] text-encre-3">
        <span className="mesure">
          {animations.pretes} / {animations.demandees}
        </span>
        <span className="mesure">{images.pretes === 0 ? "—" : `${images.pretes} im.`}</span>
      </span>
    </button>
  )
}

function LigneDeListe({
  sujet,
  choisi,
  onChoisir,
  onPrendreEnMain,
  onFinDeGlissement,
}: {
  sujet: SujetDeLaGrille
  choisi: boolean
  onChoisir: () => void
  onPrendreEnMain: (e: React.DragEvent<HTMLButtonElement>) => void
  onFinDeGlissement: () => void
}) {
  const { animations, images } = sujet.compte
  return (
    <button
      type="button"
      draggable
      onDragStart={onPrendreEnMain}
      onDragEnd={onFinDeGlissement}
      onClick={onChoisir}
      aria-pressed={choisi}
      data-ligne-de-sujet={sujet.identifiant}
      className={[
        "flex w-full shrink-0 items-center gap-[14px] rounded-8 border bg-carte px-[14px] py-[8px] text-left transition-colors duration-120",
        choisi ? "border-signal" : "border-trait hover:border-contour",
      ].join(" ")}
    >
      <Vignette sujet={sujet} cote={34} className="h-[34px] w-[34px] shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-encre">{sujet.nom}</span>
      <span className="shrink-0 truncate text-[12px] text-encre-3">{sujet.type || "—"}</span>
      <span className="flex shrink-0 flex-wrap gap-[4px]">
        {sujet.collections.map((c) => (
          <span
            key={c.identifiant}
            className="rounded-full border border-trait px-[8px] text-[10.5px] text-encre-2"
          >
            {c.nom}
          </span>
        ))}
      </span>
      <span className="mesure shrink-0 text-[11px] text-encre-3">
        {animations.pretes} / {animations.demandees}
      </span>
      <span className="mesure shrink-0 text-[11px] text-encre-3">
        {images.pretes === 0 ? "—" : `${images.pretes} im.`}
      </span>
    </button>
  )
}

/** Une pièce d'équipement.
 *
 *  **Elle n'est pas un sujet** : elle a des emplois, pas des poses, et aucune
 *  collection ne la range. Elle n'est donc ni glissable ni sélectionnable — le
 *  pied de grille le dit en toutes lettres. */
function LigneDePiece({
  piece,
  apercu,
  enGrille,
  onOuvrir,
}: {
  piece: Piece
  apercu: string | null
  enGrille: boolean
  onOuvrir: () => void
}) {
  return (
    <li data-piece-dequipement={piece.identifiant} className="min-w-0">
      <button
        type="button"
        onClick={onOuvrir}
        className={[
          "flex w-full items-center gap-[14px] rounded-8 border border-trait bg-carte px-[14px] py-[8px] text-left transition-colors duration-120 hover:border-contour",
          enGrille ? "flex-col items-start" : "",
        ].join(" ")}
      >
        <span
          className={[
            "flex shrink-0 items-center justify-center overflow-hidden rounded-5 bg-pourtour",
            enGrille ? "aspect-square w-full" : "h-[34px] w-[34px]",
          ].join(" ")}
        >
          {apercu ? (
            <img
              src={apercu}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain [image-rendering:pixelated]"
            />
          ) : (
            <span className="bg-carte p-[4px] text-[10.5px] text-encre-3">À créer</span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
          <span className="truncate text-[13px] text-encre">{piece.nom}</span>
          <span className="truncate text-[11.5px] text-encre-3">
            Équipement · {piece.description || "Description à écrire"}
          </span>
        </span>
        <span className="shrink-0 text-[12px] text-encre-3">Voir les emplois ›</span>
      </button>
    </li>
  )
}

/** L'union des poses de la page, dans l'ordre où elles apparaissent — jamais
 *  triée, jamais recalculée : c'est `compte.detail` qui les nomme. */
function colonnesDesPoses(
  sujets: readonly SujetDeLaGrille[],
): { identifiant: string; nom: string }[] {
  const vues = new Map<string, string>()
  for (const sujet of sujets)
    for (const d of sujet.compte.detail ?? []) if (!vues.has(d.identifiant)) vues.set(d.identifiant, d.nom)
  return [...vues.entries()].map(([identifiant, nom]) => ({ identifiant, nom }))
}

function TableauDesPoses({ sujets }: { sujets: readonly SujetDeLaGrille[] }) {
  const colonnes = colonnesDesPoses(sujets)
  return (
    <div
      data-tableau-des-poses
      className="defile min-h-0 flex-1 overflow-auto rounded-8 border border-trait bg-carte"
    >
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-[1] whitespace-nowrap bg-carte px-[14px] py-[8px] text-left text-encre-3">
              Sujet
            </th>
            {colonnes.map((c) => (
              <th
                key={c.identifiant}
                className="whitespace-nowrap px-[14px] py-[8px] text-left text-encre-3"
              >
                {c.nom}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sujets.map((sujet) => {
            const parPose = new Map((sujet.compte.detail ?? []).map((d) => [d.identifiant, d]))
            return (
              <tr key={sujet.identifiant} className="border-t border-trait-faible">
                <td className="sticky left-0 whitespace-nowrap bg-carte px-[14px] py-[8px] text-encre">
                  {sujet.nom}
                </td>
                {colonnes.map((c) => {
                  const d = parPose.get(c.identifiant)
                  if (!d)
                    return (
                      <td
                        key={c.identifiant}
                        className="mesure px-[14px] py-[8px] text-center text-encre-4"
                        aria-label={`${sujet.nom}, ${c.nom} : sans objet`}
                      >
                        ·
                      </td>
                    )
                  const complet = d.animations.pretes >= d.animations.demandees
                    && d.images.pretes >= d.images.demandees
                  const teinte = complet
                    ? "text-encre"
                    : d.animations.pretes > 0 || d.images.pretes > 0
                      ? "text-encre-2"
                      : "text-encre-4"
                  return (
                    <td key={c.identifiant} className={`mesure px-[14px] py-[8px] ${teinte}`}>
                      {d.animations.pretes} / {d.animations.demandees} · {d.images.pretes} / {d.images.demandees}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ChipDeRangement({
  groupe,
  deja,
  survolee,
  arrivants,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  groupe: GroupeDeRangement
  deja: number
  survolee: boolean
  arrivants: number
  onDragOver: (e: React.DragEvent<HTMLSpanElement>) => void
  onDragLeave: (e: React.DragEvent<HTMLSpanElement>) => void
  onDrop: (e: React.DragEvent<HTMLSpanElement>) => void
}) {
  return (
    <span
      data-puce-de-rangement={groupe.identifiant}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        "inline-flex h-[26px] items-center gap-[4px] rounded-full px-[14px] text-[12.5px]",
        survolee
          ? "border border-dashed border-signal bg-etiquette-fond-echec font-medium text-echec"
          : "bg-trait-faible text-encre-2",
      ].join(" ")}
    >
      <span>{groupe.nom}</span>
      <span className="mesure">{survolee ? `${deja} + ${arrivants}` : deja}</span>
    </span>
  )
}

/** Le champ qui nomme une collection.
 *
 *  **Il n'y en a qu'un à la fois dans l'écran** : dans le volet quand des
 *  sujets sont choisis — la collection naît pleine —, sous la barre d'outils
 *  sinon, puisque le volet n'existe pas alors. Le « ＋ Collection » de la
 *  colonne de gauche ouvre celui-là : c'est le geste qui ne marchait plus
 *  depuis la mort du carnet, faute d'un endroit où le champ pût paraître. */
function ChampDeCollection({
  nom,
  onNom,
  onCreer,
  onAbandon,
}: {
  nom: string
  onNom: (texte: string) => void
  onCreer: () => void
  onAbandon: () => void
}) {
  return (
    <span className="inline-flex h-[26px] items-center gap-[4px] rounded-full border border-contour px-[8px]">
      <input
        autoFocus
        value={nom}
        onChange={(e) => onNom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreer()
          if (e.key === "Escape") onAbandon()
        }}
        placeholder="Nom de la collection"
        aria-label="Nom de la nouvelle collection"
        className="bg-transparent text-[12.5px] text-encre outline-none"
      />
      <button type="button" onClick={onCreer} className="text-[12.5px] font-medium text-encre">
        Créer
      </button>
    </span>
  )
}

// ── L'écran ───────────────────────────────────────────────────────────────

export function EcranFamille({
  famille,
  nom,
  jeu,
  collectionInitiale = null,
  pieces = [],
  personnages = [],
  univers = UNIVERS_VIDE,
  rafraichi,
  surGroupes,
  surCollection,
  surFamille,
  surToutesLesFamilles,
  surRange,
  surReglages,
  surErreur,
  onOuvrir,
  onCree,
  onPiece,
  onGalerie,
  onTuiles,
  onSons,
  onCreer,
  onCommanderPlusieurs,
}: {
  /** La clé de la famille — "personnages", "objets", "decors", "interface",
   *  "equipement" —, ou `null` pour **toutes les familles** : c'est ce que la
   *  porte « Codex » ouvre. */
  famille: string | null
  /** Son nom dans le carnet — « Les personnages ». Ignoré sans famille. */
  nom?: string
  /** L'identifiant du jeu ouvert. Il part avec chaque rangement : un sujet
   *  n'est unique que par jeu. */
  jeu: string
  /** La collection ouverte au premier rendu. **Ensuite l'écran en est seul
   *  maître** — c'est sa colonne de gauche qui les liste —, et il prévient le
   *  parent par `surCollection`, qui n'en a besoin que pour le fil d'Ariane. */
  collectionInitiale?: string | null
  /** Les pièces d'équipement. Montrées sur *toutes les familles* et sur
   *  *Les équipements*, jamais ailleurs : elles ne sortent pas de la même
   *  route et n'entrent dans aucune collection. */
  pieces?: readonly Piece[]
  /** Les sujets du jeu, pour retrouver l'aperçu d'une pièce équipée. */
  personnages?: readonly Personnage[]
  /** Le barème de l'univers (`RG4`) : `bareme` porte les natures de chaque
   *  famille (champ `famille`), et c'est la colonne de gauche qui les montre
   *  sous la famille ouverte — sans lui, aucun réglage ne les avait jamais
   *  affichées, et l'auteur cherchait ses matières sans les trouver. Vide,
   *  `UNIVERS_VIDE` : les essais qui ne le passent pas ne montrent aucune
   *  nature, ce qui reste vrai plutôt que faux. */
  univers?: Univers
  /** Un compteur que le parent incrémente quand il a rangé quelque chose
   *  ailleurs : la grille se relit. */
  rafraichi: number
  /** Les collections où l'on peut ranger, remontées au parent pour que le fil
   *  d'Ariane puisse nommer celle qui est ouverte. Appelé dans le `.then` du
   *  chargement, jamais pendant le rendu. */
  surGroupes: (groupes: GroupeDeRangement[]) => void
  /** La collection ouverte a changé — pour le fil d'Ariane, rien d'autre. */
  surCollection?: (collection: string | null) => void
  /** Ouvrir une famille : c'est un lieu, et c'est donc le parent qui y va. */
  surFamille?: (famille: string) => void
  /** Revenir à toutes les familles — la porte « Codex ». */
  surToutesLesFamilles?: () => void
  /** À appeler après un rangement fait ici, pour que le parent relise l'arbre. */
  surRange: () => void
  surReglages: () => void
  surErreur: (raison: string) => void
  /** Ouvrir la fiche du sujet — ce que le clic fait par défaut, hors du mode
   *  sélection. */
  onOuvrir: (identifiant: string) => void
  /** **La chose créée se fond dans la liste vivante avant qu'on l'ouvre**
   *  (`C3`, repris du geste de l'ancien codex) : sans ce rappel, `onOuvrir`
   *  désignerait un identifiant que `personnages` ne connaît pas encore, et la
   *  page resterait introuvable jusqu'au prochain message du flux. */
  onCree: (personnage: Personnage) => void
  /** Ouvrir une pièce d'équipement et ses emplois. */
  onPiece?: (identifiant: string) => void
  onGalerie?: () => void
  onTuiles?: () => void
  onSons?: () => void
  /** Le guichet « Créer un sujet », là où nommer sur-le-champ n'a pas de sens :
   *  sans famille choisie, et sur les équipements. */
  onCreer?: (famille: string) => void
  /** Commander plusieurs objets en une planche (P2, V3.5) — offert sur *Tous*
   *  et sur les objets, là où on les choisit. */
  onCommanderPlusieurs?: () => void
}) {
  const mots = motsDe(famille)
  const cle = `grille-assets:${jeu}:${famille ?? ""}`

  /** **Nommer, c'est créer** (US-115) — le geste que le codex portait seul
   *  avant `C3`. Écrire un nom crée la chose sur-le-champ, sans formulaire et
   *  sans un centime, et l'ouvre aussitôt : on la nomme pour la décrire, pas
   *  pour la ranger. */
  const [creationOuverte, setCreationOuverte] = useState(false)
  const [nomDeLaCreation, setNomDeLaCreation] = useState("")
  const [creationEnCours, setCreationEnCours] = useState(false)
  const champDeCreation = useRef<HTMLInputElement>(null)
  /** Une famille de sujets sait nommer sur-le-champ ; les équipements et
   *  *toutes les familles* passent par le guichet, qui demande la famille. */
  const nommeSurLeChamp = famille !== null && famille !== "equipement"

  useEffect(() => {
    if (!creationOuverte) return
    const trame = requestAnimationFrame(() => champDeCreation.current?.focus())
    return () => cancelAnimationFrame(trame)
  }, [creationOuverte])

  const creer = async () => {
    const propre = nomDeLaCreation.trim()
    if (!propre || famille === null) return
    setCreationEnCours(true)
    try {
      const { personnage } = await api.creerPersonnage(propre, "", famille)
      setNomDeLaCreation("")
      setCreationOuverte(false)
      onCree(personnage)
      onOuvrir(personnage.identifiant)
    } catch (erreur) {
      surErreur(erreur instanceof Error ? erreur.message : String(erreur))
    } finally {
      setCreationEnCours(false)
    }
  }

  // **Ce que l'écran retient d'un aller-retour** : la recherche, le filtre, le
  // tri, la vue et la collection ouverte survivent à un détour par une fiche.
  // La limite, non : revenir sur une page déroulée à 600 sujets la ferait
  // recharger entière.
  const [recherche, setRecherche] = useEtatDuParcours(`${cle}:recherche`, "")
  const [filtre, setFiltre] = useEtatDuParcours<FiltreDeFamille>(`${cle}:filtre`, "tous")
  const [tri, setTri] = useEtatDuParcours<TriDesSujets>(`${cle}:tri`, "nom")
  const [vue, setVue] = useEtatDuParcours<"grille" | "liste" | "poses">(`${cle}:vue`, "grille")
  const [collection, setCollection] = useEtatDuParcours<string | null>(
    `${cle}:collection`,
    collectionInitiale,
  )
  const [limite, setLimite] = useState(120)
  /** La nature choisie dans la colonne, sous la famille ouverte (RG4). Une
   *  seule à la fois — cliquer la même l'éteint, comme un onglet qu'on
   *  referme. */
  const [natureFiltree, setNatureFiltree] = useState<string | null>(null)
  // **Les natures du jeu et ce qu'elles peuvent avoir**, demandées à la route
  // qui les sert (rangement, D1) : c'est d'elle qu'on apprend qu'une nature est
  // une matière, donc sans sujets. Vide tant qu'elle n'a pas répondu — on ne
  // retire alors aucune ligne. Montée ici, avant `sujets`, pour pouvoir déjà
  // filtrer la grille (RV11) : une matière n'est plus un sujet, dans aucune
  // liste de sujets, celle-ci comprise.
  const [naturesDuJeu, setNaturesDuJeu] = useState<NatureDuJeu[]>([])
  useEffect(() => {
    let vivant = true
    void Promise.resolve()
      .then(() => api.posesDesTypes())
      .then((recu) => vivant && setNaturesDuJeu(recu?.types ?? []))
      .catch(() => vivant && setNaturesDuJeu([]))
    return () => {
      vivant = false
    }
  }, [])
  const naturesMatiere = useMemo(() => nomsDesNaturesMatiere(naturesDuJeu), [naturesDuJeu])
  /** Les familles vides tiennent sur une seule ligne dépliable (RG4) — fermée
   *  par défaut, personne ne veut lire trois lignes à zéro avant d'avoir
   *  demandé à les voir. */
  const [videsOuvert, setVidesOuvert] = useState(false)
  /** **Le clic ouvre par défaut.** Ranger est un geste choisi, pas la
   *  réponse au premier clic sur une carte : sans ce bouton, un clic pour
   *  regarder un sujet le sélectionnait à la place de l'ouvrir. Couper le
   *  mode vide la sélection — une sélection qu'on ne voit plus n'a plus de
   *  sens. */
  const [modeSelection, setModeSelection] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const [donnee, setDonnee] = useState<{
    sujets: SujetAffiche[]
    groupes: GroupeDeRangement[]
    filtres: Record<FiltreDeFamille, number>
    total: number
  } | null>(null)
  /** Les collections connues, gardées d'une lecture à l'autre : la colonne de
   *  gauche les montre même pendant qu'une autre famille charge, et surtout
   *  même sur *Les équipements*, qui n'interroge aucune route de famille. */
  const [collectionsConnues, setCollectionsConnues] = useState<GroupeDeRangement[]>([])
  /** Le compte de chaque famille, tel que la dernière lecture *sans filtre*
   *  l'a rendu : filtrée, la somme dirait autre chose que ce que la ligne
   *  annonce. */
  const [comptes, setComptes] = useState<Record<string, number>>({})
  const [version, setVersion] = useState(0)
  const [survolee, setSurvolee] = useState<string | null>(null)
  const [rangerOuvert, setRangerOuvert] = useState(false)
  const [nouvelleOuverte, setNouvelleOuverte] = useState(false)
  const [nomNouvelle, setNomNouvelle] = useState("")
  const [occupe, setOccupe] = useState(false)
  const [retourRangement, setRetourRangement] = useState("")
  /** Ce qu'on traîne, et ce que chaque collection gagnerait si on lâchait là.
   *  Calculé au `dragstart` : `getData` est vide pendant un `dragover`. */
  const [glisses, setGlisses] = useState<readonly string[] | null>(null)
  const fantomeRef = useRef<HTMLDivElement | null>(null)

  // **La limite repart à 120 dès qu'on change de famille ou de collection** —
  // jamais héritée d'une autre grille qu'on aurait laissée déroulée.
  //
  // ⚠️ Remise pendant le rendu, pas dans un `useEffect`. Mesuré au navigateur :
  // en effet, la grille partait chercher la collection neuve **avec l'ancienne
  // limite**, puis repartait la chercher à 120 — deux allers-retours, et le
  // premier était le gros (360 sujets pour rien). Écrire l'état pendant le
  // rendu relance la passe avant que le chargement ne parte, si bien qu'un seul
  // appel sort.
  const cleDeLaGrille = `${famille ?? ""} / ${collection ?? ""}`
  const [cleVue, setCleVue] = useState(cleDeLaGrille)
  if (cleVue !== cleDeLaGrille) {
    setCleVue(cleDeLaGrille)
    setLimite(120)
    // La nature choisie appartenait à la famille qu'on quitte : la garder
    // filtrerait la nouvelle sur un mot qu'elle ne connaît pas forcément.
    setNatureFiltree(null)
  }

  /** Les familles que cette page interroge : les quatre, une seule, ou aucune
   *  — les équipements ne sortent pas de cette route. */
  const famillesALire =
    famille === null
      ? FAMILLES_DE_SUJETS.map((f) => f.cle)
      : famille === "equipement"
        ? []
        : [famille]
  const signatureDesFamilles = famillesALire.join(",")

  useEffect(() => {
    let vivant = true
    setDonnee(null)
    const cles = signatureDesFamilles ? signatureDesFamilles.split(",") : []
    Promise.all(
      cles.map(
        async (cleDeFamille) =>
          [
            cleDeFamille,
            await api.familleDeSujets(cleDeFamille, {
              recherche: recherche.trim() || undefined,
              filtre,
              collection,
              limite,
              tri,
            }),
          ] as const,
      ),
    )
      .then((lues) => {
        if (!vivant) return
        // **Une réponse se lit, elle ne se croit pas.** Le double de `fetch`
        // des essais d'écran rend `{}` pour une route qu'il ne connaît pas, et
        // `groupes` remonterait alors `undefined` au parent — qui le tranche.
        const sujets = lues.flatMap(([cleDeFamille, recue]) =>
          (recue.personnages ?? []).map((s) => ({ ...s, famille: cleDeFamille })),
        )
        const groupes = [
          ...new Map(
            lues.flatMap(([, recue]) => recue.groupes ?? []).map((g) => [g.identifiant, g]),
          ).values(),
        ].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
        const filtres = lues.reduce(
          (somme, [, recue]) => ({
            tous: somme.tous + (recue.filtres?.tous ?? 0),
            incomplets: somme.incomplets + (recue.filtres?.incomplets ?? 0),
            "sans-description":
              somme["sans-description"] + (recue.filtres?.["sans-description"] ?? 0),
          }),
          AUCUN_COMPTE,
        )
        setDonnee({
          // Une seule famille : l'ordre est celui du serveur, et rien ne le
          // retouche. Plusieurs : il faut bien recoudre les listes.
          sujets: cles.length > 1 ? trierLesSujets(sujets, tri) : sujets,
          groupes,
          filtres,
          total: lues.reduce((n, [, recue]) => n + (recue.total ?? 0), 0),
        })
        if (lues.length > 0) setCollectionsConnues(groupes)
        if (!recherche.trim() && !collection && filtre === "tous")
          setComptes((avant) => ({
            ...avant,
            ...Object.fromEntries(lues.map(([k, recue]) => [k, recue.total ?? 0])),
          }))
        surGroupes(groupes)
      })
      .catch((erreur: unknown) => {
        if (!vivant) return
        setDonnee({ sujets: [], groupes: [], filtres: AUCUN_COMPTE, total: 0 })
        surGroupes([])
        surErreur(erreur instanceof Refus ? erreur.message : "la famille n'a pas pu être lue")
      })
    return () => {
      vivant = false
    }
    // surGroupes et surErreur sont des rappels du parent, pas des données à
    // relire : les inclure ferait recharger la grille à chaque rendu du parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureDesFamilles, collection, recherche, filtre, limite, tri, rafraichi, version])

  // **Une matière n'est plus un sujet** (RV11), mais un ancien sujet qui en
  // porte encore la nature reste une carte du Codex — sa fiche est le seul
  // endroit où corriger son type (`App.test.tsx`, « un ancien sujet de
  // nature "matière" la garde affichée »). Ce que RV11 retire, ce sont les
  // *listes de travail* qui la proposaient : animer, livrer, classer au
  // montage (`Montage.tsx`, `Livraisons.tsx`, `FabricationSuivie.tsx`).
  const sujetsCharges = donnee?.sujets ?? []
  // **Une nature choisie filtre la page déjà chargée, jamais le serveur**
  // (RG4) : il n'a pas de route pour ça, et la colonne ne compte de toute
  // façon que sur ce qui est déjà en mémoire.
  const sujets = natureFiltree
    ? sujetsCharges.filter((s) => s.type === natureFiltree)
    : sujetsCharges
  const groupes = donnee ? donnee.groupes : collectionsConnues
  const total = donnee?.total ?? 0
  const filtres = donnee?.filtres ?? AUCUN_COMPTE
  const groupeOuvert = collectionsConnues.find((g) => g.identifiant === collection) ?? null

  /** Les pièces d'équipement de la page. **Une pièce n'est dans aucune
   *  collection** : dès qu'une collection est ouverte, il n'y en a aucune à
   *  montrer. */
  const equipements = useMemo(() => {
    if (famille !== null && famille !== "equipement") return []
    if (collection) return []
    const cherche = recherche.trim().toLocaleLowerCase("fr")
    return pieces
      .filter(
        (p) =>
          `${p.nom} ${p.description}`.toLocaleLowerCase("fr").includes(cherche) &&
          (filtre !== "sans-description" || !p.description.trim()),
      )
      .sort((a, b) => (tri === "nom-desc" ? -1 : 1) * a.nom.localeCompare(b.nom, "fr"))
  }, [pieces, famille, collection, recherche, filtre, tri])

  /** L'aperçu d'une pièce : le calque retenu sur un sujet qui la porte, sinon
   *  son artwork, sinon rien — et la vignette dit « À créer » plutôt que de
   *  montrer un cadre vide sans explication. */
  const apercusDesPieces = useMemo(
    () =>
      new Map(
        pieces.map((piece) => {
          const cases = personnages.flatMap((p) => p.cases)
          const calques = cases.flatMap((c) => c.calques[piece.identifiant] ?? [])
          const retenus = new Set(cases.map((c) => c.retenus[piece.identifiant]))
          const calque = calques.find((a) => retenus.has(a.identifiant)) ?? calques[0]
          return [
            piece.identifiant,
            calque
              ? vignetteAsset(calque, 128)
              : piece.concept_arts[0]
                ? api.imageCarte(piece.concept_arts[0], "")
                : null,
          ] as const
        }),
      ),
    [pieces, personnages],
  )

  // **Un monde vide n'a qu'un geste à proposer** (repris de l'ancien codex,
  // `C3`) : sur la famille entière, sans filtre ni recherche, le champ qui
  // nomme s'ouvre de lui-même plutôt que d'attendre un clic sur « Ajouter ».
  useEffect(() => {
    if (
      nommeSurLeChamp &&
      donnee &&
      donnee.total === 0 &&
      collection === null &&
      filtre === "tous" &&
      !recherche.trim()
    )
      setCreationOuverte(true)
  }, [nommeSurLeChamp, donnee, collection, filtre, recherche])

  const choisirFiltre = useCallback(
    (f: FiltreDeFamille) => {
      setFiltre(f)
      setLimite(120)
    },
    [setFiltre],
  )

  const chercher = useCallback(
    (texte: string) => {
      setRecherche(texte)
      setLimite(120)
    },
    [setRecherche],
  )

  /** Ouvrir une collection, ou revenir à toute la famille. Le parent l'apprend
   *  parce que le fil d'Ariane la nomme. */
  const ouvrirLaCollection = useCallback(
    (identifiant: string | null) => {
      setCollection(identifiant)
      setSelection([])
      surCollection?.(identifiant)
    },
    [setCollection, surCollection],
  )

  const basculerChoix = useCallback((identifiant: string) => {
    setSelection((avant) =>
      avant.includes(identifiant) ? avant.filter((id) => id !== identifiant) : [...avant, identifiant],
    )
  }, [])

  /** Couper le mode sélection referme aussi le panneau « Ranger dans… » et
   *  vide ce qui était choisi — rouvrir le mode repart d'une page blanche. */
  const basculerModeSelection = useCallback(() => {
    setModeSelection((v) => !v)
    setSelection([])
    setRangerOuvert(false)
  }, [])

  /** Le clic sur une carte : ouvrir le sujet hors du mode sélection, le
   *  choisir dedans. Un seul geste, deux sens selon le mode — jamais les
   *  deux à la fois. */
  const surClicDeCarte = useCallback(
    (identifiant: string) => {
      if (modeSelection) basculerChoix(identifiant)
      else onOuvrir(identifiant)
    },
    [modeSelection, basculerChoix, onOuvrir],
  )

  const prendreEnMain = useCallback(
    (identifiant: string) => (evenement: React.DragEvent<HTMLButtonElement>) => {
      const cible = selection.includes(identifiant) ? selection : [identifiant]
      if (cible !== selection) setSelection(cible)
      evenement.dataTransfer.setData(GLISSE_DES_SUJETS, ecrireLeGlisser(cible))
      evenement.dataTransfer.effectAllowed = "move"
      setGlisses(cible)
      if (fantomeRef.current && typeof evenement.dataTransfer.setDragImage === "function") {
        fantomeRef.current.textContent =
          cible.length === 1 ? `1 ${mots.singulier}` : `${cible.length} ${mots.pluriel}`
        evenement.dataTransfer.setDragImage(fantomeRef.current, 16, 16)
      }
    },
    [selection, mots.singulier, mots.pluriel],
  )

  const finDeGlissement = useCallback(() => {
    setGlisses(null)
    setSurvolee(null)
  }, [])

  /** Ranger, et **garder les refusés choisis** : réessayer doit porter sur ce
   *  qui a manqué, pas sur tout. `allSettled`, jamais une boucle qui s'arrête
   *  au premier refus. */
  const rangerDans = useCallback(
    async (collectionVisee: string, ids: readonly string[], retirer = false) => {
      if (ids.length === 0) return
      setOccupe(true)
      try {
        const resultats = await Promise.allSettled(
          ids.map((sujet) =>
            retirer
              ? api.retirerSujet(collectionVisee, jeu, sujet)
              : api.rangerSujet(collectionVisee, jeu, sujet),
          ),
        )
        const refuses = ids.filter((_, i) => resultats[i]!.status === "rejected")
        setSelection([...refuses])
        setVersion((n) => n + 1)
        surRange()
        setRetourRangement(
          `${ids.length - refuses.length} ${
            ids.length - refuses.length > 1 ? "sujets" : "sujet"
          } ${retirer ? "retirés de la collection" : "rangés"}. Les images restent conservées.`,
        )
        if (refuses.length)
          surErreur(
            `${refuses.length} rangement(s) n'ont pas abouti. Les sujets concernés restent sélectionnés pour réessayer.`,
          )
      } finally {
        setOccupe(false)
      }
    },
    [jeu, surRange, surErreur],
  )

  /** Lâcher sur une collection. **La charge utile se relit d'abord dans le
   *  `DataTransfer`** — un seul type, un seul format — et l'état interne ne
   *  sert que de filet, pour les navigateurs qui vident `getData` au drop. */
  const deposerSur = useCallback(
    (collectionVisee: string, evenement: React.DragEvent<HTMLElement>) => {
      const lus = lireLeGlisser(evenement.dataTransfer)
      const ids = lus.length ? lus : (glisses ?? [])
      const arrivants = arrivantsParmi(sujets, ids, collectionVisee)
      setGlisses(null)
      void rangerDans(collectionVisee, arrivants)
    },
    [sujets, glisses, rangerDans],
  )

  /** Nommer une collection, et y ranger ce qui est choisi — **s'il y a quelque
   *  chose de choisi**. Sans sélection, elle naît vide, et c'est justement le
   *  cas où le parent doit l'apprendre tout de suite : une collection vide
   *  n'apparaît sur la carte d'aucun sujet. */
  const creerEtRanger = useCallback(async () => {
    const nomSaisi = nomNouvelle.trim()
    if (!nomSaisi) return
    try {
      const { collection: nee } = await api.creerCollection(nomSaisi, jeu)
      setNomNouvelle("")
      setNouvelleOuverte(false)
      for (const sujet of selection) await api.rangerSujet(nee.identifiant, jeu, sujet)
      setVersion((n) => n + 1)
      surRange()
    } catch (erreur) {
      surErreur(erreur instanceof Refus ? erreur.message : "la collection n'a pas pu être créée")
    }
  }, [nomNouvelle, jeu, selection, surRange, surErreur])

  const totalIncomplets = filtres.incomplets
  const montres = sujets.length
  const resteAChanger = montres < total
  const choisis = sujets.filter((s) => selection.includes(s.identifiant))
  const filtresPoses = recherche.trim() !== "" || filtre !== "tous" || collection !== null

  // « Les 1 personnages » ne se dit pas, et une collection d'un seul sujet est
  // le cas ordinaire le jour où on la crée.
  const nomDeLEcran = famille === null ? "Codex" : (nom ?? famille)
  const titre =
    total === 0 ? (
      nomDeLEcran
    ) : total === 1 ? (
      <>
        <span className="mesure">1</span> {mots.singulier}
      </>
    ) : (
      <>
        Les <span className="mesure">{total}</span> {mots.pluriel}
      </>
    )

  const cibleAccepte = (evenement: React.DragEvent<HTMLElement>) =>
    evenement.dataTransfer.types.includes(GLISSE_DES_SUJETS)

  /** Une ligne de collection de la colonne de gauche — **et une cible de dépôt
   *  qu'on voit sans rien avoir choisi**, contrairement aux puces du volet. */
  const ligneDeCollection = (groupe: GroupeDeRangement) => {
    const ouverte = collection === groupe.identifiant
    const cetteSurvolee = survolee === `colonne:${groupe.identifiant}`
    return (
      <button
        type="button"
        key={groupe.identifiant}
        data-collection-de-la-colonne={groupe.identifiant}
        onClick={() => ouvrirLaCollection(groupe.identifiant)}
        onDragOver={(e) => {
          if (!cibleAccepte(e)) return
          e.preventDefault()
          setSurvolee(`colonne:${groupe.identifiant}`)
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setSurvolee((c) => (c === `colonne:${groupe.identifiant}` ? null : c))
        }}
        onDrop={(e) => {
          if (!cibleAccepte(e)) return
          e.preventDefault()
          setSurvolee(null)
          deposerSur(groupe.identifiant, e)
        }}
        aria-current={ouverte ? "page" : undefined}
        className={[
          "flex min-h-[26px] w-full items-center justify-between gap-[8px] rounded-5 px-[8px] text-left text-[12.5px]",
          cetteSurvolee
            ? "border border-dashed border-signal text-echec"
            : ouverte
              ? "bg-ligne-ouverte text-encre"
              : "text-encre-2 hover:bg-papier-cote",
        ].join(" ")}
      >
        <span className="truncate">{groupe.nom}</span>
        <span className="mesure text-[11px] text-encre-3">
          {cetteSurvolee
            ? `${dejaParmi(sujets, glisses ?? [], groupe.identifiant)} + ${
                arrivantsParmi(sujets, glisses ?? [], groupe.identifiant).length
              }`
            : groupe.sujets}
        </span>
      </button>
    )
  }

  /** Une famille est vide **sauf si c'est celle qu'on regarde** — sans quoi
   *  l'ouvrir puis vider son dernier sujet la ferait disparaître sous « Vides »
   *  pendant qu'on la lit encore. */
  const familleEstVide = (f: { cle: string }) =>
    famille !== f.cle && (f.cle === "equipement" ? pieces.length === 0 : comptes[f.cle] === 0)

  // **Un jeu neuf montre toutes ses familles** (corrigé le 20 septembre 2026,
  // relevé par `App.test.tsx` § « sur une installation neuve »). Replier les
  // vides suppose qu'il en reste au moins une à lire ; sur un projet sans aucun
  // sujet, la règle les repliait toutes les cinq et ne laissait rien à cliquer —
  // juste au moment où l'on découvre ce que le jeu peut contenir.
  const toutesVides = FAMILLES.every(familleEstVide)
  const famillesPleines = FAMILLES.filter((f) => toutesVides || !familleEstVide(f))
  const famillesVides = toutesVides ? [] : FAMILLES.filter(familleEstVide)

  /** « Tous les sujets » (RG4) : la somme de ce que chaque ligne de famille
   *  affiche déjà, équipement compris — la même règle qui décide de son
   *  propre chiffre. */
  const totalTousLesSujets = FAMILLES.reduce(
    (somme, f) => somme + (f.cle === "equipement" ? pieces.length : (comptes[f.cle] ?? 0)),
    0,
  )

  /** Une ligne de famille, dépliable sur ses natures et ses collections.
   *
   *  **Les natures ne paraissent que sur la famille ouverte** (RG4) : les
   *  compter suppose les sujets de cette famille déjà en mémoire, ce qui n'est
   *  vrai que d'elle — ou de *toutes les familles*, où `sujets.famille` les
   *  distingue. Une famille dépliée par la seule recherche d'une collection
   *  n'a donc que sa liste de collections, comme avant. */
  const ligneDeFamille = (f: (typeof FAMILLES)[number]) => {
    const ouverte = famille === f.cle
    const etendue = (ouverte || recherche.trim() !== "") && f.cle !== "equipement"
    // Une matière n'est plus un sujet : sa ligne vaudrait toujours « — ». On la
    // garde seulement si des sujets de cette nature sont encore là.
    const natures = univers.bareme.filter(
      (e) =>
        e.famille === f.cle &&
        (!naturesMatiere.has(e.nom) ||
          sujetsCharges.some((s) => s.famille === f.cle && s.type === e.nom)),
    )
    return (
      <div className="mb-[8px]" key={f.cle}>
        <button
          type="button"
          aria-expanded={ouverte}
          onClick={() => {
            ouvrirLaCollection(null)
            surFamille?.(f.cle)
          }}
          className={[
            "flex min-h-[34px] w-full items-center gap-[8px] rounded-7 px-[8px] text-left text-[13px]",
            ouverte ? "bg-ligne-ouverte text-encre" : "text-encre-2 hover:bg-papier-cote",
          ].join(" ")}
        >
          <span aria-hidden>{ouverte ? "▾" : "▸"}</span>
          <span className="truncate">{f.nom}</span>
          <span className="mesure ml-auto text-[11px] text-encre-3">
            {f.cle === "equipement" ? pieces.length : (comptes[f.cle] ?? "")}
          </span>
        </button>
        {etendue && (
          <div className="ml-[14px] border-l border-trait pl-[8px]">
            <button
              type="button"
              className="min-h-[26px] w-full px-[8px] text-left text-[12.5px] text-encre-2 hover:text-encre"
              onClick={() => ouvrirLaCollection(null)}
            >
              Tout voir
            </button>
            {/* **Une nature à zéro se montre quand même** (RG4) : c'est elle
                qui apprend à l'auteur qu'elle existe — une matière générée
                pour la première fois n'aurait sinon jamais eu de ligne où
                apparaître. */}
            {ouverte &&
              natures.map((nature) => {
                const compte = sujetsCharges.filter(
                  (s) => s.famille === f.cle && s.type === nature.nom,
                ).length
                const active = natureFiltree === nature.nom
                return (
                  <button
                    type="button"
                    key={nature.nom}
                    aria-pressed={active}
                    onClick={() => setNatureFiltree((n) => (n === nature.nom ? null : nature.nom))}
                    className={[
                      "flex min-h-[26px] w-full items-center justify-between gap-[8px] rounded-5 px-[8px] text-left text-[12.5px]",
                      active ? "bg-ligne-ouverte text-encre" : "text-encre-2 hover:bg-papier-cote",
                    ].join(" ")}
                  >
                    <span className="truncate">{capitaliser(nature.nom)}</span>
                    <span className="mesure text-[11px] text-encre-3">
                      {compte === 0 ? "—" : compte}
                    </span>
                  </button>
                )
              })}
            {ouverte && natures.length > 0 && (
              <p className="mesure mb-[4px] mt-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                Collections
              </p>
            )}
            {collectionsConnues
              .filter(
                // **La collection ouverte reste toujours visible** — un mot
                // cherché pour un sujet ne la nomme pas forcément, et la faire
                // disparaître effacerait le seul repère de là où l'on est.
                (g) =>
                  g.identifiant === collection ||
                  g.nom.toLocaleLowerCase("fr").includes(recherche.trim().toLocaleLowerCase("fr")),
              )
              .map(ligneDeCollection)}
            <button
              type="button"
              className="min-h-[26px] w-full px-[8px] text-left text-[12.5px] text-signal"
              onClick={() => setNouvelleOuverte(true)}
            >
              ＋ Collection
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    // `bg-papier` sur la racine, comme `TableauDeBord.tsx` : le châssis autour
    // est encore sombre, et un écran de la V4 qui ne pose pas son fond se
    // retrouve à dessiner des cartes claires sur le noir de l'ancien atelier.
    <main
      data-ecran-famille
      data-grille-dassets
      aria-label={famille === null ? "Codex" : `La famille ${nomDeLEcran}`}
      className="flex min-h-0 flex-1 overflow-hidden bg-papier"
    >
      {/* Le fantôme du glisser — hors écran, son contenu est écrit à la main au
          moment du `dragstart` (le rendu React n'a pas le temps de se refaire
          avant que le navigateur ne capture l'image). */}
      <div
        ref={fantomeRef}
        aria-hidden
        className="pointer-events-none fixed left-[-1000px] top-[-1000px] flex items-center gap-[8px] rounded-8 border border-signal bg-carte px-[14px] py-[8px] text-[12px] text-encre"
      />

      {/* ── La colonne des familles et des collections ─────────────────────
          Elle vivait dans la seule porte « Les assets » ; la grille d'une
          famille n'en avait aucune depuis la mort du carnet, et perdait du
          même coup sa seconde cible de dépôt. */}
      <nav
        aria-label="Familles et collections"
        className="defile w-navigation-atelier shrink-0 overflow-y-auto border-r border-trait px-[14px] py-[22px]"
      >
        {/* **Un seul champ de recherche** (RV11) : celui-ci doublait celui de
            la barre d'outils, tous deux sur le même état `recherche` — deux
            champs pour un seul mot tapé. Retiré ; le champ de la barre
            d'outils cherche déjà un sujet ou une collection, et déplie les
            familles pour montrer une collection dedans. */}
        <button
          type="button"
          className={`mb-[8px] flex w-full items-center gap-[8px] text-left ${BOUTON}`}
          aria-current={famille === null && !collection ? "page" : undefined}
          onClick={() => {
            ouvrirLaCollection(null)
            surToutesLesFamilles?.()
          }}
        >
          <span>Tous les sujets</span>
          <span className="mesure ml-auto text-encre-3">{totalTousLesSujets}</span>
        </button>
        {famillesPleines.map(ligneDeFamille)}
        {famillesVides.length > 0 && (
          <div className="mb-[8px]">
            <button
              type="button"
              aria-expanded={videsOuvert}
              onClick={() => setVidesOuvert((v) => !v)}
              className="flex min-h-[34px] w-full items-center gap-[8px] rounded-7 px-[8px] text-left text-[13px] text-encre-2 hover:bg-papier-cote"
            >
              <span aria-hidden>{videsOuvert ? "▾" : "▸"}</span>
              <span className="truncate">
                Vides : {famillesVides.map((f) => f.nom).join(", ")}
              </span>
            </button>
            {videsOuvert && famillesVides.map(ligneDeFamille)}
          </div>
        )}
        {/* **Ce que le jeu a d'autre, dit comme tel** (RG4) : « Les tuiles » et
            « Les sons » ressemblaient à des familles alors que ce sont
            d'autres écrans, sans fiche ni pose ni collection. */}
        {(onTuiles || onSons || onGalerie) && (
          <div className="mt-[14px] border-t border-trait pt-[14px]">
            <p className="mesure mb-[8px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              Ailleurs dans le jeu
            </p>
            {onTuiles && (
              <button
                type="button"
                className="block min-h-[26px] w-full px-[8px] text-left text-[12.5px] text-encre-2 hover:text-encre"
                onClick={() => onTuiles()}
              >
                Les tuiles
              </button>
            )}
            {onSons && (
              <button
                type="button"
                className="block min-h-[26px] w-full px-[8px] text-left text-[12.5px] text-encre-2 hover:text-encre"
                onClick={() => onSons()}
              >
                Les sons
              </button>
            )}
            {onGalerie && (
              <button
                type="button"
                className="block min-h-[26px] w-full px-[8px] text-left text-[12.5px] text-encre-2 hover:text-encre"
                onClick={onGalerie}
              >
                La galerie — toutes les images
              </button>
            )}
          </div>
        )}
      </nav>

      <section className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-hidden px-[30px] pt-[22px]">
        {/* ── Le fil, le titre, les actions ─────────────────────────────── */}
        <div className="flex items-baseline gap-[8px] text-[12.5px] text-encre-3">
          <span>{nomDeLEcran}</span>
          <span aria-hidden>›</span>
          {/* Tant que la grille charge, les collections ne sont pas connues et
              le nom reste introuvable : on n'écrit rien plutôt qu'« Tous »,
              qui serait faux. */}
          <span className="text-encre">
            {collection === null ? "Tous" : (groupeOuvert?.nom ?? "")}
          </span>
        </div>

        <div className="flex items-end justify-between gap-[22px]">
          <div className="flex flex-col gap-[4px]">
            {famille === null ? (
              <h1 className="font-serif text-[38px] leading-[1.05] text-encre">Codex</h1>
            ) : (
              <h1 className="font-serif text-[38px] leading-[1.05] text-encre">{titre}</h1>
            )}
            <p className="text-[13px] text-encre-2">
              {famille === null
                ? "Le Codex, rangé par famille et par collection."
                : collectionsConnues.length > 0
                  ? `Rangés dans ${collectionsConnues.length} collections. Un même ${mots.singulier} peut être dans plusieurs.`
                  : "Aucune collection encore. Une collection range sans contraindre."}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-[8px]">
            {nommeSurLeChamp && (
              <button
                type="button"
                onClick={surReglages}
                className="flex h-[34px] shrink-0 items-center gap-[4px] rounded-7 border border-trait bg-carte px-[14px] text-[13px] text-encre transition-colors duration-120 hover:border-contour"
              >
                <span>Réglages de la famille</span>
                <span aria-hidden className="text-encre-4">
                  ›
                </span>
              </button>
            )}
            {nommeSurLeChamp && creationOuverte ? (
              <>
                <input
                  ref={champDeCreation}
                  value={nomDeLaCreation}
                  onChange={(e) => setNomDeLaCreation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void creer()
                    if (e.key === "Escape") setCreationOuverte(false)
                  }}
                  disabled={creationEnCours}
                  placeholder={PLACEHOLDER_DE_LA_FAMILLE[famille ?? ""] ?? "nommer un sujet du jeu"}
                  aria-label="Nom du sujet du jeu à créer"
                  className="h-[34px] min-w-0 flex-1 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre outline-none"
                />
                <span className="shrink-0 text-[11px] text-encre-4">Entrée le crée</span>
              </>
            ) : (
              <>
              {onCommanderPlusieurs && (!famille || famille === "objets") && (
                <button
                  type="button"
                  onClick={onCommanderPlusieurs}
                  className="h-[34px] shrink-0 rounded-7 border border-contour bg-carte px-[14px] text-[13px] text-encre-controle hover:border-encre-3"
                >
                  Commander plusieurs objets
                </button>
              )}
              {/* **Un seul bouton rouille par écran** (`docs/DESIGN.md` § Les onze
                  pièces) : c'est celui-ci, et son libellé change avec ce qu'on
                  peut faire ici. Dans une famille, nommer suffit à créer ; sans
                  famille choisie, il faut d'abord dire laquelle, et c'est le
                  guichet qui le demande. */}
              <button
                type="button"
                onClick={() =>
                  // Sur *Les équipements*, le guichet s'ouvre déjà sur la bonne
                  // famille : on y vient pour créer une pièce, pas un
                  // personnage. Sans famille choisie, il le demande.
                  nommeSurLeChamp ? setCreationOuverte(true) : onCreer?.(famille ?? "personnages")
                }
                className="h-[34px] shrink-0 rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:bg-echec"
              >
                {nommeSurLeChamp ? `Ajouter un ${mots.singulier}` : "Créer un sujet"}
              </button>
              </>
            )}
          </div>
        </div>

        {/* ── La barre d'outils ──────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="flex h-[34px] flex-1 items-center gap-[8px] rounded-7 border border-trait bg-carte px-[14px]">
            <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-encre-4)" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              type="search"
              value={recherche}
              onChange={(e) => chercher(e.target.value)}
              placeholder="Chercher…"
              aria-label={famille === null ? "Rechercher un sujet" : `Chercher un ${mots.singulier}`}
              className="w-full bg-transparent text-[13px] text-encre outline-none placeholder:text-encre-4"
            />
          </span>

          <div role="tablist" aria-label="La vue" className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            <Onglet actif={vue === "grille"} onClic={() => setVue("grille")}>
              La grille
            </Onglet>
            <Onglet actif={vue === "liste"} onClic={() => setVue("liste")}>
              La liste
            </Onglet>
            <Onglet actif={vue === "poses"} onClic={() => setVue("poses")}>
              Les poses
            </Onglet>
          </div>

          <div role="tablist" aria-label="Le filtre" className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
            <Onglet actif={filtre === "tous"} onClic={() => choisirFiltre("tous")}>
              Tous les sujets
            </Onglet>
            <Onglet actif={filtre === "incomplets"} onClic={() => choisirFiltre("incomplets")}>
              Incomplets <span className="mesure ml-[4px]">{filtres.incomplets}</span>
            </Onglet>
            <Onglet
              actif={filtre === "sans-description"}
              onClic={() => choisirFiltre("sans-description")}
            >
              Sans description <span className="mesure ml-[4px]">{filtres["sans-description"]}</span>
            </Onglet>
          </div>

          <label className="flex items-center gap-[4px] text-[12px] text-encre-3">
            Trier
            <select
              value={tri}
              onChange={(e) => setTri(e.target.value as TriDesSujets)}
              aria-label="Trier les sujets"
              className="h-[26px] rounded-7 border border-trait bg-carte px-[8px] text-[12.5px] text-encre"
            >
              <option value="nom">Nom A → Z</option>
              <option value="nom-desc">Nom Z → A</option>
              <option value="resultats">Plus de résultats</option>
            </select>
          </label>

          <button
            type="button"
            aria-pressed={modeSelection}
            onClick={basculerModeSelection}
            className={[
              "ml-auto flex h-[34px] shrink-0 items-center gap-[4px] rounded-7 border px-[14px] text-[13px] transition-colors duration-120",
              modeSelection
                ? "border-signal bg-ligne-ouverte text-signal"
                : "border-trait bg-carte text-encre hover:border-contour",
            ].join(" ")}
          >
            Sélection
          </button>
          {/* **Cocher la page d'un coup** — le geste de l'ancienne porte
              « Les assets ». Il vit à côté du bouton qui arme le mode, et non
              dans la barre de masse : celle-ci ne paraît qu'avec une sélection,
              et le geste qui la crée ne peut pas attendre qu'elle existe. */}
          {modeSelection && (
            <button
              type="button"
              disabled={sujets.length === 0 || occupe}
              onClick={() => setSelection(sujets.map((s) => s.identifiant))}
              className={`shrink-0 ${BOUTON}`}
            >
              Sélectionner cette page
            </button>
          )}
        </div>

        {filtresPoses && (
          <div className="flex flex-wrap items-center gap-[8px] text-[12.5px]">
            <button
              type="button"
              className="text-encre-2 underline"
              onClick={() => {
                setRecherche("")
                setFiltre("tous")
                ouvrirLaCollection(null)
                setLimite(120)
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* ── Nommer une collection sans rien avoir choisi ────────────────── */}
        {nouvelleOuverte && selection.length === 0 && (
          <div
            data-nouvelle-collection
            className="flex items-center gap-[8px] rounded-8 border border-trait bg-carte px-[14px] py-[8px]"
          >
            <span className="text-[12.5px] text-encre-2">
              Une collection de plus dans {nomDeLEcran.toLowerCase()} :
            </span>
            <ChampDeCollection
              nom={nomNouvelle}
              onNom={setNomNouvelle}
              onCreer={() => void creerEtRanger()}
              onAbandon={() => setNouvelleOuverte(false)}
            />
            <button
              type="button"
              onClick={() => setNouvelleOuverte(false)}
              className="ml-auto h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 hover:text-encre"
            >
              Laisser tomber
            </button>
          </div>
        )}

        {/* **Une collection ouverte se supprime d'ici** — la route existait
            depuis B8.4 sans aucun chemin depuis un écran (AGENTS.md, 8nonies).
            Aucun sujet n'est touché : seul le groupe part. */}
        {collection && selection.length === 0 && (
          <div data-supprimer-la-collection className="flex justify-end">
            <button
              type="button"
              disabled={occupe}
              onClick={() => {
                const nomDuGroupe = groupes.find((g) => g.identifiant === collection)?.nom ?? collection
                if (!window.confirm(`Supprimer la collection « ${nomDuGroupe} » ? Les sujets qu'elle range ne sont pas touchés.`)) return
                void api
                  .supprimerCollection(collection)
                  .then(() => {
                    setCollectionsConnues((avant) => avant.filter((g) => g.identifiant !== collection))
                    ouvrirLaCollection(null)
                    setVersion((n) => n + 1)
                    surRange()
                  })
                  .catch((erreur) =>
                    surErreur(erreur instanceof Refus ? erreur.message : "la collection n'a pas pu être supprimée"),
                  )
              }}
              className="h-[26px] rounded-7 border border-trait px-[14px] text-[12.5px] text-encre-3 hover:border-trait-echec hover:text-echec disabled:opacity-50"
            >
              Supprimer cette collection
            </button>
          </div>
        )}

        {/* ── La barre de masse ──────────────────────────────────────────── */}
        {selection.length > 0 && (
          <div
            data-barre-de-masse
            className="flex flex-wrap items-center gap-[8px] rounded-8 border border-trait-echec bg-fond-echec px-[14px] py-[8px]"
          >
            <span className="whitespace-nowrap text-[13px] font-medium text-echec">
              <span className="mesure">{selection.length}</span>{" "}
              {selection.length > 1 ? "choisis" : "choisi"}
            </span>
            <span className="whitespace-nowrap text-[12.5px] text-encre-3">
              glisse-les sur une collection, ou :
            </span>
            <button
              type="button"
              disabled={occupe}
              onClick={() => setRangerOuvert((v) => !v)}
              className="h-[26px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre disabled:opacity-50"
            >
              Ranger dans…
            </button>
            {collection && (
              <button
                type="button"
                disabled={occupe}
                onClick={() => void rangerDans(collection, selection, true)}
                className="h-[26px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre disabled:opacity-50"
              >
                Retirer de cette collection
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelection([])}
              className="ml-auto h-[26px] rounded-7 px-[14px] text-[12.5px] text-encre-3 hover:text-encre"
            >
              Ne rien choisir
            </button>
          </div>
        )}

        {retourRangement && (
          <p role="status" className="text-[12px] text-encre-ok">
            {retourRangement}
          </p>
        )}

        {rangerOuvert && selection.length > 0 && (
          <div className="flex flex-wrap gap-[8px] rounded-8 border border-trait bg-carte p-[8px]">
            {groupes.length === 0 && (
              <span className="text-[12.5px] text-encre-3">aucune collection encore</span>
            )}
            {groupes.map((groupe) => (
              <button
                key={groupe.identifiant}
                type="button"
                onClick={() => {
                  void rangerDans(groupe.identifiant, selection)
                  setRangerOuvert(false)
                }}
                className="rounded-full bg-trait-faible px-[14px] text-[12.5px] text-encre-2 hover:bg-ligne-ouverte"
              >
                {groupe.nom}
              </button>
            ))}
          </div>
        )}

        {/* ── Les trois vues ──────────────────────────────────────────────── */}
        {vue === "grille" && (
          <div className="defile min-h-0 flex-1 overflow-y-auto">
            <div
              data-grille-de-sujets
              className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-[8px]"
            >
              {sujets.map((sujet) => (
                <CarteDeGrille
                  key={sujet.identifiant}
                  sujet={sujet}
                  choisi={selection.includes(sujet.identifiant)}
                  onChoisir={() => surClicDeCarte(sujet.identifiant)}
                  onPrendreEnMain={prendreEnMain(sujet.identifiant)}
                  onFinDeGlissement={finDeGlissement}
                />
              ))}
            </div>
            {equipements.length > 0 && (
              <ul
                data-equipements
                className="mt-[14px] grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-[8px]"
              >
                {equipements.map((piece) => (
                  <LigneDePiece
                    key={piece.identifiant}
                    piece={piece}
                    apercu={apercusDesPieces.get(piece.identifiant) ?? null}
                    enGrille
                    onOuvrir={() => onPiece?.(piece.identifiant)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {vue === "liste" && (
          <div className="defile min-h-0 flex-1 overflow-y-auto">
            <div data-liste-de-sujets className="flex flex-col gap-[4px]">
              {sujets.map((sujet) => (
                <LigneDeListe
                  key={sujet.identifiant}
                  sujet={sujet}
                  choisi={selection.includes(sujet.identifiant)}
                  onChoisir={() => surClicDeCarte(sujet.identifiant)}
                  onPrendreEnMain={prendreEnMain(sujet.identifiant)}
                  onFinDeGlissement={finDeGlissement}
                />
              ))}
            </div>
            {equipements.length > 0 && (
              <ul data-equipements className="mt-[14px] flex flex-col gap-[4px]">
                {equipements.map((piece) => (
                  <LigneDePiece
                    key={piece.identifiant}
                    piece={piece}
                    apercu={apercusDesPieces.get(piece.identifiant) ?? null}
                    enGrille={false}
                    onOuvrir={() => onPiece?.(piece.identifiant)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {vue === "poses" && <TableauDesPoses sujets={sujets} />}

        {donnee && total === 0 && equipements.length === 0 && (
          <div className="rounded-8 border border-dashed border-contour p-[22px]">
            <h2 className="font-serif text-[25px]">Aucun sujet pour ces filtres</h2>
            <p className="mt-[8px] text-[13px] text-encre-3">
              Choisis toutes les familles, une autre collection, ou créez le premier.
            </p>
          </div>
        )}

        {/* ── Le pied de grille ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-[22px] border-t border-trait py-[8px] text-[12.5px] text-encre-3">
          <div className="flex flex-wrap items-center gap-[8px]">
            <span>
              <span className="mesure">{montres}</span> des <span className="mesure">{total}</span> affichés.
            </span>
            {equipements.length > 0 && (
              <span>
                <span className="mesure">{equipements.length}</span>{" "}
                {equipements.length > 1 ? "équipements" : "équipement"}. Ils se retrouvent par leur
                nom et leurs emplois ; une collection ne les range pas.
              </span>
            )}
            {resteAChanger && (
              <button
                type="button"
                onClick={() => setLimite((l) => l + 120)}
                className="h-[26px] rounded-7 border border-trait bg-carte px-[14px] text-[12.5px] text-encre"
              >
                Afficher davantage de sujets
              </button>
            )}
            {totalIncomplets > 0 && (
              <span className="text-encre">
                {totalIncomplets === 1 ? (
                  <>
                    <span className="mesure">1</span> {mots.singulier} a une pose manquante.
                  </>
                ) : (
                  <>
                    <span className="mesure">{totalIncomplets}</span> {mots.pluriel} ont des poses
                    manquantes.
                  </>
                )}
              </span>
            )}
          </div>
          {totalIncomplets > 0 && filtre !== "incomplets" && (
            <button
              type="button"
              onClick={() => choisirFiltre("incomplets")}
              className="whitespace-nowrap text-[12.5px] text-encre-2 underline"
            >
              Voir seulement ce qui manque ›
            </button>
          )}
        </div>
      </section>

      {/* ── Le volet ──────────────────────────────────────────────────────── */}
      {selection.length > 0 && (
        <aside
          data-volet-de-selection
          aria-label="La sélection"
          className="volet flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
        >
          <div className="flex flex-col gap-[4px]">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
              {selection.length === 1 ? (
                "Le sujet choisi"
              ) : (
                <>
                  Les <span className="mesure">{selection.length}</span> choisis
                </>
              )}
            </p>
            <p className="text-[13px] leading-[1.45] text-encre-2">
              Ce que tu fais ici s'applique aux <span className="mesure">{selection.length}</span> d'un
              coup.
            </p>
          </div>

          <div className="flex flex-col gap-[4px] rounded-8 border border-trait bg-carte p-[8px]">
            {choisis.map((sujet) => (
              <div key={sujet.identifiant} className="flex items-center gap-[8px] rounded-5 p-[4px]">
                <Vignette sujet={sujet} cote={34} className="h-[34px] w-[34px] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-encre">{sujet.nom}</p>
                  <p className="truncate text-[11.5px] text-encre-4">
                    {sujet.collections[0]?.nom ?? sujet.type} ·{" "}
                    <span className="mesure">
                      {sujet.compte.animations.pretes} / {sujet.compte.animations.demandees}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => basculerChoix(sujet.identifiant)}
                  aria-label={`Retirer ${sujet.nom} de la sélection`}
                  className="text-[13px] text-encre-4 hover:text-encre"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
            <p className="text-[13px] font-medium text-encre">Les ranger</p>
            <div className="flex flex-wrap gap-[8px]">
              {groupes.map((groupe) => {
                const cetteSurvolee = survolee === groupe.identifiant
                return (
                  <ChipDeRangement
                    key={groupe.identifiant}
                    groupe={groupe}
                    deja={dejaParmi(sujets, selection, groupe.identifiant)}
                    survolee={cetteSurvolee}
                    arrivants={arrivantsParmi(sujets, glisses ?? [], groupe.identifiant).length}
                    onDragOver={(e) => {
                      if (!cibleAccepte(e)) return
                      e.preventDefault()
                      setSurvolee(groupe.identifiant)
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget.contains(e.relatedTarget as Node)) return
                      setSurvolee((c) => (c === groupe.identifiant ? null : c))
                    }}
                    onDrop={(e) => {
                      if (!cibleAccepte(e)) return
                      e.preventDefault()
                      setSurvolee(null)
                      deposerSur(groupe.identifiant, e)
                    }}
                  />
                )
              })}
              {nouvelleOuverte ? (
                <ChampDeCollection
                  nom={nomNouvelle}
                  onNom={setNomNouvelle}
                  onCreer={() => void creerEtRanger()}
                  onAbandon={() => setNouvelleOuverte(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setNouvelleOuverte(true)}
                  className="inline-flex h-[26px] items-center rounded-full border border-contour px-[14px] text-[12.5px] text-encre-4"
                >
                  + nouvelle
                </button>
              )}
            </div>
            <p className="text-[11.5px] leading-[1.45] text-encre-4">
              Une collection ne déplace rien et n'efface rien : elle range. Un sujet peut être dans
              autant de collections qu'on veut.
            </p>
          </div>

          <div className="flex flex-col gap-[8px] rounded-8 border border-trait bg-carte p-[14px]">
            <p className="text-[13px] font-medium text-encre">Ce qui leur manque</p>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-[4px] text-[12.5px]">
              <span className="text-encre-2">Animations manquantes</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => s.compte.animations.pretes < s.compte.animations.demandees).length}
              </span>
              <span className="text-encre-2">Sans description</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => !s.description.trim()).length}
              </span>
              <span className="text-encre-2">Sans animation</span>
              <span className="mesure text-right text-encre">
                {choisis.filter((s) => s.compte.animations.pretes === 0).length}
              </span>
            </div>
          </div>

          <div className="rounded-8 border border-contour bg-fond-attention p-[14px]">
            <p className="mb-[4px] text-[13px] font-medium text-encre">Une collection n'est pas une famille</p>
            <p className="text-[12px] leading-[1.5] text-encre-2">
              La famille — personnages, objets, terrains — est posée par l'atelier et décide des outils.
              La collection, c'est toi qui la crées, et elle ne sert qu'à retrouver.
            </p>
          </div>
        </aside>
      )}
    </main>
  )
}
