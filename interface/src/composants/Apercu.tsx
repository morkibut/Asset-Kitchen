// L'aperçu — regarder une image en grand, et rien de plus.
//
// **Un geste, aucun contrôle.** Le pointeur se pose sur une vignette, Espace, et
// l'image emplit l'écran ; Espace encore, Échap, ou un clic, et elle s'en va.
// Rien ne paraît sur la tuile, aucune loupe, aucun bouton : c'est ce qui permet
// de traverser trente images à la file sans jamais rien viser. La grille est une
// planche contact, et une planche contact se regarde à la loupe — la loupe ne se
// range pas dessus.
//
// **L'aperçu est la vignette en grand, et rien d'autre.** Il ne décide pas quelle
// image montrer : il reprend l'adresse que la surface affiche déjà. Un second
// endroit qui répondrait « rendu ou brut ? » finirait par répondre autrement que
// la grille, et on jugerait alors une image que personne ne regarde. D'où
// `imageAsset` ci-dessous, **le seul endroit du produit qui nomme l'adresse de
// l'image d'un asset** — la tuile, la fiche et l'aperçu la lisent tous les trois.
//
// **Une note a un aperçu depuis E7, et c'est la même réponse par l'autre bout.**
// Tant que la carte grandissait avec son texte, l'agrandir ne montrait rien de
// plus, et `sujetCarte` rendait `null`. Depuis que la carte de texte a la
// hauteur de son cran de zoom — sans quoi une note de quatre mille mots pousse
// la première image à quatre mille pixels de défilement —, son texte est
// **coupé**, et il faut un endroit où le lire en entier. C'est ici, et l'aperçu
// s'y pose en **colonne de prose** au lieu d'une image : la seconde et dernière
// exception à *aucune largeur maximale* (`docs/DESIGN.md` § Layout).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { api, type Asset, type Carte } from "../api"

/** Ce qu'un aperçu montre. Une image, son nom, et ses dimensions **mesurées**. */
export type Sujet = {
  /** L'identité de ce qui est sous le pointeur — c'est elle, et pas l'adresse,
   *  qui dit si le pointeur a quitté ce qu'il visait. */
  cle: string
  src: string
  titre: string
  /** Zéro veut dire « pas mesuré », et l'aperçu se tait alors sur le facteur.
   *  « Une mesure ne s'affiche que si elle a été prise. » */
  largeur: number
  hauteur: number
  /** Le voisinage de pixel de la vignette, repris tel quel : un sprite se
   *  regarde au plus proche voisin — c'est ce qu'on vient compter en l'ouvrant
   *  —, une inspiration collée s'interpole, parce que ses pixels ne sont pas la
   *  matière du travail. Aucune décision neuve : les deux grilles rendent déjà
   *  leurs images comme ça. */
  pixelise: boolean
  /** Le texte à lire en entier, quand le sujet n'est pas une image. L'aperçu se
   *  pose alors en colonne de prose bornée et défile, au lieu de zoomer. */
  prose?: string
}

/**
 * L'adresse de l'image d'un asset — **le seul endroit qui la nomme**.
 *
 * Une image traitée se lit par son **empreinte** : le rendu change sous la même
 * adresse à chaque cran de curseur, et c'est elle qui fait chercher la neuve.
 * Une image sans recette se lit par son **emplacement**, l'adresse de la grille.
 * Un asset sans recette n'a qu'une image : sa bascule *brut* ne change alors
 * rien, et il n'y a aucune raison de la demander par deux adresses.
 */
export const imageAsset = (asset: Asset, brut = false): string =>
  asset.traite
    ? api.rendu(asset.identifiant, asset.empreinte, brut)
    : api.image(asset.generation, asset.rang)

/**
 * L'adresse de l'image d'un asset **pour une case de grille** — réduite.
 *
 * Elle vit à côté d'`imageAsset` parce que c'est la même question posée d'un
 * cran plus loin : *quelle adresse, pour quel emploi*. La grille en a un à
 * elle, et il n'a rien à voir avec celui de la fiche — on y regarde cent
 * images à cent quarante-cinq pixels, et le fichier entier n'y sert jamais.
 *
 * **L'aperçu, lui, garde `sujetAsset`** : Espace ouvre l'image en grand, et
 * c'est très exactement le moment où l'on veut le fichier entier.
 */
export const vignetteAsset = (asset: Asset, cote: number): string =>
  api.vignette(asset.identifiant, asset.empreinte, cote)

export const sujetAsset = (asset: Asset, brut = false): Sujet => ({
  // Le brut et le rendu sont deux images du même asset : les distinguer ici
  // évite qu'un aperçu ouvert sur l'un se croie ouvert sur l'autre.
  cle: brut ? `${asset.identifiant}·brut` : asset.identifiant,
  src: imageAsset(asset, brut),
  titre: asset.label,
  largeur: asset.traite && !brut ? asset.rendu_largeur : asset.largeur,
  hauteur: asset.traite && !brut ? asset.rendu_hauteur : asset.hauteur,
  pixelise: true,
})

/** Combien de mots un texte porte. **Compté, jamais estimé** : c'est le chiffre
 *  que le pied d'une carte de texte annonce, et un chiffre affiché est un
 *  chiffre mesuré. */
export const mots = (texte: string): number =>
  texte.trim() ? texte.trim().split(/\s+/).length : 0

export const sujetCarte = (carte: Carte): Sujet | null => {
  if (carte.genre === "texte")
    return carte.texte.trim()
      ? {
          cle: carte.identifiant,
          src: "",
          titre: carte.note || carte.groupe || "note",
          // Zéro des deux côtés : une note n'a pas de dimensions, et l'aperçu
          // se tait alors sur le facteur — c'est déjà sa règle pour une image
          // qu'on n'a pas mesurée.
          largeur: 0,
          hauteur: 0,
          pixelise: false,
          prose: carte.texte,
        }
      : null
  return carte.genre === "image" && carte.montrable
    ? {
        cle: carte.identifiant,
        src: api.imageCarte(carte.identifiant, carte.empreinte),
        titre: carte.note || carte.source || carte.groupe || "carte",
        largeur: carte.largeur,
        hauteur: carte.hauteur,
        pixelise: false,
      }
    : null
}

// ── Ce que le pointeur vise, et ce qui est à l'écran ────────────────────────
//
// Deux choses, et une seule est un état de rendu. **Ce que le pointeur vise ne
// fait rien paraître** : personne n'a besoin de le savoir avant d'appuyer sur
// Espace, donc aucun abonné, aucun rendu, et survoler cent tuiles ne coûte rien.
// Ce qui est ouvert, lui, se rend — et suit le patron du guide, un magasin de
// module, parce que la touche est écoutée au-dessus de tous les écrans et que
// les vignettes vivent quatre étages plus bas.

let vise: Sujet | null = null
let ouvert: Sujet | null = null
const abonnes = new Set<() => void>()

/**
 * Est-on **en train** d'écrire ?
 *
 * Un champ focalisé ne suffit pas, et c'est le piège de T9 pris par l'autre
 * bout : *le champ de prompt de l'atelier prend le focus au démarrage et ne le
 * rend jamais*. Un garde qui ne regarderait que lui rendrait Espace mort dans
 * l'atelier — c'est-à-dire à l'endroit exact où il sert, la grille qu'on vient
 * de remplir. Vérifié en écrivant l'essai : l'aperçu ne s'ouvrait pas une fois.
 *
 * Il faut donc les deux : un champ où l'on peut écrire, **et** que la dernière
 * chose faite ait été d'y écrire. Poser le pointeur sur une image est l'autre
 * geste, et il rend la touche à l'image ; taper un seul signe la rend au champ.
 */
let ecrit = false

const prevenir = () => abonnes.forEach((f) => f())

const champFocalise = () => {
  const actif = document.activeElement
  return (
    actif instanceof HTMLElement &&
    (actif.isContentEditable || ["INPUT", "TEXTAREA"].includes(actif.tagName))
  )
}

/** Le pointeur est entré sur quelque chose qui a une image. */
export function viser(sujet: Sujet | null) {
  vise = sujet
  ecrit = false
}

/**
 * Le pointeur est sorti — **si c'est bien de là qu'il sort**.
 *
 * La clé est demandée pour ça : deux vignettes voisines rendent leur `enter` et
 * leur `leave` dans un ordre que personne ne garantit, et un `leave` en retard
 * effacerait la carte sur laquelle le pointeur vient d'arriver.
 */
export function lacher(cle: string | undefined) {
  if (cle !== undefined && vise?.cle === cle) vise = null
}

export function ouvrirApercu(sujet: Sujet) {
  ouvert = sujet
  prevenir()
}

export function fermerApercu() {
  if (!ouvert) return
  ouvert = null
  prevenir()
}

/** Remettre l'aperçu à zéro — les essais d'écran, comme pour le guide. */
export function reinitialiserApercu() {
  vise = null
  ouvert = null
  ecrit = false
  prevenir()
}

/**
 * Ce qu'une surface branche pour être ouvrable en grand.
 *
 * Le démontage lâche ce qu'il visait : une carte peut disparaître pendant qu'on
 * la survole — supprimée, filtrée, tirée sur la toile —, et `pointerleave` ne
 * part jamais dans ce cas-là. Sans cette ligne, Espace ouvrirait l'aperçu de ce
 * qui n'est plus là.
 */
export function useVisee(sujet: Sujet | null) {
  const dernier = useRef(sujet)
  dernier.current = sujet
  useEffect(() => () => lacher(dernier.current?.cle), [])
  return {
    entrer: () => viser(dernier.current),
    sortir: () => lacher(dernier.current?.cle),
  }
}

/**
 * L'aperçu ouvert, et la touche qui l'ouvre. **Appelé une fois, tout en haut.**
 *
 * **En capture sur la fenêtre, et il arrête ce qu'il consomme.** Trois autres
 * écoutes de touche vivent dans le produit — Échap du Guide, Échap de la
 * Découpe, Ctrl+Z de la toile — et l'aperçu les couvre toutes : un Échap qui
 * fermerait l'aperçu *et* l'écran derrière lui ferait deux gestes pour une
 * pression. La capture passe avant tout le reste, `stopPropagation` interrompt
 * la course, et ce qu'on ne consomme pas continue son chemin intact — un Espace
 * sans rien sous le pointeur défile le guide comme avant.
 *
 * **Un champ de saisie garde Espace tant qu'on y écrit**, et « y écrire » se
 * mesure au dernier geste, pas au focus — voir `ecrit` ci-dessus. Sous un
 * aperçu ouvert, le garde ne s'applique plus du tout : c'est la leçon de la
 * toile, mot pour mot, *on ne tape pas dans un champ qu'un écran recouvre*.
 */
export function useApercu(): Sujet | null {
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return
      const espace = evenement.key === " " || evenement.key === "Spacebar"
      if (!espace && evenement.key !== "Escape") {
        // Toute autre touche reçue dans un champ **est** de l'écriture : elle
        // rend la barre d'espace suivante au champ, et c'est le seul endroit
        // où `ecrit` s'allume.
        if (champFocalise()) ecrit = true
        return
      }

      const consommer = () => {
        evenement.preventDefault()
        evenement.stopPropagation()
      }

      // Ouvert : les deux touches le ferment, et rien d'autre ne les voit.
      if (ouvert) {
        consommer()
        fermerApercu()
        return
      }
      // Fermé : Échap appartient à qui le veut, Espace à ce qu'on écrit.
      if (!espace) return
      if (ecrit && champFocalise()) return
      if (!vise) return
      // `preventDefault` fait ici un second travail : un bouton qui a le focus
      // — la tuile qu'on vient de cliquer — s'active à la barre d'espace, et
      // deux gestes partiraient pour une pression.
      consommer()
      ouvrirApercu(vise)
    }
    window.addEventListener("keydown", surTouche, true)
    return () => window.removeEventListener("keydown", surTouche, true)
  }, [])

  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    () => ouvert,
    () => null,
  )
}

// ── L'écran ─────────────────────────────────────────────────────────────────

/** Ce qu'on laisse entre l'image et le bord de l'écran — `lg` de l'échelle
 *  d'espacement de `docs/DESIGN.md`, et aucune valeur neuve. */
const MARGE = 24

/** Le plafond du zoom. Seize fois l'ajustement suffit à compter les pixels d'un
 *  sprite : au-delà, on ne regarde plus une image, on regarde un carré. */
const ZOOM_MAX = 16

/** Ce qui sépare un clic d'un glissement — **le même seuil que la bande d'un
 *  îlot** (`Toile.tsx`), parce que c'est la même question posée à la même main. */
const SEUIL_PRISE = 3

/** La molette : un cran de souris rend `deltaY` ≈ 100, ce qui fait ici un
 *  facteur de 1,16. Exponentielle et non additive — sans quoi un pavé tactile,
 *  qui envoie vingt petits deltas là où la souris en envoie un gros, zoomerait
 *  vingt fois plus vite pour le même geste de la main. */
const SENSIBILITE = 0.0015

/** Firefox compte la molette en **lignes** (`deltaMode` 1) là où les autres
 *  comptent en pixels. Sans cette conversion, le même cran y vaut trois
 *  centièmes de ce qu'il vaut ailleurs, et la molette paraît morte. */
const PAS_LIGNE = 16
const PAS_PAGE = 400

/** L'ajustement : l'image entière, centrée. C'est l'état d'ouverture, et celui
 *  où l'on revient dès que le zoom redescend — un déplacement gardé sous une
 *  image qui tient tout entière n'aurait rien à décaler. */
const AJUSTE = { zoom: 1, x: 0, y: 0 }

const borner = (zoom: number) => Math.min(ZOOM_MAX, Math.max(1, zoom))

export function Apercu({ sujet, onFermer }: { sujet: Sujet; onFermer: () => void }) {
  const scene = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState({ l: 0, h: 0 })
  const [vue, setVue] = useState(AJUSTE)
  const prise = useRef<{ x: number; y: number; de: typeof AJUSTE; ecart: number } | null>(
    null,
  )

  // **Une largeur se lit à la demande.** Au montage et au redimensionnement de
  // la fenêtre, et il n'y a pas d'autre moment : l'aperçu est posé sur l'écran
  // entier, donc rien d'autre que la fenêtre ne peut changer sa place. Pas de
  // `ResizeObserver` — il ne livre rien à un onglet qui ne compose pas ses
  // images, et ce piège s'est déjà refermé quatre fois dans ce dépôt.
  const mesurer = useCallback(() => {
    const boite = scene.current?.getBoundingClientRect()
    setPlace({
      l: Math.max(0, (boite?.width ?? 0) - 2 * MARGE),
      h: Math.max(0, (boite?.height ?? 0) - 2 * MARGE),
    })
  }, [])

  useLayoutEffect(() => {
    mesurer()
  }, [mesurer])

  useEffect(() => {
    window.addEventListener("resize", mesurer)
    return () => window.removeEventListener("resize", mesurer)
  }, [mesurer])

  // **La molette s'écoute à la main, et non passivement.** React pose ses
  // écoutes de `wheel` en passif à la racine : `preventDefault` y est ignoré, et
  // la page derrière l'aperçu défilerait pendant qu'on zoome.
  useEffect(() => {
    const noeud = scene.current
    if (!noeud) return
    const surMolette = (evenement: WheelEvent) => {
      evenement.preventDefault()
      const boite = noeud.getBoundingClientRect()
      // Le point visé, en écart au centre de la scène : c'est lui qui doit
      // rester sous le pointeur — zoomer sur le centre de l'écran obligerait à
      // rattraper au déplacement ce que la molette vient de faire fuir.
      const cx = evenement.clientX - (boite.left + boite.width / 2)
      const cy = evenement.clientY - (boite.top + boite.height / 2)
      const delta =
        evenement.deltaY *
        (evenement.deltaMode === 1 ? PAS_LIGNE : evenement.deltaMode === 2 ? PAS_PAGE : 1)
      setVue((avant) => {
        const zoom = borner(avant.zoom * Math.exp(-delta * SENSIBILITE))
        if (zoom === avant.zoom) return avant
        if (zoom === 1) return AJUSTE
        const k = zoom / avant.zoom
        return { zoom, x: cx - k * (cx - avant.x), y: cy - k * (cy - avant.y) }
      })
    }
    noeud.addEventListener("wheel", surMolette, { passive: false })
    return () => noeud.removeEventListener("wheel", surMolette)
  }, [])

  const mesure = sujet.largeur > 0 && sujet.hauteur > 0
  const ajuste =
    mesure && place.l > 0 && place.h > 0
      ? Math.min(place.l / sujet.largeur, place.h / sujet.hauteur)
      : 0
  const facteur = ajuste * vue.zoom
  const rendu = { imageRendering: sujet.pixelise ? "pixelated" : "auto" } as const

  if (sujet.prose)
    return (
      <div
        role="dialog"
        aria-modal
        aria-label="Aperçu"
        className="fixed inset-0 z-50 flex flex-col bg-fond-0/92"
      >
        {/* **Une colonne de prose bornée à 504 px, et elle défile.** C'est la
            seconde et dernière surface du produit qui a le droit à une largeur
            maximale, et elle l'a pour la raison exacte qui borne le Guide : la
            prose est la seule matière du produit qui *perde* à recevoir de la
            largeur. Ouvrir une note de trois paragraphes sur 1 600 px la rend
            illisible (`docs/DESIGN.md` § Layout).

            **Et la borne s'écrit en pixels, jamais en `ch`** : un `ch` vaut la
            largeur du chiffre zéro, l'un des signes les plus larges de la
            police — `72ch` fait 637 px, où tiennent environ 107 lettres. */}
        <div
          data-apercu-prose
          onPointerDown={(evenement) => {
            // Le clic « à côté » ferme, comme sur une image ; le clic *dans* la
            // colonne ne ferme pas, parce qu'on y sélectionne du texte.
            if (evenement.target === evenement.currentTarget) onFermer()
          }}
          className="defile min-h-0 flex-1 overflow-y-auto px-6 py-10"
        >
          <p className="mx-auto max-w-[504px] text-[13.5px] leading-relaxed whitespace-pre-wrap text-texte">
            {sujet.prose}
          </p>
        </div>
        <footer className="flex h-[26px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4">
          <span className="min-w-0 truncate text-[11.5px] text-texte" title={sujet.titre}>
            {sujet.titre}
          </span>
          <div className="mesure ml-auto flex shrink-0 items-center gap-3 text-[10px] text-texte-3">
            <span>{mots(sujet.prose)} mots</span>
            <span>Espace ou Échap · fermer</span>
          </div>
        </footer>
      </div>
    )

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Aperçu"
      className="fixed inset-0 z-50 flex flex-col bg-fond-0/92"
    >
      <div
        ref={scene}
        data-apercu-scene
        // **Un clic ferme, un glissement déplace**, et c'est la distance qui les
        // sépare. L'aperçu ne porte aucun contrôle : rien d'autre qu'une sortie
        // ne peut être voulu par un clic, donc il n'y a aucune zone morte à
        // apprendre — « à côté » est partout.
        onPointerDown={(evenement) => {
          if (evenement.button !== 0) return
          // **Le geste s'écrit avant la capture, jamais après.** C'est la leçon
          // déjà payée sur la bande d'un îlot : la capture lève `NotFoundError`
          // dès que le pointeur n'est pas celui qu'elle croit, et elle lève
          // **avant** la ligne qui suit. Prise en second, elle ne peut plus
          // faire disparaître le geste sans un mot.
          prise.current = { x: evenement.clientX, y: evenement.clientY, de: vue, ecart: 0 }
          evenement.currentTarget.setPointerCapture(evenement.pointerId)
        }}
        onPointerMove={(evenement) => {
          const en_cours = prise.current
          if (!en_cours) return
          const dx = evenement.clientX - en_cours.x
          const dy = evenement.clientY - en_cours.y
          en_cours.ecart = Math.max(en_cours.ecart, Math.hypot(dx, dy))
          if (en_cours.ecart < SEUIL_PRISE) return
          setVue((avant) =>
            avant.zoom === 1
              ? avant
              : { ...avant, x: en_cours.de.x + dx, y: en_cours.de.y + dy },
          )
        }}
        onPointerUp={() => {
          const en_cours = prise.current
          prise.current = null
          // Rien ne relâche la capture : elle se rend d'elle-même au
          // `pointerup`, et un `releasePointerCapture` de plus lèverait dès que
          // le pointeur a déjà été rendu — avant la ligne qui ferme.
          if (en_cours && en_cours.ecart < SEUIL_PRISE) onFermer()
        }}
        className={[
          "relative min-h-0 flex-1 overflow-hidden",
          vue.zoom > 1 ? "cursor-grab active:cursor-grabbing" : "",
        ].join(" ")}
      >
        {facteur > 0 ? (
          // **Le cadre *est* l'image** : sa taille est calculée, elle n'est pas
          // déléguée à `object-contain`. C'est la leçon du cadre de la Découpe —
          // une boîte qui ment décale ce qu'on pose dessus, et ici c'est le
          // damier qui dirait une transparence au mauvais endroit.
          <div
            className="damier damier-apercu absolute top-1/2 left-1/2"
            style={{
              width: sujet.largeur * facteur,
              height: sujet.hauteur * facteur,
              transform: `translate(-50%, -50%) translate(${vue.x}px, ${vue.y}px)`,
            }}
          >
            <img
              src={sujet.src}
              alt={sujet.titre}
              draggable={false}
              className="h-full w-full select-none"
              style={rendu}
            />
          </div>
        ) : (
          // **Sans mesure, on laisse le navigateur contenir.** Zéro n'est pas une
          // dimension, c'est l'absence de mesure : l'aperçu montre quand même
          // l'image, il se tait seulement sur le facteur.
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <img
              src={sujet.src}
              alt={sujet.titre}
              draggable={false}
              className="damier damier-apercu max-h-full max-w-full object-contain select-none"
              style={rendu}
            />
          </div>
        )}
      </div>

      {/* 26 px — la hauteur de la barre d'état, à la place de la barre d'état.
          Aucune hauteur neuve, et l'œil retrouve les mesures là où il les lit
          d'habitude. */}
      <footer className="flex h-[26px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4">
        <span className="min-w-0 truncate text-[11.5px] text-texte" title={sujet.titre}>
          {sujet.titre}
        </span>
        <div className="mesure ml-auto flex shrink-0 items-center gap-3 text-[10px] text-texte-3">
          {mesure && (
            <span>
              {sujet.largeur}×{sujet.hauteur}
              {ajuste > 0 && ` · ${Math.round(facteur * 100)} %`}
            </span>
          )}
          <span>molette · zoom</span>
          <span>Espace ou Échap · fermer</span>
        </div>
      </footer>
    </div>
  )
}
