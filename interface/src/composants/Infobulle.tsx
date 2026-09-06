// L'infobulle — « elle explique, elle n'excuse jamais ».
//
// `docs/design-motifs.md` § L'infobulle explique, elle n'excuse jamais. Le test qui la
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
/** Ce qui sépare la bulle du panneau dont elle sort. */
const ECART = 10

/** **L'attribut qui dit « je suis un panneau de réglages ».**
 *
 *  Une colonne de réglages, et rien d'autre : celle de l'atelier, celle de
 *  l'univers, la fiche, la découpe, les personnages, et le panneau des
 *  réglages. Une barre d'outils n'en est pas une — elle traverse l'écran, donc
 *  « hors du panneau » n'y voudrait rien dire —, et le champ de prompt non
 *  plus.
 *
 *  **Déclaré, jamais deviné.** Chercher « le premier ancêtre qui ressemble à un
 *  panneau » aurait marché jusqu'au jour où quelqu'un pose une bordure ailleurs,
 *  et la bulle aurait alors basculé sans que rien ne le dise. */
export const PANNEAU = { "data-panneau": "" } as const

type Place = { x: number; y: number; hauteurMax: number }

/** Un rectangle, réduit à ce dont le placement a besoin. */
export type Cadre = { left: number; right: number; top: number }

/**
 * Où poser la bulle. **Pure, et c'est pour ça qu'elle est vérifiable** (R4).
 *
 * Même raison que les trois fonctions de la toile : jsdom ne met rien en page,
 * donc un essai qui monterait l'écran et mesurerait le recouvrement lirait des
 * rectangles nuls et passerait toujours. Sortie d'ici, la règle s'éprouve sur
 * de vrais rectangles ; ce que l'écran doit prouver de son côté est autre
 * chose — que chaque panneau de réglages se déclare, et ça, jsdom le voit.
 *
 * `cadre` est le **panneau de réglages** qui porte l'ancre — pas la bulle, qui
 * ne se mesure jamais elle-même —, ou l'ancre quand il n'y en a pas. `ancre` ne
 * sert qu'à la verticale : la bulle s'aligne sur ce qu'elle explique, pas sur
 * le haut du panneau.
 */
export function placer(
  cadre: Cadre,
  ancre: Cadre,
  fenetre: { largeur: number; hauteur: number },
  hauteurBulle = 0,
): Place {
  // **Le côté le plus large gagne**, et non un côté préféré : un panneau collé
  // au bord gauche n'a rien à sa gauche, et un panneau posé au milieu de
  // l'écran — celui des réglages — a les deux.
  const versLaDroite = fenetre.largeur - cadre.right >= cadre.left
  const brut = versLaDroite ? cadre.right + ECART : cadre.left - LARGEUR - ECART
  const x = Math.max(MARGE, Math.min(brut, fenetre.largeur - LARGEUR - MARGE))
  const hauteurMax = fenetre.hauteur - MARGE * 2
  let y = ancre.top - 4
  if (hauteurBulle > 0 && y + hauteurBulle > fenetre.hauteur - MARGE) {
    y = Math.max(MARGE, fenetre.hauteur - MARGE - hauteurBulle)
  }
  return { x, y, hauteurMax }
}

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

  // **Elle sort du panneau de réglages qui porte l'ancre, pas de la moitié
  // d'écran** (R4).
  //
  // La règle d'origine — s'ouvrir vers le centre de la fenêtre — visait le bon
  // corollaire du menu de carte : *jamais sur ce qu'il règle*. Elle était juste
  // à l'atelier, où la moitié opposée **est** la grille, et fausse partout où
  // l'écran n'est que du réglage : à l'univers, aux réglages, dans la fiche, la
  // surface d'à côté est encore du réglage, et la bulle atterrissait dessus.
  //
  // Mesurée autour du panneau de réglages, elle se pose là où il n'y a rien à
  // cliquer dans les deux cas : à l'atelier, juste après la colonne des
  // réglages, donc sur la grille comme avant ; ailleurs, hors du panneau
  // qu'elle explique.
  //
  // **Ce qui change est le cadre, pas ce qu'on mesure.** La règle d'`ancre`
  // tient toujours : la place se mesure autour de ce qui est **à l'écran**, et
  // jamais autour de la bulle, dont la hauteur dépend de ce qu'on vient d'y
  // mettre. C'est pour ça que `hauteurBulle` ne sert qu'à la remonter du bas,
  // et jamais à choisir son côté.
  //
  // Sans panneau déclaré — la barre d'outils, le champ de prompt —, l'ancre
  // tient ce rôle, et le calcul retombe sur ce qu'il faisait.
  //
  // **Et il est borné par l'écran, jamais par son contenu** (§ Layout). Sans
  // plancher, exprès : un plancher le rendrait plus haut que la place offerte,
  // donc rogné, donc son pied inatteignable.
  useLayoutEffect(() => {
    if (!visible || !ancre.current) return
    const r = ancre.current.getBoundingClientRect()
    const panneau = ancre.current.closest("[data-panneau]")
    setPlace(
      placer(
        panneau ? panneau.getBoundingClientRect() : r,
        r,
        { largeur: window.innerWidth, hauteur: window.innerHeight },
        bulleRef.current?.offsetHeight ?? 0,
      ),
    )
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
          className="shrink-0 text-ancien-signal hover:text-ancien-signal-clair"
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
