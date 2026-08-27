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
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { api, Refus, type Carte } from "../api"
import {
  BarreTableau,
  CarteTuile,
  GLISSE_CARTE,
  GOUTTIERE,
  groupesDe,
  useCollage,
  useDepot,
  useSurvol,
  type Vue,
} from "./Tableau"

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

// ── Ce qu'un geste retient pour se défaire ──────────────────────────────────

export type Geste = { carte: string; avant: Parameters<typeof api.reglerCarte>[1] }

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
  crans: Crans | null
  onSurvol: (identifiant: string, dedans: boolean) => void
  onChoisir: (identifiant: string | null) => void
  onErreur: (raison: string) => void
  onLargeur: (carte: Carte, largeur: number) => void
  aimanter: (depart: number, ecart: number) => number
  zoom: () => number
}

const CADRE = createContext<Cadre | null>(null)

const TYPES = { ilot: NoeudIlot, carte: NoeudCarte }

// ── L'écran ─────────────────────────────────────────────────────────────────

type Parametres = {
  cartes: Carte[]
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
  const { survolee, survoler } = useSurvol(choisie)
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
          zIndex: 1,
        })),
    ])
  }, [cartes, ilots, places, crans, setNoeuds])

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
  useEffect(() => {
    setNoeuds((liste) =>
      liste.map((n) =>
        n.type === "carte"
          ? { ...n, zIndex: n.id === choisie || n.id === survolee ? 10 : 1 }
          : n,
      ),
    )
  }, [choisie, survolee, setNoeuds])

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
      pile.current.push({ carte: carte.identifiant, avant })
      void api
        .reglerCarte(carte.identifiant, reglage)
        .catch((e) => echouer(e, "la carte n'a pas pu être posée"))
    },
    [crans, echouer, pile],
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
      void api
        .reglerCarte(geste.carte, geste.avant)
        .catch((e) => echouer(e, "le geste n'a pas pu être défait"))
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

  const cadre = useMemo<Cadre>(
    () => ({
      choisie,
      survolee,
      crans,
      onSurvol: survoler,
      onChoisir,
      onErreur,
      onLargeur: (carte, largeur) => poser(carte, { largeur_libre: largeur }),
      aimanter: (depart, ecart) => aimanter(crans, depart, ecart),
      zoom: getZoom,
    }),
    [choisie, survolee, crans, survoler, onChoisir, onErreur, poser, getZoom],
  )

  const glisseCarte = (evenement: React.DragEvent) =>
    evenement.dataTransfer.types.includes(GLISSE_CARTE)

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
        className="relative min-h-0 min-w-0 flex-1"
      >
        <CADRE.Provider value={cadre}>
          <ReactFlow
            nodes={noeuds}
            nodeTypes={TYPES}
            onNodesChange={surChangement}
            edges={[]}
            onNodeDragStop={(evenement, noeud) =>
              relacher(noeud.id, noeud.position, {
                x: (evenement as MouseEvent).clientX,
                y: (evenement as MouseEvent).clientY,
              })
            }
            onPaneClick={() => onChoisir(null)}
            minZoom={0.2}
            maxZoom={2.5}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            deleteKeyCode={null}
            className="h-full w-full"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="var(--color-bord)"
            />
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

// ── Les deux nœuds ──────────────────────────────────────────────────────────

/**
 * L'îlot — un cadre et un nom, et rien d'autre.
 *
 * « L'îlot est du châssis, pas un objet dessiné » (`docs/DESIGN.md`) : cadre de
 * 1 px, rayon 2 comme la carte, titre en mono 10 px parce que c'est un fait sur
 * ce qu'il contient et pas une légende. **Il ne se saisit pas** — on le traverse
 * pour prendre une carte, ou pour déplacer le plan.
 *
 * Sa teinte arrive en T9 avec le reste de la couleur (`docs/PLAN.md` T9) ; d'ici
 * là il porte celle du châssis, ce qui est exactement ce qu'il est.
 */
function NoeudIlot({ data }: NodeProps) {
  const { nom, membres } = data as unknown as { nom: string; membres: number }
  return (
    <div
      data-ilot={nom}
      className="h-full w-full rounded-[2px] border border-bord-fort bg-fond-1/40"
    >
      <div className="mesure flex h-[20px] items-center gap-2 px-2 text-[10px] text-texte-2">
        <span className="truncate">{nom}</span>
        <span className="shrink-0 text-texte-3">
          {membres} carte{membres > 1 ? "s" : ""}
        </span>
      </div>
    </div>
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
        survolee={carte.identifiant === cadre.survolee}
        onSurvol={(dedans) => cadre.onSurvol(carte.identifiant, dedans)}
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
    </div>
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
