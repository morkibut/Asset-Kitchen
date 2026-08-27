// L'infobulle — « elle explique, elle n'excuse jamais ».
//
// `docs/DESIGN.md` § L'infobulle explique, elle n'excuse jamais. Le test qui la
// borne est binaire : *son absence empêche-t-elle un geste ?* Oui — fente
// permanente sous le contrôle, jamais un survol (voir `Raison`). Non — survol,
// jamais une fente. Ce fichier ne rend que le second cas ; il ne doit jamais
// porter une raison.
//
// **Le libellé est la cible, et aucun glyphe neuf n'entre.** Le produit compte
// trois glyphes et le bloc repliable a déjà refusé le chevron pour ne pas en
// ouvrir un quatrième ; trente points d'interrogation dans les panneaux
// seraient ce quatrième glyphe, multiplié. Le nom du réglage est déjà à
// l'écran : il devient sa propre poignée, souligné d'un pointillé `--bord-fort`
// — le token de la poignée de barre de défilement, même métier, *il y a plus
// ici*.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { explication } from "../aide"
import { ouvrirGuide } from "./Guide"

/** 280 px — `docs/DESIGN.md`. Au-delà de trois lignes, c'est le guide qu'on
 *  veut, et le guide est à un clic. */
const LARGEUR = 280
/** Ce qu'on garde entre la bulle et le bord de l'écran. */
const MARGE = 8
/** « Assez long pour traverser un panneau sans rien déclencher, assez court
 *  pour battre le clic. » La durée du menu de carte, réemployée. */
const REPOS = 200
/** Le temps de traverser la gouttière sans perdre la bulle. */
const GRACE = 150

type Place = { x: number; y: number; hauteurMax: number }

/**
 * Ce qu'il faut pour poser une infobulle sur un élément.
 *
 * Rend trois choses parce que les deux cas d'usage du produit ne mettent pas
 * les gestes au même endroit :
 *
 * - `ancre` — l'élément que la bulle désigne, et **autour duquel la place se
 *   mesure**. C'est la règle du menu de carte : mesurer autour du panneau
 *   plutôt qu'autour de l'ancre le fait basculer en croyant tenir.
 * - `declencheurs` — les gestes. Sur un libellé seul, ils vont sur le libellé.
 *   Dans un en-tête de bloc, ils vont sur **le bouton**, parce qu'un élément
 *   focalisable imbriqué dans un bouton est du HTML invalide et un piège au
 *   clavier.
 * - `bulle` — le panneau lui-même, en `fixed`, à rendre n'importe où.
 */
export function useInfobulle(
  cle: string | undefined,
  { epinglable = true }: { epinglable?: boolean } = {},
) {
  const entree = explication(cle)
  const ancre = useRef<HTMLElement | null>(null)
  const bulleRef = useRef<HTMLDivElement | null>(null)
  const minuterie = useRef<number | null>(null)

  const [visible, setVisible] = useState(false)
  const [epingle, setEpingle] = useState(false)
  const [place, setPlace] = useState<Place | null>(null)

  const annuler = () => {
    if (minuterie.current !== null) {
      window.clearTimeout(minuterie.current)
      minuterie.current = null
    }
  }

  const montrer = useCallback(() => {
    annuler()
    minuterie.current = window.setTimeout(() => setVisible(true), REPOS)
  }, [])

  const cacher = useCallback(() => {
    annuler()
    minuterie.current = window.setTimeout(() => {
      // « On ne vole pas un menu à un clavier en train de s'en servir » : une
      // bulle épinglée ne se referme qu'au clic ou à Échap.
      setVisible((v) => (epingle ? v : false))
    }, GRACE)
  }, [epingle])

  const fermer = useCallback(() => {
    annuler()
    setEpingle(false)
    setVisible(false)
  }, [])

  useEffect(() => () => annuler(), [])

  // Échap lâche l'épingle, comme partout dans le produit.
  useEffect(() => {
    if (!epingle) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [epingle, fermer])

  // **Elle s'ouvre vers le centre, jamais vers le bord.** Corollaire du menu de
  // carte — *jamais sur l'image qu'il règle* — appliqué un cran plus loin : le
  // panneau se pose du côté de la grille, seule surface assez large et seule
  // chose que personne ne lit au moment où il lit une explication.
  //
  // **Et il est borné par l'écran, jamais par son contenu** (§ Layout). Sans
  // plancher, exprès : un plancher le rendrait plus haut que la place offerte,
  // donc rogné, donc son pied inatteignable.
  useLayoutEffect(() => {
    if (!visible || !ancre.current) return
    const r = ancre.current.getBoundingClientRect()
    const versLaDroite = r.left + r.width / 2 < window.innerWidth / 2
    const brut = versLaDroite ? r.right + 10 : r.left - LARGEUR - 10
    const x = Math.max(MARGE, Math.min(brut, window.innerWidth - LARGEUR - MARGE))
    const hauteurMax = window.innerHeight - MARGE * 2
    const haut = bulleRef.current?.offsetHeight ?? 0
    let y = r.top - 4
    if (haut > 0 && y + haut > window.innerHeight - MARGE) {
      y = Math.max(MARGE, window.innerHeight - MARGE - haut)
    }
    setPlace({ x, y, hauteurMax })
  }, [visible, epingle])

  if (!entree) {
    return { presente: false as const, ancre, declencheurs: {}, bulle: null }
  }

  const identifiant = `aide-${(cle ?? "").replace(/\W/g, "-")}`

  const declencheurs = {
    onMouseEnter: montrer,
    onMouseLeave: cacher,
    onFocus: () => setVisible(true),
    onBlur: () => {
      if (!epingle) setVisible(false)
    },
    ...(epinglable
      ? {
          // Le clic épingle : une explication de quatre lignes se lit sans que
          // la main reste immobile, et on peut vouloir en copier un mot.
          onClick: (e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            annuler()
            if (epingle) {
              setEpingle(false)
              setVisible(false)
            } else {
              setEpingle(true)
              setVisible(true)
            }
          },
          tabIndex: 0,
          role: "button" as const,
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              setEpingle((p) => !p)
              setVisible((v) => !epingle || !v)
            }
          },
        }
      : {}),
    "aria-describedby": visible ? identifiant : undefined,
  }

  const style: CSSProperties = place
    ? {
        left: place.x,
        top: place.y,
        width: LARGEUR,
        maxHeight: place.hauteurMax,
      }
    : { left: -9999, top: 0, width: LARGEUR }

  const bulle = visible ? (
    <div
      ref={bulleRef}
      id={identifiant}
      role="tooltip"
      style={style}
      onMouseEnter={annuler}
      onMouseLeave={cacher}
      // `paraitre` — **la même animation que le menu de carte**, pas une
      // seconde. Le § Motion garde une liste close, et sa rangée « ce qui
      // paraît sans clic » a désormais deux locataires, pas deux entrées.
      // Une animation CSS plutôt qu'un fondu piloté en JS, aussi : un
      // `requestAnimationFrame` ne se déclenche pas dans un onglet qui ne
      // compose pas ses images, et la bulle resterait à `opacity: 0`.
      className={[
        "paraitre defile fixed z-50 overflow-y-auto rounded-[2px] border border-bord-fort bg-fond-1 px-3 pt-2.5 pb-2",
        "shadow-[0_6px_20px_rgba(0,0,0,.45)]",
      ].join(" ")}
    >
      {/* Ce que c'est — une phrase, jamais deux. */}
      <p className="text-[12px] leading-[1.5] text-texte">{entree.quoi}</p>
      {/* Ce que ça change — la ligne obligatoire, celle qui porte tout le
          poids. « Rien à la génération. » est une réponse, et la plus utile. */}
      <p className="mt-2 text-[12px] leading-[1.5] text-texte-2">{entree.change}</p>
      {/* D'où ça sort — en mono, parce que l'origine d'un défaut est un fait
          sur le monde, et que ce produit rend tout fait en mono. */}
      <div className="mesure mt-2.5 flex items-center justify-between gap-3 border-t border-bord pt-2 text-[10px] text-texte-3">
        <span className="truncate">{entree.origine}</span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            fermer()
            ouvrirGuide(cle)
          }}
          className="shrink-0 text-signal hover:text-signal-clair"
        >
          Le guide ›
        </button>
      </div>
    </div>
  ) : null

  return { presente: true as const, ancre, declencheurs, bulle, epingle }
}

/**
 * Le pointillé — la seule marque que ce motif ajoute au châssis au repos.
 *
 * `--bord-fort`, `underline-offset: 3px`. Même token que la poignée de barre de
 * défilement, et pour exactement le même métier : *il y a plus ici*. `--bord`
 * est sous le seuil où l'œil le trouve, `--bord-fort` est au-dessus quand on
 * cherche et en dessous quand on travaille. C'est aussi le trait que le
 * navigateur pose sous `<abbr>` depuis toujours — la seule décoration du
 * produit qui se comprenne sans être apprise.
 */
export const POINTILLE =
  "cursor-help underline decoration-dotted decoration-bord-fort underline-offset-[3px] hover:decoration-texte-3"
