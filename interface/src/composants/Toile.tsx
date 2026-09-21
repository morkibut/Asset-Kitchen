// La toile — la seconde vue du tableau d'inspiration (T8).
//
// **La règle est une phrase, et l'écran ne dit rien d'autre : la toile montre ce
// qui est classé, la réserve contient ce qui reste à classer** (`docs/design-motifs.md`
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
// de largeur. `docs/archi-versions.md` §6.5 fait la part exacte.
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
  type ReactNode,
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
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import {
  api,
  COULEUR_TEINTE,
  Refus,
  type Carte,
  type Fabrique,
  type Lien,
  type Personnage,
  type Teinte,
} from "../api"
import type { CibleAmbiances } from "./Ambiances"
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
import { Libelle, Raison } from "./pieces"

// ── Les mesures de l'îlot ───────────────────────────────────────────────────
//
// « L'îlot est du châssis, pas un objet dessiné » : ce qui suit est ce qu'il
// laisse autour de ce qu'il contient, et rien de plus. La marge reprend l'écart
// du châssis ; la bande du titre est la hauteur d'une ligne en mono 10 px.

const MARGE_ILOT = 14
const BANDE_ILOT = 20

// ── Les deux échelles ───────────────────────────────────────────────────────
//
// **Ce qui se lit est en pixels d'écran ; ce qui se mesure est en pixels de
// plan** (`docs/archive/DESIGN-chassis-chaud-2026-09-04.md` § Six règles de
// comportement, la sixième). L'image, la carte, la
// note, la boîte d'un îlot sont des **places** : elles suivent le zoom, sans
// quoi la toile mentirait sur ce qu'elle range. Le nom d'un îlot, son compte, le
// mot d'un trait et les trois prises sont des **lectures et des cibles** : ils
// gardent leur taille d'écran à tous les crans, parce qu'un nom illisible à 0,3×
// et une poignée de 30 px à 2,5× sont la même panne vue par ses deux bouts.
//
// C'est la seule surface du produit qui ait besoin de la règle — partout
// ailleurs l'écran *est* le plan. **Coût, et il est structurel** : tout objet
// neuf de cette toile doit déclarer à laquelle des deux il appartient, et
// l'oubli est silencieux — il ne se voit qu'en zoomant.

/** Le zoom du plan, **relu à chaque cran**.
 *
 *  `getZoom()` rend la valeur du moment sans réabonner personne : il sert au
 *  calcul d'un geste en cours, où l'on veut la valeur *maintenant*. Ici c'est le
 *  **rendu** qui en dépend, donc c'est le store qu'on lit — et la transformation
 *  seule, pas le déplacement : `useViewport` rendrait chaque nœud à chaque pixel
 *  de panoramique, pour une valeur qui n'a pas bougé.
 *
 *  Zéro n'est pas un zoom : c'est l'absence de plan monté, et diviser par lui
 *  ferait disparaître ce qu'on voulait garder lisible. */
const zoomDuPlan = (etat: ReactFlowState) => etat.transform[2]

function useZoom(): number {
  return useStore(zoomDuPlan) || 1
}

/**
 * Une **ancre d'écran** — un point du plan dont le contenu ne suit pas le zoom.
 *
 * La boîte est de taille nulle : elle n'occupe rien, elle ne recouvre rien, et
 * `scale(1/zoom)` autour d'elle laisse son point exactement là où il est —
 * ses quatre coins étant confondus, il n'y a aucun `transform-origin` à
 * choisir, donc aucun à se tromper. Ce qu'on pose dedans se mesure en pixels
 * d'écran : le plan multiplie par le zoom, l'ancre divise par lui, et le compte
 * est juste à tous les crans.
 *
 * **Une seule forme pour les cinq usages** — le bandeau d'un îlot, ses deux
 * prises, celles d'une carte, le mot d'un trait. Une taille d'écran obtenue
 * cinq fois de cinq façons aurait fini par en donner cinq différentes.
 */
function ancreEcran(zoom: number, place: React.CSSProperties): React.CSSProperties {
  return {
    position: "absolute",
    width: 0,
    height: 0,
    transform: `scale(${1 / zoom})`,
    transformOrigin: "0 0",
    // L'ancre elle-même n'attrape rien : ce qu'elle porte le dit pour soi.
    pointerEvents: "none",
    ...place,
  }
}

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
 * — la surface (`docs/archi-versions.md` §6.5). Une seule paire par nœud, source
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

/** Ce qu'une prise doit parcourir, en pixels d'écran, pour devenir un
 *  glissement.
 *
 *  Le seul endroit du produit qui ait besoin de distinguer les deux : la bande
 *  d'un îlot porte deux gestes — ouvrir son menu, déplacer l'îlot — et c'est la
 *  distance qui les sépare. Trois pixels, parce que le tremblement d'un clic en
 *  fait un ou deux et qu'un déplacement voulu en fait dix. À l'écran et non sur
 *  le plan : c'est la main qui tremble, pas la toile. */
const SEUIL_PRISE = 3

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

/** Deux boîtes se touchent-elles ? Non strict — deux bords qui se rejoignent au
 *  pixel se **touchent**, et c'est ce que le mot dit. */
function touche(un: Boite, deux: Boite): boolean {
  return (
    un.x <= deux.x + deux.l &&
    deux.x <= un.x + un.l &&
    un.y <= deux.y + deux.h &&
    deux.y <= un.y + un.h
  )
}

/** Deux boîtes se recouvrent-elles ? Strict — deux bords qui se rejoignent au
 *  pixel sont côte à côte, pas l'un sur l'autre. La sœur de `touche`, et les
 *  deux existent séparément parce que les deux seuils du classement ne sont
 *  justement pas le même. */
function chevauche(un: Boite, deux: Boite): boolean {
  return (
    un.x < deux.x + deux.l &&
    deux.x < un.x + un.l &&
    un.y < deux.y + deux.h &&
    deux.y < un.y + un.h
  )
}

/**
 * Le groupe d'une carte posée là — **on entre par le centre, on sort par le
 * tout**.
 *
 * Écrit le 28 août 2026 (`docs/design-motifs.md` § La toile révisée). Le
 * classement se décidait au centre dans les deux sens, et il suffisait d'en
 * passer la moitié par-dessus la bordure pour qu'un groupe s'efface —
 * c'est-à-dire qu'un îlot lâchait une carte qui était encore visiblement dedans.
 * Les deux seuils se séparent : une carte **entre** dans un îlot dès que son
 * centre y est, elle n'en **sort** que lorsqu'elle n'en touche plus rien. C'est
 * l'hystérésis, et c'est le remède écrit d'un classement nerveux.
 *
 * **Et quand les deux se disputent, entrer l'emporte sur rester.** Deux îlots
 * voisins peuvent tenir la même carte — l'un parce qu'elle le touche encore,
 * l'autre parce que son centre y est déjà —, et une carte n'a qu'un groupe.
 * L'ordre est donc fixe : le centre d'abord, l'ancien îlot ensuite. Sans lui, le
 * classement dépendrait de l'ordre de la liste, ce qui est la manière la plus
 * discrète de n'avoir aucune règle. **Coût** : une carte peut être à moitié
 * dehors en étant encore dedans, et le cadre s'élargit au relâchement pour le
 * dire.
 *
 * **Pure, et exportée pour ça** : c'est de la géométrie, et la géométrie se
 * vérifie sans navigateur.
 */
export function classer(carte: Boite, actuel: string, ilots: Ilot[]): string {
  const entrant = ilotSous({ x: carte.x + carte.l / 2, y: carte.y + carte.h / 2 }, ilots)
  if (entrant) return entrant
  const ancien = ilots.find((un) => un.nom === actuel)
  return ancien && touche(carte, ancien.boite) ? actuel : ""
}

/**
 * La première place libre à partir de celle qu'on visait — **ce qui arrive de la
 * réserve ne se pose jamais sur une carte**.
 *
 * Lâchée dans un îlot déjà rempli, une carte se posait sous le pointeur et donc
 * **derrière** ce qui s'y trouvait. Elle glisse maintenant vers la droite, puis
 * à la ligne, jusqu'à la première place libre : la règle que `disposer` applique
 * déjà aux cartes d'un îlot à l'ouverture, appliquée à une carte au lieu d'un
 * lot. Rien d'autre ne bouge — *l'œil reste exactement où il était*, et **ce
 * n'est donc pas une mise en page qui reflue**.
 *
 * **Et la règle s'arrête au bord de la réserve.** Un déplacement *sur* le plan
 * garde le droit de recouvrir, et c'est la ligne qui rend celle-ci défendable :
 * la main y voit les deux cartes et décide ; un empilement voulu est un geste
 * légitime sur une toile. Le glissement depuis la réserve est **aveugle** — le
 * fantôme que le navigateur traîne ne dit ni la taille réelle au zoom courant,
 * ni ce qu'il y a dessous. On ne corrige que le geste qui ne peut pas se voir.
 *
 * `borneDroite` est le bord au-delà duquel la ligne redescend : celui de l'îlot
 * où l'on tombe, ou celui de ce que la toile occupe déjà quand il n'y en a pas.
 * Épuisée, la carte se pose **sous tout** — une place qui est libre par
 * construction, donc une réponse plutôt qu'un abandon.
 */
export function placeLibre(
  voulue: Place,
  taille: { l: number; h: number },
  occupees: Boite[],
  borneDroite: number,
): Place {
  const libre = (place: Place) =>
    !occupees.some((b) => chevauche({ ...place, ...taille }, b))
  if (libre(voulue)) return voulue

  const pasX = taille.l + GOUTTIERE
  const pasY = taille.h + GOUTTIERE
  const bas = Math.max(...occupees.map((b) => b.y + b.h))
  // Le nombre de lignes est borné par ce qu'il y a à éviter : au-delà d'une
  // ligne par carte occupée, il n'y a plus rien à rencontrer.
  for (let ligne = 0; ligne <= occupees.length; ligne++) {
    const y = voulue.y + ligne * pasY
    // La colonne du départ est toujours essayée, même si elle déborde déjà :
    // la borne écarte les places suivantes, elle ne refuse pas celle qu'on
    // visait.
    for (let x = voulue.x; x === voulue.x || x + taille.l <= borneDroite; x += pasX)
      if (libre({ x, y })) return { x, y }
  }
  return { x: voulue.x, y: bas + GOUTTIERE }
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
  return { nom, teinte: teintes[nom] ?? "", liens: liensDeLIlot(nom, liens) }
}

/** Les traits qui aboutissent à un îlot. **Une seule définition**, parce que
 *  deux gestes la demandent — une carte qui sort, et un lot qui part. */
function liensDeLIlot(nom: string, liens: Lien[]): Lien[] {
  return liens.filter(
    (un) =>
      (un.de.genre === "ilot" && un.de.valeur === nom) ||
      (un.vers.genre === "ilot" && un.vers.valeur === nom),
  )
}

/** Les îlots qu'un **lot** emporte en partant (`RP9`).
 *
 *  Ce n'est pas `ilotPerdu` répété : cinq cartes du même groupe, prises une à
 *  une, laissent chacune quatre survivantes et ne perdent donc rien — alors que
 *  le lot entier vide le groupe. La question se pose sur le lot, pas sur la
 *  carte, et c'est le même piège que le compte d'un îlot pendant un glissement.
 *
 *  **Pure, et exportée pour ça** : c'est de l'arithmétique, et elle se vérifie
 *  sans écran. */
export function ilotsPerdusParLeLot(
  partantes: readonly string[],
  cartes: Carte[],
  liens: Lien[],
  teintes: Record<string, Teinte>,
): IlotPerdu[] {
  const lot = new Set(partantes)
  const noms = new Set(
    cartes.filter((c) => lot.has(c.identifiant) && c.groupe).map((c) => c.groupe),
  )
  return [...noms]
    .filter((nom) => !cartes.some((c) => !lot.has(c.identifiant) && c.groupe === nom))
    .map((nom) => ({ nom, teinte: teintes[nom] ?? "", liens: liensDeLIlot(nom, liens) }))
}

/**
 * Ce qu'un glissement en cours ferait disparaître, **s'il se terminait
 * maintenant**.
 *
 * `vers` est le groupe où la carte tomberait — celui de l'îlot sous son centre,
 * ou le vide si elle est sur le plan nu ou sur la réserve. C'est le même calcul
 * qu'au relâchement, et il **doit** l'être : deux réponses différentes à un pixel
 * d'écart feraient de l'avertissement un mensonge la moitié du temps.
 *
 * **Un groupe inchangé ne menace rien**, et c'est toute la règle de cette
 * fonction : déplacer une carte *dans* son îlot est le geste le plus courant de
 * la toile, et il ne coûte jamais rien. Tout le reste est délégué à `ilotPerdu`,
 * qui remplissait déjà la pile d'annulation : la même vérité, dite avant le
 * geste au lieu d'après.
 *
 * **Pure, et exportée pour ça.** L'endroit où la carte tombe se mesure à l'écran ;
 * ce qu'elle emporte en tombant là est de l'arithmétique, et l'arithmétique se
 * vérifie sans navigateur.
 */
export function menaceDe(
  sortante: Carte,
  vers: string,
  cartes: Carte[],
  liens: Lien[],
  teintes: Record<string, Teinte>,
): IlotPerdu | null {
  if (vers === sortante.groupe) return null
  return ilotPerdu(sortante, cartes, liens, teintes) ?? null
}

/**
 * Le glissement en cours, tel que les îlots ont besoin de le connaître.
 *
 * **Un îlot dit ce qu'il vaudra, et non ce qu'il vaut.** T10 avait donné cette
 * voix à l'îlot pour un seul cas — celui où il disparaît. Elle vaut pour les
 * trois, parce que c'est le même instant : celui où l'auteur peut encore ne pas
 * faire le geste. Il faut donc dire à chaque îlot lequel des trois rôles il
 * tient, et **trois rôles se déduisent de deux noms** : d'où la carte part, où
 * elle tomberait. `perdu` est le troisième, et il est déjà calculé par
 * `menaceDe`.
 *
 * Une seule forme plutôt que trois états, pour la raison qui vaut sur toute
 * cette toile : le glissement appelle cent fois par seconde, et trois états
 * indépendants auraient fait trois rendus là où il en faut un.
 */
export type Glissement = {
  /** L'îlot d'où la carte vient, ou le vide. */
  depuis: string
  /** L'îlot où elle tomberait **si on lâchait maintenant**, ou le vide. */
  vers: string
  /** Ce que le geste ferait disparaître, ou rien — la sortie de `menaceDe`. */
  perdu: IlotPerdu | null
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
  /** **Un îlot déplacé est *un* geste, et donc *une* entrée.** Douze cartes
   *  posées font douze places écrites ; les empiler une à une aurait demandé
   *  douze Ctrl+Z pour défaire un seul glissement, c'est-à-dire le contraire de
   *  ce que la pile promet. Elle décrit des gestes, pas des écritures.
   *
   *  `avant` porte les places **occupées**, pas les places *écrites* : une carte
   *  groupée avant T8 n'en avait aucune, et c'est celle que l'ouverture lui
   *  calculait qu'elle occupait — donc celle où l'annulation doit la remettre.
   *  Le disque en garde une de plus qu'avant le geste ; l'œil, lui, retrouve
   *  exactement ce qu'il avait. */
  | { genre: "ilot-deplace"; groupe: string; avant: Record<string, [number, number]> }
  /** **Un lot mis en réserve est *un* geste, et donc *une* entrée** (`RP9`) —
   *  le même argument que pour l'îlot déplacé : cinq cartes renvoyées d'un clic
   *  demanderaient sinon cinq Ctrl+Z, c'est-à-dire le contraire de ce que la
   *  pile promet. Elle décrit des gestes, pas des écritures.
   *
   *  `ilots` porte ce que le lot a vidé, calculé sur le lot entier et non carte
   *  par carte : cinq cartes d'un même groupe, prises séparément, ne perdent
   *  jamais leur îlot. */
  | {
      genre: "lot-rendu"
      cartes: { carte: string; avant: Parameters<typeof api.reglerCarte>[1] }[]
      ilots: IlotPerdu[]
    }
  | { genre: "lien-cree"; lien: string }
  | { genre: "lien-coupe"; lien: Lien }

// ── Ce que porte la sélection (`RP9`) ───────────────────────────────────────
//
// **Une liste d'identifiants de cartes, et rien d'autre ne voyage.** Un cadre
// tiré sur le plan est une région, et une région dépend du zoom, du cadrage et
// de la taille de la fenêtre : *une coordonnée ne voyage pas* (lot U). Ce qui
// en sort et qui a un sens ailleurs, ce sont les cartes.
//
// **Elle ne se nettoie jamais.** Ce qui est sélectionné est ce que la toile
// montre **et** que l'auteur a choisi — les deux, à chaque lecture. Une carte
// supprimée ou renvoyée en réserve sort donc de la sélection sans qu'une ligne
// de code s'en occupe ; une carte **déplacée** y reste, parce que déplacer
// n'est pas choisir.

/** Ce qui reste choisi : les identifiants encore posés sur le plan, dans
 *  l'ordre où l'auteur les a pris. */
export function selectionVive(
  cartes: readonly Carte[],
  selection: readonly string[],
): string[] {
  const posees = new Set(
    cartes.filter((c) => !c.en_reserve).map((c) => c.identifiant),
  )
  return selection.filter((identifiant) => posees.has(identifiant))
}

/** Le clic, et ce qu'il fait de la sélection.
 *
 *  **Ctrl (ou ⌘) ajoute ou retire, un clic nu remplace** — c'est déjà la
 *  grammaire de la galerie, et c'est la seule du produit. Pas de Maj : sur un
 *  plan il n'y a pas d'ordre, donc pas d'étendue à couvrir. Recliquer la carte
 *  seule la lâche, ce que le clic faisait déjà avant la sélection. */
export function basculerLaSelection(
  selection: readonly string[],
  identifiant: string | null,
  multiple: boolean,
): string[] {
  if (identifiant === null) return []
  if (!multiple)
    return selection.length === 1 && selection[0] === identifiant
      ? []
      : [identifiant]
  return selection.includes(identifiant)
    ? selection.filter((autre) => autre !== identifiant)
    : [...selection, identifiant]
}

/** Ce que la sélection donnerait à la préparation : les images d'un côté, les
 *  textes des notes de l'autre.
 *
 *  **Les deux ne se mêlent pas, et c'est tout le critère** : les images partent
 *  cochées d'avance, les notes ne partent pas sans qu'on le dise. Une carte
 *  dont l'image n'est pas arrivée n'entre pas — joindre une adresse qui n'a
 *  rien rendu ferait payer un appel à qui il manque exactement ça. */
export function cequiPartDeLaToile(
  cartes: readonly Carte[],
  selection: readonly string[],
): { images: string[]; notes: string[] } {
  const parIdentifiant = new Map(cartes.map((c) => [c.identifiant, c]))
  const images: string[] = []
  const notes: string[] = []
  for (const identifiant of selectionVive(cartes, selection)) {
    const carte = parIdentifiant.get(identifiant)
    if (!carte) continue
    if (carte.genre === "texte") {
      if (carte.texte.trim()) notes.push(carte.texte.trim())
    } else if (carte.statut === "prete") {
      images.push(carte.identifiant)
    }
  }
  return { images, notes }
}

/** Ce qu'un champ de correction doit écrire au blur, ou rien.
 *
 *  **Vide referme sans écrire, comme le brouillon d'une note neuve** — c'est le
 *  même argument que `cequiPartDeLaToile` applique déjà à ce qui part : une
 *  carte texte n'existe que par son texte, et l'effacer par un blur maladroit
 *  serait bien pire qu'une note vide qu'on ne crée jamais. C'est aussi ce qui
 *  évite un appel à chaque fermeture — coller, relire, refermer sans y toucher
 *  ne doit rien écrire. */
export function texteACorriger(carte: Carte, valeur: string): string | null {
  const corrige = valeur.trim()
  if (!corrige || corrige === carte.texte) return null
  return corrige
}

/** Les trois gestes du lot, **au-dessus de la toile** (`RP9`).
 *
 * La maquette compte la sélection au-dessus du plan, et c'est le bon endroit :
 * un lot se regarde d'au-dessus, alors qu'une carte se règle dans son menu. Les
 * boutons reprennent la forme de `+ note`, à trois pas d'eux dans la même barre
 * — 26 px, `rounded-7`, contour et papier de carte : aucune mesure neuve.
 *
 * **La case des notes est tout ce qui reste de la fenêtre « Choisir ce qui part
 * de la toile ».** Des quatre décisions que la maquette y prend, trois — l'asset
 * visé, *Image fixe* ou *Animation*, le modèle — appartiennent à la fenêtre
 * unique de `RP4` ; les reconstruire ici ferait deux endroits à défaire. La
 * quatrième — *les notes partent-elles ?* — est la seule qui soit de la toile,
 * et elle reste là où la sélection vit.
 */
export function GestesDeLaSelection({
  choisies,
  notes,
  avecLesNotes,
  onAvecLesNotes,
  onFabriquer,
  onReserve,
  onEffacer,
}: {
  /** Combien de cartes sont choisies — images et notes ensemble. */
  choisies: number
  /** Combien de notes en font partie. Zéro, la case ne paraît pas : il n'y a
   *  rien à joindre, et une case morte est pire qu'une case absente. */
  notes: number
  avecLesNotes: boolean
  onAvecLesNotes: (avec: boolean) => void
  onFabriquer: () => void
  onReserve: () => void
  onEffacer: () => void
}) {
  if (choisies === 0) return null
  const bouton =
    "mesure flex h-[26px] items-center rounded-7 border border-contour bg-carte px-2 text-[11.5px] text-encre transition-colors duration-[120ms] hover:bg-papier-cote"
  return (
    <div data-selection className="flex shrink-0 items-center gap-2">
      <span className="mesure shrink-0 text-[10.5px] text-signal">
        {choisies} choisie{choisies > 1 ? "s" : ""}
      </span>
      {notes > 0 && (
        <label className="mesure flex shrink-0 items-center gap-1 text-[10.5px] text-encre-3">
          <input
            type="checkbox"
            checked={avecLesNotes}
            onChange={(evenement) => onAvecLesNotes(evenement.target.checked)}
          />
          joindre {notes} note{notes > 1 ? "s" : ""}
        </label>
      )}
      <button type="button" onClick={onFabriquer} className={bouton}>
        Fabriquer depuis la sélection
      </button>
      <button type="button" onClick={onReserve} className={bouton}>
        Mettre en réserve
      </button>
      <button type="button" onClick={onEffacer} className={bouton}>
        Effacer la sélection
      </button>
    </div>
  )
}

// ── Ce que les nœuds ont besoin de savoir ───────────────────────────────────
//
// **Par un contexte, et pas par les props d'un type de nœud.** Un `nodeTypes`
// recalculé pour transporter la carte survolée fabrique un **nouveau type de
// composant** à chaque survol : React démonte alors tous les nœuds et les
// remonte, ce qui referme le menu qu'on venait d'ouvrir. Les types sont donc
// une constante de module, et ce qui bouge passe par ici.

type Cadre = {
  choisie: string | null
  /** Les cartes du lot (`RP9`). *Choisir une carte est la sélection à un* :
   *  quand elle en tient une, c'est `choisie` ; au-delà, plus rien n'est
   *  « choisi » et chaque carte du lot porte le même anneau. */
  selection: readonly string[]
  survolee: string | null
  /** Ce qui est épinglé et **n'est pas une carte** — le pavé d'un lien, le menu
   *  d'un îlot. Séparé de `choisie`, qui reste la carte choisie et voyage
   *  jusqu'à la réserve et à la grille : les mélanger aurait fait qu'épingler un
   *  trait désigne une carte dans une colonne où il n'y a pas de trait. */
  epingle: string | null
  crans: Crans | null
  teintes: Record<string, Teinte>
  /** Les personnages du projet, pour dire ce qui sert et ce qui dort (US-125).
   *  **Ils passent par le cadre et non par les données d'un nœud** : la
   *  librairie garde ces données-là, et y poser une liste qui change ferait
   *  recomposer la toile à chaque description écrite ailleurs. */
  personnages: Personnage[]
  /** Le glissement en cours, ou rien — d'où la carte part, où elle tomberait,
   *  et ce que le geste ferait disparaître.
   *
   *  **C'est `ilotPerdu` rendu visible**, la même fonction qui remplit la pile
   *  d'annulation, plus les deux noms qui donnent aux **trois** îlots concernés
   *  leur rôle. Elle savait déjà, au moment d'écrire, ce que le geste allait
   *  emporter ; elle le dit maintenant *pendant* qu'on le fait, ce qui est le
   *  seul instant où l'on peut encore ne pas le faire. */
  glissement: Glissement | null
  /** La taille d'un nœud, **telle que le produit la calcule** — jamais celle
   *  que la librairie croit avoir mesurée. Voir `AreteLien`. */
  tailleDe: (id: string) => { l: number; h: number } | null
  onSurvol: (cle: string, dedans: boolean) => void
  /** Le clic sur une carte du plan. `multiple` est vrai avec Ctrl ou ⌘, et
   *  c'est la seule chose que le nœud a besoin de savoir de la sélection. */
  onChoisir: (identifiant: string | null, multiple?: boolean) => void
  onEpingler: (cle: string | null) => void
  onErreur: (raison: string) => void
  onLargeur: (carte: Carte, largeur: number) => void
  /** Le texte d'une note, corrigé en place (`RT7`). Passe par `poser` comme
   *  `onLargeur` : le serveur sait le champ depuis `T9`, il ne manquait qu'un
   *  écran pour l'appeler — et la pile de défaire pour le reste. */
  onCorrigerTexte: (carte: Carte, texte: string) => void
  onTeinterIlot: (nom: string, teinte: Teinte) => void
  /** **Les deux gestes de fabrication du paquet** (E7, ouverts en E11).
   *
   *  Ils partent d'un paquet parce que c'est là qu'on a réuni ce qui va
   *  ensemble : l'atelier lit les couleurs des images du paquet et en fait une
   *  palette nommée du nom du paquet, ou une ambiance qui porte cette palette.
   *  Rien n'est payé — la lecture des couleurs se fait sur la machine. */
  onFairePalette: (nom: string) => void
  onFaireAmbiance: (nom: string) => void
  /** Ce que chaque paquet a déjà produit (U7), et ce que le dernier geste vient
   *  de faire. Les deux vivent ici parce que les deux se lisent sur l'îlot :
   *  la marque, en permanence ; le compte rendu, dans le menu où l'on a cliqué. */
  fabriques: Record<string, Fabrique>
  fabrique: { paquet: string; texte: string; cible: CibleAmbiances } | null
  onAllerAuxAmbiances: (cible: CibleAmbiances) => void
  /** L'îlot suit la main — sans rien écrire. La formule du dépôt depuis T2 :
   *  *la valeur suit la main, l'écriture suit le relâchement.* */
  onGlisserIlot: (nom: string, ecart: Place) => void
  /** Et le relâchement écrit, en un appel pour tout l'îlot. */
  onPoserIlot: (nom: string, ecart: Place) => void
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
  personnages: Personnage[]
  vue: Vue
  onVue: (vue: Vue) => void
  choisie: string | null
  onChoisir: (identifiant: string | null, multiple?: boolean) => void
  /** **La sélection de la toile** (`RP9`) — déjà réduite à ce que le plan
   *  montre par `selectionVive`, et tenue par l'écran Univers parce qu'elle
   *  meurt avec lui, comme la pile d'annulation. */
  selection: readonly string[]
  /** Les trois gestes du lot, à poser au-dessus de la toile. Rendus par
   *  l'écran Univers, qui est le seul à savoir ouvrir une préparation. */
  gestes?: ReactNode
  onErreur: (raison: string) => void
  collage: ReturnType<typeof useCollage>
  crans: Crans | null
  /** La pile d'annulation, tenue par l'écran Univers pour qu'elle **meure avec
   *  lui** : ce n'est pas de l'historique de projet, c'est le rattrapage du
   *  geste en cours (`docs/archive/plan-versions-tenues.md` T8). */
  pile: React.RefObject<Geste[]>
  /** Les trois côtés de l'onglet Univers, posés à gauche de la barre du
   *  tableau. Deux bandes au-dessus du plan en auraient fait trois avec celle
   *  du châssis, et la maquette n'en dessine que deux. */
  cotes?: ReactNode
  /** Ce que chaque paquet a produit — sa palette, son ambiance (U7). */
  fabriques: Record<string, Fabrique>
  /** Ouvrir un objet du côté Ambiances. La toile ne sait pas y aller
   *  elle-même : les deux côtés n'ont que l'application en commun. */
  onAllerAuxAmbiances: (cible: CibleAmbiances) => void
  /** Relire le tableau — donc les marques des îlots — après une fabrication. */
  onRelire: () => void
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
  personnages,
  vue,
  onVue,
  choisie,
  onChoisir,
  selection,
  gestes,
  onErreur,
  collage,
  crans,
  pile,
  cotes,
  fabriques,
  onAllerAuxAmbiances,
  onRelire,
}: Parametres) {
  const { screenToFlowPosition, getZoom, setViewport } = useReactFlow()
  // Ce qui est épinglé sans être une carte : un lien, un îlot. Local au plan,
  // parce que rien d'autre que le plan n'en dessine.
  const [epingle, setEpingle] = useState<string | null>(null)
  // Le glissement en cours, et ce qu'il ferait aux îlots qu'il touche. Local au
  // plan, comme `epingle` : rien d'autre que le plan n'en dessine, et ça meurt
  // avec le geste.
  const [glissement, setGlissement] = useState<Glissement | null>(null)
  const { survolee, survoler } = useSurvol(choisie !== null || epingle !== null)
  const depot = useDepot(collage.collerFichier, collage.collerTexte)
  const [noeuds, setNoeuds, surChangement] = useNodesState<Node>([])

  const echouer = useCallback(
    (erreur: unknown, defaut: string) =>
      onErreur(erreur instanceof Refus ? erreur.message : defaut),
    [onErreur],
  )

  /** Ce que le dernier geste de fabrication a fait, et où c'est allé (U7).
   *
   *  **Il se lit dans le menu de l'îlot où l'on a cliqué**, jamais dans la
   *  bande du haut : c'est là que la main est, c'est là que la question se pose.
   *  Le refus, lui, part par `onErreur` comme partout ailleurs — un refus est
   *  du même genre partout dans le produit, et lui inventer une seconde place
   *  ici aurait fait deux grammaires pour une mauvaise nouvelle. */
  const [fabrique, setFabrique] = useState<{
    paquet: string
    texte: string
    cible: CibleAmbiances
  } | null>(null)

  const montrer = useCallback(
    (paquet: string, texte: string, genre: CibleAmbiances["genre"], identifiant: string) =>
      setFabrique({ paquet, texte, cible: { genre, identifiant } }),
    [],
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
        // **La largeur voyage avec les données**, parce que le bandeau est de
        // l'écran et la boîte du plan : pour tenir la largeur de l'une en
        // pixels de l'autre, il faut la connaître. La lire sur le DOM aurait
        // demandé une mesure, et *une mesure ne se prend pas dans un onglet qui
        // ne compose pas ses images* — le piège de ce fichier depuis T5.
        data: { nom, membres, largeur: boite.l },
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
        // de `docs/archi-versions.md` §6.5 : un trait de 1 px ne se survole pas,
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
  // (`docs/PIEGES.md`). Le plan mesurait donc zéro et `fitView` renonçait en
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
      // Le texte d'une note, corrigé en place (`RT7`) : même geste que la
      // largeur, même pile.
      if ("texte" in reglage) avant.texte = carte.texte
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

      // **On entre par le centre, on sort par le tout** — `classer`, et c'est
      // le même calcul qu'à `surveiller`. Deux réponses différentes à un pixel
      // d'écart feraient de l'avertissement un mensonge la moitié du temps.
      const boite = {
        ...place,
        l: largeurDe(carte, crans),
        h: hauteurDe(carte, crans),
      }
      poser(carte, {
        groupe: classer(boite, carte.groupe, ilots),
        position: [place.x, place.y],
      })
    },
    [cartes, crans, ilots, poser],
  )

  // ── Le geste de l'îlot ───────────────────────────────────────────────────
  //
  // **Déplacer un îlot, c'est déplacer ses cartes — il n'a rien d'autre.** Il
  // n'a ni identité, ni fichier, ni position à lui : son étendue est celle de
  // ses membres (`docs/ARCHITECTURE.md` §5), donc la seule chose qu'on puisse
  // écrire de son déplacement est leur place à chacune. Ce qui rend le geste
  // possible sans faire de l'îlot un objet.
  //
  // **Et il ne reclasse rien.** Une carte lâchée décide de son groupe par
  // l'endroit où elle tombe ; un îlot lâché ne décide de rien du tout, parce
  // que déplacer un rangement n'est pas ranger ce qu'il contient. Deux îlots
  // qui se recouvrent restent deux îlots — c'était déjà permis, rien ne
  // s'aligne tout seul sur cette toile.

  /** Les cartes d'un îlot et la place que chacune **occupe**.
   *
   *  Occupée, et non *écrite* : une carte groupée avant T8 n'a pas de position,
   *  et c'est celle que l'ouverture lui calcule qu'elle occupe (`disposer`). La
   *  prendre là est ce qui fait qu'un vieil îlot se déplace comme un neuf. */
  const membresDe = useCallback(
    (nom: string) =>
      cartes
        .filter((c) => !c.en_reserve && c.groupe === nom)
        .map((c) => ({ carte: c, place: places.get(c.identifiant) }))
        .filter((m): m is { carte: Carte; place: Place } => m.place !== undefined),
    [cartes, places],
  )

  /** L'îlot suit la main, **sans rien écrire** — et ses cartes avec lui.
   *
   *  L'écart s'applique toujours à la place que le serveur dit, jamais à celle
   *  du rendu précédent : additionner des écarts image après image accumule
   *  l'erreur du zoom, et l'îlot dérive sous la main. Une base fixe, un écart
   *  total, aucune mémoire à tenir. */
  const glisserIlot = useCallback(
    (nom: string, ecart: Place) => {
      const bases = new Map<string, Place>(
        membresDe(nom).map(({ carte, place }) => [carte.identifiant, place]),
      )
      const ilot = ilots.find((un) => un.nom === nom)
      if (ilot) bases.set(`ilot:${nom}`, { x: ilot.boite.x, y: ilot.boite.y })
      setNoeuds((liste) =>
        liste.map((noeud) => {
          const base = bases.get(noeud.id)
          return base
            ? { ...noeud, position: { x: base.x + ecart.x, y: base.y + ecart.y } }
            : noeud
        }),
      )
    },
    [membresDe, ilots, setNoeuds],
  )

  /** Et le relâchement écrit — **un appel pour tout l'îlot**, une entrée pour
   *  tout le geste. Voir `api.deplacerIlot` et le genre `ilot-deplace`. */
  const poserIlot = useCallback(
    (nom: string, ecart: Place) => {
      const membres = membresDe(nom)
      if (!membres.length) return
      const avant: Record<string, [number, number]> = {}
      const apres: Record<string, [number, number]> = {}
      for (const { carte, place } of membres) {
        avant[carte.identifiant] = [place.x, place.y]
        apres[carte.identifiant] = [place.x + ecart.x, place.y + ecart.y]
      }
      pile.current.push({ genre: "ilot-deplace", groupe: nom, avant })
      void api
        .deplacerIlot(nom, apres)
        .catch((e) => echouer(e, "l'îlot n'a pas pu être déplacé"))
    },
    [membresDe, echouer, pile],
  )

  /** Ce que le glissement en cours ferait disparaître — **calculé pendant, avec
   *  la fonction qui le calculait déjà après**.
   *
   *  `ilotPerdu` remplissait la pile d'annulation au moment d'écrire : elle
   *  savait, mais après coup. Le seul instant où l'auteur peut encore ne pas
   *  faire le geste est *pendant* qu'il le fait, et « hors îlot, pas de groupe »
   *  emporte alors la teinte de l'îlot et les traits qui y aboutissaient. Ce
   *  n'est pas une confirmation — le produit n'en pose pas — c'est le même fait,
   *  montré à temps.
   *
   *  La destination se demande exactement comme au relâchement : la réserve
   *  d'abord, puis l'îlot sous le **centre** de la carte. Deux réponses
   *  différentes à un pixel d'écart auraient fait de l'avertissement un mensonge
   *  la moitié du temps. */
  const surveiller = useCallback(
    (evenement: MouseEvent, noeud: Node) => {
      const carte = cartes.find((c) => c.identifiant === noeud.id)
      if (!carte || !crans) return
      const vers = surLaReserve({ x: evenement.clientX, y: evenement.clientY })
        ? ""
        : classer(
            {
              ...noeud.position,
              l: largeurDe(carte, crans),
              h: hauteurDe(carte, crans),
            },
            carte.groupe,
            ilots,
          )
      const perdu = menaceDe(carte, vers, cartes, liens, teintes)
      // Le glissement appelle cent fois par seconde et l'état ne doit changer
      // qu'à la frontière : sans cette égalité, chaque image refabriquerait le
      // contexte des nœuds et remonterait toute la toile.
      setGlissement((avant) =>
        avant &&
        avant.depuis === carte.groupe &&
        avant.vers === vers &&
        avant.perdu?.nom === perdu?.nom
          ? avant
          : { depuis: carte.groupe, vers, perdu },
      )
    },
    [cartes, liens, teintes, crans, ilots],
  )

  /** Une carte tirée de la réserve — elle arrive **où on la lâche**, et le
   *  classement suit la place. Composer et classer sont le même geste.
   *
   *  **Mais jamais sur une carte** : le glissement depuis la réserve est le seul
   *  geste aveugle de cette toile — le fantôme que le navigateur traîne ne dit
   *  ni la taille réelle au zoom courant, ni ce qu'il y a dessous. Elle glisse
   *  donc vers la droite, puis à la ligne, jusqu'à la première place libre
   *  (`placeLibre`), et **le groupe se décide sur la place finale** : composer
   *  et classer restent le même geste, y compris quand la place a dû se
   *  déplacer d'une colonne. */
  const accueillir = useCallback(
    (evenement: React.DragEvent) => {
      const identifiant = evenement.dataTransfer.getData(GLISSE_CARTE)
      if (!identifiant || !crans) return
      evenement.preventDefault()
      const carte = cartes.find((c) => c.identifiant === identifiant)
      if (!carte) return
      const point = screenToFlowPosition({ x: evenement.clientX, y: evenement.clientY })
      const taille = { l: largeurDe(carte, crans), h: hauteurDe(carte, crans) }
      // Lâchée sous le pointeur, donc centrée sur lui : une carte qui se pose
      // par son coin supérieur gauche tombe toujours à côté de ce qu'on visait.
      const visee = { x: point.x - taille.l / 2, y: point.y - taille.h / 2 }

      // Ce qui occupe déjà le plan, et jusqu'où la ligne peut pousser : le bord
      // de l'îlot où l'on tombe, ou celui de tout ce qui est posé quand il n'y
      // en a pas. Aucun nombre écrit à la main — on ne pousse jamais une carte
      // au-delà de ce que la toile occupe déjà.
      const occupees = cartes
        .filter((c) => !c.en_reserve && c.identifiant !== identifiant)
        .map((c) => {
          const p = places.get(c.identifiant)
          return p ? { ...p, l: largeurDe(c, crans), h: hauteurDe(c, crans) } : null
        })
        .filter((b): b is Boite => b !== null)
      const accueillant = ilots.find((un) => un.nom === ilotSous(point, ilots))
      const tout = englober(occupees)
      const borne = accueillant
        ? accueillant.boite.x + accueillant.boite.l
        : tout
          ? tout.x + tout.l
          : visee.x

      const place = placeLibre(visee, taille, occupees, borne)
      poser(carte, {
        groupe: classer({ ...place, ...taille }, "", ilots),
        position: [place.x, place.y],
      })
    },
    [cartes, crans, ilots, places, poser, screenToFlowPosition],
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
      if (geste.genre === "ilot-deplace") {
        // Le même appel avec les places d'avant : « annuler, c'est rappeler la
        // même route avec la valeur d'avant », et l'îlot repart entier comme il
        // est venu.
        await api.deplacerIlot(geste.groupe, geste.avant)
        return
      }
      if (geste.genre === "lot-rendu") {
        // **Les groupes d'abord, les îlots ensuite** — le même ordre que pour
        // une carte seule, et pour la même raison : le serveur refuse à juste
        // titre un trait vers un îlot qui n'existe pas encore.
        for (const une of geste.cartes) await api.reglerCarte(une.carte, une.avant)
        for (const ilot of geste.ilots) {
          if (ilot.teinte) await api.teinterIlot(ilot.nom, ilot.teinte)
          for (const un of ilot.liens)
            await api.lier(un.de, un.vers, { mot: un.mot, pointe: un.pointe })
        }
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
      selection,
      survolee,
      epingle,
      crans,
      teintes,
      personnages,
      glissement,
      tailleDe,
      onSurvol: survoler,
      onChoisir,
      onEpingler: setEpingle,
      onErreur,
      onLargeur: (carte, largeur) => poser(carte, { largeur_libre: largeur }),
      onCorrigerTexte: (carte, texte) => poser(carte, { texte }),
      onTeinterIlot: (nom, teinte) =>
        void api.teinterIlot(nom, teinte).catch((e) => echouer(e, "teinte refusée")),
      // **Le paquet n'est pas la palette**, et c'est ce que ces deux gestes
      // fabriquent : un paquet n'a pas d'identité à lui — c'est un nom de
      // groupe écrit sur des cartes, et il disparaît avec sa dernière carte. La
      // palette et l'ambiance qu'il produit sont de **vrais objets, qui lui
      // survivent** ; sans quoi ranger son tableau d'inspiration effacerait une
      // palette et trois cases de texte.
      //
      // **Et le geste dit ce qu'il a fait** (U7). Il partait sans le moindre
      // retour : le serveur fabriquait bien la palette, mais l'écran ne bougeait
      // pas d'un pixel et l'objet allait vivre dans un autre côté de l'onglet.
      // De l'endroit où l'on clique, cela ne se distinguait pas d'un bouton
      // mort — et c'est ce que la séance a conclu.
      onFairePalette: (nom) => {
        // **Un paquet déjà servi ne fabrique pas un doublon** : le geste mène à
        // ce qui existe. La question « ce paquet a-t-il déjà une palette ? » est
        // celle que l'îlot pose déjà pour porter sa marque, et elle n'a qu'une
        // réponse — celle du serveur, arrivée avec les cartes.
        const deja = fabriques[nom]?.palette
        if (deja) return montrer(nom, "sa palette existe déjà", "palette", deja)
        void api
          .creerPalette(nom, [{ genre: "images", reference: nom }])
          .then((recu) => {
            const nee = recu.palettes.find((p) => p.nom === nom)
            if (nee) montrer(nom, `palette « ${nee.nom} » faite`, "palette", nee.identifiant)
            onRelire()
          })
          .catch((e) => echouer(e, "la palette n'a pas pu être faite"))
      },
      onFaireAmbiance: (nom) => {
        const deja = fabriques[nom]?.ambiance
        if (deja) return montrer(nom, "son ambiance existe déjà", "ambiance", deja)
        void api
          .creerPalette(nom, [{ genre: "images", reference: nom }])
          .then((recu) =>
            api.creerAmbiance(
              nom,
              recu.palettes.find((p) => p.nom === nom)?.identifiant ?? "",
            ),
          )
          .then((recu) => {
            const nee = recu.ambiances.find((a) => a.nom === nom)
            if (nee)
              montrer(nom, `ambiance « ${nee.nom} » faite`, "ambiance", nee.identifiant)
            onRelire()
          })
          .catch((e) => echouer(e, "l'ambiance n'a pas pu être faite"))
      },
      fabriques,
      fabrique,
      onAllerAuxAmbiances,
      onGlisserIlot: glisserIlot,
      onPoserIlot: poserIlot,
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
      selection,
      personnages,
      survolee,
      epingle,
      crans,
      teintes,
      glissement,
      tailleDe,
      survoler,
      onChoisir,
      onErreur,
      poser,
      couper,
      ecrire,
      echouer,
      getZoom,
      glisserIlot,
      poserIlot,
      fabriques,
      fabrique,
      onAllerAuxAmbiances,
      onRelire,
      montrer,
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
        "flex min-h-0 min-w-0 flex-1 flex-col border-l border-trait",
        depot.survole ? "bg-carte" : "bg-papier",
      ].join(" ")}
    >
      {/* **En toile, `+ note` pose le brouillon au centre de ce que l'écran
          montre** — c'est-à-dire au milieu de ce qu'on regarde, et non à sept
          cents pixels de là, qui était l'argument de T9 contre un contrôle de
          barre. Le centre se **mesure** sur le plan rendu : la librairie tient
          ses dimensions par un `ResizeObserver`, et un `ResizeObserver` ne livre
          rien à un onglet qui ne compose pas ses images (`AGENTS.md`). Une
          largeur se lit à la demande, quatrième fois dans ce fichier. */}
      <BarreTableau
        cartes={cartes}
        vue={vue}
        onVue={onVue}
        debut={cotes}
        selection={gestes}
        onNote={() => {
          if (!crans || !plan.current) return
          const place = plan.current.getBoundingClientRect()
          const centre = screenToFlowPosition({
            x: place.left + place.width / 2,
            y: place.top + place.height / 2,
          })
          setBrouillon({ x: centre.x - crans[1] / 2, y: centre.y - crans[1] / 2 })
        }}
      />

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
            // **Pendant** le glissement, l'écran dit ce que le relâchement
            // ferait disparaître ; **au** relâchement, il l'écrit. Deux
            // moments, une seule règle — `surveiller` et `relacher` demandent
            // la destination de la même façon.
            onNodeDrag={(evenement, noeud) => surveiller(evenement as MouseEvent, noeud)}
            onNodeDragStop={(evenement, noeud) => {
              setGlissement(null)
              relacher(noeud.id, noeud.position, {
                x: (evenement as MouseEvent).clientX,
                y: (evenement as MouseEvent).clientY,
              })
            }}
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
            // **Le fond ne bouge que quand on le déplace**, et c'est la seconde
            // moitié de la même règle. Le défaut de la librairie fait glisser le
            // plan tout seul dès que le pointeur passe à moins de 40 px d'un bord
            // pendant qu'on tire un nœud — or la réserve est collée au bord
            // droit, donc *tout* renvoi de carte traverse cette bande, et le plan
            // fuit sous la main au moment précis où l'on range. « L'œil reste
            // exactement où il était » vaut ici comme pour la grille : ce qui se
            // déplace tout seul n'a été demandé par personne.
            autoPanOnNodeDrag={false}
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
              color="var(--color-contour)"
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
                  <path d="M0,0 L6,3 L0,6 z" fill="var(--color-pointille)" />
                </marker>
              </defs>
            </svg>
          </ReactFlow>
        </CADRE.Provider>

        {!crans ? (
          <p className="mesure pointer-events-none absolute inset-0 flex items-center justify-center text-[10.5px] text-encre-4">
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
 *  telle qu'elle est rendue — mesurée, jamais supposée.
 *
 *  **Et repliée, la réserve n'est plus une frontière.** Elle garde ses 380 px —
 *  replier n'est pas démonter, et c'est cette largeur-là que l'aimant mesure —,
 *  mais la case qui la porte est à zéro et les rogne entièrement : ce qui reste
 *  à l'écran n'a pas d'épaisseur, et une carte lâchée là n'a rien traversé. Le
 *  rectangle du nœud dit l'inverse, puisqu'il ne sait rien du rognage de son
 *  parent ; on le borne donc à ce que la fenêtre montre. */
function surLaReserve(pointeur: Place): boolean {
  const colonne = document.querySelector("[data-reserve]")?.getBoundingClientRect()
  if (!colonne) return false
  const droite = Math.min(colonne.right, window.innerWidth)
  return (
    droite > colonne.left &&
    pointeur.x >= colonne.left &&
    pointeur.x <= droite &&
    pointeur.y >= colonne.top &&
    pointeur.y <= colonne.bottom
  )
}

/** L'état vide. En serif, parce que c'est une invitation et non un message
 *  d'erreur — `docs/DESIGN.md` § Typography, règle 1. */
function ToileNue() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
      <p className="text-center font-serif text-[25px] leading-tight text-encre-3">
        La toile est nue. <span className="italic text-encre">Tire une carte.</span>
      </p>
      <p className="mesure max-w-[380px] text-center text-[10.5px] leading-relaxed text-encre-4">
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
 *  **surface** — le partage de `docs/archi-versions.md` §6.5, à la lettre.
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
 * Les six points — **le premier glyphe du produit**, et il vient avec sa règle
 * d'admission.
 *
 * `docs/DESIGN.md` dit « aucune icône illustrative » depuis l'origine, et il n'y
 * a jamais eu d'exception. En voici une, et la règle qui la borne : **un glyphe
 * n'entre que là où aucun mot ne peut tenir et où la forme est déjà lue sans
 * apprentissage.** Dix-huit pixels de bandeau avant le nom n'accueillent pas un
 * mot ; une grille de six points est lue comme *ça se saisit* par quiconque a
 * déjà touché une interface. Le carré de 10 px qu'elle remplace échouait aux
 * deux : il ne disait rien, et il était le troisième carré identique de l'écran.
 *
 * **Coût** : le produit a désormais un glyphe, donc un endroit où en ajouter un
 * deuxième. La règle ci-dessus est tout ce qui l'en empêche.
 *
 * Il prend la couleur du nom, parce qu'il est de la même encre que lui — c'est
 * le bandeau qui décide de ce qui s'écrit dessus, et il n'en décide qu'une fois.
 */
function SixPoints({ encre }: { encre: string }) {
  return (
    <span
      aria-hidden
      className="grid h-3 w-3 shrink-0 grid-cols-2 grid-rows-3 place-content-center place-items-center gap-[4px] p-px"
    >
      {[0, 1, 2, 3, 4, 5].map((rang) => (
        <i
          key={rang}
          style={{ background: encre }}
          className="block h-[4px] w-[4px] rounded-full"
        />
      ))}
    </span>
  )
}

/**
 * L'îlot — un cadre, un bandeau, un nom, un compte, deux prises.
 *
 * « L'îlot est du châssis, pas un objet dessiné » (`docs/DESIGN.md`) : cadre de
 * 1 px, rayon 5 comme la carte, fond de la même teinte à **16 %**, titre en mono
 * 10,5 px parce que c'est un fait sur ce qu'il contient et pas une légende. Sans
 * teinte il porte celle du carnet — `--pointille`, `--papier-cote` à 40 % —, et
 * ce n'est pas un provisoire : c'est ce que `Toile.dc.html` dessine.
 *
 * **Le bandeau est en teinte pleine, et c'est lui qui décide de la couleur de
 * son texte** (28 août 2026, `docs/design-motifs.md` § La toile révisée). La
 * bande de 20 px était transparente et le nom portait la teinte sur un fond à
 * 8 % : un îlot ne se nommait de loin que si on savait déjà où regarder.
 *
 * **La conditionnelle a survécu au passage au papier, en changeant de sens**
 * (`D2`). Les dix teintes sont maintenant plus **sombres** que le papier — voir
 * `index.css` —, donc le nom s'y pose en `--papier`, à 4,6 : 1 sur chacune des
 * dix ; `--pointille` est clair, donc le nom y reste en `--encre`, à 9 : 1.
 * **Elle est mécanique, pas décorative** : `--papier` sur `--pointille` vaut
 * 1,4 : 1, c'est-à-dire illisible. Le compte est cette encre à 90 %, la prise de
 * lien à 55 % — un seul nombre pour les deux cas, à trois endroits.
 *
 * **Deux échelles, et le bandeau appartient à celle de l'écran.** Sa boîte est
 * du plan ; son nom, son compte et ses deux prises sont des lectures et des
 * cibles. Il garde donc ses 20 px d'écran à tous les crans, et **son bord
 * inférieur reste collé au haut de la marge de l'îlot** : ce qu'il gagne en
 * hauteur quand on dézoome, il le prend au-dessus du cadre, jamais sur les
 * cartes. La phrase de T9 — *ces 20 px ne recouvrent aucune carte, par
 * construction* — est donc vraie à tous les zooms, et pas seulement à 1×. Le
 * cadre, lui, fait suivre son bord du haut : sans ça, le bandeau flotterait à
 * l'intérieur à 2,5× et déborderait au-dessus à 0,3×.
 *
 * **Une seule surface vivante, et c'est le bandeau** : il passe en
 * `pointer-events: auto` sous un nœud qui reste en `none`. Une surface qui ne
 * recouvre rien ne prend rien à personne, là où rendre la *boîte* vivante aurait
 * volé chaque prise de carte. On traverse toujours l'îlot pour prendre une
 * carte ; on ne le déplace que par son bandeau (T10).
 *
 * **Ce qu'on perd est 20 px de plan par îlot, et c'est `nopan` qui le paie.**
 * La phrase était écrite depuis T9, la classe manquait : la bande déplaçait
 * l'îlot *et* le plan, du même écart, donc l'îlot à deux fois la main et le fond
 * à une fois. Corrigé le 28 août 2026, à l'usage.
 *
 * **Trois gestes sur ce bandeau, et ce sont les formes qui les séparent
 * désormais.** Les six points saisissent, le nom ouvre le menu, le rond tire un
 * lien. Le nom et le bandeau partagent le même `pointerdown` et c'est la
 * **distance** qui tranche (T10) ; le rond, lui, est écarté dès la pression,
 * parce que deux gestes sur une même pression demanderaient de décider lequel
 * gagne — c'est l'argument qui a déjà éteint `connectOnClick`. Les curseurs le
 * redisent : `pointer` sur le mot, `grab` sur le bandeau, `crosshair` sur le
 * rond.
 */
function NoeudIlot({ data }: NodeProps) {
  const cadre = useContext(CADRE)
  const zoom = useZoom()
  const { nom, membres, largeur } = data as unknown as {
    nom: string
    membres: number
    largeur: number
  }
  /** La prise en cours sur le bandeau : d'où le pointeur est parti, s'il a
   *  franchi le seuil, et s'il est parti du nom. Un `ref` et non un état — la
   *  valeur est lue par les gestionnaires suivants du même geste, elle n'est pas
   *  rendue. */
  const prise = useRef<{ x: number; y: number; tire: boolean; surLeNom: boolean } | null>(
    null,
  )
  if (!cadre) return null

  const cle = cleIlot(nom)
  const ouvert = cadre.epingle === cle || cadre.survolee === cle
  const teinte = cadre.teintes[nom] ?? ""
  const couleur = teinte ? COULEUR_TEINTE[teinte] : null

  // ── Ce que l'îlot vaudra, et non ce qu'il vaut ───────────────────────────
  //
  // T10 avait donné cette voix à l'îlot pour un seul cas — celui où il
  // disparaît. Elle vaut pour les trois, parce que c'est le même instant : celui
  // où l'auteur peut encore ne pas faire le geste. Les trois rôles sont
  // exclusifs, et l'ordre les rend tels : partir l'emporte sur perdre, qui n'est
  // que sa version bénigne.
  const geste = cadre.glissement
  const part = geste?.perdu?.nom === nom ? geste.perdu : null
  const accueille = !part && !!geste && geste.vers === nom && geste.depuis !== nom
  const perd = !part && !!geste && geste.depuis === nom && geste.vers !== nom

  /** La couleur de la surface — la teinte, le châssis, ou ce qui s'en va. */
  const surface = part ? "var(--color-echec)" : (couleur ?? "var(--color-pointille)")
  /** L'encre du bandeau, et c'est le bandeau qui la décide. */
  const encre = part || couleur ? "var(--color-papier)" : "var(--color-encre)"

  // **Le trait porte le message, et la couleur reste réservée.** La seule
  // couleur disponible pour dire *ça s'en va* est `--echec` ; la dépenser sur un
  // geste anodin — retirer une carte d'un îlot qui en compte douze — ferait
  // cesser de voir le seul avertissement qui compte, celui de la dernière carte.
  // Le **pointillé** dit *cette limite n'est pas celle que tu vas laisser* sans
  // emprunter un mot à la sémantique, et le fond vidé le redit sur toute la
  // surface, là où l'œil est réellement posé pendant qu'on tire.
  const fond = part
    ? "color-mix(in srgb, var(--color-echec) 8%, transparent)"
    : perd
      ? "transparent"
      : accueille
        ? `color-mix(in srgb, ${surface} 28%, transparent)`
        : couleur
          ? `color-mix(in srgb, ${couleur} 16%, transparent)`
          : "color-mix(in srgb, var(--color-papier-cote) 40%, transparent)"

  // **Le compte est l'argument, et il était déjà là.** Montrer la valeur
  // *future* au lieu de la valeur courante ne demande ni surface, ni couleur, ni
  // glyphe. Les traits sont nommés parce qu'ils partiraient sans qu'on les voie
  // partir ; la teinte non — elle est déjà en train de s'en aller sous les yeux,
  // le cadre ayant viré à `--echec`.
  const apres = membres + (accueille ? 1 : perd ? -1 : 0)

  // **Un îlot porte la marque de ce qu'il a produit** (U7), et elle se pose là
  // où l'îlot parle déjà de lui-même — à côté du compte, dans le même mot et la
  // même encre. Aucun glyphe neuf, aucune couleur dépensée : `palette` et
  // `ambiance` sont les deux noms que le produit emploie déjà, et l'ambiance
  // l'emporte parce qu'elle *contient* la palette du paquet.
  //
  // Elle disparaît pendant qu'on tire : l'îlot dit alors ce qu'il vaudra, et
  // ce qu'il a fabriqué n'est pas ce qui est en jeu.
  const fait = cadre.fabriques[nom]
  const marque = fait?.ambiance ? "ambiance" : fait?.palette ? "palette" : null
  const compte = part
    ? `l'îlot part${part.liens.length ? ` — ${part.liens.length} trait${part.liens.length > 1 ? "s" : ""}` : ""}`
    : `${apres} carte${apres > 1 ? "s" : ""}${!geste && marque ? ` · ${marque}` : ""}`

  /** Le haut du bandeau, en pixels de plan et relatif au nœud. Son **bas** est
   *  fixe — il vaut `BANDE_ILOT`, c'est-à-dire le haut de la marge de l'îlot —,
   *  donc c'est le haut qui bouge avec le zoom. */
  const haut = BANDE_ILOT - 20 / zoom

  /** L'écart parcouru depuis la prise, **à l'échelle du plan** : sans la
   *  division, tirer de dix pixels à l'écran en donnerait quarante sur un plan
   *  réduit au quart. La poignée de largeur divise déjà par le même zéro. */
  const ecartDe = (evenement: React.PointerEvent, depuis: { x: number; y: number }) => {
    const echelle = cadre.zoom() || 1
    return {
      x: (evenement.clientX - depuis.x) / echelle,
      y: (evenement.clientY - depuis.y) / echelle,
    }
  }

  return (
    <div data-ilot={nom} className="group/ilot relative h-full w-full">
      {/* **Le cadre — sa boîte est du plan, son bord du haut suit le bandeau.**
          L'écart entre les deux ne dépasse jamais 20 px de plan, et il n'existe
          que pour que le bandeau se pose *sur* le cadre à tous les crans plutôt
          que de flotter dedans ou au-dessus. Ce que le classement mesure reste
          la boîte, qui n'a pas bougé. */}
      <div
        style={{
          top: haut,
          borderColor: surface,
          borderStyle: perd ? "dashed" : "solid",
          background: fond,
        }}
        className="absolute right-0 bottom-0 left-0 rounded-5 border transition-colors duration-[120ms]"
      />

      {/* **Le bandeau, en pixels d'écran** — voir `ancreEcran`. Sa largeur est
          celle de la boîte (donc du plan, donc multipliée par le zoom avant
          d'entrer dans l'ancre), sa hauteur est de 20 px d'écran, et le pixel
          qu'il déborde de chaque côté couvre le bord du cadre.

          **Il est aussi sa propre poignée.** Le pointeur est capturé dès la
          pression et non au franchissement du seuil : une bande de 20 px se
          quitte en une image quand on tire vite, et un glissement qui n'attrape
          rien parce que la main allait trop vite est un geste qui rate au
          hasard. La capture prise, c'est le **relâchement** qui dit ce que le
          geste était — sous le seuil un clic, au-dessus un déplacement. */}
      <div style={ancreEcran(zoom, { left: 0, top: haut })}>
        <div
          style={{
            pointerEvents: "auto",
            left: -1,
            top: -1,
            width: largeur * zoom + 2,
            height: 20,
            background: surface,
            color: encre,
          }}
          onPointerEnter={() => cadre.onSurvol(cle, true)}
          onPointerLeave={() => cadre.onSurvol(cle, false)}
          onPointerDown={(evenement) => {
            // Le rond n'est pas une prise sur l'îlot : deux gestes sur le même
            // `pointerdown`, il faudrait décider lequel gagne — c'est
            // l'argument qui a déjà éteint `connectOnClick`.
            if ((evenement.target as HTMLElement).closest(".react-flow__handle")) return
            if (evenement.button !== 0) return
            prise.current = {
              x: evenement.clientX,
              y: evenement.clientY,
              tire: false,
              surLeNom: !!(evenement.target as HTMLElement).closest("[data-nom-ilot]"),
            }
            evenement.currentTarget.setPointerCapture(evenement.pointerId)
          }}
          onPointerMove={(evenement) => {
            const en_cours = prise.current
            if (!en_cours) return
            const ecran = Math.hypot(
              evenement.clientX - en_cours.x,
              evenement.clientY - en_cours.y,
            )
            // Sous le seuil, rien ne bouge : sans lui, le tremblement d'un clic
            // écrirait un déplacement de deux pixels que personne n'a voulu.
            if (!en_cours.tire && ecran < SEUIL_PRISE) return
            en_cours.tire = true
            cadre.onGlisserIlot(nom, ecartDe(evenement, en_cours))
          }}
          onPointerUp={(evenement) => {
            const en_cours = prise.current
            prise.current = null
            if (!en_cours) return
            // **Rien ne relâche la capture ici, et c'est volontaire.** Elle se
            // rend d'elle-même au `pointerup` ; un `releasePointerCapture` de
            // plus ne serait pas seulement redondant, il lève `NotFoundError`
            // dès que le pointeur a déjà été rendu — et lève **avant** la ligne
            // qui écrit. Le geste serait alors perdu sans un mot, ce qui est la
            // famille de défauts que ce dépôt traque depuis T5.
            if (en_cours.tire) {
              cadre.onPoserIlot(nom, ecartDe(evenement, en_cours))
              return
            }
            // Pas de glissement : c'était un clic, et un clic n'ouvre le menu
            // que s'il est parti du nom. La capture ayant détourné le `click`
            // vers ce bandeau, c'est ici qu'il se traite — le bouton ne garde
            // que le chemin du clavier.
            if (en_cours.surLeNom)
              cadre.onEpingler(ouvert && cadre.epingle === cle ? null : cle)
          }}
          onPointerCancel={() => {
            prise.current = null
          }}
          // `nopan` — **et c'est elle qui rend le geste de T10 honnête.** Sans
          // elle, une seule pression fait deux choses : le bandeau déplace
          // l'îlot de tout l'écart parcouru, et le plan de la librairie se
          // déplace du même écart par-dessus. L'îlot part alors à **deux fois**
          // la main et le fond à une fois — la parallaxe qu'on a vue. Voir
          // `Poignee` pour la raison technique, qui est la même aux quatre
          // endroits.
          className="mesure nodrag nopan absolute flex cursor-grab items-center gap-1.5 rounded-t-5 px-1.5 text-[10.5px] active:cursor-grabbing"
        >
          {/* **La prise de déplacement, et elle est permanente.** *Le survol
              révèle* garde ses raisons partout ailleurs ; ici les six points
              servent à déplacer un objet vers une cible qui n'est pas sous
              l'œil, et la toile est la seule surface du produit où ça arrive. Un
              curseur ne se voit pas de loin. La grille d'assets, elle, ne change
              pas d'un pixel. */}
          <SixPoints encre={encre} />

          {/* Le nom **est** la poignée du menu — le motif de l'infobulle,
              appliqué à l'objet qui n'a rien d'autre à offrir. `w-fit` pour la
              même raison qu'un libellé : dans une rangée, la cible doit être le
              mot. Son curseur est `pointer` et non le `grab` du bandeau : c'est
              le seul endroit d'où un clic ouvre quelque chose. */}
          <button
            type="button"
            data-nom-ilot
            onClick={(evenement) => {
              // **Le clavier seul passe par ici.** Un clic de souris est déjà
              // traité au `pointerup` du bandeau, qui sait si le pointeur a
              // tiré ; le laisser agir ici aussi refermerait le menu qu'il vient
              // d'ouvrir. `detail` vaut 0 quand le clic ne vient pas d'un
              // pointeur.
              if (evenement.detail !== 0) return
              cadre.onEpingler(ouvert && cadre.epingle === cle ? null : cle)
            }}
            className="w-fit max-w-full cursor-pointer truncate text-left font-medium"
          >
            {nom}
          </button>

          {/* **Ce que l'îlot dit de lui-même** : ce qu'il vaudra si on lâche
              maintenant, et non ce qu'il vaut. */}
          <span
            style={{ color: `color-mix(in srgb, ${encre} 90%, transparent)` }}
            className="ml-auto shrink-0"
          >
            {compte}
          </span>

          {/* Le rond — **on tire un trait**, et il est permanent lui aussi. Il
              relie deux objets, c'est-à-dire qu'il vise une cible qui n'est pas
              sous l'œil : même argument que les six points, même conclusion. Il
              n'entre pas dans le bandeau quand l'îlot s'en va — un îlot qui
              part n'a plus rien à joindre. Il passe en `--signal` sous le
              pointeur, comme les deux autres depuis T10 : *le survol révèle la
              poignée, le pointeur dit qu'on l'a trouvée.* */}
          {!part && (
            <Handle
              type="source"
              position={Position.Right}
              isConnectableStart
              isConnectableEnd={false}
              style={{ borderColor: `color-mix(in srgb, ${encre} 55%, transparent)` }}
              className="!relative !ml-1.5 !h-3 !w-3 !min-w-0 !shrink-0 !transform-none !cursor-crosshair !rounded-full !border !bg-transparent !opacity-100 !transition !duration-[120ms] hover:!border-signal"
            />
          )}
          <Ancrage />
        </div>
      </div>

      {/* **Le menu porte le survol de l'îlot, comme le menu d'une carte porte
          celui de sa carte.** Là-bas il est *dans* la carte, donc aller le
          chercher n'est pas la quitter ; ici il est le **frère** du bandeau, et
          le pointeur qui montait vers lui quittait la seule surface qui le
          tenait ouvert. Il se refermait à trois pixels du but, et la teinte d'un
          îlot était inatteignable à la souris. Il redit donc `onSurvol(…, true)`
          en entrant, ce qui annule la grâce de 150 ms, et `false` en sortant.

          **Et l'écart de 3 px passe dedans.** En marge, il était un couloir mort
          entre deux surfaces vivantes, que la traversée quittait toutes les
          deux ; en padding, le dessin ne bouge pas d'un pixel et la zone
          sensible touche le bandeau.

          **Il se cale sur le haut du bandeau, pas sur celui de la boîte** —
          les deux ne coïncident qu'à 1×, et un menu qui se poserait sur le nom
          qu'il explique serait le contraire de la règle du menu de carte.

          `nodrag nopan`, comme le pavé d'un lien : sans elles, choisir une
          teinte déplace le plan sous le menu. */}
      {ouvert && (
        <div
          style={{
            pointerEvents: "auto",
            position: "absolute",
            left: 0,
            top: haut,
            transform: "translateY(-100%)",
            paddingBottom: 3,
          }}
          onPointerEnter={() => cadre.onSurvol(cle, true)}
          onPointerLeave={() => cadre.onSurvol(cle, false)}
          className="nodrag nopan"
        >
          <div className="paraitre flex w-[300px] flex-col gap-1.5 rounded-8 border border-trait bg-papier-cote p-2">
            <Libelle aide="ilot.teinte">Teinte de l'îlot</Libelle>
            <Pastilles teinte={teinte} onChoisir={(t) => cadre.onTeinterIlot(nom, t)} />

            {/* **Les deux gestes de fabrication du tableau** (E7), **ouverts
                en E11**. Ils partent d'un paquet parce que c'est là qu'on a
                réuni ce qui va ensemble : l'atelier lit les couleurs des images
                du paquet et en fait une palette nommée du nom du paquet, ou une
                ambiance qui porte cette palette.

                Ils étaient grisés avec leur raison — « les palettes et les
                ambiances n'ont pas encore d'écran où vivre » — jusqu'à ce que
                cet écran existe. La raison a disparu parce qu'elle a cessé
                d'être vraie, et non parce qu'on l'a effacée. */}
            {/* **Le geste change de mot quand il a déjà été fait** (U7). Un
                second clic ne fabrique pas un doublon : il mène à ce qui
                existe, et le bouton le dit *avant* qu'on clique plutôt que de
                s'excuser après. La question « ce paquet a-t-il déjà une
                palette ? » est celle que le bandeau pose déjà pour porter sa
                marque, et elle n'a qu'une réponse — celle du serveur. */}
            <div className="mt-1 flex flex-col gap-1 border-t border-trait pt-2">
              <button
                type="button"
                onClick={() => cadre.onFairePalette(nom)}
                title={
                  fait?.palette
                    ? "elle existe déjà — ce geste y mène, il n'en fait pas une seconde"
                    : "l'atelier lit les couleurs de ces images — rien n'est payé"
                }
                className="mesure h-[26px] rounded-7 border border-contour bg-carte px-2 text-left text-[10.5px] text-encre-3 hover:text-signal"
              >
                {fait?.palette ? "ouvrir sa palette ›" : "faire une palette de cet îlot"}
              </button>
              <button
                type="button"
                onClick={() => cadre.onFaireAmbiance(nom)}
                title={
                  fait?.ambiance
                    ? "elle existe déjà — ce geste y mène, il n'en fait pas une seconde"
                    : "la palette, l'ambiance qui la porte, et il ne reste qu'à écrire les trois cases"
                }
                className="mesure h-[26px] rounded-7 border border-contour bg-carte px-2 text-left text-[10.5px] text-encre-3 hover:text-signal"
              >
                {fait?.ambiance
                  ? "ouvrir son ambiance ›"
                  : "faire une ambiance de cet îlot"}
              </button>

              {/* **Le compte rendu se lit là où l'on a cliqué**, avec le chemin
                  pour aller voir. Le geste partait sans le moindre retour vers
                  un objet qui vit dans un autre côté de l'onglet : de l'endroit
                  où l'on clique, cela ne se distinguait pas d'un bouton mort. */}
              {cadre.fabrique?.paquet === nom ? (
                <p
                  data-fabrique-faite
                  role="status"
                  className="mesure text-[10.5px] leading-snug text-encre-3"
                >
                  {cadre.fabrique.texte} —{" "}
                  <button
                    type="button"
                    onClick={() => cadre.onAllerAuxAmbiances(cadre.fabrique!.cible)}
                    className="text-signal underline-offset-2 hover:underline"
                  >
                    aller la voir ›
                  </button>
                </p>
              ) : (
                <Raison texte="elles vivent dans l'onglet Univers, côté Ambiances et couleurs — et survivent au paquet" />
              )}
            </div>
          </div>
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
      // `nopan` avec les deux autres : sélectionner son texte à la souris
      // déplaçait le plan sous le champ, et la note s'en allait de l'écran
      // pendant qu'on la relisait.
      className="nodrag nowheel nopan h-full w-full resize-none rounded-7 border border-signal bg-carte p-3 text-[12.5px] leading-relaxed text-encre shadow-[0_0_0_2px_var(--color-signal)] placeholder:text-encre-4"
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
  const zoom = useZoom()
  const { carte } = data as unknown as { carte: Carte }
  const [tiree, setTiree] = useState<number | null>(null)
  // **La valeur à écrire vit aussi dans un `ref`.** Un `pointerup` qui suit son
  // `pointermove` d'assez près lit un `onPoser` fabriqué au rendu d'avant, donc
  // une largeur encore nulle — et le geste ne s'écrit pas. L'état sert à rendre,
  // la référence à poser ; c'est la même valeur, tenue là où chacun la lit.
  const derniere = useRef<number | null>(null)

  // ── La correction d'une note posée (`RT7`) ────────────────────────────────
  //
  // **Le serveur sait le champ `texte` depuis T9, aucun écran ne le lui
  // envoyait.** Une carte collée ici ne se corrigeait jamais : réparer une
  // faute demandait de la retirer et de la recoller, donc de perdre sa place,
  // sa teinte et ses liens — exactement ce que le champ existe pour éviter.
  //
  // **Un crayon, pas une note qu'on rouvre.** Le menu de `CarteTuile` porte
  // déjà un champ *Texte*, mais il vit dans le tableau, sans `nodrag`/`nopan` :
  // cliquer dedans sur la toile saisirait le nœud comme au premier pixel d'un
  // glissement. L'édition de la toile est donc la sienne, à côté — un champ
  // plein cadre qui reprend le geste du brouillon d'une note neuve
  // (`NoeudBrouillon`), et le referme de la même façon.
  const [enEdition, setEnEdition] = useState(false)
  const champTexte = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (enEdition) champTexte.current?.focus()
  }, [enEdition])
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
        personnages={cadre.personnages}
        plan
        choisie={carte.identifiant === cadre.choisie}
        /* **Le lot porte le même anneau que la carte choisie**, et il perd le
           menu : un menu règle une carte, et ce qu'on fait de plusieurs se lit
           au-dessus de la toile (`RP9`). */
        selectionnee={cadre.selection.includes(carte.identifiant)}
        // Le menu du tableau referme pendant qu'on écrit : les deux champs
        // *Texte* se contrediraient sinon, posés l'un sur l'autre.
        menu={!enEdition && cadre.selection.length < 2}
        survolee={!enEdition && cleCarte(carte.identifiant) === cadre.survolee}
        onSurvol={(dedans) => cadre.onSurvol(cleCarte(carte.identifiant), dedans)}
        onChoisir={(evenement) =>
          cadre.onChoisir(
            carte.identifiant,
            Boolean(evenement?.ctrlKey || evenement?.metaKey),
          )
        }
        onErreur={cadre.onErreur}
      />
      {/* Le crayon — révélé au survol comme la poignée de largeur, dans le
          coin resté libre : le triangle d'artwork et la marque de concept art
          n'existent que sur une image (`CarteTuile`), jamais sur une note. */}
      {carte.genre === "texte" && !enEdition && (
        <div style={ancreEcran(zoom, { left: "100%", top: "0%" })}>
          <button
            type="button"
            aria-label="Corriger le texte"
            onClick={(evenement) => {
              evenement.stopPropagation()
              setEnEdition(true)
            }}
            className="nodrag nopan absolute top-[4px] -left-[24px] flex h-[22px] w-[22px] items-center justify-center rounded-5 border border-contour bg-carte text-[11px] leading-none text-encre-3 opacity-0 transition duration-[120ms] group-hover:opacity-100 hover:border-signal hover:text-signal focus-visible:opacity-100"
          >
            ✎
          </button>
        </div>
      )}
      {/* Le champ plein cadre, par-dessus la carte : `Échap` referme sans
          écrire, `blur` écrit ce qui a changé — et rien quand le champ revient
          vide ou inchangé (`texteACorriger`), pour qu'une relecture refermée
          sans y toucher n'envoie aucun appel. */}
      {enEdition && (
        <div className="absolute inset-0 z-30">
          <textarea
            ref={champTexte}
            defaultValue={carte.texte}
            onKeyDown={(evenement) => {
              if (evenement.key !== "Escape") return
              evenement.stopPropagation()
              setEnEdition(false)
            }}
            onBlur={(evenement) => {
              const corrige = texteACorriger(carte, evenement.target.value)
              if (corrige) cadre.onCorrigerTexte(carte, corrige)
              setEnEdition(false)
            }}
            // `nopan` avec les deux autres, comme `NoeudBrouillon` : sélectionner
            // le texte à la souris déplacerait sinon le plan sous le champ.
            className="nodrag nowheel nopan h-full w-full resize-none rounded-5 border border-signal bg-carte p-3 text-[12.5px] leading-relaxed text-encre shadow-[0_0_0_2px_var(--color-signal)]"
          />
        </div>
      )}
      {/* **Le carré — on tire une dimension**, 10 px au coin bas-droit, révélé
          au survol. Le seul des trois qui garde le motif *le survol révèle*, et
          il le garde avec sa raison : il règle **la carte qu'on regarde déjà**,
          donc il n'a rien à faire avant que la main soit dessus. Les deux autres
          servent à relier ou déplacer deux objets, c'est-à-dire à viser une
          cible qui n'est pas sous l'œil — et c'est là que le motif cède. */}
      <div style={ancreEcran(zoom, { left: "100%", top: "100%" })}>
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
      </div>

      {/* **Le rond — on tire un trait**, 12 px, **permanent**, et il sort
          entièrement de la carte.

          Il déborde de 3 px sur la voisine : la gouttière entre deux cartes d'un
          îlot est de 9 px, un rond permanent de 12 en prend 12 — le compte est
          écrit parce qu'il ne se rattrape pas. Le mordant est sur le **bord** de
          la voisine, pas sur son image. **L'autre branche coûtait plus cher** :
          à cheval sur le bord, il cachait six pixels de sprite en permanence,
          sur chaque carte, c'est-à-dire sur la seule chose que l'écran existe
          pour montrer.

          *Qui passe devant qui reste au navigateur* : deux cartes au repos
          partagent le même `zIndex`, donc c'est l'ordre du document qui tranche
          — et la carte survolée monte à 10, ce qui suffit, puisque c'est le seul
          moment où l'on vise ce rond.

          Il passe en `--signal` sous le pointeur, comme les deux autres depuis
          T10 : *le survol révèle la poignée, le pointeur dit qu'on l'a
          trouvée.* */}
      <div style={ancreEcran(zoom, { left: "100%", top: "50%" })}>
        <Handle
          type="source"
          position={Position.Right}
          isConnectableStart
          isConnectableEnd={false}
          className="!top-[-6px] !left-0 !h-3 !w-3 !min-w-0 !transform-none !cursor-crosshair !rounded-full !border !border-contour !bg-carte !opacity-100 !transition !duration-[120ms] hover:!border-signal"
        />
      </div>
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
 * (`docs/archi-versions.md` §6.5) — un trait de 1 px, lui, ne se survole pas.
 */
function AreteLien({ id, source, target, data }: EdgeProps) {
  const cadre = useContext(CADRE)
  const zoom = useZoom()
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
          stroke: ouvert ? "var(--color-encre-3)" : "var(--color-pointille)",
          strokeWidth: 1,
        }}
        // Le survol passe par la zone d'écoute de la librairie, qui la pose sur
        // le chemin d'interaction — pas sur le trait visible.
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        {/* Le mot, au milieu du trait, sur une pastille `--fond-0` pour que le
            trait ne le traverse pas. Mono 10 px : c'est un fait sur ce qui est
            là, comme le nom d'un îlot.

            **Et comme lui, il est de l'échelle de l'écran**
            (`docs/archive/DESIGN-chassis-chaud-2026-09-04.md`
            § Six règles de comportement, la sixième). Le trait est une
            géométrie du plan,
            le mot est une lecture : à 0,3× il aurait fait trois pixels de haut,
            c'est-à-dire rien. L'ancre est le milieu du trait, et la pastille s'y
            centre. */}
        {lien.mot && (
          <div style={ancreEcran(zoom, { left: milieu.x, top: milieu.y })}>
            <button
              type="button"
              onPointerEnter={() => cadre.onSurvol(cle, true)}
              onPointerLeave={() => cadre.onSurvol(cle, false)}
              onClick={() => cadre.onEpingler(cadre.epingle === cle ? null : cle)}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                pointerEvents: "all",
              }}
              className="mesure nodrag nopan rounded-5 bg-papier px-1 text-[10.5px] whitespace-nowrap text-encre-3"
            >
              {lien.mot}
            </button>
          </div>
        )}

        {/* La zone d'écoute d'un lien **muet** : il n'a pas de mot à survoler, et
            c'est la contrepartie assumée du défaut muet. Un carré de 20 px au
            milieu du trait, invisible, dans la même largeur que celle que la
            librairie pose le long du tracé — donc **de l'écran**, comme elle :
            une cible qui rétrécirait avec le plan cesserait d'être une cible. */}
        {!lien.mot && (
          <div style={ancreEcran(zoom, { left: milieu.x, top: milieu.y })}>
            <button
              type="button"
              aria-label="Régler le lien"
              onPointerEnter={() => cadre.onSurvol(cle, true)}
              onPointerLeave={() => cadre.onSurvol(cle, false)}
              onClick={() => cadre.onEpingler(cadre.epingle === cle ? null : cle)}
              style={{
                position: "absolute",
                transform: "translate(-50%, -50%)",
                pointerEvents: "all",
              }}
              className="nodrag nopan h-[22px] w-[22px] rounded-5"
            />
          </div>
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
            className="paraitre nodrag nopan flex min-w-[300px] flex-col gap-2 rounded-8 border border-trait bg-papier-cote p-2"
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
          className="mesure h-[26px] rounded-7 border border-trait bg-carte px-2 text-[11px] text-encre placeholder:text-encre-4"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Libelle aide="lien.pointe">Pointe</Libelle>
        <button
          type="button"
          aria-pressed={lien.pointe}
          onClick={() => cadre.onReglerLien(lien, { pointe: !lien.pointe })}
          className={[
            "mesure h-[26px] rounded-7 border px-2 text-[10.5px] transition-colors duration-[120ms]",
            lien.pointe
              ? "border-signal bg-ligne-ouverte text-signal"
              : "border-trait bg-carte text-encre-3 hover:bg-papier-cote",
          ].join(" ")}
        >
          {lien.pointe ? "pointe à l'arrivée" : "sans pointe"}
        </button>
      </div>
      <div className="flex items-center border-t border-trait pt-2">
        <button
          type="button"
          onClick={() => cadre.onCouperLien(lien)}
          className="mesure ml-auto text-[10.5px] text-encre-4 hover:text-echec"
        >
          Couper
        </button>
      </div>
    </>
  )
}

/**
 * La poignée de largeur — le **carré** de 10 px, centré sur le coin bas-droit,
 * et elle ne paraît qu'au survol.
 *
 * **Dix pixels d'écran, à tous les crans** : elle vit dans une ancre d'écran
 * (`ancreEcran`), donc ses mesures ci-dessous sont en pixels d'écran et non de
 * plan. Une poignée de 30 px à 2,5× et un nom illisible à 0,3× étaient la même
 * panne vue par ses deux bouts.
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
 * on déplace la carte au lieu de l'élargir. **`nopan` est l'autre moitié, et
 * elle manquait** : `nodrag` écarte le glissement de nœud, elle n'écarte pas le
 * déplacement du plan, qui écoute un `mousedown` **natif** posé sur son propre
 * calque. Le `stopPropagation` d'à côté ne pouvait rien y faire, et pour deux
 * raisons plutôt qu'une : React délègue à la racine du document, donc son
 * gestionnaire passe *après* celui de la librairie — et le `pointerdown` qu'il
 * arrête n'est de toute façon pas le `mousedown` qu'elle écoute. Une classe, lue
 * par la librairie elle-même, est la seule réponse, et c'est la même aux quatre
 * endroits de ce fichier où le produit tient un geste à la main.
 *
 * Elle s'allume en `--signal` sous le pointeur — le token de la poignée du
 * curseur depuis T2, pour la même chose : une poignée que la main a trouvée.
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
      style={{ pointerEvents: "auto" }}
      className="nodrag nopan absolute -top-[5px] -left-[5px] h-[8px] w-[8px] cursor-ew-resize rounded-5 border border-contour bg-carte opacity-0 transition duration-[120ms] group-hover:opacity-100 hover:border-signal focus-visible:opacity-100"
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
 * la grille, jamais écrites en dur** (`docs/design-motifs.md` § La toile).
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
