/**
 * L'essai — B12. **Le personnage joué au clavier, à la taille du jeu.**
 *
 * `docs/archive/pistes-2026-09-04/carnet/Essai.dc.html`. Le quatrième onglet de la page
 * d'un sujet, et le seul endroit du produit où quelque chose bouge parce qu'on
 * appuie sur une touche.
 *
 * **Ce que l'écran existe pour montrer** : une animation peut être juste toute
 * seule et fausse dans le jeu — trop lente à côté de la course, mal ancrée au
 * sol, à côté d'une grenouille qui lui arrive à l'épaule. Aucune fiche ne dit
 * ça ; seul le mouvement le dit.
 *
 * ── **La vitesse, et c'est toute la difficulté de la tranche** ───────────────
 *
 * `bande.cadence` n'est pas la vitesse jouée. Le format d'accompagnement compte
 * en millièmes de seconde **entiers**, et `duree_en_ms`
 * (`atelier/domaine/aseprite.py`) est le seul endroit qui arrondit : c'est son
 * résultat qui part dans `duration` du descriptif *et* dans l'image animée.
 * Cet écran joue donc `dureeImageMs(bande.cadence)` (`interface/src/api.ts`),
 * le double exact de cette fonction-là — pas `1000 / cadence`, qui est ce que
 * les trois lecteurs d'avant emploient (`Apercu.tsx`, `AtelierDeBande.tsx`,
 * `Montage.tsx`) et qui joue un rythme que rien n'exporte.
 *
 * ⚠️ **Et un intervalle nu ne suffit pas non plus.** `setInterval` arrive
 * toujours un peu en retard, et les retards s'additionnent : au bout d'une
 * minute, ce qu'on regarde n'est plus ce qu'on a réglé. Le compteur ci-dessous
 * bat bien sur `setInterval`, mais c'est `performance.now()` qui décide de
 * combien d'images on avance — voir `useMetronome`, et le piège de
 * `requestAnimationFrame` qui y est écrit.
 *
 * ── **Ce qu'il ne fait jamais** ──────────────────────────────────────────────
 *
 * **Il ne remplace pas une animation qui manque par une autre.** Une attaque
 * vers le sud qui n'existe pas devient un rectangle plein, à la taille des
 * autres, et le personnage continue de se déplacer ; jouer l'attaque vers l'est
 * à sa place ferait croire que la case est faite.
 *
 * ── **On s'y déplace, comme dans le jeu** ────────────────────────────────────
 *
 * Tenir une touche fait avancer le personnage dans la scène, à une vitesse en
 * cases par seconde qui se règle. La caméra suit la vue du jeu : de côté, il va
 * à gauche et à droite sur un sol plat ou en pente ; de dessus (trois quarts,
 * oblique, isométrique compris), il va dans tous les sens et il n'y a pas de sol.
 *
 * **Il ne fabrique rien et ne dépense rien.** Aucun `fetch` ne part de ce
 * fichier : tout arrive en props, comme `GrilleDuJeu.tsx` et `Comparer.tsx`. Le
 * seul bouton qui mène à une dépense ouvre l'écran du clip, où le prix
 * s'annonce avant de commander.
 *
 * **Il ne pose pas l'équipement sur le cycle.** Une pièce se cale aujourd'hui
 * sur une image fixe, et rien ne la pose sur les douze images d'un cycle qui
 * tourne — la planche le range dans *ce que cet écran n'a pas encore*, et les
 * critères de la tranche ne le demandent pas. Ce qu'il porte se lit sur sa
 * fiche (`VestiaireDuSujet.tsx`, B19).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  CIBLE_DE_REFERENCE,
  api,
  dureeImageMs,
  type Bande,
  type Case,
  type CaseDirection,
  type Personnage,
  type Pose,
  type Univers,
} from "../api"
import { imageAsset, rangDeLaBande } from "./Apercu"
import { rangerLaLigne } from "./AnimationsDuSujet"

/** Les crans de la planche, dans son ordre. **Trois, et le premier est celui
 *  où l'on joue** : à ×1 un sprite de 48 px ne dit rien d'un mouvement, et à
 *  ×6 on regarde un pixel plutôt qu'un personnage.
 *
 *  Des multiples entiers, comme partout ailleurs (`Vitrine.tsx`,
 *  `GrilleDuJeu.tsx`, `Comparer.tsx`) et pour la même raison : à ×1,5 un pixel
 *  du jeu n'est plus un carré. */
const ZOOMS = [3, 6, 1] as const
type Zoom = (typeof ZOOMS)[number]

/** Les quatre poses que le clavier sait jouer tout seul, **par leur
 *  identifiant et rien d'autre**.
 *
 *  Ce sont ceux que le produit livre — `CONSIGNES` d'`atelier/domaine/plan.py`,
 *  et le catalogue de mouvements d'`atelier/domaine/mouvement.py` porte les
 *  mêmes. Un jeu dont le plan ne les porte pas garde ses touches muettes, et la
 *  colonne le dit : le produit ne devine pas qu'un mot français désigne une
 *  marche, exactement comme `direction_au_miroir` refuse de deviner qu'un mot
 *  désigne une direction opposée. */
const AU_REPOS = "repos"
const QUI_MARCHE = "marche"
const QUI_COURT = "course"
const QUI_ATTAQUE = "attaque"

/** Ce qu'une touche de déplacement vise, **parmi les directions que le produit
 *  livre** (`_CARDINALES` et `DEUX` d'`atelier/domaine/vue.py`).
 *
 *  Plusieurs candidates par touche parce qu'un jeu de côté n'a ni est ni
 *  ouest : il a `droite` et `gauche`. La première que le jeu déclare vraiment
 *  gagne ; aucune, et la touche ne fait rien. **Les directions d'un projet sont
 *  libres**, et cette table ne connaît que celles qui sont livrées. */
const DIRECTIONS_DE_LA_TOUCHE: Record<string, readonly string[]> = {
  z: ["nord"],
  w: ["nord"],
  arrowup: ["nord"],
  s: ["sud"],
  arrowdown: ["sud"],
  q: ["ouest", "gauche"],
  a: ["ouest", "gauche"],
  arrowleft: ["ouest", "gauche"],
  d: ["est", "droite"],
  arrowright: ["est", "droite"],
}

/** Le sens de déplacement de chaque direction livrée, en cases de l'écran.
 *  Une diagonale n'est pas ici : elle naît de deux touches tenues ensemble. */
const VECTEUR_DE_LA_DIRECTION: Record<string, readonly [number, number]> = {
  nord: [0, -1],
  sud: [0, 1],
  est: [1, 0],
  droite: [1, 0],
  ouest: [-1, 0],
  gauche: [-1, 0],
}

/** **D'où la caméra regarde, donc comment on se déplace.**
 *
 *  `cote` — un jeu de plateforme ou de défilement : le personnage va à gauche
 *  et à droite, les pieds sur un sol. `dessus` — vue de dessus, trois quarts,
 *  oblique, isométrique : il se déplace sur le plan, dans tous les sens, et il
 *  n'y a pas de ligne de sol.
 *
 *  La vue déclarée dans les règles du jeu décide (`atelier/domaine/vue.py`).
 *  Un jeu qui n'en déclare pas : ses directions le disent — `droite` et
 *  `gauche` seules, c'est un jeu de côté ; un nord ou un sud, c'est un jeu vu
 *  d'en haut. L'auteur peut toujours basculer dans *La scène*. */
export type Camera = "cote" | "dessus"

export function cameraDuJeu(vue: string, directions: readonly { identifiant: string }[]): Camera {
  if (vue.startsWith("vue-cote") || vue === "vue-face-fixe") return "cote"
  if (vue.startsWith("vue-dessus") || vue === "vue-oblique" || vue === "vue-isometrique")
    return "dessus"
  const siennes = directions.map((d) => d.identifiant)
  if (siennes.some((d) => d.startsWith("nord") || d.startsWith("sud"))) return "dessus"
  return "cote"
}

/** Où vont les touches tenues : un vecteur de longueur 1 (ou nul), et la
 *  direction que le personnage regarde — la diagonale si le jeu la déclare,
 *  sinon la dernière touche appuyée. */
export function versOuVaIl(
  directionsTenues: readonly string[],
  camera: Camera,
  declarees: ReadonlySet<string>,
): { dx: number; dy: number; regarde: string | null } {
  let dx = 0
  let dy = 0
  for (const d of new Set(directionsTenues)) {
    const [x, y] = VECTEUR_DE_LA_DIRECTION[d] ?? [0, 0]
    dx += x
    dy += y
  }
  if (camera === "cote") dy = 0
  dx = Math.sign(dx)
  dy = Math.sign(dy)
  const longueur = Math.hypot(dx, dy)
  let regarde = directionsTenues.at(-1) ?? null
  if (dx !== 0 && dy !== 0) {
    const diagonale = `${dy < 0 ? "nord" : "sud"}-${dx > 0 ? "est" : "ouest"}`
    if (declarees.has(diagonale)) regarde = diagonale
  }
  return longueur === 0
    ? { dx: 0, dy: 0, regarde }
    : { dx: dx / longueur, dy: dy / longueur, regarde }
}

/** Les vitesses de déplacement par défaut, **en cases du jeu par seconde**.
 *  Réglables dans *La scène* : ce sont celles du jeu qu'on juge, pas une
 *  vérité du produit. */
const MARCHE_PAR_DEFAUT = 2
const COURSE_PAR_DEFAUT = 4.5

/** Les quatre fonds de la planche. `jeu` prend la couleur que les règles du
 *  jeu portent — le même geste que `Comparer.tsx`, au même nom. */
type Fond = "neutre" | "clair" | "damier" | "jeu"

const NOM_DU_FOND: Record<Fond, string> = {
  neutre: "gris neutre",
  clair: "clair",
  damier: "damier",
  jeu: "un décor du jeu",
}

// ── Ce que le clavier demande, et ce qui répond ──────────────────────────────

/** La pose réellement jouée. **Se déplacer la choisit tout seul** : tant qu'une
 *  touche de déplacement est tenue, c'est la marche — ou la course avec Maj —,
 *  et la lâcher rend la pose qu'on avait posée à la main. */
export function poseJouee(
  posee: string,
  touches: ReadonlySet<string>,
  court: boolean,
  connues: ReadonlySet<string>,
): string {
  if (touches.size === 0) return posee
  if (court && connues.has(QUI_COURT)) return QUI_COURT
  if (connues.has(QUI_MARCHE)) return QUI_MARCHE
  return posee
}

/** Les directions de ce sujet, dans l'ordre où ses cases les donnent.
 *
 *  Le serveur a déjà retiré celles que la pose ne tient pas — la portée large
 *  du plan et la portée étroite du sujet (`atelier/domaine/personnage.py`,
 *  `directions_tenues`). L'écran ne rejoue donc aucun rangement : il réunit ce
 *  qu'il reçoit, première vue en premier. */
export function directionsDuSujet(cases: readonly Case[]): CaseDirection[] {
  const vues = new Map<string, CaseDirection>()
  for (const sienne of cases)
    for (const d of sienne.directions) if (!vues.has(d.identifiant)) vues.set(d.identifiant, d)
  return [...vues.values()]
}

/** **L'animation qui sortirait dans le jeu pour cette pose et cette
 *  direction** — ou rien, et rien veut dire *elle n'existe pas*.
 *
 *  Le départage est celui de *Ses animations* (`rangerLaLigne`), repris et non
 *  recopié : la retenue d'abord, la plus récente des gardées ensuite. Le
 *  serveur ne tient pas l'unicité de la retenue et aucune règle d'export ne lit
 *  encore `favori` (`atelier/domaine/bande.py`) — deux écrans qui départageaient
 *  différemment montreraient deux animations pour la même case.
 *
 *  ⚠️ **Une case sans direction déclarée n'est pas une case vide** : le jeu
 *  n'a alors pas de second axe du tout, et ses bandes sont dans `bandes`. */
export function bandeQuiSortirait(
  cases: readonly Case[],
  pose: string,
  direction: string | null,
): Bande | null {
  const sienne = cases.find((c) => c.pose === pose)
  if (!sienne) return null
  const dedans =
    direction === null
      ? sienne.bandes
      : (sienne.directions.find((d) => d.identifiant === direction)?.bandes ?? [])
  const { retenue, gardees } = rangerLaLigne(dedans)
  return retenue ?? gardees.at(-1) ?? null
}

/** Le compteur d'images, **sans dérive**.
 *
 *  Le battement est un `setInterval` au pas exact de l'export, et l'horloge qui
 *  décide est `performance.now()` : chaque réveil demande *combien d'images se
 *  sont écoulées depuis la dernière*, plutôt que d'avancer d'une image par
 *  réveil. Un intervalle nu dérive — il arrive toujours un peu en retard, et
 *  les retards s'additionnent —, celui-ci rattrape, et sa moyenne reste
 *  exactement le pas demandé.
 *
 *  ⚠️ **`requestAnimationFrame` a été essayé le premier, et il ne bat pas
 *  partout.** Mesuré au navigateur en fermant cette tranche : dans le volet de
 *  l'atelier, `document.visibilityState` vaut `visible`, `document.hidden` vaut
 *  `false`, et `requestAnimationFrame` est appelé **zéro fois par seconde** —
 *  la page se croit visible, rien ne compose, l'animation est figée et personne
 *  ne le dit. `setInterval` bat dans ce cas-là. Voir `docs/PIEGES.md`. */
function useMetronome(pasMs: number, actif: boolean): number {
  const [pas, setPas] = useState(0)
  useEffect(() => {
    if (!actif || pasMs <= 0) return
    let depuis = performance.now()
    const minuteur = window.setInterval(() => {
      const avances = Math.floor((performance.now() - depuis) / pasMs)
      if (avances > 0) {
        depuis += avances * pasMs
        setPas((p) => p + avances)
      }
    }, pasMs)
    return () => window.clearInterval(minuteur)
  }, [pasMs, actif])
  return pas
}

// ── Les pièces ───────────────────────────────────────────────────────────────

/** Une bande posée dans la scène, **à la taille du jeu et sans le moindre
 *  lissage**.
 *
 *  La planche entière est chargée une fois et décalée en `backgroundPosition` —
 *  la même mécanique que `BandeQuiTourne` (`Apercu.tsx`), qui ne peut pas être
 *  reprise telle quelle ici : elle porte son propre métronome à
 *  `1000 / cadence` et son propre cadre. Le rang lui est donné du dehors, pour
 *  que la scène entière parle d'une seule horloge par animation. */
function BandeAuJeu({ bande, rang, zoom }: { bande: Bande; rang: number; zoom: Zoom }) {
  return (
    <span
      data-bande-au-jeu={bande.identifiant}
      style={{
        display: "block",
        width: bande.case_largeur * zoom,
        height: bande.case_hauteur * zoom,
        backgroundImage: `url(${api.plancheDeLaBande(bande.identifiant)})`,
        backgroundSize: `${bande.case_largeur * bande.compte * zoom}px ${bande.case_hauteur * zoom}px`,
        backgroundPosition: `-${rang * bande.case_largeur * zoom}px 0`,
        imageRendering: "pixelated",
      }}
    />
  )
}

/** **Ce qui tient la place d'une animation qui manque** : un rectangle plein,
 *  à la taille des autres, qui porte le nom de ce qui manque. Le personnage se
 *  déplace quand même — on juge le jeu, et un trou ne doit pas l'arrêter —,
 *  mais on ne peut pas le prendre pour une animation faite. */
function Remplacant({
  largeur,
  hauteur,
  mot,
}: {
  largeur: number
  hauteur: number
  mot: string
}) {
  return (
    <span
      data-remplacant={mot}
      title={`${mot} — pas encore faite`}
      className="mesure flex items-center justify-center overflow-hidden rounded-5 border border-trait-echec bg-fond-echec px-[4px] text-center text-[10.5px] leading-[1.1] text-echec"
      style={{ width: largeur, height: hauteur }}
    >
      {largeur >= 40 ? mot : ""}
    </span>
  )
}

/** Une étiquette de scène — posée sur le pourtour, donc sur du papier et non
 *  sur un voile sombre : le carnet n'a pas de couleur pour ça. */
function Marque({ children, marqueur }: { children: ReactNode; marqueur?: string }) {
  return (
    <span
      data-marque-de-la-scene={marqueur}
      className="mesure rounded-5 bg-carte px-[8px] py-[4px] text-[11px] text-encre-controle"
    >
      {children}
    </span>
  )
}

/** Une touche du clavier, **et elle s'allume quand on la tient**.
 *
 *  ⚠️ Allumée, elle n'est pas rouille : le rouille ne dit que *ce qui coûte*,
 *  et l'unique bouton rouille de cet écran est celui qui mène au clip. Une
 *  touche tenue prend la ligne ouverte du carnet. */
function Touche({ children, tenue }: { children: ReactNode; tenue?: boolean }) {
  return (
    <span
      className={[
        "mesure inline-flex items-center rounded-5 border border-b-2 px-[4px] text-[10.5px]",
        tenue
          ? "border-encre-4 bg-ligne-ouverte text-encre"
          : "border-contour bg-carte text-encre-controle",
      ].join(" ")}
    >
      {children}
    </span>
  )
}

// ── L'onglet ─────────────────────────────────────────────────────────────────

type Volet = "fait" | "scene"

export function EssaiDuSujet({
  personnage,
  personnages,
  plan,
  univers,
  onAnimer,
  onAnimations,
}: {
  personnage: Personnage
  /** Les autres sujets du jeu, pour en poser un à côté. Leurs images et leurs
   *  bandes sont déjà là — un appel de plus pour les relire ferait deux
   *  vérités. */
  personnages: Personnage[]
  plan: Pose[]
  univers: Univers
  /** **Demander un clip** (A9) — la porte que *Ses animations* emprunte déjà.
   *  Elle ne dépense rien : c'est l'écran du clip qui paie, et qui annonce son
   *  prix avant. */
  onAnimer: (
    personnage: Personnage,
    pose: Pose,
    direction?: { identifiant: string; nom: string } | null,
  ) => void
  /** Passer à *Ses animations* — c'est là qu'on en change une. Ici on regarde. */
  onAnimations: () => void
}) {
  const [zoom, setZoom] = useState<Zoom>(3)
  const [volet, setVolet] = useState<Volet>("fait")
  const [fond, setFond] = useState<Fond>("neutre")
  const [grille, setGrille] = useState(true)
  const [cadre, setCadre] = useState(true)
  const [sol, setSol] = useState<"plat" | "pente">("plat")
  const [voisin, setVoisin] = useState<string>("")
  const [auClavier, setAuClavier] = useState(false)

  const scene = useRef<HTMLDivElement | null>(null)

  const sesDirections = useMemo(
    () => directionsDuSujet(personnage.cases),
    [personnage.cases],
  )

  /** Ses poses, dans l'ordre de son plan — **six au plus portent une touche**,
   *  parce que la planche en dessine six et qu'au-delà le chiffre cesse d'être
   *  lisible d'un coup d'œil. */
  const sesPoses = useMemo(
    () =>
      personnage.cases.map((sienne) => ({
        identifiant: sienne.pose,
        nom: plan.find((p) => p.identifiant === sienne.pose)?.nom ?? sienne.pose,
      })),
    [personnage.cases, plan],
  )
  const connues = useMemo(
    () => new Set(sesPoses.map((p) => p.identifiant)),
    [sesPoses],
  )

  // **Ce qu'on a choisi et ce qui est jouable sont deux choses.** La direction
  // et la pose gardent un *souhait*, et la valeur employée juste en dessous
  // retombe sur le défaut dès que ce souhait n'a plus de sens — un sujet qui ne
  // tient pas cette direction, une pose qu'il n'a pas. Un effet qui remettrait
  // ces états à zéro effacerait le choix de l'auteur à chaque relecture des
  // cases, donc au premier changement de retenue fait ailleurs.
  const [directionVoulue, setDirectionVoulue] = useState<string | null>(null)
  const [poseeVoulue, setPoseeVoulue] = useState<string | null>(null)
  const [tenues, setTenuesEtat] = useState<ReadonlySet<string>>(new Set())
  // Deux touches enfoncées dans le même instant arrivent avant que l'écran se
  // redessine : la seconde doit voir la première, donc on lit une référence.
  const tenuesRef = useRef<ReadonlySet<string>>(tenues)
  const setTenues = useCallback((suite: ReadonlySet<string>) => {
    tenuesRef.current = suite
    setTenuesEtat(suite)
  }, [])
  const [court, setCourt] = useState(false)

  // **La direction de départ est la première qui a quelque chose à jouer.**
  // Ouvrir sur un nord vide quand seules l'est et l'ouest sont faites laisse
  // croire que l'écran ne marche pas.
  const directionDeDepart =
    sesDirections.find((d) =>
      personnage.cases.some(
        (c) => (c.directions.find((x) => x.identifiant === d.identifiant)?.bandes.length ?? 0) > 0,
      ),
    )?.identifiant ??
    sesDirections[0]?.identifiant ??
    null
  const direction =
    directionVoulue !== null && sesDirections.some((d) => d.identifiant === directionVoulue)
      ? directionVoulue
      : directionDeDepart
  const posee =
    poseeVoulue !== null && connues.has(poseeVoulue)
      ? poseeVoulue
      : connues.has(AU_REPOS)
        ? AU_REPOS
        : (sesPoses[0]?.identifiant ?? AU_REPOS)

  const demandee = poseJouee(posee, tenues, court, connues)
  const nomDeLaPose = (identifiant: string) =>
    sesPoses.find((p) => p.identifiant === identifiant)?.nom ?? identifiant
  const nomDeLaDirection = (identifiant: string | null) =>
    identifiant === null
      ? null
      : (sesDirections.find((d) => d.identifiant === identifiant)?.nom ?? identifiant)

  const voulue = bandeQuiSortirait(personnage.cases, demandee, direction)
  // **Elle manque, donc un rectangle plein prend sa place** — jamais une autre
  // animation, qui ferait croire que la case est faite. Le personnage se
  // déplace quand même : c'est le jeu qu'on juge.
  const jouee = voulue
  const manque = voulue === null

  // La taille d'une case de ce sujet, pour que le remplaçant ait la taille des
  // animations qui existent — et la case du jeu s'il n'en a aucune.
  const uneBande =
    personnage.cases.flatMap((c) => [...c.bandes, ...c.directions.flatMap((d) => d.bandes)])[0] ??
    null

  const pasMs = jouee ? dureeImageMs(jouee.cadence) : 0
  const pas = useMetronome(pasMs, jouee !== null && jouee.compte > 1)
  const rang = jouee ? rangDeLaBande(pas, jouee.compte, jouee.sens) : 0

  const sonVoisin =
    personnages.find(
      (p) => p.identifiant === voisin && p.identifiant !== personnage.identifiant,
    ) ?? null
  const bandeDuVoisin = sonVoisin
    ? (bandeQuiSortirait(sonVoisin.cases, AU_REPOS, direction) ??
      bandeQuiSortirait(sonVoisin.cases, AU_REPOS, null))
    : null
  // Son propre métronome : le voisin est là pour comparer des tailles, pas pour
  // battre au rythme d'un autre. Sa cadence est la sienne.
  const pasMsDuVoisin = bandeDuVoisin ? dureeImageMs(bandeDuVoisin.cadence) : 0
  const pasDuVoisin = useMetronome(
    pasMsDuVoisin,
    bandeDuVoisin !== null && bandeDuVoisin.compte > 1,
  )
  const imageDuVoisin = sonVoisin
    ? (sonVoisin.cases.flatMap((c) => c.images).find((a) => a.favori) ??
      sonVoisin.cases.flatMap((c) => c.images).at(-1) ??
      null)
    : null

  const cible = univers.cible_px || CIBLE_DE_REFERENCE

  /** La direction que cette touche vise, **si le jeu la déclare**. */
  const dirigerVers = useCallback(
    (touche: string): string | null => {
      // **Un jeu qui ne déclare aucune direction se déplace quand même** : ses
      // animations valent sous tous les angles, et la touche garde son sens.
      if (sesDirections.length === 0) return DIRECTIONS_DE_LA_TOUCHE[touche]?.[0] ?? null
      for (const candidate of DIRECTIONS_DE_LA_TOUCHE[touche] ?? [])
        if (sesDirections.some((d) => d.identifiant === candidate)) return candidate
      return null
    },
    [sesDirections],
  )

  // ── Le déplacement ────────────────────────────────────────────────────────
  const cameraDeduite = cameraDuJeu(univers.vue ?? "", sesDirections)
  const [cameraVoulue, setCameraVoulue] = useState<Camera | null>(null)
  const camera = cameraVoulue ?? cameraDeduite
  const [vitesseMarche, setVitesseMarche] = useState(MARCHE_PAR_DEFAUT)
  const [vitesseCourse, setVitesseCourse] = useState(COURSE_PAR_DEFAUT)
  /** Où il est, **en pixels du jeu**, depuis le milieu de la scène. */
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [tailleScene, setTailleScene] = useState({ largeur: 0, hauteur: 0 })

  useEffect(() => {
    const element = scene.current
    if (!element || typeof ResizeObserver === "undefined") return
    const mesurer = () =>
      setTailleScene({ largeur: element.clientWidth, hauteur: element.clientHeight })
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])

  const largeurActeur = (jouee ?? uneBande)?.case_largeur ?? cible
  const hauteurActeur = (jouee ?? uneBande)?.case_hauteur ?? cible

  const declarees = useMemo(
    () => new Set(sesDirections.map((d) => d.identifiant)),
    [sesDirections],
  )
  const directionsTenues = [...tenues]
    .map((t) => dirigerVers(t))
    .filter((d): d is string => d !== null)
  const { dx, dy } = versOuVaIl(directionsTenues, camera, declarees)
  const vitesse = (court && connues.has(QUI_COURT) ? vitesseCourse : vitesseMarche) * cible

  /** Les bornes de la scène, relues à chaque battement sans relancer la boucle. */
  const bornes = useRef({ x: Infinity, y: Infinity })
  bornes.current = {
    x: tailleScene.largeur > 0 ? Math.max(0, (tailleScene.largeur / zoom - largeurActeur) / 2) : Infinity,
    y:
      tailleScene.hauteur > 0 ? Math.max(0, (tailleScene.hauteur / zoom - hauteurActeur) / 2) : Infinity,
  }
  const borner = (x: number, y: number) => ({
    x: Math.max(-bornes.current.x, Math.min(bornes.current.x, x)),
    y: camera === "cote" ? 0 : Math.max(-bornes.current.y, Math.min(bornes.current.y, y)),
  })
  const bornerRef = useRef(borner)
  bornerRef.current = borner

  // Le même choix d'horloge que `useMetronome`, pour la même raison :
  // `setInterval` bat dans le volet de l'atelier, `requestAnimationFrame` non.
  // Le temps écoulé est relu à chaque réveil, donc un réveil en retard avance
  // d'autant plus loin.
  useEffect(() => {
    if ((dx === 0 && dy === 0) || vitesse <= 0) return
    let avant = performance.now()
    const minuteur = window.setInterval(() => {
      const maintenant = performance.now()
      const secondes = Math.min(0.1, (maintenant - avant) / 1000)
      avant = maintenant
      setPosition((p) => bornerRef.current(p.x + dx * vitesse * secondes, p.y + dy * vitesse * secondes))
    }, 16)
    return () => window.clearInterval(minuteur)
  }, [dx, dy, vitesse])

  // Changer de caméra ou de zoom peut laisser le personnage hors du cadre.
  useEffect(() => {
    setPosition((p) => bornerRef.current(p.x, p.y))
  }, [camera, zoom, tailleScene.largeur, tailleScene.hauteur])

  /** La hauteur du sol sous un point de la scène, en pixels de l'écran — la
   *  vue de côté seulement. En pente, il monte de gauche à droite. */
  const epaisseurSol = Math.max(24, Math.round(cible * zoom * 0.5))
  const montee = sol === "pente" ? Math.round(Math.min(cible * zoom * 1.5, (tailleScene.hauteur || 400) * 0.4)) : 0
  const solSous = (xEcran: number) => {
    if (montee === 0 || tailleScene.largeur === 0) return epaisseurSol
    const part = Math.max(0, Math.min(1, (tailleScene.largeur / 2 + xEcran) / tailleScene.largeur))
    return Math.round(epaisseurSol + part * montee)
  }

  /** Où poser un acteur : le milieu en largeur, les pieds sur le sol de côté,
   *  le centre sur le plan vu de dessus — et, de dessus, celui qui est plus bas
   *  passe devant. */
  const placer = (x: number, y: number): React.CSSProperties =>
    camera === "cote"
      ? {
          position: "absolute",
          left: `calc(50% + ${Math.round(x * zoom)}px)`,
          bottom: solSous(x * zoom),
          transform: "translateX(-50%)",
        }
      : {
          position: "absolute",
          left: `calc(50% + ${Math.round(x * zoom)}px)`,
          top: `calc(50% + ${Math.round(y * zoom)}px)`,
          transform: "translate(-50%, -50%)",
          zIndex: 1000 + Math.round(y),
        }

  /** Ce que chaque pose a pour la direction regardée — c'est la colonne de
   *  droite, et c'est aussi ce qui grise une touche. */
  const ceQuIlFait = sesPoses.map((p, rangee) => ({
    ...p,
    touche: rangee < 6 ? String(rangee + 1) : null,
    bande: bandeQuiSortirait(personnage.cases, p.identifiant, direction),
  }))

  /** Ce qui existe pour la pose qui manque, direction par direction — la liste
   *  que la planche montre sous le bandeau rouge. */
  const ailleurs = manque
    ? sesDirections
        .filter((d) => d.identifiant !== direction)
        .map((d) => ({ d, bande: bandeQuiSortirait(personnage.cases, demandee, d.identifiant) }))
    : []

  const auDebut = useCallback(() => {
    setPoseeVoulue(null)
    setDirectionVoulue(null)
    setTenues(new Set())
    setCourt(false)
    setPosition({ x: 0, y: 0 })
  }, [setTenues])

  // **Le clavier est celui de la scène, jamais celui de la fenêtre.** Un
  // écouteur posé sur `window` volerait Ctrl+K à la barre et `?` au guide —
  // c'est le défaut que B6 a payé —, et il ferait marcher le personnage
  // pendant qu'on écrit ailleurs. Cliquer la scène la met au clavier, Échap la
  // relâche : c'est exactement ce que le pied de l'écran promet.
  const surTouche = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const touche = e.key.toLowerCase()
    if (touche === "escape") {
      scene.current?.blur()
      return
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const vers = dirigerVers(touche)
    if (vers !== null) {
      e.preventDefault()
      const suite = new Set(tenuesRef.current)
      suite.delete(touche)
      suite.add(touche)
      const visees = [...suite].map((t) => dirigerVers(t)).filter((d): d is string => d !== null)
      setDirectionVoulue(versOuVaIl(visees, camera, declarees).regarde ?? vers)
      setCourt(e.shiftKey)
      setTenues(suite)
      // Se remettre à marcher efface la pose qu'on avait posée à la main :
      // sans ça, lâcher la touche rendrait une attaque qu'on croyait finie.
      setPoseeVoulue(null)
      return
    }
    if (touche === " ") {
      e.preventDefault()
      if (connues.has(QUI_ATTAQUE)) setPoseeVoulue(QUI_ATTAQUE)
      return
    }
    const rangee = Number(touche)
    if (Number.isInteger(rangee) && rangee >= 1 && rangee <= 6) {
      const visee = ceQuIlFait[rangee - 1]
      if (visee) {
        e.preventDefault()
        setPoseeVoulue(visee.identifiant)
      }
    }
  }

  const surRelache = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const touche = e.key.toLowerCase()
    if (touche === "shift") {
      setCourt(false)
      return
    }
    if (DIRECTIONS_DE_LA_TOUCHE[touche] && tenuesRef.current.has(touche)) {
      const suite = new Set(tenuesRef.current)
      suite.delete(touche)
      // Lâcher une touche d'une diagonale : il regarde vers celle qui reste.
      const visees = [...suite].map((t) => dirigerVers(t)).filter((d): d is string => d !== null)
      const regarde = versOuVaIl(visees, camera, declarees).regarde
      if (regarde !== null) setDirectionVoulue(regarde)
      setTenues(suite)
    }
  }

  const fondDeScene =
    fond === "jeu" && univers.fond ? { background: univers.fond } : undefined

  return (
    <div data-onglet-essai className="flex items-start">
      {/* `min-w-0` : sans lui, la scène pousse le volet hors de la fenêtre —
          la même note qu'`ImagesDuSujet.tsx`. */}
      <section className="flex min-w-0 flex-1 flex-col gap-[14px]">
        <div className="flex items-center justify-between gap-[14px]">
          <p className="text-[13px] text-encre-2">
            À la taille du jeu, piloté au clavier. La vitesse jouée ici est celle qui
            sera exportée — il n'y en a pas deux.
          </p>
          <div className="flex shrink-0 items-center gap-[8px]">
            <div className="flex gap-[4px] rounded-8 bg-papier-cote p-[4px]">
              {ZOOMS.map((z) => (
                <button
                  key={z}
                  type="button"
                  aria-pressed={zoom === z}
                  onClick={() => setZoom(z)}
                  className={[
                    "flex h-[26px] min-w-[34px] items-center justify-center rounded-7 text-[12.5px] transition-colors duration-120",
                    zoom === z ? "bg-carte font-medium text-encre" : "text-encre-3 hover:text-encre",
                  ].join(" ")}
                >
                  ×{z}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={auDebut}
              className="h-[30px] rounded-7 border border-contour bg-carte px-[14px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
            >
              Remettre au début
            </button>
          </div>
        </div>

        {/* ── La scène ────────────────────────────────────────────────────── */}
        <div
          ref={scene}
          data-scene-de-l-essai
          role="application"
          aria-label={`Jouer ${personnage.nom} au clavier`}
          tabIndex={0}
          onFocus={() => setAuClavier(true)}
          onBlur={() => {
            setAuClavier(false)
            setTenues(new Set())
            setCourt(false)
          }}
          onKeyDown={surTouche}
          onKeyUp={surRelache}
          className={[
            // **Haute**, parce qu'on s'y déplace : de dessus, on monte et on descend.
            "relative h-[clamp(440px,70vh,760px)] w-full overflow-hidden rounded-8 outline-none",
            fond === "damier" ? "damier-papier" : "",
            fond === "clair" ? "bg-papier-cote" : "",
            fond === "neutre" || fond === "jeu" ? "bg-pourtour" : "",
            auClavier ? "ring-2 ring-signal" : "",
          ].join(" ")}
          style={
            grille
              ? {
                  ...fondDeScene,
                  // Le même trait que `GrilleDuJeu.tsx`, et pour la même raison :
                  // « overlay » adoucit `--color-eteint` sur le fond de cet
                  // élément sans écrire de couleur littérale, ce que la liste
                  // fermée interdit.
                  backgroundImage:
                    "linear-gradient(to right, var(--color-eteint) 1px, transparent 1px), linear-gradient(to bottom, var(--color-eteint) 1px, transparent 1px)",
                  backgroundSize: `${cible * zoom}px ${cible * zoom}px`,
                  backgroundBlendMode: "overlay",
                }
              : fondDeScene
          }
        >
          {camera === "cote" && (
            <span
              aria-hidden
              data-sol={sol}
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-encre/20"
              style={{
                height: epaisseurSol + montee,
                clipPath:
                  montee > 0
                    ? `polygon(0 ${Math.round((montee / (epaisseurSol + montee)) * 100)}%, 100% 0, 100% 100%, 0 100%)`
                    : undefined,
              }}
            />
          )}

          {sonVoisin && (
            <figure
              data-voisin={sonVoisin.identifiant}
              style={placer(borner(-2.5 * cible, 0).x, 0)}
            >
              {bandeDuVoisin ? (
                <BandeAuJeu
                  bande={bandeDuVoisin}
                  rang={rangDeLaBande(pasDuVoisin, bandeDuVoisin.compte, bandeDuVoisin.sens)}
                  zoom={zoom}
                />
              ) : imageDuVoisin ? (
                <img
                  src={imageAsset(imageDuVoisin)}
                  alt={sonVoisin.nom}
                  width={(imageDuVoisin.rendu_largeur || imageDuVoisin.largeur) * zoom}
                  height={(imageDuVoisin.rendu_hauteur || imageDuVoisin.hauteur) * zoom}
                  style={{ imageRendering: "pixelated" }}
                  className="block"
                />
              ) : (
                <Remplacant largeur={cible * zoom} hauteur={cible * zoom} mot={`${sonVoisin.nom} · repos`} />
              )}
              <figcaption className="mesure absolute left-1/2 top-full mt-[4px] -translate-x-1/2 whitespace-nowrap text-[10.5px] text-carte">
                {sonVoisin.nom}
              </figcaption>
            </figure>
          )}

          <figure data-acteur style={placer(position.x, position.y)}>
            {cadre && (
              <span
                aria-hidden
                data-cadre-de-la-case
                className="pointer-events-none absolute left-1/2 rounded-5 border border-dashed border-eteint"
                style={{
                  width: cible * zoom,
                  height: cible * zoom,
                  bottom: 0,
                  transform: "translateX(-50%)",
                }}
              />
            )}
            {jouee ? (
              <BandeAuJeu bande={jouee} rang={rang} zoom={zoom} />
            ) : (
              <Remplacant
                largeur={largeurActeur * zoom}
                hauteur={hauteurActeur * zoom}
                mot={`${nomDeLaPose(demandee)}${direction ? ` · ${nomDeLaDirection(direction)}` : ""}`}
              />
            )}
            <figcaption className="mesure absolute left-1/2 top-full mt-[4px] -translate-x-1/2 whitespace-nowrap text-[10.5px] text-carte">
              {personnage.nom}
            </figcaption>
          </figure>

          <div className="pointer-events-none absolute left-[14px] top-[14px] flex gap-[8px]">
            <Marque marqueur="scene">
              {nomDeLaPose(demandee)}
              {direction ? ` · ${nomDeLaDirection(direction)}` : ""}
            </Marque>
            {jouee && (
              <Marque>
                {jouee.cadence} i/s · {pasMs} ms par image · image{" "}
                {rang + 1} / {jouee.compte}
              </Marque>
            )}
          </div>
          <div className="pointer-events-none absolute right-[14px] top-[14px]">
            {jouee && (
              <Marque>
                {jouee.case_largeur} × {jouee.case_hauteur} px · ×{zoom}
              </Marque>
            )}
          </div>
        </div>

        {/* ── Les touches, sous la scène ──────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-[22px] border-t border-trait pb-[14px] pt-[8px] text-[12px] text-encre-3">
          <span className="flex items-center gap-[4px]">
            <Touche tenue={tenues.has("z") || tenues.has("arrowup")}>Z</Touche>
            <Touche tenue={tenues.has("q") || tenues.has("arrowleft")}>Q</Touche>
            <Touche tenue={tenues.has("s") || tenues.has("arrowdown")}>S</Touche>
            <Touche tenue={tenues.has("d") || tenues.has("arrowright")}>D</Touche>
            <span className="ml-[4px]">se déplacer — la direction suit</span>
          </span>
          <span className="flex items-center gap-[4px]">
            <Touche tenue={court}>Maj</Touche>
            <span>courir</span>
          </span>
          <span className="flex items-center gap-[4px]">
            <Touche>Espace</Touche>
            <span>attaquer</span>
          </span>
          <span className="flex items-center gap-[4px]">
            <Touche>1</Touche>
            <span>à</span>
            <Touche>6</Touche>
            <span>jouer une animation directement</span>
          </span>
          <span className="ml-auto text-[11.5px] text-encre-4">
            {auClavier
              ? "La scène a le clavier — Échap le relâche."
              : "Clique la scène pour lui donner le clavier. Le carnet et la barre restent joignables."}
          </span>
        </div>
      </section>

      {/* ── Le volet ──────────────────────────────────────────────────────── */}
      <aside
        data-volet-de-l-essai
        aria-label="Ce qu'il fait, et la scène"
        className="volet volet-colle defile flex w-[380px] shrink-0 flex-col gap-[14px] overflow-y-auto border-l border-trait bg-papier-cote p-[22px]"
      >
        <div
          role="tablist"
          aria-label="Ce qu'on règle"
          className="flex gap-[4px] self-start rounded-8 bg-carte p-[4px]"
        >
          {(
            [
              ["fait", "Ce qu'il fait"],
              ["scene", "La scène"],
            ] as const
          ).map(([clef, nom]) => (
            <button
              key={clef}
              type="button"
              role="tab"
              aria-selected={volet === clef}
              onClick={() => setVolet(clef)}
              className={[
                "flex h-[26px] items-center rounded-7 px-[14px] text-[12.5px] transition-colors duration-120",
                volet === clef
                  ? "bg-papier-cote font-medium text-encre"
                  : "text-encre-3 hover:text-encre",
              ].join(" ")}
            >
              {nom}
            </button>
          ))}
        </div>

        {volet === "fait" ? (
          <>
            <div className="flex items-baseline justify-between gap-[8px]">
              <span className="font-serif text-[25px] leading-[1.15] text-encre">
                Ce qu'il fait
              </span>
              <span className="mesure text-[11px] text-encre-4">
                {nomDeLaPose(demandee)}
                {direction ? ` · ${nomDeLaDirection(direction)}` : ""}
              </span>
            </div>

            {manque && (
              <div className="flex flex-col gap-[8px] rounded-8 border border-trait-echec bg-fond-echec p-[14px]">
                <p className="text-[13px] font-medium text-echec">
                  {nomDeLaPose(demandee)}
                  {direction ? ` vers ${nomDeLaDirection(direction)}` : ""} n'existe pas
                </p>
                <p className="text-[12px] leading-[1.5] text-encre-2">
                  Un rectangle plein tient sa place, et le personnage se déplace quand
                  même. Aucune autre animation ne la remplace : on croirait qu'elle est
                  faite.
                </p>
              </div>
            )}

            {manque && ailleurs.length > 0 && (
              <div className="flex flex-col gap-[8px]">
                <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                  ce qui existe pour {nomDeLaPose(demandee)}
                </span>
                {ailleurs.map(({ d, bande }) => (
                  <button
                    key={d.identifiant}
                    type="button"
                    disabled={bande === null}
                    onClick={() => setDirectionVoulue(d.identifiant)}
                    className="flex items-center justify-between gap-[8px] rounded-8 border border-trait bg-carte px-[14px] py-[8px] text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4 disabled:border-trait disabled:text-eteint disabled:hover:border-trait"
                  >
                    <span>vers {d.nom}</span>
                    <span className="mesure text-[11px] text-encre-4">
                      {bande ? `${bande.compte} images` : "rien"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[12.5px] leading-[1.5] text-encre-2">
              Cliquer une ligne, ou les touches 1 à 6, joue cette animation sur place.
              Se déplacer au clavier choisit la marche ou la course tout seul.
            </p>

            <div className="flex flex-col gap-[8px]">
              {ceQuIlFait.map((p) => (
                <button
                  type="button"
                  key={p.identifiant}
                  data-ce-qu-il-fait={p.identifiant}
                  aria-pressed={p.identifiant === demandee}
                  onClick={() => setPoseeVoulue(p.identifiant)}
                  className={[
                    "flex items-center gap-[8px] rounded-8 px-[14px] py-[8px] text-left transition-colors duration-120 hover:border-encre-4",
                    p.bande
                      ? p.identifiant === demandee
                        ? "border border-signal bg-carte"
                        : "border border-trait bg-carte"
                      : "border border-dashed border-pointille bg-carte",
                  ].join(" ")}
                >
                  {p.touche ? (
                    <Touche>{p.touche}</Touche>
                  ) : (
                    <span className="mesure text-[10.5px] text-eteint">—</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block text-[12.5px]",
                        p.bande
                          ? p.identifiant === demandee
                            ? "font-medium text-encre"
                            : "text-encre"
                          : "text-eteint",
                      ].join(" ")}
                    >
                      {p.nom}
                    </span>
                    <span
                      className={`block text-[11px] ${p.bande ? "text-encre-3" : "text-eteint"}`}
                    >
                      {p.bande
                        ? `${p.bande.compte} images · ${p.bande.cadence} i/s · ${dureeImageMs(p.bande.cadence)} ms${p.identifiant === demandee && !manque ? " · en cours" : ""}`
                        : `pas encore faite${direction ? ` vers ${nomDeLaDirection(direction)}` : ""}`}
                    </span>
                  </span>
                  {p.bande && (
                    <span aria-hidden className="text-[14px] leading-none text-ok">
                      ●
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                la direction
              </span>
              {sesDirections.length === 0 ? (
                <p className="text-[11.5px] leading-[1.45] text-encre-3">
                  Ce jeu ne déclare aucune direction : ses animations valent sous tous
                  les angles. Les règles du jeu sont l'endroit où l'on en déclare.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-[4px]">
                    {sesDirections.map((d) => (
                      <button
                        key={d.identifiant}
                        type="button"
                        aria-pressed={direction === d.identifiant}
                        onClick={() => setDirectionVoulue(d.identifiant)}
                        className={[
                          "h-[30px] rounded-7 border px-[14px] text-[12px] transition-colors duration-120",
                          direction === d.identifiant
                            ? "border-contour bg-carte font-medium text-encre"
                            : "border-trait text-encre-3 hover:text-encre",
                        ].join(" ")}
                      >
                        {d.nom}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11.5px] leading-[1.45] text-encre-3">
                    Z Q S D changent la direction en même temps que le déplacement. Ces
                    boutons servent quand on veut regarder une pose sans bouger.
                  </p>
                </>
              )}
            </div>

            <div className="mt-auto flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <button
                type="button"
                onClick={() => {
                  const pose = plan.find((p) => p.identifiant === demandee)
                  if (!pose) return
                  const angle = sesDirections.find((d) => d.identifiant === direction)
                  onAnimer(
                    personnage,
                    pose,
                    angle ? { identifiant: angle.identifiant, nom: angle.nom } : null,
                  )
                }}
                disabled={!plan.some((p) => p.identifiant === demandee)}
                className="h-[34px] rounded-7 bg-signal text-[13px] font-medium text-encre-sur-signal transition-colors duration-120 hover:opacity-90 disabled:bg-carte disabled:text-eteint"
              >
                Demander un clip pour {nomDeLaPose(demandee)}
                {direction ? ` · ${nomDeLaDirection(direction)}` : ""} ›
              </button>
              <p className="text-[11.5px] leading-[1.45] text-encre-4">
                Rien ne part d'ici. L'écran du clip s'ouvre avec cette pose et cette
                direction déjà remplies, et son bouton porte le prix avant qu'on
                commande.
              </p>
              <button
                type="button"
                onClick={onAnimations}
                className="h-[30px] rounded-7 border border-contour bg-carte text-[12.5px] text-encre-controle transition-colors duration-120 hover:border-encre-4"
              >
                Ses animations ›
              </button>
              <p className="text-[11.5px] leading-[1.45] text-encre-4">
                Pour en changer une, c'est là. Ici on ne fait que regarder.
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="font-serif text-[25px] leading-[1.15] text-encre">
              La scène
            </span>
            <p className="text-[12.5px] leading-[1.5] text-encre-2">
              Ce qui est autour du personnage ne change rien à ses images. C'est là pour
              juger à l'œil, et ça ne coûte rien.
            </p>

            <div className="flex flex-col gap-[8px]">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                le fond
              </span>
              <div className="grid grid-cols-4 gap-[4px]">
                {(["neutre", "clair", "damier", "jeu"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-label={`Fond ${NOM_DU_FOND[f]}`}
                    aria-pressed={fond === f}
                    onClick={() => setFond(f)}
                    disabled={f === "jeu" && !univers.fond}
                    style={f === "jeu" && univers.fond ? { background: univers.fond } : undefined}
                    className={[
                      "h-[34px] rounded-7 border transition-colors duration-120",
                      f === "damier" ? "damier-papier" : "",
                      f === "neutre" ? "bg-pourtour" : "",
                      f === "clair" ? "bg-carte" : "",
                      fond === f ? "border-signal" : "border-contour",
                      f === "jeu" && !univers.fond ? "bg-papier-cote" : "",
                    ].join(" ")}
                  />
                ))}
              </div>
              <span className="text-[11px] text-encre-3">
                {univers.fond
                  ? "gris neutre · clair · damier · la couleur de fond du jeu"
                  : "gris neutre · clair · damier — le jeu n'a pas encore de couleur de fond"}
              </span>
            </div>

            {(
              [
                ["la grille du jeu", grille, setGrille, "visible", "cachée"],
                ["le cadre de la case", cadre, setCadre, "visible", "caché"],
              ] as const
            ).map(([mot, valeur, poser, oui, non]) => (
              <div key={mot} className="flex items-center justify-between gap-[8px]">
                <span className="text-[12.5px] text-encre-2">{mot}</span>
                <div className="flex gap-[4px] rounded-8 bg-carte p-[4px]">
                  {([true, false] as const).map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={valeur === v}
                      onClick={() => poser(v)}
                      className={[
                        "flex h-[22px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                        valeur === v
                          ? "bg-papier-cote font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      {v ? oui : non}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-[12.5px] text-encre-2">la caméra</span>
                <div className="flex gap-[4px] rounded-8 bg-carte p-[4px]">
                  {(["cote", "dessus"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={camera === v}
                      onClick={() => setCameraVoulue(v)}
                      className={[
                        "flex h-[22px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                        camera === v
                          ? "bg-papier-cote font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      {v === "cote" ? "de côté" : "de dessus"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[11.5px] leading-[1.45] text-encre-3">
                {camera === "cote"
                  ? "De côté : il va à gauche et à droite, les pieds sur le sol."
                  : "De dessus : il se déplace sur le plan, dans tous les sens. Pas de sol, la grille du jeu dessine les cases."}
                {cameraVoulue === null ? " Choisi d'après la vue du jeu." : ""}
              </p>
            </div>

            {camera === "cote" && (
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-[12.5px] text-encre-2">le sol</span>
                <div className="flex gap-[4px] rounded-8 bg-carte p-[4px]">
                  {(["plat", "pente"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={sol === v}
                      onClick={() => setSol(v)}
                      className={[
                        "flex h-[22px] items-center rounded-7 px-[8px] text-[12px] transition-colors duration-120",
                        sol === v
                          ? "bg-papier-cote font-medium text-encre"
                          : "text-encre-3 hover:text-encre",
                      ].join(" ")}
                    >
                      {v === "plat" ? "plat" : "en pente"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(
              [
                ["vitesse de marche", vitesseMarche, setVitesseMarche],
                ["vitesse de course", vitesseCourse, setVitesseCourse],
              ] as const
            ).map(([mot, valeur, poser]) => (
              <label key={mot} className="flex items-center justify-between gap-[8px]">
                <span className="text-[12.5px] text-encre-2">{mot}</span>
                <span className="flex items-center gap-[4px] text-[11.5px] text-encre-3">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.5}
                    value={valeur}
                    onChange={(e) => poser(Math.max(0, Number(e.target.value) || 0))}
                    className="mesure h-[26px] w-[70px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-controle"
                  />
                  cases / s
                </span>
              </label>
            ))}

            <div className="flex flex-col gap-[8px] border-t border-trait pt-[14px]">
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
                un deuxième sujet
              </span>
              <select
                aria-label="Poser un deuxième sujet à côté"
                value={voisin}
                onChange={(e) => setVoisin(e.target.value)}
                className="h-[34px] rounded-7 border border-contour bg-carte px-[8px] text-[12.5px] text-encre-controle"
              >
                <option value="">aucun</option>
                {personnages
                  .filter((p) => p.identifiant !== personnage.identifiant)
                  .map((p) => (
                    <option key={p.identifiant} value={p.identifiant}>
                      {p.nom}
                    </option>
                  ))}
              </select>
              <p className="text-[11.5px] leading-[1.5] text-encre-3">
                Poser une créature à côté sert à une seule chose : vérifier que les
                tailles vont ensemble. Une grenouille à hauteur d'épaule se voit ici,
                pas sur une fiche.
              </p>
            </div>

            <p className="mt-auto border-t border-trait pt-[14px] text-[11.5px] leading-[1.5] text-encre-4">
              Aucun de ces réglages ne touche aux images du sujet, et aucun n'appelle le
              serveur. On peut tout essayer et tout défaire.
            </p>
          </>
        )}
      </aside>
    </div>
  )
}
