// La toile — la seconde vue du tableau d'inspiration (T8).
//
// **La règle est une phrase, et l'écran ne dit rien d'autre : la toile montre ce
// qui est classé, la réserve contient ce qui reste à classer** (`docs/DESIGN.md`
// § La toile, la réserve et les îlots). Tout en découle — pourquoi la réserve
// n'est pas une grille de plus, pourquoi une carte sans groupe et sans place
// n'est jamais sur le plan, pourquoi tirer est le seul geste à apprendre.
//
// **L'îlot n'est pas un objet, c'est l'étendue de ses membres.** Un îlot *est* le
// groupe (`docs/ARCHITECTURE.md` §5) : il n'a ni identité, ni fichier, ni
// position à lui. Il est donc **calculé** — la boîte qui englobe les cartes de
// son groupe, augmentée de sa marge et de la bande de son nom — et il n'existe
// aucun état où l'écran montrerait un îlot que le disque ne dit pas. C'est aussi
// pourquoi un îlot vide n'existe pas : un groupe sans carte n'a nulle part où
// être écrit, donc rien à englober.
//
// **Ce que la librairie tient, et ce qu'elle ne tient pas.** `@xyflow/react`
// fournit le plan — déplacement, zoom, transformation unique, conversion écran →
// plan —, le nœud et son glissement, la sélection. Le reste est du produit : la
// carte, la persistance, le classement, l'annulation, la réserve, et la poignée
// de largeur. `docs/ARCHITECTURE.md` §6.5 fait la part exacte.
//
// **Rien ne se recompose tout seul.** Aucun alignement automatique, aucune
// distribution, aucune mise en page qui reflue quand une carte arrive : c'est
// « l'œil reste exactement où il était » appliqué à la surface dont c'est la
// raison d'être. La seule disposition que l'écran calcule est celle des cartes
// qui n'ont **jamais** eu de place, et elle n'est pas écrite : elle se refait à
// l'identique à chaque ouverture, et le premier geste sur une carte écrit la
// sienne.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useInternalNode,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  api,
  COULEUR_TEINTE,
  Refus,
  type Carte,
  type Lien,
  type Teinte,
} from "../api"
import {
  BarreTableau,
  CarteTuile,
  GLISSE_CARTE,
  GOUTTIERE,
  Pastilles,
  groupesDe,
  useCollage,
  useDepot,
  useSurvol,
  type Vue,
} from "./Tableau"
import { Libelle } from "./chassis"

// ── Les mesures de l'îlot ───────────────────────────────────────────────────
//
// « L'îlot est du châssis, pas un objet dessiné » : ce qui suit est ce qu'il
// laisse autour de ce qu'il contient, et rien de plus. La marge reprend l'écart
// du châssis ; la bande du titre est la hauteur d'une ligne en mono 10 px.

const MARGE_ILOT = 14
const BANDE_ILOT = 20

/** La hauteur du pied d'une carte — la rangée qui porte son groupe et son cran.
 *  Elle entre dans la hauteur du nœud parce que c'est **l'image** qui suit le
 *  rapport, pas la carte entière. */
const PIED = 21

/** Le plancher et le plafond de la largeur libre, les mêmes que le serveur
 *  (`atelier/domaine/carte.py`). Ils sont ici pour que la poignée s'arrête
 *  d'elle-même plutôt que d'aller chercher un refus qu'on connaît déjà. */
const LARGEUR_MIN = 48
const LARGEUR_MAX = 2048

/** Ce à quoi la largeur libre s'aimante, quand la mesure a pu être prise. */
export type Crans = { 1: number; 2: number; 4: number }

/**
 * Les ancrages d'un nœud, **donnés et non laissés à mesurer** — quatrième fois
 * que ce piège se referme dans ce dépôt, et cette fois-ci un cran plus bas.
 *
 * T8 avait donné à chaque nœud ses `width` et `height`, parce que la librairie
 * cache ce dont elle ignore la taille et qu'elle l'apprend par un
 * `ResizeObserver` — *qui ne livre rien à un onglet qui ne compose pas ses
 * images*. Les **arêtes** ont exactement la même dépendance, et à un autre
 * endroit : `isNodeInitialized` exige `internals.handleBounds || handles`, et
 * `handleBounds` se mesure sur le DOM des ancrages. Sans elles, `getEdgePosition`
 * rend `null` et **aucun trait ne paraît** — sans un mot, comme la toile entière
 * était invisible en T8.
 *
 * La réponse est la même : le produit les **déclare**. Elles n'ont aucune
 * conséquence sur le tracé, qui se calcule par `ancrer` sur les boîtes ; elles
 * existent pour que la librairie sache résoudre l'arête, ce qui est son travail
 * — la surface (`docs/ARCHITECTURE.md` §6.5). Une seule paire par nœud, source
 * et arrivée : le produit n'a qu'un point de départ par objet et décide de
 * l'arrivée lui-même.
 */
const ANCRAGES = [
  { id: null, type: "source" as const, position: Position.Right, x: 0, y: 0, width: 1, height: 1 },
  { id: null, type: "target" as const, position: Position.Left, x: 0, y: 0, width: 1, height: 1 },
]

/** Ce que le glissement d'une poignée doit dépasser pour quitter un cran. Sous
 *  ce seuil l'aimant tient : c'est ce qui empêche la largeur libre d'être
 *  arbitraire, et ce qui rend le cran un repère plutôt qu'une prison. */
const AIMANT = 12

/**
 * L'aimant de la largeur libre — **la seule mesure continue du produit**.
 *
 * Le cran cesse d'être la seule valeur possible pour redevenir un repère : on
 * s'arrête dessus quand on passe à côté, on le dépasse quand on le veut.
 *
 * Écrit à part et pur, parce que c'est de l'arithmétique et que l'arithmétique
 * se vérifie sans navigateur. Sans crans mesurés il n'y a pas d'aimant, et la
 * largeur reste exactement celle qu'on a tirée — « zéro n'est pas une largeur,
 * c'est l'absence de mesure », et l'absence de mesure ne doit rien attirer.
 */
export function aimanter(crans: Crans | null, depart: number, ecart: number): number {
  const voulue = Math.max(LARGEUR_MIN, Math.min(LARGEUR_MAX, depart + ecart))
  if (!crans) return Math.round(voulue)
  const proche = [crans[1], crans[2], crans[4]]
    .map((cran) => ({ cran, distance: Math.abs(cran - voulue) }))
    .sort((a, b) => a.distance - b.distance)[0]
  return proche.distance <= AIMANT ? proche.cran : Math.round(voulue)
}

// ── Ce qu'une carte occupe ──────────────────────────────────────────────────

type Boite = { x: number; y: number; l: number; h: number }
type Place = { x: number; y: number }

/** Le rapport d'une carte — **le sien**, quand il a été mesuré.
 *
 *  Une carte texte, une carte en attente, une carte dont l'image n'est pas
 *  arrivée n'ont aucun rapport mesuré : elles prennent le carré, qui est la
 *  forme qu'elles ont dans la grille. « Une mesure ne s'affiche que si elle a
 *  été prise » vaut aussi pour une forme. */
function rapport(carte: Carte): number {
  if (carte.genre !== "image" || !carte.montrable) return 1
  if (!carte.largeur || !carte.hauteur) return 1
  return carte.hauteur / carte.largeur
}

function largeurDe(carte: Carte, crans: Crans): number {
  return carte.largeur_libre ?? crans[carte.taille]
}

function hauteurDe(carte: Carte, crans: Crans): number {
  return Math.round(largeurDe(carte, crans) * rapport(carte)) + PIED
}

function englober(boites: Boite[]): Boite | null {
  if (!boites.length) return null
  const x = Math.min(...boites.map((b) => b.x))
  const y = Math.min(...boites.map((b) => b.y))
  const droite = Math.max(...boites.map((b) => b.x + b.l))
  const bas = Math.max(...boites.map((b) => b.y + b.h))
  return { x, y, l: droite - x, h: bas - y }
}

// ── Où chaque carte se pose ─────────────────────────────────────────────────

/**
 * La place de chaque carte de la toile — celle qu'elle porte, sinon celle que
 * l'ouverture lui calcule.
 *
 * **Ce qui est écrit fait foi, et rien d'autre n'est écrit.** Une carte qui a
 * une position la garde, exactement. Une carte groupée avant T8 n'en a pas : elle
 * se pose dans son îlot à l'ouverture, et n'écrit la sienne qu'au premier geste
 * (`docs/ARCHITECTURE.md` §5). Le calcul est donc **déterministe** — mêmes cartes,
 * même disposition —, sans quoi « rouvrir rend la toile telle qu'elle a été
 * laissée » serait faux pour tout un tableau hérité.
 */
export function disposer(cartes: Carte[], crans: Crans): Map<string, Place> {
  const places = new Map<string, Place>()
  const surLaToile = cartes.filter((c) => !c.en_reserve)
  for (const c of surLaToile)
    if (c.position) places.set(c.identifiant, { x: c.position[0], y: c.position[1] })

  const boiteDe = (c: Carte): Boite | null => {
    const p = places.get(c.identifiant)
    return p ? { ...p, l: largeurDe(c, crans), h: hauteurDe(c, crans) } : null
  }
  const boitesDe = (liste: Carte[]) =>
    liste.map(boiteDe).filter((b): b is Boite => b !== null)

  /** Poser des cartes en carré à partir d'un coin, et rendre ce qu'elles
   *  occupent.
   *
   *  **Un carré plutôt qu'une bande**, et la règle vaut aux deux échelles : les
   *  cartes dans un îlot, les îlots entre eux. Neuf cartes en ligne demandent un
   *  balayage horizontal que l'œil ne fait pas, et trois îlots empilés font un
   *  ruban étroit sur une surface dont la largeur est justement l'intérêt. Une
   *  seule règle pour les deux, parce que c'est le même problème vu deux fois. */
  const poserEnCarre = (liste: Carte[], x0: number, y0: number): Boite => {
    const colonnes = Math.max(1, Math.ceil(Math.sqrt(liste.length)))
    let x = x0
    let y = y0
    let rangee = 0
    liste.forEach((carte, rang) => {
      if (rang && rang % colonnes === 0) {
        y += rangee + GOUTTIERE
        x = x0
        rangee = 0
      }
      places.set(carte.identifiant, { x, y })
      x += largeurDe(carte, crans) + GOUTTIERE
      rangee = Math.max(rangee, hauteurDe(carte, crans))
    })
    return englober(boitesDe(liste))!
  }

  // Un îlot déjà entamé accueille la suite **à sa droite** : ce qui y est placé
  // ne bouge pas, et l'îlot s'étend pour prendre le reste.
  const neufs: string[] = []
  for (const nom of groupesDe(surLaToile)) {
    const membres = surLaToile.filter((c) => c.groupe === nom)
    const aPoser = membres.filter((c) => !places.has(c.identifiant))
    if (!aPoser.length) continue
    const ancre = englober(boitesDe(membres))
    if (ancre) poserEnCarre(aPoser, ancre.x + ancre.l + GOUTTIERE, ancre.y)
    else neufs.push(nom)
  }

  // Ce qu'un cadre d'îlot prend autour de son contenu, des deux côtés : c'est
  // l'écart minimal entre deux îlots posés côte à côte pour que leurs cadres ne
  // se touchent pas.
  const ECART = (MARGE_ILOT + BANDE_ILOT) * 2

  // Ce qu'on compose se pose **sous** tout ce qui a déjà une place : une carte
  // posée à la main ne se fait pas recouvrir par un rangement qu'elle n'a pas
  // demandé.
  //
  // **Mesuré après les îlots entamés, et pas avant.** Vu sur un vrai tableau :
  // un îlot dont une seule carte était posée s'étendait vers le bas en
  // accueillant les autres, et les îlots neufs, calés sous la place de cette
  // carte-là, lui rentraient dedans. Le socle n'est pas ce qui était posé au
  // départ, c'est ce qui occupe la toile au moment où l'on compose le reste.
  const socle = englober(boitesDe(surLaToile))

  const colonnes = Math.max(1, Math.ceil(Math.sqrt(neufs.length)))
  let x = 0
  let y = socle ? socle.y + socle.h + ECART : 0
  let rangee = 0
  neufs.forEach((nom, rang) => {
    if (rang && rang % colonnes === 0) {
      y += rangee + ECART
      x = 0
      rangee = 0
    }
    const pose = poserEnCarre(
      surLaToile.filter((c) => c.groupe === nom),
      x,
      y,
    )
    x += pose.l + ECART
    rangee = Math.max(rangee, pose.h)
  })

  return places
}

export type Ilot = { nom: string; boite: Boite; membres: number }

/** Les îlots, calculés — un par groupe qui a au moins une carte sur la toile. */
export function ilotsDe(cartes: Carte[], places: Map<string, Place>, crans: Crans): Ilot[] {
  const surLaToile = cartes.filter((c) => !c.en_reserve)
  const ilots: Ilot[] = []
  for (const nom of groupesDe(surLaToile)) {
    const membres = surLaToile.filter((c) => c.groupe === nom)
    const boites = membres
      .map((c) => {
        const p = places.get(c.identifiant)
        return p ? { ...p, l: largeurDe(c, crans), h: hauteurDe(c, crans) } : null
      })
      .filter((b): b is Boite => b !== null)
    const boite = englober(boites)
    if (!boite) continue
    ilots.push({
      nom,
      membres: membres.length,
      boite: {
        x: boite.x - MARGE_ILOT,
        y: boite.y - MARGE_ILOT - BANDE_ILOT,
        l: boite.l + MARGE_ILOT * 2,
        h: boite.h + MARGE_ILOT * 2 + BANDE_ILOT,
      },
    })
  }
  return ilots
}

/** L'îlot dont l'étendue contient un point du plan, ou rien.
 *
 *  C'est **tout** le mécanisme du classement : tirer une carte dans un îlot lui
 *  écrit son groupe, la lâcher ailleurs le vide. Le point est le centre de la
 *  carte et non le pointeur — c'est là que l'œil dit où elle est. */
export function ilotSous(point: Place, ilots: Ilot[]): string {
  // Du plus petit au plus grand : deux îlots qui se recouvrent — ce qui est
  // permis, puisque rien ne s'aligne tout seul — donnent le plus serré, celui
  // qu'on visait.
  const dedans = ilots.filter(
    ({ boite }) =>
      point.x >= boite.x &&
      point.x <= boite.x + boite.l &&
      point.y >= boite.y &&
      point.y <= boite.y + boite.h,
  )
  if (!dedans.length) return ""
  return dedans.sort((a, b) => a.boite.l * a.boite.h - b.boite.l * b.boite.h)[0].nom
}

/** La carte dont l'étendue contient un point du plan, ou rien.
 *
 *  **La sœur d'`ilotSous`, et elle existe pour la même raison** : c'est le
 *  produit qui décide sur quoi un trait est lâché, jamais la librairie. Un
 *  ancrage invisible posé sur toute la carte aurait dû être éteint au repos et
 *  rallumé pendant la liaison — *une règle déléguée à autre chose dont personne
 *  n'aurait mesuré le résultat*, la famille de défauts qui revient depuis T5.
 *
 *  Elle se demande **avant** `ilotSous`, dans l'ordre exact des `zIndex` —
 *  carte 1, îlot 0 —, c'est-à-dire dans l'ordre de ce que l'œil voit. */
export function carteSous(
  point: Place,
  cartes: Carte[],
  places: Map<string, Place>,
  crans: Crans,
): string {
  const dedans = cartes
    .filter((c) => !c.en_reserve)
    .map((c) => {
      const p = places.get(c.identifiant)
      return p
        ? { id: c.identifiant, b: { ...p, l: largeurDe(c, crans), h: hauteurDe(c, crans) } }
        : null
    })
    .filter((x): x is { id: string; b: Boite } => x !== null)
    .filter(
      ({ b }) =>
        point.x >= b.x && point.x <= b.x + b.l && point.y >= b.y && point.y <= b.y + b.h,
    )
  if (!dedans.length) return ""
  // La plus serrée, comme pour les îlots : rien ne s'aligne tout seul sur cette
  // toile, et deux cartes peuvent se recouvrir.
  return dedans.sort((a, b) => a.b.l * a.b.h - b.b.l * b.b.h)[0].id
}

/**
 * Les deux points où un trait rencontre les objets qu'il joint.
 *
 * **Le trait part du côté qui fait face**, et rien n'est stocké : on prend le
 * segment qui joint les deux centres, et on garde ses intersections avec chaque
 * bord. Deux boîtes, deux points, aucune mémoire — c'est ce qui fait qu'un lien
 * suit ses extrémités sans que personne n'ait à le lui dire.
 *
 * **Et c'est ce qui permet à un îlot d'être une extrémité sans avoir
 * d'identité** (`docs/ARCHITECTURE.md` §5) : son étendue est déjà calculée,
 * puisqu'elle est celle de ses membres. Un ancrage qu'il aurait fallu *mesurer*
 * aurait exigé qu'il soit un objet ; un ancrage qui se calcule n'exige rien.
 *
 * Deux boîtes concentriques n'ont pas de côté qui se fasse face : on rend alors
 * les deux centres, et le trait a une longueur nulle — il ne se voit pas, ce qui
 * est exactement ce qu'il y a à montrer de deux objets posés l'un sur l'autre.
 */
export function ancrer(depart: Boite, arrivee: Boite): [Place, Place] {
  const centre = (b: Boite): Place => ({ x: b.x + b.l / 2, y: b.y + b.h / 2 })
  const un = centre(depart)
  const deux = centre(arrivee)
  const dx = deux.x - un.x
  const dy = deux.y - un.y
  if (!dx && !dy) return [un, deux]

  /** Où le rayon partant du centre de `b` dans la direction (dx, dy) sort de `b`.
   *  Le facteur est le plus petit des deux qui amène sur un bord : c'est celui
   *  qui décide **quel** côté fait face. */
  const sortie = (b: Boite, dx: number, dy: number): Place => {
    const c = centre(b)
    const facteurs: number[] = []
    if (dx) facteurs.push(b.l / 2 / Math.abs(dx))
    if (dy) facteurs.push(b.h / 2 / Math.abs(dy))
    const t = Math.min(...facteurs)
    return { x: c.x + dx * t, y: c.y + dy * t }
  }

  return [sortie(depart, dx, dy), sortie(arrivee, -dx, -dy)]
}

// ── Ce qu'un geste retient pour se défaire ──────────────────────────────────
//
// **Une union, parce que la toile a désormais trois gestes qui s'annulent**, et
// que chacun se défait par un appel différent. Une forme unique aurait obligé à
// deviner lequel jouer, et deviner sur une pile d'annulation, c'est défaire
// autre chose que ce qu'on vient de faire.

/** Ce qu'un îlot emporte en disparaissant, et qu'il faut savoir reposer.
 *
 *  **Sortir la dernière carte d'un groupe efface, sur le disque, les liens qui
 *  aboutissaient à son îlot et la teinte qu'on lui avait donnée** — c'est la
 *  règle de la tranche, et elle est juste : un trait vers rien ne représente
 *  rien. Mais Ctrl+Z ne peut pas se contenter de rendre son groupe à la carte :
 *  l'îlot reparaîtrait nu, et la couleur comme les traits seraient perdus **en
 *  silence**. L'écran tient donc, au moment du geste, ce que le geste va faire
 *  disparaître. Il le sait : il a la toile entière sous les yeux. */
export type IlotPerdu = { nom: string; teinte: Teinte; liens: Lien[] }

/**
 * Ce qu'un geste va faire disparaître, calculé **avant** de l'envoyer.
 *
 * Une carte quitte le groupe `sortante.groupe` ; si personne d'autre ne le
 * porte, l'îlot cesse d'exister, et le serveur emporte avec lui ses liens et sa
 * teinte (`ServiceUnivers._elaguer`). Ce qui est rendu ici est exactement de
 * quoi les reposer.
 *
 * **Pure, et exportée pour ça** : c'est la seule moitié de l'annulation qui ait
 * une règle plutôt qu'un appel, donc la seule qui se vérifie sans écran.
 */
export function ilotPerdu(
  sortante: Carte,
  cartes: Carte[],
  liens: Lien[],
  teintes: Record<string, Teinte>,
): IlotPerdu | undefined {
  const nom = sortante.groupe
  if (!nom) return undefined
  const reste = cartes.some((c) => c.identifiant !== sortante.identifiant && c.groupe === nom)
  if (reste) return undefined
  return {
    nom,
    teinte: teintes[nom] ?? "",
    liens: liens.filter(
      (un) =>
        (un.de.genre === "ilot" && un.de.valeur === nom) ||
        (un.vers.genre === "ilot" && un.vers.valeur === nom),
    ),
  }
}

export type Geste =
  | {
      genre: "carte"
      carte: string
      avant: Parameters<typeof api.reglerCarte>[1]
      /** Rempli seulement quand ce geste-là vide un groupe de son dernier
       *  membre. Presque toujours absent, donc. */
      ilot?: IlotPerdu
    }
  | { genre: "lien-cree"; lien: string }
  | { genre: "lien-coupe"; lien: Lien }

// ── Ce que les nœuds ont besoin de savoir ───────────────────────────────────
//
// **Par un contexte, et pas par les props d'un type de nœud.** Un `nodeTypes`
// recalculé pour transporter la carte survolée fabrique un **nouveau type de
// composant** à chaque survol : React démonte alors tous les nœuds et les
// remonte, ce qui referme le menu qu'on venait d'ouvrir. Les types sont donc
// une constante de module, et ce qui bouge passe par ici.

type Cadre = {
  choisie: string | null
  survolee: string | null
  /** Ce qui est épinglé et **n'est pas une carte** — le pavé d'un lien, le menu
   *  d'un îlot. Séparé de `choisie`, qui reste la carte choisie et voyage
   *  jusqu'à la réserve et à la grille : les mélanger aurait fait qu'épingler un
   *  trait désigne une carte dans une colonne où il n'y a pas de trait. */
  epingle: string | null
  crans: Crans | null
  teintes: Record<string, Teinte>
  /** La taille d'un nœud, **telle que le produit la calcule** — jamais celle
   *  que la librairie croit avoir mesurée. Voir `AreteLien`. */
  tailleDe: (id: string) => { l: number; h: number } | null
  onSurvol: (cle: string, dedans: boolean) => void
  onChoisir: (identifiant: string | null) => void
  onEpingler: (cle: string | null) => void
  onErreur: (raison: string) => void
  onLargeur: (carte: Carte, largeur: number) => void
  onTeinterIlot: (nom: string, teinte: Teinte) => void
  onReglerLien: (lien: Lien, reglage: { mot?: string; pointe?: boolean }) => void
  onCouperLien: (lien: Lien) => void
  onNote: (texte: string, place: Place) => void
  onAbandon: () => void
  aimanter: (depart: number, ecart: number) => number
  zoom: () => number
}

const CADRE = createContext<Cadre | null>(null)

/** **Une seule survolée sur la toile, tous genres confondus.** Le produit promet
 *  qu'il n'y a qu'une surface ouverte à la fois ; trois états de survol
 *  indépendants en auraient ouvert trois. Les clés sont donc préfixées — c'est
 *  la même leçon que `Bout(genre, valeur)` côté domaine : deux espaces de noms
 *  aplatis dans un seul finissent par se confondre. */
const cleCarte = (identifiant: string) => `carte:${identifiant}`
const cleLien = (identifiant: string) => `lien:${identifiant}`
const cleIlot = (nom: string) => `ilot:${nom}`

const TYPES = { ilot: NoeudIlot, carte: NoeudCarte, brouillon: NoeudBrouillon }
const TYPES_ARETE = { lien: AreteLien }

// ── L'écran ─────────────────────────────────────────────────────────────────

type Parametres = {
  cartes: Carte[]
  liens: Lien[]
  teintes: Record<string, Teinte>
  vue: Vue
  onVue: (vue: Vue) => void
  choisie: string | null
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  collage: ReturnType<typeof useCollage>
  crans: Crans | null
  /** La pile d'annulation, tenue par l'écran Univers pour qu'elle **meure avec
   *  lui** : ce n'est pas de l'historique de projet, c'est le rattrapage du
   *  geste en cours (`docs/PLAN.md` T8). */
  pile: React.RefObject<Geste[]>
}

export function Toile(parametres: Parametres) {
  // Le plan a besoin de son fournisseur au-dessus de lui pour que
  // `screenToFlowPosition` existe : c'est la seule conversion que la librairie
  // fait et que personne ne devrait réécrire.
  return (
    <ReactFlowProvider>
      <Plan {...parametres} />
    </ReactFlowProvider>
  )
}

function Plan({
  cartes,
  liens,
  teintes,
  vue,
  onVue,
  choisie,
  onChoisir,
  onErreur,
  collage,
  crans,
  pile,
}: Parametres) {
  const { screenToFlowPosition, getZoom, setViewport } = useReactFlow()
  // Ce qui est épinglé sans être une carte : un lien, un îlot. Local au plan,
  // parce que rien d'autre que le plan n'en dessine.
  const [epingle, setEpingle] = useState<string | null>(null)
  const { survolee, survoler } = useSurvol(choisie !== null || epingle !== null)
  const depot = useDepot(collage.collerFichier, collage.collerTexte)
  const [noeuds, setNoeuds, surChangement] = useNodesState<Node>([])

  const echouer = useCallback(
    (erreur: unknown, defaut: string) =>
      onErreur(erreur instanceof Refus ? erreur.message : defaut),
    [onErreur],
  )

  // ── Ce que la toile montre ───────────────────────────────────────────────
  //
  // **Les places et les îlots se calculent sur ce que le serveur dit, jamais
  // sur ce qu'un glissement en cours montre.** L'étendue d'un îlot comprend ses
  // membres : la recalculer pendant qu'on tire une carte hors de son groupe la
  // ferait suivre, et la carte ne sortirait jamais. Le nœud, lui, suit la main —
  // c'est la librairie qui le tient, et l'écran ne le relit qu'au relâchement.

  const places = useMemo(
    () => (crans ? disposer(cartes, crans) : new Map<string, Place>()),
    [cartes, crans],
  )
  const ilots = useMemo(
    () => (crans ? ilotsDe(cartes, places, crans) : []),
    [cartes, places, crans],
  )

  // ── Le brouillon d'une note ──────────────────────────────────────────────
  //
  // **Un nœud comme un autre, et pas une surface flottante par-dessus le plan.**
  // Une boîte posée en pixels d'écran serait fausse au premier cran de zoom et
  // resterait immobile pendant qu'on déplace le plan : ce qu'on écrit est déjà à
  // sa place, donc ça doit être *sur* le plan.
  //
  // Sa clé ne change jamais (`brouillon`), et son champ de saisie n'est pas
  // contrôlé : l'effet ci-dessous refabrique la liste des nœuds à chaque carte
  // qui arrive — une image collée depuis un autre onglet, par exemple —, et un
  // texte à moitié tapé qui vivrait dans `data` serait perdu à ce moment-là.
  // Même clé, même composant monté, même DOM : le texte est dans le champ, et
  // le champ ne bouge pas.
  const [brouillon, setBrouillon] = useState<Place | null>(null)

  // **Chaque nœud porte ses dimensions, et c'est la librairie qui l'exige.** Un
  // nœud dont elle ne connaît pas la taille est rendu `visibility: hidden` en
  // attendant que son `ResizeObserver` la lui livre — et *un `ResizeObserver` ne
  // livre rien à un onglet qui ne compose pas ses images* (`AGENTS.md`, mesuré en
  // T5 sur le grisé du zoom). Toute la toile restait donc invisible dans un
  // onglet d'arrière-plan, sans que rien ne le dise. Vu à l'atelier lancé, le
  // 28 août 2026. On les lui donne : elles sont calculées de toute façon, puisque
  // l'étendue d'un îlot est celle de ses membres.
  useEffect(() => {
    if (!crans) return
    setNoeuds([
      // Les îlots d'abord, et derrière : ils sont du châssis, pas un objet
      // qu'on attrape. On les traverse pour saisir une carte, et pour saisir le
      // plan lui-même.
      ...ilots.map<Node>(({ nom, boite, membres }) => ({
        id: `ilot:${nom}`,
        type: "ilot",
        position: { x: boite.x, y: boite.y },
        data: { nom, membres },
        width: boite.l,
        height: boite.h,
        handles: ANCRAGES,
        style: { pointerEvents: "none" as const },
        draggable: false,
        selectable: false,
        zIndex: 0,
      })),
      ...cartes
        .filter((c) => !c.en_reserve)
        .map<Node>((carte) => ({
          id: carte.identifiant,
          type: "carte",
          position: places.get(carte.identifiant) ?? { x: 0, y: 0 },
          data: { carte },
          width: largeurDe(carte, crans),
          height: hauteurDe(carte, crans),
          handles: ANCRAGES,
          zIndex: 1,
        })),
      ...(brouillon
        ? [
            {
              id: "brouillon",
              type: "brouillon",
              position: brouillon,
              data: {},
              width: crans[1],
              height: crans[1],
              draggable: false,
              selectable: false,
              zIndex: 20,
            } as Node,
          ]
        : []),
    ])
  }, [cartes, ilots, places, crans, brouillon, setNoeuds])

  // ── Les traits ───────────────────────────────────────────────────────────
  //
  // **Une arête par lien, et son tracé n'est pas de la librairie.** Elle fournit
  // la surface — le calque, la zone d'écoute de 20 px le long du trait, le
  // rendu de l'étiquette à l'échelle du plan — et le produit fournit la
  // géométrie, parce que l'ancrage d'un îlot se calcule sur son étendue et que
  // son étendue est celle de ses membres (`ancrer`). Un ancrage qu'il aurait
  // fallu *mesurer* aurait exigé que l'îlot soit un objet.
  //
  // **Un lien dont une extrémité n'est pas sur le plan ne se dessine pas.** Le
  // serveur l'aura déjà effacé — c'est la règle de la tranche — mais le message
  // qui le dit et celui qui dit la carte arrivent par deux chemins : entre les
  // deux, l'écran ne doit pas tracer un trait vers un nœud qui n'existe pas.
  const aretes = useMemo<Edge[]>(() => {
    const noeudsPresents = new Set([
      ...cartes.filter((c) => !c.en_reserve).map((c) => c.identifiant),
      ...ilots.map((i) => `ilot:${i.nom}`),
    ])
    const nomDe = (bout: Lien["de"]) =>
      bout.genre === "ilot" ? `ilot:${bout.valeur}` : bout.valeur
    return liens
      .filter((un) => noeudsPresents.has(nomDe(un.de)) && noeudsPresents.has(nomDe(un.vers)))
      .map<Edge>((un) => ({
        id: un.identifiant,
        type: "lien",
        source: nomDe(un.de),
        target: nomDe(un.vers),
        data: { lien: un },
        // La zone d'écoute de la librairie, et c'est très exactement le partage
        // de `docs/ARCHITECTURE.md` §6.5 : un trait de 1 px ne se survole pas,
        // et une zone d'écoute est de la surface.
        interactionWidth: 20,
        selectable: false,
        focusable: false,
      }))
  }, [liens, cartes, ilots])


  /**
   * La taille d'un nœud — **celle que le produit calcule, pas celle que la
   * librairie mesure**.
   *
   * Quatrième fois que le même piège se referme, et cette fois-ci sur le tracé
   * d'un trait. `useInternalNode(...).measured` est rempli par un
   * `ResizeObserver`, *qui ne livre rien à un onglet qui ne compose pas ses
   * images* : les deux boîtes valaient alors zéro, et `ancrer` — qui rend les
   * deux centres quand les boîtes sont vides — faisait partir le trait du **coin
   * supérieur gauche** de chaque objet au lieu du côté qui fait face. Vu à
   * l'atelier lancé, dans un onglet sans composition ; invisible autrement,
   * puisqu'un onglet au premier plan mesure et corrige tout seul.
   *
   * La **position**, elle, reste celle de la librairie : c'est elle qui bouge
   * pendant qu'on tire une carte, et c'est ce qui fait que le trait suit la
   * main. Position mesurée, taille donnée — la formule de T8, appliquée aux
   * arêtes.
   */
  const tailleDe = useCallback(
    (id: string) => {
      if (!crans) return null
      if (id.startsWith("ilot:")) {
        const ilot = ilots.find((i) => i.nom === id.slice(5))
        return ilot ? { l: ilot.boite.l, h: ilot.boite.h } : null
      }
      const carte = cartes.find((c) => c.identifiant === id)
      return carte ? { l: largeurDe(carte, crans), h: hauteurDe(carte, crans) } : null
    },
    [cartes, ilots, crans],
  )

  // ── Le cadrage d'ouverture ───────────────────────────────────────────────
  //
  // **Une fois, quand il y a enfin quelque chose à cadrer.** Ensuite plus rien
  // ne recadre : « rien ne se recompose tout seul » vaut aussi pour le regard,
  // et un cadrage qui se rejouerait à chaque carte classée déplacerait la toile
  // sous la main.
  //
  // **Et il se calcule sur une largeur mesurée, pas sur celle que la librairie
  // croit avoir.** Deux raisons, et la seconde est celle qui a décidé. La
  // première : `fitView` posé en propriété s'exécute au montage, où les nœuds
  // n'existent pas encore — ils arrivent d'un effet. La seconde : la librairie
  // tient les dimensions de son plan par un `ResizeObserver`, et *un
  // `ResizeObserver` ne livre rien à un onglet qui ne compose pas ses images*
  // (`AGENTS.md`, T5). Le plan mesurait donc zéro et `fitView` renonçait en
  // silence, alors que le `getBoundingClientRect` du même nœud rendait
  // 519 × 638. Troisième fois que ce piège se referme dans ce dépôt, et la
  // réponse est toujours la même : **une largeur se lit à la demande.**
  const plan = useRef<HTMLDivElement>(null)
  const cadre_pris = useRef(false)

  const etendue = useMemo(() => {
    if (!crans) return null
    return englober([
      ...ilots.map((i) => i.boite),
      ...cartes
        .filter((c) => !c.en_reserve)
        .map((c) => {
          const p = places.get(c.identifiant) ?? { x: 0, y: 0 }
          return { ...p, l: largeurDe(c, crans), h: hauteurDe(c, crans) }
        }),
    ])
  }, [cartes, ilots, places, crans])

  useEffect(() => {
    if (cadre_pris.current || !etendue || !plan.current) return
    const place = plan.current.getBoundingClientRect()
    if (!place.width || !place.height) return
    cadre_pris.current = true
    // La marge du § Layout, en proportion : ce qu'on cadre ne touche jamais le
    // bord. Et on ne grossit pas — au-delà de 1, la toile mentirait sur la
    // taille des cartes qu'on vient de régler.
    const MARGE = 1.2
    const zoom = Math.min(
      place.width / (etendue.l * MARGE),
      place.height / (etendue.h * MARGE),
      1,
    )
    setViewport({
      x: place.width / 2 - (etendue.x + etendue.l / 2) * zoom,
      y: place.height / 2 - (etendue.y + etendue.h / 2) * zoom,
      zoom: Math.max(zoom, 0.2),
    })
  }, [etendue, setViewport])

  // **Une carte ouverte passe devant ses voisines.** Le menu déborde de son
  // nœud ; sans cette élévation il glisserait sous celui d'à côté, et c'est
  // exactement au moment où on le lit qu'il disparaîtrait à moitié.
  //
  // **Et un îlot ouvert aussi, pour la même raison et avec une pente en plus.**
  // Le nœud d'un îlot est posé à `zIndex: 0`, les cartes à 1 : son menu de
  // teintes se serait rendu **sous** les cartes qui l'entourent, c'est-à-dire
  // sous exactement ce qu'il décrit. Il monte donc à 10 comme une carte ouverte,
  // et redescend à 0 en se refermant — un îlot qui resterait élevé volerait les
  // clics de ses propres membres.
  useEffect(() => {
    setNoeuds((liste) =>
      liste.map((n) => {
        if (n.type === "carte")
          return {
            ...n,
            zIndex: n.id === choisie || survolee === cleCarte(n.id) ? 10 : 1,
          }
        if (n.type === "ilot") {
          const cle = `ilot:${(n.data as { nom: string }).nom}`
          return { ...n, zIndex: epingle === cle || survolee === cle ? 10 : 0 }
        }
        return n
      }),
    )
  }, [choisie, survolee, epingle, setNoeuds])

  // ── Poser, et retenir de quoi défaire ────────────────────────────────────

  /** L'annulation n'a rien côté serveur : annuler, c'est rappeler la même route
   *  avec la valeur d'avant. Une route d'annulation aurait fait de la
   *  composition un historique de projet — elle est le rattrapage du geste en
   *  cours, et rien d'autre. */
  const poser = useCallback(
    (carte: Carte, reglage: Parameters<typeof api.reglerCarte>[1]) => {
      const avant: Parameters<typeof api.reglerCarte>[1] = {}
      if ("groupe" in reglage) avant.groupe = carte.groupe
      if ("position" in reglage) avant.position = carte.position ?? []
      // Une largeur jamais posée se défait vers **le cran**, et non vers rien :
      // la route ne connaît pas « oublie cette largeur », et le cran est de
      // toute façon la largeur qu'on voyait avant de tirer.
      if ("largeur_libre" in reglage && crans)
        avant.largeur_libre = carte.largeur_libre ?? crans[carte.taille]
      // **Et ce que ce geste-là va emporter avec l'îlot qu'il vide** (T9). Sortir
      // la dernière carte d'un groupe efface, sur le disque, les liens qui
      // aboutissaient à son îlot et la teinte qu'on lui avait donnée : c'est la
      // règle de la tranche, et elle est juste. Mais rendre son groupe à la
      // carte ferait alors reparaître un îlot **nu**, et la couleur comme les
      // traits seraient perdus en silence — c'est-à-dire le contraire de ce que
      // « le champ retrouve sa valeur d'avant » promet. L'écran a la toile
      // entière sous les yeux au moment du geste ; il retient donc de quoi les
      // reposer.
      //
      // **Dès que le groupe *change*, et pas seulement quand il se vide.** Tirer
      // l'unique membre d'un îlot droit dans un autre écrit un groupe non vide,
      // et emporte quand même le premier : la condition « le groupe devient
      // vide » ratait exactement ce cas-là.
      const perdu =
        "groupe" in reglage && reglage.groupe !== carte.groupe
          ? ilotPerdu(carte, cartes, liens, teintes)
          : undefined
      pile.current.push({ genre: "carte", carte: carte.identifiant, avant, ilot: perdu })
      void api
        .reglerCarte(carte.identifiant, reglage)
        .catch((e) => echouer(e, "la carte n'a pas pu être posée"))
    },
    [cartes, liens, teintes, crans, echouer, pile],
  )

  // ── Les gestes du lien ───────────────────────────────────────────────────
  //
  // **La pile n'empile que ce qu'elle sait défaire, et l'ordre n'est pas le
  // même des deux côtés.** Un réglage s'empile *avant* l'appel, parce que la
  // valeur d'avant est vraie même si l'appel échoue. Une création s'empile
  // *après*, parce que son identifiant vient de la réponse — l'empiler avant
  // aurait fait viser un lien qui n'existe pas encore, ou pas du tout.

  const tirer = useCallback(
    (de: Lien["de"], vers: Lien["de"]) => {
      void api
        .lier(de, vers)
        .then((ne) => pile.current.push({ genre: "lien-cree", lien: ne.identifiant }))
        .catch((e) => echouer(e, "le lien n'a pas pu être tiré"))
    },
    [echouer, pile],
  )

  const couper = useCallback(
    (un: Lien) => {
      pile.current.push({ genre: "lien-coupe", lien: un })
      void api.couperLien(un.identifiant).catch((e) => echouer(e, "le lien n'a pas pu être coupé"))
    },
    [echouer, pile],
  )

  // ── Ctrl+Z, sans surface ─────────────────────────────────────────────────
  //
  // « L'annulation d'une suppression tient dans une fente parce que ce geste-là
  // est rare. Sur la toile le geste risqué est le déplacement, c'est-à-dire le
  // geste permanent : une fente qui clignote cent fois par séance serait du
  // bruit » (`docs/DESIGN.md`). Elle existe parce que « hors îlot, pas de
  // groupe » ferait autrement d'un glissement raté l'effacement d'un nom tapé à
  // la main.

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (!(evenement.ctrlKey || evenement.metaKey) || evenement.key.toLowerCase() !== "z")
        return
      // Un champ de saisie a sa propre annulation, et c'est celle-là qu'on veut
      // quand on est en train d'écrire une note.
      //
      // **Mais seulement un champ de cet écran-ci.** Trouvé en écrivant l'essai :
      // le champ de prompt de l'atelier prend le focus au démarrage et ne le
      // rend jamais, parce que l'écran Univers *couvre* l'atelier au lieu de le
      // remplacer. Le garde tel qu'écrit d'abord voyait donc un `<textarea>`
      // actif à chaque frappe et avalait toutes les annulations de la toile,
      // sans que rien ne le dise. La règle est juste, son hypothèse était
      // fausse : on ne tape pas dans un champ qu'un écran recouvre.
      const actif = document.activeElement
      if (
        actif instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(actif.tagName) &&
        actif.closest("[data-univers]")
      )
        return
      const geste = pile.current.pop()
      if (!geste) return
      evenement.preventDefault()
      void defaire(geste).catch((e) => echouer(e, "le geste n'a pas pu être défait"))
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [echouer, pile])

  // ── Les gestes de composition ────────────────────────────────────────────

  /** Relâcher une carte : elle écrit sa place **et** son groupe, en un appel.
   *
   *  Deux appels rendraient possible un état où l'un est écrit et l'autre non,
   *  c'est-à-dire la divergence que toute la tranche est là pour empêcher. */
  const relacher = useCallback(
    (identifiant: string, place: Place, pointeur: Place) => {
      const carte = cartes.find((c) => c.identifiant === identifiant)
      if (!carte || !crans) return

      // **Le glissement qui traverse la frontière est du code maison** : lâchée
      // sur la réserve, la carte perd sa place et son groupe — ni classée, ni
      // posée, ce qui est exactement ce que la réserve contient.
      if (surLaReserve(pointeur)) {
        poser(carte, { groupe: "", position: [] })
        return
      }

      const centre = {
        x: place.x + largeurDe(carte, crans) / 2,
        y: place.y + hauteurDe(carte, crans) / 2,
      }
      poser(carte, { groupe: ilotSous(centre, ilots), position: [place.x, place.y] })
    },
    [cartes, crans, ilots, poser],
  )

  /** Une carte tirée de la réserve — elle arrive **où on la lâche**, et le
   *  classement suit la place. Composer et classer sont le même geste. */
  const accueillir = useCallback(
    (evenement: React.DragEvent) => {
      const identifiant = evenement.dataTransfer.getData(GLISSE_CARTE)
      if (!identifiant || !crans) return
      evenement.preventDefault()
      const carte = cartes.find((c) => c.identifiant === identifiant)
      if (!carte) return
      const point = screenToFlowPosition({ x: evenement.clientX, y: evenement.clientY })
      // Lâchée sous le pointeur, donc centrée sur lui : une carte qui se pose
      // par son coin supérieur gauche tombe toujours à côté de ce qu'on visait.
      const place = {
        x: point.x - largeurDe(carte, crans) / 2,
        y: point.y - hauteurDe(carte, crans) / 2,
      }
      poser(carte, { groupe: ilotSous(point, ilots), position: [place.x, place.y] })
    },
    [cartes, crans, ilots, poser, screenToFlowPosition],
  )

  /** Le point du plan où un geste de la librairie s'est terminé, et ce qu'il y
   *  a dessous — **demandé au produit, jamais à la librairie**. */
  const objetSous = useCallback(
    (ecran: { clientX: number; clientY: number }): Lien["de"] | null => {
      if (!crans) return null
      const point = screenToFlowPosition({ x: ecran.clientX, y: ecran.clientY })
      // La carte d'abord, l'îlot ensuite : l'ordre exact des `zIndex`,
      // c'est-à-dire l'ordre de ce que l'œil voit.
      const carte = carteSous(point, cartes, places, crans)
      if (carte) return { genre: "carte", valeur: carte }
      const nom = ilotSous(point, ilots)
      return nom ? { genre: "ilot", valeur: nom } : null
    },
    [cartes, places, ilots, crans, screenToFlowPosition],
  )

  /** Un trait vient d'être relâché. **C'est `onConnectEnd` et pas `onConnect`**,
   *  parce que l'arrivée est décidée par la géométrie du produit : un ancrage
   *  invisible posé sur toute la carte aurait dû être éteint au repos et rallumé
   *  pendant la liaison — une règle déléguée à la librairie dont personne
   *  n'aurait mesuré le résultat. */
  const relierAu = useCallback(
    (evenement: MouseEvent | TouchEvent, etat: { fromNode?: { id: string } | null }) => {
      const depart = etat.fromNode?.id
      if (!depart) return
      const ecran =
        "clientX" in evenement
          ? { clientX: evenement.clientX, clientY: evenement.clientY }
          : {
              clientX: evenement.changedTouches[0]?.clientX ?? 0,
              clientY: evenement.changedTouches[0]?.clientY ?? 0,
            }
      const arrivee = objetSous(ecran)
      // Lâché dans le vide : rien ne se passe, et rien ne le dit. Un trait tiré
      // à côté est un geste abandonné, pas un refus.
      if (!arrivee) return
      const de: Lien["de"] = depart.startsWith("ilot:")
        ? { genre: "ilot", valeur: depart.slice(5) }
        : { genre: "carte", valeur: depart }
      if (de.genre === arrivee.genre && de.valeur === arrivee.valeur) return
      tirer(de, arrivee)
    },
    [objetSous, tirer],
  )

  /** Écrire une note là où on double-clique.
   *
   *  **`zoomOnDoubleClick` est éteint pour ça**, et c'est le prix, écrit : le
   *  défaut de `@xyflow/react` est `true`, donc le plan zoomerait sous le champ
   *  au moment même où il s'ouvre — et le champ étant à l'échelle du plan, il
   *  grossirait et se déplacerait pendant qu'on tape. Le double-clic ne peut pas
   *  à la fois zoomer et écrire, et le perdant serait toujours celui qu'on
   *  voulait. La molette et le plan couvrent déjà le zoom. */
  const ouvrirBrouillon = useCallback(
    (evenement: React.MouseEvent) => {
      if (!crans) return
      // **Sur quoi que ce soit que le produit ait posé, le double-clic ne crée
      // rien** : on écrit *à côté* de ce qui est là, jamais par-dessus. Le nœud
      // ne suffit pas à le dire — le pavé d'un lien et son mot sont rendus par
      // le calque des étiquettes, qui est **frère** des nœuds et non l'un
      // d'eux. Sans cette seconde classe, double-cliquer un mot dans le champ
      // « Mot » pour le sélectionner — le geste le plus banal qui soit sur un
      // champ de saisie — ouvrait un brouillon de note et lui volait le focus.
      const cible = evenement.target as HTMLElement
      if (cible.closest(".react-flow__node, .react-flow__edgelabel-renderer")) return
      const point = screenToFlowPosition({ x: evenement.clientX, y: evenement.clientY })
      setBrouillon({ x: point.x - crans[1] / 2, y: point.y - crans[1] / 2 })
    },
    [crans, screenToFlowPosition],
  )

  /** Ce qu'un brouillon devient. Vide, il ne devient rien — sans quoi le tableau
   *  se remplirait de notes vides qu'il faudrait ensuite retirer une à une. */
  const ecrire = useCallback(
    (texte: string, place: Place) => {
      setBrouillon(null)
      const propre = texte.trim()
      if (!propre || !crans) return
      // **Une note écrite dans un îlot lui appartient**, comme tout ce qui
      // atterrit sur le plan : « composer et classer sont le même geste ». La
      // laisser hors groupe aurait fait qu'une note posée au milieu d'un îlot
      // n'en soit pas membre, puis le devienne au premier pixel de déplacement —
      // deux réponses à la même question, à un pixel d'écart.
      const centre = { x: place.x + crans[1] / 2, y: place.y + crans[1] / 2 }
      void api
        .collerTexte(propre, {
          position: [place.x, place.y],
          groupe: ilotSous(centre, ilots),
        })
        .catch((e) => echouer(e, "la note n'a pas pu être posée"))
    },
    [crans, ilots, echouer],
  )

  /** Défaire un geste — trois formes, trois chemins.
   *
   *  L'ordre compte pour l'îlot rendu : son groupe doit être réécrit **avant**
   *  que ses liens ne soient reposés, sinon le serveur refuse à juste titre un
   *  trait vers un îlot qui n'existe pas encore. */
  const defaire = useCallback(
    async (geste: Geste) => {
      if (geste.genre === "lien-cree") {
        await api.couperLien(geste.lien)
        return
      }
      if (geste.genre === "lien-coupe") {
        const { de, vers, mot, pointe } = geste.lien
        const repose = await api.lier(de, vers, { mot, pointe })
        // **Le lien revient avec un identifiant neuf, et la pile doit le
        // savoir.** Rien ne référence un lien, donc le changement ne se voit
        // nulle part — sauf dans la pile elle-même, où l'entrée « ce lien-ci a
        // été tiré » nommait l'ancien. Un Ctrl+Z de plus serait allé couper un
        // lien qui n'existe plus, et l'auteur aurait lu un refus au lieu de voir
        // son geste se défaire. On réécrit donc ce que l'annulation vient de
        // renommer : la pile décrit des gestes, pas des identifiants figés.
        //
        // **Aucun essai ne couvre ce chemin, et ça se dit.** Il demande un lien
        // *tiré depuis l'écran* — donc la gestion de pointeur de la librairie,
        // qui ne démarre pas sur des événements synthétisés. Un essai monté sur
        // un lien de fixture n'empile aucune création, et passerait donc sans
        // rien prouver : c'est très exactement le défaut d'essai que la revue de
        // cette tranche a trouvé ailleurs, et on ne le réintroduit pas ici.
        for (const autre of pile.current)
          if (autre.genre === "lien-cree" && autre.lien === geste.lien.identifiant)
            autre.lien = repose.identifiant
        return
      }
      await api.reglerCarte(geste.carte, geste.avant)
      if (!geste.ilot) return
      // L'îlot reparaît : on lui rend ce qu'il avait.
      if (geste.ilot.teinte) await api.teinterIlot(geste.ilot.nom, geste.ilot.teinte)
      for (const un of geste.ilot.liens) {
        await api.lier(un.de, un.vers, { mot: un.mot, pointe: un.pointe })
      }
    },
    [],
  )

  const cadre = useMemo<Cadre>(
    () => ({
      choisie,
      survolee,
      epingle,
      crans,
      teintes,
      tailleDe,
      onSurvol: survoler,
      onChoisir,
      onEpingler: setEpingle,
      onErreur,
      onLargeur: (carte, largeur) => poser(carte, { largeur_libre: largeur }),
      onTeinterIlot: (nom, teinte) =>
        void api.teinterIlot(nom, teinte).catch((e) => echouer(e, "teinte refusée")),
      onReglerLien: (un, reglage) =>
        void api
          .reglerLien(un.identifiant, reglage)
          .catch((e) => echouer(e, "le lien n'a pas pu être réglé")),
      onCouperLien: couper,
      onNote: ecrire,
      onAbandon: () => setBrouillon(null),
      aimanter: (depart, ecart) => aimanter(crans, depart, ecart),
      zoom: getZoom,
    }),
    [
      choisie,
      survolee,
      epingle,
      crans,
      teintes,
      tailleDe,
      survoler,
      onChoisir,
      onErreur,
      poser,
      couper,
      ecrire,
      echouer,
      getZoom,
    ],
  )

  const glisseCarte = (evenement: React.DragEvent) =>
    evenement.dataTransfer.types.includes(GLISSE_CARTE)

  /** **Ne pas proposer ce qu'on refusera** — la règle du produit depuis T1, et
   *  le serveur refuse déjà les deux cas en le disant. Un objet ne se joint pas
   *  à lui-même, et deux traits entre les deux mêmes objets se poseraient l'un
   *  sur l'autre : le second serait invisible, donc impossible à couper. */
  const peutRelier = useCallback(
    ({ source, target }: { source?: string | null; target?: string | null }) => {
      if (!source || !target || source === target) return false
      const nomDe = (bout: Lien["de"]) =>
        bout.genre === "ilot" ? `ilot:${bout.valeur}` : bout.valeur
      return !liens.some(
        (un) =>
          (nomDe(un.de) === source && nomDe(un.vers) === target) ||
          (nomDe(un.de) === target && nomDe(un.vers) === source),
      )
    },
    [liens],
  )

  return (
    <section
      className={[
        "flex min-h-0 min-w-0 flex-1 flex-col border-l border-bord",
        depot.survole ? "bg-fond-2" : "bg-fond-0",
      ].join(" ")}
    >
      <BarreTableau cartes={cartes} vue={vue} onVue={onVue} />

      <div
        ref={plan}
        {...depot.props}
        onDragOver={(evenement) => {
          if (glisseCarte(evenement)) evenement.preventDefault()
          else depot.props.onDragOver(evenement)
        }}
        onDrop={(evenement) => {
          if (glisseCarte(evenement)) accueillir(evenement)
          else depot.props.onDrop(evenement)
        }}
        onDoubleClick={ouvrirBrouillon}
        data-plan
        className="relative min-h-0 min-w-0 flex-1"
      >
        <CADRE.Provider value={cadre}>
          <ReactFlow
            nodes={noeuds}
            nodeTypes={TYPES}
            onNodesChange={surChangement}
            edges={aretes}
            edgeTypes={TYPES_ARETE}
            onConnectEnd={relierAu}
            isValidConnection={peutRelier}
            onNodeDragStop={(evenement, noeud) =>
              relacher(noeud.id, noeud.position, {
                x: (evenement as MouseEvent).clientX,
                y: (evenement as MouseEvent).clientY,
              })
            }
            onPaneClick={() => {
              onChoisir(null)
              setEpingle(null)
            }}
            minZoom={0.2}
            maxZoom={2.5}
            // Un objet porte **une** poignée de lien, à l'endroit où l'écran
            // dessinait déjà quelque chose : pas de nord/sud/est/ouest, pas de
            // point sur cinquante cartes. Ce qui paraît est ce que le produit
            // dessine, jamais une propriété.
            nodesConnectable
            // **Le défaut de la librairie est `true`, et il arme une liaison au
            // clic.** Un clic sur le nom d'un îlot ouvrirait alors son menu *et*
            // commencerait un trait : deux gestes sur le même `pointerdown`. Un
            // lien se tire, il ne se clique pas.
            connectOnClick={false}
            // Le défaut est `true` lui aussi, et le double-clic écrit une note
            // ici. Voir `ouvrirBrouillon`.
            zoomOnDoubleClick={false}
            nodesFocusable={false}
            edgesFocusable={false}
            // **Cette ligne cesse d'être un héritage le jour où il y a de vraies
            // arêtes.** Sans elle, la touche Suppr de la librairie couperait un
            // lien sans passer par la route ni par la pile — un geste qui écrit
            // sur le disque et que Ctrl+Z ignore. La suppression reste au
            // produit, dans le pavé du lien.
            deleteKeyCode={null}
            // **Le défaut de la librairie est `Space`**, et Espace ouvre
            // l'aperçu de la carte survolée. Laissé tel quel, il armerait un
            // mode « déplacer le plan en tirant » que personne n'a demandé, à
            // chaque fois qu'on regarde une image en grand — et il resterait
            // armé si le relâchement se perdait sous l'écran posé par-dessus.
            // Troisième réglage de librairie éteint ici, et la raison est
            // écrite comme les deux autres : un réglage éteint sans phrase se
            // rallume à la première mise à jour.
            panActivationKeyCode={null}
            className="h-full w-full"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--color-bord)"
            />
            {/* **La pointe, définie une fois pour toutes les arêtes.** Un
                marqueur par lien serait autant de définitions identiques dans le
                document, et `markerEnd` se résout de toute façon par
                identifiant. Elle prend la couleur du trait au repos : une pointe
                est une précision sur le trait, pas une seconde marque. */}
            <svg width="0" height="0" aria-hidden>
              <defs>
                <marker
                  id={POINTE}
                  markerWidth="7"
                  markerHeight="7"
                  refX="6"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 z" fill="var(--color-bord-fort)" />
                </marker>
              </defs>
            </svg>
          </ReactFlow>
        </CADRE.Provider>

        {!crans ? (
          <p className="mesure pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] text-texte-3">
            la toile se règle sur la grille…
          </p>
        ) : (
          !cartes.some((c) => !c.en_reserve) && <ToileNue />
        )}
      </div>
    </section>
  )
}

/** Le pointeur est-il sur la réserve ? La frontière est celle de la colonne,
 *  telle qu'elle est rendue — mesurée, jamais supposée. */
function surLaReserve(pointeur: Place): boolean {
  const colonne = document.querySelector("[data-reserve]")?.getBoundingClientRect()
  return (
    !!colonne &&
    pointeur.x >= colonne.left &&
    pointeur.x <= colonne.right &&
    pointeur.y >= colonne.top &&
    pointeur.y <= colonne.bottom
  )
}

/** L'état vide. En serif, parce que c'est une invitation et non un message
 *  d'erreur — `docs/DESIGN.md` § Typography, règle 1. */
function ToileNue() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
      <p className="text-center font-serif text-[28px] leading-tight text-texte-2">
        La toile est nue. <span className="italic text-texte">Tire une carte.</span>
      </p>
      <p className="mesure max-w-[420px] text-center text-[10px] leading-relaxed text-texte-3">
        Ce que tu poses ici garde sa place. Lâche-la dans un îlot et son groupe
        s'écrit ; lâche-la à côté et elle reste posée sans être classée.
      </p>
    </div>
  )
}

// ── Les nœuds et l'arête ────────────────────────────────────────────────────

/** L'ancrage d'arrivée — **il existe pour que la librairie sache résoudre une
 *  arête, et pour rien d'autre.**
 *
 *  Elle refuse de rendre un trait dont elle ne trouve pas les deux bouts : sans
 *  cet ancrage, aucun lien ne paraît, et rien ne le dit. Il est donc de la
 *  **surface** — le partage de `docs/ARCHITECTURE.md` §6.5, à la lettre.
 *
 *  **Il ne participe jamais à la liaison** (`isConnectable={false}`), et c'est
 *  ce qui le distingue du piège qu'on a écarté : décider *sur quoi* un trait est
 *  lâché reste au produit, par `carteSous` et `ilotSous` au relâchement. Un
 *  ancrage qui aurait accepté la liaison aurait fallu être éteint au repos et
 *  rallumé pendant le geste — une règle déléguée à la librairie dont personne
 *  n'aurait mesuré le résultat. Celui-ci ne s'allume jamais.
 *
 *  Le tracé, lui, ne le lit pas : `ancrer` calcule les deux points sur les
 *  boîtes. Sa position déclarée n'a donc aucune conséquence visible. */
function Ancrage() {
  return (
    <Handle
      type="target"
      position={Position.Left}
      isConnectable={false}
      className="!pointer-events-none !h-0 !w-0 !min-w-0 !border-0 !bg-transparent !opacity-0"
    />
  )
}

/**
 * L'îlot — un cadre, un nom, et depuis T9 une couleur.
 *
 * « L'îlot est du châssis, pas un objet dessiné » (`docs/DESIGN.md`) : cadre de
 * 1 px, rayon 2 comme la carte, fond de la même teinte à 8 %, titre en mono
 * 10 px parce que c'est un fait sur ce qu'il contient et pas une légende. Sans
 * teinte il porte celle du châssis — `--bord-fort`, `--fond-1` à 40 % —, et ce
 * n'est pas un provisoire : c'est ce que ce document dit qu'il est.
 *
 * **Il ne se saisit toujours pas.** Ce qui change en T9 tient en une ligne : la
 * bande de son nom passe en `pointer-events: auto` sous un nœud qui reste en
 * `none`. L'argument est géométrique et il se mesure dans `ilotsDe` — la boîte
 * part à `y − MARGE_ILOT − BANDE_ILOT`, donc ces 20 px sont **au-dessus** de la
 * boîte englobante de ses membres et ne recouvrent aucune carte, par
 * construction. Une surface qui ne recouvre rien ne prend rien à personne, là
 * où rendre la *boîte* vivante aurait volé chaque prise de carte. On traverse
 * toujours l'îlot pour prendre une carte et pour déplacer le plan ; on ne le
 * déplace toujours pas, puisque déplacer un rangement serait déplacer ce qu'il
 * contient. Ce qu'on perd est 20 px de plan par îlot, et ça se dit.
 *
 * **Le nom ouvre le menu, la poignée tire le lien — deux surfaces, deux
 * gestes.** Une bande qui ferait les deux les mettrait sur le même
 * `pointerdown`, et il faudrait décider lequel gagne à chaque pression. La
 * poignée est la jumelle de celle de la largeur : 10 px, mêmes tokens, révélée
 * au survol.
 */
function NoeudIlot({ data }: NodeProps) {
  const cadre = useContext(CADRE)
  const { nom, membres } = data as unknown as { nom: string; membres: number }
  if (!cadre) return null

  const cle = cleIlot(nom)
  const ouvert = cadre.epingle === cle || cadre.survolee === cle
  const teinte = cadre.teintes[nom] ?? ""
  const couleur = teinte ? COULEUR_TEINTE[teinte] : null

  return (
    <div
      data-ilot={nom}
      style={
        couleur
          ? {
              borderColor: couleur,
              background: `color-mix(in srgb, ${couleur} 8%, transparent)`,
            }
          : undefined
      }
      className={[
        "group/ilot h-full w-full rounded-[2px] border",
        couleur ? "" : "border-bord-fort bg-fond-1/40",
      ].join(" ")}
    >
      {/* **La seule surface vivante de l'îlot**, et elle ne recouvre aucune de
          ses cartes. Le nœud reste en `pointer-events: none` ; un enfant en
          `auto` sous un parent en `none` reçoit ses événements. */}
      <div
        style={{ pointerEvents: "auto" }}
        onPointerEnter={() => cadre.onSurvol(cle, true)}
        onPointerLeave={() => cadre.onSurvol(cle, false)}
        className="mesure relative flex h-[20px] items-center gap-2 px-2 text-[10px]"
      >
        {/* Le nom **est** la poignée du menu — le motif de l'infobulle, appliqué
            à l'objet qui n'a rien d'autre à offrir. `w-fit` pour la même raison
            qu'un libellé : dans une rangée, la cible doit être le mot. */}
        <button
          type="button"
          onClick={() => cadre.onEpingler(ouvert && cadre.epingle === cle ? null : cle)}
          style={couleur ? { color: couleur } : undefined}
          className={`w-fit max-w-full truncate text-left ${couleur ? "" : "text-texte-2"}`}
        >
          {nom}
        </button>
        <span className="shrink-0 text-texte-3">
          {membres} carte{membres > 1 ? "s" : ""}
        </span>

        {/* La poignée de lien, jumelle de celle de la largeur : mêmes tokens,
            même révélation au survol, seul le curseur diffère. */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectableStart
          isConnectableEnd={false}
          className="!relative !ml-auto !h-[10px] !w-[10px] !min-w-0 !translate-y-0 !transform-none !cursor-crosshair !rounded-[2px] !border !border-bord-fort !bg-fond-3 !opacity-0 !transition-opacity !duration-[80ms] group-hover/ilot:!opacity-100"
        />
        <Ancrage />
      </div>

      {ouvert && (
        <div className="paraitre absolute bottom-full left-0 mb-[3px] flex flex-col gap-1.5 rounded-[2px] border border-bord bg-fond-1 p-2"
             style={{ pointerEvents: "auto" }}>
          <Libelle aide="ilot.teinte">Teinte de l'îlot</Libelle>
          <Pastilles teinte={teinte} onChoisir={(t) => cadre.onTeinterIlot(nom, t)} />
        </div>
      )}
    </div>
  )
}

/**
 * Le brouillon d'une note — ce sur quoi on écrit avant que la note existe.
 *
 * **Un champ non contrôlé, et c'est délibéré.** L'effet qui compose les nœuds se
 * rejoue à chaque carte qui arrive — une image collée depuis un autre onglet,
 * une récupération qui aboutit —, et un texte à moitié tapé qui vivrait dans
 * l'état du plan serait perdu à ce moment-là. Ici il vit dans le DOM du champ,
 * que React ne démonte pas puisque la clé du nœud ne change jamais.
 *
 * `Échap` abandonne, `blur` écrit, et un champ vide ne crée rien : le tableau ne
 * se remplit pas de notes vides qu'il faudrait ensuite retirer une à une.
 */
function NoeudBrouillon({ positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const cadre = useContext(CADRE)
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => champ.current?.focus(), [])
  if (!cadre) return null

  return (
    <textarea
      ref={champ}
      data-brouillon
      placeholder="une intention, ici"
      onKeyDown={(evenement) => {
        if (evenement.key === "Escape") {
          evenement.stopPropagation()
          cadre.onAbandon()
        }
      }}
      onBlur={(evenement) =>
        cadre.onNote(evenement.target.value, { x: positionAbsoluteX, y: positionAbsoluteY })
      }
      className="nodrag nowheel h-full w-full resize-none rounded-[2px] border border-lumiere bg-fond-2 p-3 text-[12.5px] leading-relaxed text-texte shadow-[0_0_0_2px_var(--color-lumiere)] placeholder:text-texte-3"
    />
  )
}

/** Une carte sur le plan — la carte du tableau, et sa poignée de largeur.
 *
 *  **La carte suit la poignée pendant qu'on tire, et c'est la moitié du geste.**
 *  Le nœud, lui, ne change de taille qu'une fois la largeur écrite et revenue
 *  par le flux : sans cette largeur vive, on tirerait une poignée devant une
 *  carte immobile, et on ne verrait la place qu'elle prend qu'après l'avoir
 *  lâchée — c'est-à-dire trop tard pour la juger. Le curseur de T2 avait déjà
 *  cette forme : *la valeur suit la main, l'écriture suit le relâchement*. */
function NoeudCarte({ data }: NodeProps) {
  const cadre = useContext(CADRE)
  const { carte } = data as unknown as { carte: Carte }
  const [tiree, setTiree] = useState<number | null>(null)
  // **La valeur à écrire vit aussi dans un `ref`.** Un `pointerup` qui suit son
  // `pointermove` d'assez près lit un `onPoser` fabriqué au rendu d'avant, donc
  // une largeur encore nulle — et le geste ne s'écrit pas. L'état sert à rendre,
  // la référence à poser ; c'est la même valeur, tenue là où chacun la lit.
  const derniere = useRef<number | null>(null)
  if (!cadre) return null

  const posee = carte.largeur_libre ?? (cadre.crans ? cadre.crans[carte.taille] : 0)
  const vive = tiree ?? posee

  return (
    <div
      className="group relative"
      style={{ width: vive, height: Math.round(vive * rapport(carte)) + PIED }}
    >
      <CarteTuile
        carte={carte}
        plan
        choisie={carte.identifiant === cadre.choisie}
        survolee={cleCarte(carte.identifiant) === cadre.survolee}
        onSurvol={(dedans) => cadre.onSurvol(cleCarte(carte.identifiant), dedans)}
        onChoisir={() =>
          cadre.onChoisir(carte.identifiant === cadre.choisie ? null : carte.identifiant)
        }
        onErreur={cadre.onErreur}
      />
      <Poignee
        depart={vive}
        onTirer={(ecart, depuis) => {
          const largeur = cadre.aimanter(depuis, ecart)
          derniere.current = largeur
          setTiree(largeur)
        }}
        onPoser={() => {
          if (derniere.current !== null && derniere.current !== posee)
            cadre.onLargeur(carte, derniere.current)
          derniere.current = null
          setTiree(null)
        }}
        zoom={cadre.zoom}
      />

      {/* **La poignée du lien — jumelle de celle de la largeur, à l'autre coin.**
          Mêmes tokens exactement : 10 px, rayon 2, cadre `--bord-fort`, fond
          `--fond-3`, révélée au survol. Aucun pixel de vocabulaire neuf ; seul
          le curseur diffère, parce que le geste diffère. Bas-**gauche** contre
          bas-droit : deux poignées au même coin auraient demandé de viser, et
          une toile se compose vite. */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectableStart
        isConnectableEnd={false}
        className="!left-0 !-bottom-1 !h-[10px] !w-[10px] !min-w-0 !-translate-x-1/2 !cursor-crosshair !rounded-[2px] !border !border-bord-fort !bg-fond-3 !opacity-0 !transition-opacity !duration-[80ms] group-hover:!opacity-100"
      />
      <Ancrage />
    </div>
  )
}

/**
 * Le trait, son mot et sa pointe.
 *
 * **Le tracé se calcule sur les positions vives des nœuds, pas sur celles que le
 * serveur dit.** C'est la phrase de T8 pour la troisième fois — *la valeur suit
 * la main, l'écriture suit le relâchement* : sans elle, un lien resterait
 * immobile pendant qu'on déplace la carte à laquelle il est accroché, et ne
 * sauterait qu'au relâchement. L'îlot, lui, ne suit **pas** un membre qu'on tire
 * dehors : sa boîte est celle que le serveur dit, exactement comme T8 l'a
 * décidé pour qu'une carte puisse sortir de son îlot.
 *
 * **Droit, et non courbe.** `docs/PLAN.md` dit « un trait nu » ; une courbe de
 * Bézier ferait lire l'écran comme un outil de diagrammes.
 *
 * **Un lien qui a un mot se survole par son mot, un lien muet par sa bande.**
 * C'est ce qui rend le défaut muet payable : la zone d'écoute de 20 px que la
 * librairie pose le long du tracé est de la surface, donc de son ressort
 * (`docs/ARCHITECTURE.md` §6.5) — un trait de 1 px, lui, ne se survole pas.
 */
function AreteLien({ id, source, target, data }: EdgeProps) {
  const cadre = useContext(CADRE)
  const depart = useInternalNode(source)
  const arrivee = useInternalNode(target)
  const { lien } = data as unknown as { lien: Lien }
  if (!cadre || !depart || !arrivee) return null

  // **Position de la librairie, taille du produit** — voir `tailleDe`. La
  // position bouge pendant qu'on tire une carte, donc elle vient d'elle ; la
  // taille est calculée de toute façon, donc elle vient de nous, et le trait
  // ne dépend d'aucune mesure qu'un onglet pourrait ne jamais prendre.
  const boiteDe = (n: typeof depart, id: string): Boite => {
    const taille = cadre.tailleDe(id)
    return {
      x: n?.internals?.positionAbsolute?.x ?? 0,
      y: n?.internals?.positionAbsolute?.y ?? 0,
      l: taille?.l ?? n?.measured?.width ?? 0,
      h: taille?.h ?? n?.measured?.height ?? 0,
    }
  }
  const [un, deux] = ancrer(boiteDe(depart, source), boiteDe(arrivee, target))

  const cle = cleLien(id)
  const ouvert = cadre.epingle === cle || cadre.survolee === cle
  const milieu = { x: (un.x + deux.x) / 2, y: (un.y + deux.y) / 2 }

  return (
    <>
      <BaseEdge
        id={id}
        path={`M ${un.x},${un.y} L ${deux.x},${deux.y}`}
        markerEnd={lien.pointe ? `url(#${POINTE})` : undefined}
        style={{
          stroke: ouvert ? "var(--color-texte-2)" : "var(--color-bord-fort)",
          strokeWidth: 1,
        }}
        // Le survol passe par la zone d'écoute de la librairie, qui la pose sur
        // le chemin d'interaction — pas sur le trait visible.
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        {/* Le mot, au milieu du trait, sur une pastille `--fond-0` pour que le
            trait ne le traverse pas. Mono 10 px : c'est un fait sur ce qui est
            là, comme le nom d'un îlot. */}
        {lien.mot && (
          <button
            type="button"
            onPointerEnter={() => cadre.onSurvol(cle, true)}
            onPointerLeave={() => cadre.onSurvol(cle, false)}
            onClick={() => cadre.onEpingler(cadre.epingle === cle ? null : cle)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${milieu.x}px, ${milieu.y}px)`,
              pointerEvents: "all",
            }}
            className="mesure nodrag nopan rounded-[2px] bg-fond-0 px-1 text-[10px] text-texte-2"
          >
            {lien.mot}
          </button>
        )}

        {/* La zone d'écoute d'un lien **muet** : il n'a pas de mot à survoler, et
            c'est la contrepartie assumée du défaut muet. Un carré de 20 px au
            milieu du trait, invisible, dans la même largeur que celle que la
            librairie pose le long du tracé. */}
        {!lien.mot && (
          <button
            type="button"
            aria-label="Régler le lien"
            onPointerEnter={() => cadre.onSurvol(cle, true)}
            onPointerLeave={() => cadre.onSurvol(cle, false)}
            onClick={() => cadre.onEpingler(cadre.epingle === cle ? null : cle)}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${milieu.x}px, ${milieu.y}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan h-[20px] w-[20px] rounded-[2px]"
          />
        )}

        {ouvert && (
          <div
            data-lien={id}
            onPointerEnter={() => cadre.onSurvol(cle, true)}
            onPointerLeave={() => cadre.onSurvol(cle, false)}
            style={{
              position: "absolute",
              transform: `translate(-50%, 0) translate(${milieu.x}px, ${milieu.y + GOUTTIERE}px)`,
              pointerEvents: "all",
            }}
            className="paraitre nodrag nopan flex min-w-[240px] flex-col gap-2 rounded-[2px] border border-bord bg-fond-1 p-2"
          >
            <PavéLien lien={lien} cadre={cadre} />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

/** L'identifiant de la pointe, posé une fois pour toutes les arêtes. */
const POINTE = "pointe-lien"

/** Ce qu'on règle sur un lien : son mot, sa pointe — et le couper.
 *
 *  **Une seule rangée de chaque, dans la forme du menu d'une carte** : mêmes
 *  libellés à pointillé, même `Retirer` à droite en `--texte-3` qui vire à
 *  `--echec` au survol. Le mot s'écrit à `blur`, comme `groupe` et `note`.
 *
 *  **La pointe est un bouton qui est la phrase de son état**, comme le bouton
 *  `silhouette` du barème : `sans pointe` / `pointe à l'arrivée`. Aucun glyphe
 *  neuf, et pas de troisième état à inventer — le domaine porte un booléen, et
 *  le sens vient du tracé : on tire du départ vers l'arrivée. */
function PavéLien({ lien, cadre }: { lien: Lien; cadre: Cadre }) {
  const [mot, setMot] = useState(lien.mot)
  useEffect(() => setMot(lien.mot), [lien.identifiant])

  return (
    <>
      <div className="flex flex-col gap-1">
        <Libelle aide="lien.mot">Mot</Libelle>
        <input
          value={mot}
          placeholder="aucun"
          onChange={(e) => setMot(e.target.value)}
          onBlur={() => mot !== lien.mot && cadre.onReglerLien(lien, { mot })}
          className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[11px] text-texte placeholder:text-texte-3"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Libelle aide="lien.pointe">Pointe</Libelle>
        <button
          type="button"
          aria-pressed={lien.pointe}
          onClick={() => cadre.onReglerLien(lien, { pointe: !lien.pointe })}
          className={[
            "mesure h-[26px] rounded-[2px] border px-2 text-[10px] transition-colors duration-[80ms]",
            lien.pointe
              ? "border-signal bg-signal/13 text-signal"
              : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
          ].join(" ")}
        >
          {lien.pointe ? "pointe à l'arrivée" : "sans pointe"}
        </button>
      </div>
      <div className="flex items-center border-t border-bord pt-2">
        <button
          type="button"
          onClick={() => cadre.onCouperLien(lien)}
          className="mesure ml-auto text-[10px] text-texte-3 hover:text-echec"
        >
          Couper
        </button>
      </div>
    </>
  )
}

/**
 * La poignée de largeur — 10 px dans le coin, et elle ne paraît qu'au survol.
 *
 * **Elle ne tire que la largeur**, et c'est une décision de produit : « sur une
 * toile la taille est une place occupée, pas un niveau de zoom », et la hauteur
 * suit le rapport de l'image. Un redimensionnement à deux dimensions aurait
 * rendu possible une carte qui ment sur ce qu'elle montre.
 *
 * Le glissement est divisé par le zoom du plan — sans quoi tirer de dix pixels à
 * l'écran en donnerait quarante sur un plan réduit au quart.
 *
 * `nodrag` : sans cette classe la librairie saisit le nœud au premier pixel, et
 * on déplace la carte au lieu de l'élargir.
 */
function Poignee({
  depart,
  onTirer,
  onPoser,
  zoom,
}: {
  depart: number
  onTirer: (ecart: number, depuis: number) => void
  onPoser: () => void
  zoom: () => number
}) {
  const prise = useRef<{ x: number; largeur: number } | null>(null)

  return (
    <button
      type="button"
      aria-label="Régler la largeur sur la toile"
      className="nodrag absolute -right-1 -bottom-1 h-[10px] w-[10px] cursor-ew-resize rounded-[2px] border border-bord-fort bg-fond-3 opacity-0 transition-opacity duration-[80ms] group-hover:opacity-100 focus-visible:opacity-100"
      onPointerDown={(evenement) => {
        evenement.stopPropagation()
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
        prise.current = { x: evenement.clientX, largeur: depart }
      }}
      onPointerMove={(evenement) => {
        if (!prise.current) return
        const echelle = zoom() || 1
        onTirer((evenement.clientX - prise.current.x) / echelle, prise.current.largeur)
      }}
      onPointerUp={(evenement) => {
        if (!prise.current) return
        evenement.currentTarget.releasePointerCapture(evenement.pointerId)
        prise.current = null
        onPoser()
      }}
    />
  )
}

// ── L'aimant, et d'où il tire ses crans ─────────────────────────────────────

/**
 * Les trois largeurs sur lesquelles la largeur libre s'aimante — **mesurées sur
 * la grille, jamais écrites en dur** (`docs/DESIGN.md` § La toile).
 *
 * `gridTemplateColumns` calculé rend la largeur réelle d'une colonne, c'est-à-dire
 * celle d'une carte 1×. Les deux autres s'en déduisent par la règle que la grille
 * applique déjà à un `span` : *n* colonnes et les *n−1* gouttières entre elles.
 * Une valeur écrite ici serait fausse au premier changement de densité, et une
 * mesure prise sur une carte serait indisponible sur une réserve vide — d'où la
 * grille, qui est là même quand elle ne contient rien.
 *
 * **Trois déclencheurs, une seule mesure** — le montage, le redimensionnement de
 * la fenêtre, et le changement de vue. Un `ResizeObserver` ne livre rien à un
 * onglet qui ne compose pas ses images (T5), et la largeur d'une colonne ne
 * bouge pas autrement.
 */
export function useCrans(
  cadre: React.RefObject<HTMLDivElement | null>,
  vue: Vue,
): Crans | null {
  const [crans, setCrans] = useState<Crans | null>(null)

  useLayoutEffect(() => {
    const mesurer = () => {
      const el = cadre.current
      if (!el) return
      const une = Number.parseFloat(getComputedStyle(el).gridTemplateColumns.split(" ")[0])
      // Zéro n'est pas une largeur, c'est l'absence de mesure : sans elle il n'y
      // a pas d'aimant, et la largeur libre reste ce qu'elle est.
      if (!Number.isFinite(une) || une <= 0) return
      setCrans({
        1: Math.round(une),
        2: Math.round(une * 2 + GOUTTIERE),
        4: Math.round(une * 4 + GOUTTIERE * 3),
      })
    }
    mesurer()
    window.addEventListener("resize", mesurer)
    return () => window.removeEventListener("resize", mesurer)
  }, [cadre, vue])

  return crans
}
