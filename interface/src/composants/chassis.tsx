// Le châssis : les quelques pièces que tout le reste réutilise.
// Elles portent les hauteurs de contrôle de `docs/DESIGN.md` § Spacing —
// c'est cette grille de densité, pas les marges, qui fait l'instrument.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react"
import { secondes } from "../api"
import { POINTILLE, useInfobulle } from "./Infobulle"

// ── Les crans de taille ─────────────────────────────────────────────────────
//
// « Les vignettes 1× / 2× / 4× sont les crans du zoom de la grille »
// (`docs/design-motifs.md` § L'écran Univers). **Un seul vocabulaire de taille dans tout le
// produit**, donc un seul endroit qui l'écrive : la grille d'assets s'en sert
// pour la largeur minimale d'une tuile, le tableau d'inspiration pour le nombre
// de colonnes qu'une carte occupe. Les deux contrôles ne cohabitent jamais —
// ils vivent sur deux écrans —, mais ils comptent pareil.

export type Zoom = 1 | 2 | 4
export const ZOOMS: readonly Zoom[] = [1, 2, 4]

/** La largeur minimale d'une tuile, par cran. 128 est la valeur de T3 : 1× ne
 *  change donc rien à ce qu'on regardait, le zoom s'ajoute au repos plutôt que
 *  de le redéfinir. */
export const CRANS: Record<Zoom, number> = { 1: 128, 2: 256, 4: 512 }

/** Ce que l'auteur lit — le multiplicateur, jamais le nombre de pixels. */
export const LIBELLES_ZOOM: Partial<Record<string, string>> = {
  "1": "1×",
  "2": "2×",
  "4": "4×",
}

/**
 * « Le grisé porte sa raison — jamais une infobulle. »
 *
 * Une ligne sœur permanente sous le contrôle indisponible : mono 10 px,
 * `--texte-3`, précédée d'un tiret de 8 px, avec un lien en `--signal` quand il
 * y a un endroit où aller. Le produit interdit de proposer puis de refuser :
 * l'apparence doit donc dire pourquoi sans qu'on ait à chercher.
 */
export function Raison({
  texte,
  ouAller,
  onAller,
}: {
  texte: string | null
  ouAller?: string
  onAller?: () => void
}) {
  if (!texte) return null
  return (
    <p className="mesure mt-1 flex items-center gap-1.5 text-[10px] leading-4 text-texte-3">
      <span aria-hidden className="inline-block h-px w-2 bg-texte-3" />
      <span>{texte}</span>
      {ouAller && onAller && (
        <button
          type="button"
          onClick={onAller}
          className="text-signal hover:text-signal-clair"
        >
          {ouAller} ›
        </button>
      )}
    </p>
  )
}

/**
 * « Le revers — l'actif qui porte son risque. »
 *
 * Le repli hors ligne est le seul endroit du produit où l'on propose puis
 * refuse : le catalogue est une photo, générer reste **actif**, et l'échec ne
 * survient qu'au moment du clic (US-95). C'est l'exception à `Raison`, et elle
 * se rend dans **la même fente, avec la même forme** — tiret de 8 px, mono
 * 10 px, lien `--signal` pour le geste. Ce qui change est le mot : le grisé dit
 * *pourquoi c'est fermé*, le revers dit *ce qui va casser*.
 *
 * En `--epingle` et non `--info` : arrêté à un instant, que le système ne
 * bougera pas tout seul, et que seul un geste de l'auteur relance — exactement
 * la définition que partagent « réglé à la main » et « interrompu ».
 * `docs/design-motifs.md`.
 */
export function Revers({
  texte,
  geste,
  onGeste,
  enCours = false,
}: {
  texte: string
  geste: string
  onGeste: () => void
  enCours?: boolean
}) {
  return (
    <p className="mesure mt-1 flex items-center gap-1.5 text-[10px] leading-4 whitespace-nowrap text-epingle">
      <span aria-hidden className="inline-block h-px w-2 bg-epingle" />
      <span>{texte}</span>
      <button
        type="button"
        onClick={onGeste}
        disabled={enCours}
        className="text-signal hover:text-signal-clair disabled:text-texte-3"
      >
        {enCours ? "…" : `${geste} ›`}
      </button>
    </p>
  )
}

export function EnTetePanneau({ children }: { children: ReactNode }) {
  return (
    <div className="mesure flex h-[30px] shrink-0 items-center border-b border-bord px-2 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
      {children}
    </div>
  )
}

/**
 * Le nom d'un réglage — et sa propre poignée d'explication.
 *
 * « Le libellé est la cible — aucun glyphe neuf » (`docs/design-motifs.md` §
 * L'infobulle explique, elle n'excuse jamais). Passer `aide` pose le pointillé
 * `--bord-fort` et branche le survol ; sans `aide`, le libellé est exactement
 * ce qu'il était, et **c'est le cas d'un réglage que le corpus ne documente pas
 * encore** : aucune marque, aucune bulle vide, rien qui casse.
 *
 * Ne jamais y faire passer une **raison** : ce qui refuse un geste vit dans une
 * fente permanente (`Raison`), et se survoler serait proposer puis refuser.
 */
export function Libelle({
  children,
  aide,
  eteint = false,
}: {
  children: ReactNode
  aide?: string
  /** Le libellé d'un contrôle qui ne porte rien — un champ de bible vide ou
   *  désactivé. Il descend d'un ton, et **c'est la seule variante permise** :
   *  un second gabarit de libellé serait un second endroit où poser le
   *  pointillé, donc un endroit où l'oublier. */
  eteint?: boolean
}) {
  const { presente, ancre, declencheurs, bulle } = useInfobulle(aide)
  // **`w-fit`, et c'est la poignée qui en dépend.** Un `<span>` posé dans un
  // conteneur flexible est *blockifié* — son `display` calculé vaut `block`,
  // quel que soit celui qu'on écrit. Dans une rangée il se dimensionne sur son
  // texte ; dans une **colonne**, `align-items: stretch` l'étire sur toute la
  // largeur du panneau. Mesuré à l'atelier : « Proportions » occupait 268 px
  // pour 60 px de mot, soit 208 px de zone morte qui ouvrait quand même la
  // bulle et allumait quand même le pointillé — à côté de « Modèle », content,
  // dans le même panneau. « Le libellé est la cible » ne tient que si la cible
  // *est* le libellé. Une largeur en `fit-content` neutralise l'étirement sans
  // toucher à l'alignement, donc sans défaire l'`items-baseline` des rangées.
  const base = `w-fit text-[11px] ${eteint ? "text-texte-3" : "text-texte-2"}`
  if (!presente) return <span className={base}>{children}</span>
  return (
    <>
      <span ref={ancre as Ref<HTMLSpanElement>} {...declencheurs} className={`${base} ${POINTILLE}`}>
        {children}
      </span>
      {bulle}
    </>
  )
}

// ── Le bloc repliable ───────────────────────────────────────────────────────
//
// « Un bloc replié ne se tait pas — il porte son réglage, en mono, à droite de
// son titre » (`docs/design-motifs.md` § Le bloc repliable). C'est cette ligne qui
// fait tout : le repli cesse d'être un rangement pour devenir un **résumé**, et
// un panneau plié se lit mieux que déplié.
//
// **L'état de repli est global et par bloc**, tenu ici et non dans un écran :
// il doit survivre au changement d'asset et à la fermeture de la fiche, qui se
// démonte. C'est la promesse d'US-37 — « fermer le panneau remet exactement où
// l'on était » — et personne ne veut gérer deux cents états de repli.

const ouverts = new Set<string>()
const abonnes = new Set<() => void>()

function abonner(prevenir: () => void) {
  abonnes.add(prevenir)
  return () => {
    abonnes.delete(prevenir)
  }
}

function prevenirTous() {
  abonnes.forEach((prevenir) => prevenir())
}

function basculer(cle: string) {
  if (ouverts.has(cle)) ouverts.delete(cle)
  else ouverts.add(cle)
  prevenirTous()
}

function ouvrir(cle: string) {
  if (ouverts.has(cle)) return
  ouverts.add(cle)
  prevenirTous()
}

/** Tout replier — l'état de repos du produit.
 *
 *  Le repli global vit dans ce module et non dans un écran, donc il survit à
 *  tout ce qui se démonte : c'est ce qu'on veut d'une image à l'autre, et c'est
 *  ce qu'on ne veut pas d'un essai à l'autre. Les essais d'écran le remettent à
 *  zéro dans leur `beforeEach`, comme ils remettent le flux et l'horloge. */
export function toutReplier() {
  if (ouverts.size === 0) return
  ouverts.clear()
  prevenirTous()
}

function useOuvert(cle: string) {
  return useSyncExternalStore(
    abonner,
    () => ouverts.has(cle),
    () => false,
  )
}

/**
 * Un repli qui n'est pas un `Bloc`, mais qui vit dans le même registre.
 *
 * Le dépliant « Ce qui partira » et le prompt négatif se replient sans être des
 * blocs de réglages : ils n'ont ni en-tête de rangée ni valeur résumée. Ils
 * n'en tenaient pas moins leur état chez eux, ce qui allait tant que le champ
 * de saisie ne se démontait jamais — la galerie était le fond du produit.
 *
 * **La V2.1 en fait un onglet, et le fond disparaît.** Aller poser un champ de
 * bible dans l'Univers puis revenir refermait le dépliant qu'on avait ouvert,
 * exactement le défaut que le registre existe pour empêcher : « fermer le
 * panneau remet exactement où l'on était » (US-37). Le registre est déjà
 * global, déjà remis à zéro par les essais, déjà abonné — il ne manquait que la
 * porte.
 */
export function usePli(cle: string): [boolean, () => void] {
  return [useOuvert(cle), () => basculer(cle)]
}

/** Ouvrir un pli sans le basculer — pour le geste qui *implique* de voir. */
export const ouvrirPli = ouvrir

/** La valeur d'un bloc replié. `null` — rien de posé — se dit par le tiret du
 *  produit, en `--texte-3` ; un réglage posé se dit en `--signal`, la couleur
 *  de ce qui est choisi partout ailleurs. */
function Valeur({ etat }: { etat: string | null | undefined }) {
  return (
    <span
      className={[
        "mesure ml-auto max-w-[60%] truncate pl-2 text-[9.5px]",
        etat ? "text-signal" : "text-texte-3",
      ].join(" ")}
    >
      {etat || "—"}
    </span>
  )
}

/**
 * Un bloc de réglages qui se replie.
 *
 * **La marque de repli est la valeur elle-même** : replié, l'en-tête porte le
 * réglage ; ouvert, il se tait, parce que la valeur est dans le bloc, sous les
 * yeux. Aucun glyphe neuf n'entre dans le produit — les deux candidats évidents
 * sont pris : le `+` en bout de rangée veut dire *nouvelle entrée* dans
 * l'arbre, et le triangle plein veut dire *favori* sur une tuile.
 *
 * La rangée fait 26 px, celle du § Spacing. Aucune hauteur neuve non plus.
 *
 * **Le repli est instantané**, et c'est le § Motion qui le tranche par sa
 * propre règle d'admission : un mouvement n'entre dans la liste close que si la
 * chose qui arrive n'a aucun autre moyen d'être remarquée. On a cliqué.
 */
export function Bloc({
  cle,
  titre,
  etat,
  mesure,
  aide,
  children,
}: {
  /** L'identité du bloc dans le repli global. Stable d'un asset à l'autre. */
  cle: string
  titre: string
  /** La clé de l'entrée du corpus, s'il y en a une.
   *
   *  **Un titre de bloc n'épingle pas** : son clic est déjà pris — il replie.
   *  Les gestes vont donc sur le bouton et non sur le titre, parce qu'un
   *  élément focalisable imbriqué dans un bouton est du HTML invalide et un
   *  piège au clavier ; le survol révèle, le focus du bouton aussi, et c'est
   *  tout ce que ce cas mérite. */
  aide?: string
  /** Ce que le bloc porte, dit en une ligne. `null` — rien de posé. */
  etat?: string | null
  /** Le fait que le bloc garde visible une fois **ouvert**. La droite de la
   *  rangée dit toujours un fait sur le bloc : replié c'est sa valeur, ouvert
   *  c'est ce qu'il veut qu'on garde sous les yeux en le réglant — « 24 au
   *  catalogue » pendant qu'on choisit un modèle. Les deux ne cohabitent
   *  jamais : ils occupent la même fente. */
  mesure?: string | null
  children: ReactNode
}) {
  const ouvert = useOuvert(cle)
  const infobulle = useInfobulle(aide, { epinglable: false })
  return (
    <section className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => basculer(cle)}
        aria-expanded={ouvert}
        {...infobulle.declencheurs}
        className="-mx-1 flex h-[26px] items-center rounded-[2px] px-1 text-left transition-colors duration-[80ms] hover:bg-fond-3"
      >
        <span
          ref={infobulle.ancre as Ref<HTMLSpanElement>}
          // `w-fit` pour la même raison que dans `Libelle` : la poignée est
          // bornée à son mot **quelle que soit l'orientation du parent**. Cette
          // rangée-ci est en `flex … items-center`, donc contente aujourd'hui —
          // la classe dit qu'elle le restera si la rangée devient une colonne.
          className={`w-fit text-[11px] text-texte-2 ${infobulle.presente ? POINTILLE : ""}`}
        >
          {titre}
        </span>
        {ouvert ? (
          mesure && (
            <span className="mesure ml-auto truncate pl-2 text-[9.5px] text-texte-3">
              {mesure}
            </span>
          )
        ) : (
          <Valeur etat={etat} />
        )}
      </button>
      {/* Hors du bouton, exprès : la bulle porte le lien « Le guide › », et un
          bouton dans un bouton est invalide — le clic du lien replierait le
          bloc au passage. Elle est en `fixed`, donc sa place à l'écran ne doit
          rien à l'endroit où elle est rendue. */}
      {infobulle.bulle}
      {ouvert && children}
    </section>
  )
}

export function Bouton({
  enfants,
  principal = false,
  inactif = false,
  onClick,
  titre,
}: {
  enfants: ReactNode
  principal?: boolean
  inactif?: boolean
  onClick?: () => void
  titre?: string
}) {
  const base =
    "h-[34px] rounded-[2px] px-3 text-[13px] transition-colors duration-[80ms] disabled:cursor-not-allowed"
  const couleurs = inactif
    ? "border border-bord bg-fond-2 text-texte-3"
    : principal
      ? "bg-signal text-fond-0 hover:bg-signal-clair font-medium"
      : "border border-bord-fort bg-fond-2 text-texte hover:bg-fond-3"
  return (
    <button
      type="button"
      title={titre}
      disabled={inactif}
      onClick={onClick}
      className={`${base} ${couleurs}`}
    >
      {enfants}
    </button>
  )
}

/** Un choix parmi peu — proportions, variations. Un segment indisponible est
 *  grisé, jamais caché : l'absence n'apprend rien, le grisé apprend pourquoi. */
export function Segments<T extends string | number>({
  valeurs,
  valeur,
  onChange,
  indisponibles = [],
  libelles,
}: {
  valeurs: readonly T[]
  valeur: T
  onChange: (v: T) => void
  indisponibles?: readonly T[]
  /** Ce que l'auteur lit, quand ce n'est pas ce que l'API transporte. Le nom
   *  d'un moteur voyage sans accent — il traverse du JSON et des chemins — mais
   *  ce qui s'affiche est français, comme tout le reste de l'écran. */
  libelles?: Partial<Record<string, string>>
}) {
  return (
    <div className="flex gap-1">
      {valeurs.map((v) => {
        const choisi = v === valeur
        const grise = indisponibles.includes(v)
        return (
          <button
            key={String(v)}
            type="button"
            disabled={grise}
            onClick={() => onChange(v)}
            className={[
              // `whitespace-nowrap` : un segment qui se replie sur deux lignes
              // sort de la hauteur de sa bande, et une bande de la liste
              // fermée ne grandit pas. Trouvé au navigateur en tenant E5, sur
              // « côte à côte » dans un comparateur devenu étroit.
              "mesure h-[26px] min-w-[34px] shrink-0 whitespace-nowrap rounded-[2px] border px-2 text-[11.5px] transition-colors duration-[80ms]",
              grise
                ? "border-bord bg-fond-2 text-texte-3"
                : choisi
                  ? "border-signal bg-signal/13 text-signal"
                  : "border-bord bg-fond-2 text-texte-2 hover:bg-fond-3",
            ].join(" ")}
          >
            {libelles?.[String(v)] ?? v}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Un réglage continu — la tolérance d'un détourage, l'occupation d'une case.
 *
 * Le seul contrôle ajouté au châssis en T2, et il l'est pour une raison de
 * comportement : viser une valeur dans un champ de nombre avant de voir ce
 * qu'elle donne est l'inverse du geste. On fait glisser, et on regarde.
 *
 * **`onChange` bouge la valeur, `onFini` la pose.** Écrit le 27 août 2026, à la
 * mesure : une retouche qui touche le détourage coûte 1,5 à 2,3 s au serveur,
 * pas les 28 ms de la queue de recette sur lesquels T2 avait promis « chaque
 * réglage répond sans attente perceptible ». Un appel par cran de curseur, ce
 * sont vingt-deux appels sérialisés pour un glissement de la tolérance, soit
 * une demi-minute de file pendant laquelle l'image défile des valeurs que
 * personne n'a demandé à voir. Le curseur envoie donc **ce qu'on a lâché, pas
 * ce qu'on a traversé** — la valeur suit la main sans attendre, le rendu suit
 * le relâchement. Un cran de segment reste un choix, et part tout de suite.
 *
 * Il n'introduit aucune couleur : rail en `--bord`, curseur en `--signal`,
 * valeur en mono à droite comme toute mesure du produit.
 */
export function Curseur({
  valeur,
  min,
  max,
  pas = 1,
  unite = "",
  onChange,
  onFini,
  inactif = false,
  crans,
}: {
  valeur: number
  min: number
  max: number
  pas?: number
  unite?: string
  /** **Les seules valeurs où quelque chose change.** Un curseur qui s'arrête à
   *  chaque pour cent sur une échelle qui n'a qu'une trentaine d'états
   *  distincts fait croire à la main qu'elle règle quelque chose. Quand la
   *  liste est donnée, la valeur saute au cran le plus proche — et le nombre
   *  affiché reste celui du cran, jamais celui de la position de la main.
   *
   *  Sans liste, le curseur est celui de T2 : rien ne change pour les six
   *  autres réglages du produit, qui n'ont pas de crans à eux. */
  crans?: readonly number[]
  onChange: (v: number) => void
  /** Le relâchement — souris, doigt ou touche. Sans lui, `onChange` fait tout,
   *  ce qui reste juste pour un réglage qui ne coûte rien à celui d'en face. */
  onFini?: (v: number) => void
  inactif?: boolean
}) {
  /** Le cran le plus proche, ou la valeur telle quelle. */
  const arrondir = (brute: number) =>
    crans && crans.length
      ? crans.reduce((a, b) => (Math.abs(b - brute) < Math.abs(a - brute) ? b : a))
      : brute
  const fini = (e: { currentTarget: HTMLInputElement }) =>
    onFini?.(arrondir(Number(e.currentTarget.value)))
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        disabled={inactif}
        onChange={(e) => onChange(arrondir(Number(e.target.value)))}
        onPointerUp={fini}
        onKeyUp={fini}
        className="curseur h-[26px] min-w-0 flex-1"
      />
      <span
        className={[
          "mesure w-[46px] shrink-0 text-right text-[10px]",
          inactif ? "text-texte-3" : "text-texte-2",
        ].join(" ")}
      >
        {valeur}
        {unite}
      </span>
    </div>
  )
}

/**
 * Une place de la recette est-elle remplie ou vide ?
 *
 * Pas une case à cocher du système : un titre de section cliquable, dont l'état
 * se lit à la couleur du texte et à un liseré. La recette a sept places — cinq
 * quand ce commentaire a été écrit, les contours et la main s'y sont ajoutés —,
 * et autant de cases à cocher alignées dans un panneau de 380 px
 * ressembleraient à un formulaire — or ce panneau est un établi.
 *
 * **C'est le cas particulier du bloc repliable**, et la rangée porte deux actes
 * qui ne sont pas le même : le carré dit *posé ou pas* — ça change l'asset —,
 * le titre dit *montré ou pas* — ça ne change que l'écran. Une étape qui n'est
 * pas posée n'a rien à replier : toute sa rangée la pose, comme avant. Mesuré
 * le 27 août 2026 : cinq étapes posées tenaient 522 px dans une colonne qui en
 * offre 650, et le seul moyen de les garder posées était de les subir.
 *
 * **Poser une étape l'ouvre** — c'est le même geste, on demande ses contrôles
 * en la posant. Rien d'autre ne s'ouvre tout seul : l'en-tête dit déjà l'état,
 * donc rien n'a besoin de s'ouvrir pour se faire remarquer.
 */
export function Etape({
  cle,
  titre,
  active,
  onBasculer,
  etat,
  raison,
  aide,
  children,
}: {
  /** L'identité de l'étape dans le repli global. Stable d'un asset à l'autre :
   *  on ne veut pas rouvrir cinq blocs à chaque image regardée. */
  cle: string
  titre: string
  active: boolean
  onBasculer: () => void
  /** La clé de l'entrée du corpus. **Une étape est un réglage**, et le plus
   *  structurant de tous : elle décide qu'une place de la recette est occupée.
   *  Documenter `tache minimale` sans documenter `Nettoyage des bords`
   *  laisserait le parent plus opaque que son enfant.
   *
   *  N'épingle pas, comme le titre d'un `Bloc` : le clic de la rangée est déjà
   *  pris — il pose l'étape, ou la replie. */
  aide?: string
  /** Le réglage posé, dit en une ligne — ce que l'en-tête porte une fois
   *  replié. Ignoré tant que l'étape n'est pas posée : il n'y a rien à dire. */
  etat?: string | null
  raison?: string | null
  children?: ReactNode
}) {
  const grise = Boolean(raison)
  const ouvert = useOuvert(cle)
  const montre = active && !grise && ouvert
  const infobulle = useInfobulle(aide, { epinglable: false })

  // **Le pointillé reste sur une étape grisée.** Le § L'infobulle le tranche :
  // *pourquoi c'est fermé* n'est pas *à quoi ça sert*, et les deux cohabitent —
  // la raison dans sa fente, permanente ; l'explication au survol.
  const nom = (
    <span
      ref={infobulle.ancre as Ref<HTMLSpanElement>}
      className={`truncate ${infobulle.presente ? POINTILLE : ""}`}
    >
      {titre}
    </span>
  )

  const carre = (
    <span
      aria-hidden
      className={[
        "inline-block h-[9px] w-[9px] shrink-0 rounded-[2px] border",
        active && !grise ? "border-signal bg-signal" : "border-bord-fort bg-fond-2",
      ].join(" ")}
    />
  )
  const style = [
    "mesure flex h-[26px] items-center gap-2 text-left text-[9.5px] tracking-[.11em] uppercase transition-colors duration-[80ms]",
    grise ? "text-texte-3" : active ? "text-signal" : "text-texte-3 hover:text-texte-2",
  ].join(" ")

  return (
    <section className="flex flex-col gap-1.5 border-t border-bord pt-2 first:border-t-0 first:pt-0">
      {active && !grise ? (
        // Posée : le carré la dépose, le reste de la rangée la replie. Le carré
        // fait 9 px mais sa cible en fait 26 — la hauteur de rangée du produit.
        <div className="flex items-center">
          <button
            type="button"
            onClick={onBasculer}
            aria-label={`Retirer ${titre} de la recette`}
            className="-ml-1 flex h-[26px] w-[22px] items-center justify-center rounded-[2px] transition-colors duration-[80ms] hover:bg-fond-3"
          >
            {carre}
          </button>
          <button
            type="button"
            onClick={() => basculer(cle)}
            aria-expanded={ouvert}
            {...infobulle.declencheurs}
            className={`${style} -mr-1 min-w-0 flex-1 rounded-[2px] pr-1 hover:bg-fond-3`}
          >
            {nom}
            {!ouvert && <Valeur etat={etat} />}
          </button>
        </div>
      ) : (
        // Pas posée, ou grisée : rien à replier, toute la rangée la pose.
        //
        // **`aria-disabled` et non `disabled`, et c'est le motif qui l'exige.**
        // Un contrôle grisé garde son pointillé — *pourquoi c'est fermé* n'est
        // pas *à quoi ça sert* —, or un `<button disabled>` ne dispatche aucun
        // événement de souris, pas même sur ses enfants : l'explication d'une
        // étape grisée serait donc la seule du produit à ne jamais s'ouvrir,
        // et c'est précisément celle qu'on cherche à ce moment-là. Le refus
        // reste entier : le clic ne fait rien, et la raison est dans sa fente,
        // juste dessous.
        <button
          type="button"
          aria-disabled={grise}
          onClick={() => {
            if (grise) return
            ouvrir(cle)
            onBasculer()
          }}
          {...infobulle.declencheurs}
          className={style}
        >
          {carre}
          {nom}
        </button>
      )}
      {/* Hors des boutons, exprès : la bulle porte le lien « Le guide › », et un
          bouton dans un bouton est invalide. Elle est en `fixed`, donc sa place
          à l'écran ne doit rien à l'endroit où elle est rendue. */}
      {infobulle.bulle}
      {grise ? <Raison texte={raison ?? null} /> : montre ? children : null}
    </section>
  )
}

// ── La jauge ────────────────────────────────────────────────────────────────

/**
 * La jauge du produit — **déterminée**, `docs/DESIGN.md` § Motion : « ça
 * travaille, et voilà où ça en est ». Le seul mouvement continu du produit, et
 * il n'y en a qu'un : une génération dans la grille et une retouche dans la
 * fiche portent la même barre, aux mêmes 2 px, dans la même couleur.
 *
 * Elle ne ment pas sur ce qu'elle sait : la barre avance vers l'attente
 * mesurée, puis ralentit sans jamais atteindre le bout, parce qu'elle ne sait
 * pas quand ça finira.
 *
 * Deux réglages, parce que les deux attentes du produit n'ont pas la même
 * échelle. Une génération court dix à vingt secondes et on peut quitter
 * l'écran : elle porte son **compteur**, et c'est lui qui dit s'il faut
 * attendre. Une retouche court une à deux secondes, la main encore sur le
 * curseur : `00:01 / ~00:02` y serait un nombre qui change deux fois. Elle
 * porte donc un **seuil** à la place — rien ne paraît sous 240 ms, la borne du
 * § Motion, parce qu'une queue de recette répond en 29 ms et qu'y faire
 * clignoter une jauge serait pire que de ne rien montrer.
 */
export function Jauge({
  demarreLe,
  attendue,
  compteur = true,
  seuil = 0,
}: {
  /** L'instant du départ, en secondes Unix. `null` — pas encore parti. */
  demarreLe: number | null
  /** Ce que cette opération-là a mis la dernière fois, en secondes. */
  attendue: number
  /** Le temps écoulé et l'attente, en mono sous la barre. */
  compteur?: boolean
  /** Sous cette durée, la jauge ne paraît pas du tout. En secondes. */
  seuil?: number
}) {
  const [ecoule, setEcoule] = useState(() => depuis(demarreLe))

  useEffect(() => {
    setEcoule(depuis(demarreLe))
    const battement = setInterval(() => setEcoule(depuis(demarreLe)), 250)
    return () => clearInterval(battement)
  }, [demarreLe])

  // Pas encore parti : la tuile tient sa place, mais il n'y a rien à mesurer.
  const enAttente = demarreLe === null

  if (seuil > 0 && !enAttente && ecoule < seuil) return null

  return (
    <>
      {compteur && (
        <span className="mesure text-[8.5px] text-texte-2">
          {enAttente ? "en file" : `${secondes(ecoule)} / ~${secondes(attendue)}`}
        </span>
      )}
      <span className="block h-[2px] w-full overflow-hidden bg-bord">
        <span
          className="block h-full bg-signal transition-[width] duration-[240ms] ease-linear"
          style={{ width: `${part(ecoule, attendue, enAttente) * 100}%` }}
        />
      </span>
    </>
  )
}

const depuis = (horodatage: number | null) =>
  horodatage === null ? 0 : Math.max(0, Date.now() / 1000 - horodatage)

/**
 * Où en est la jauge, entre 0 et 1.
 *
 * Linéaire jusqu'à 85 % au moment de l'attente estimée, puis asymptotique :
 * chaque seconde supplémentaire avance moins que la précédente, et le bout
 * n'est jamais atteint. Une jauge qui se colle à 100 % avant l'arrivée dit une
 * chose fausse ; celle-ci dit « ça dépasse, et ça continue ».
 */
function part(ecoule: number, attendue: number, enAttente: boolean): number {
  if (enAttente || attendue <= 0) return 0
  const fraction = ecoule / attendue
  if (fraction <= 1) return 0.85 * fraction
  return 0.85 + 0.14 * (1 - 1 / fraction)
}

// ── La zone de texte qui grandit avec ce qu'on y écrit ──────────────────────

/**
 * Un champ de texte long dont la hauteur suit son contenu, entre un plancher et
 * un plafond.
 *
 * **Pourquoi il existe** — ajouté le 31 août 2026. Le produit écrivait ses
 * textes les plus longs dans des boîtes de deux ou trois lignes : la
 * description d'un personnage, qui repart avec **chaque** image de ce
 * personnage et décide donc de ce qu'on paie, se composait par un hublot de
 * quatre lignes sur vingt-quatre — mesuré, 733 signes dont un sixième visible.
 * Le document de présentation du jeu, 4 350 mots, se corrigeait dans trois
 * lignes. Écrire long dans une fente courte n'est pas un inconfort : on ne
 * relit pas, donc on ne corrige pas, et le texte le plus cher du produit est
 * celui qu'on regarde le moins.
 *
 * **Un plafond, et pas seulement un plancher.** Sans lui, une note de quatre
 * mille mots repousserait tout ce qui la suit hors de l'écran — c'est
 * exactement le défaut que la carte de texte du tableau avait payé le 31 août
 * 2026, et qu'`aspect-square` avait réparé. Au-delà du plafond, la zone défile,
 * et la barre de 9 px du produit dit qu'il y a plus.
 *
 * La hauteur se mesure au navigateur (`scrollHeight`), jamais estimée depuis le
 * nombre de signes : la largeur du champ, la police et les retours à la ligne
 * décident, et eux seuls savent.
 */
export function ZoneTexte({
  valeur,
  onChange,
  onBlur,
  lignesMin = 3,
  lignesMax = 16,
  className = "",
  ...reste
}: {
  valeur: string
  onChange: (valeur: string) => void
  onBlur?: () => void
  /** La hauteur au repos, en lignes. Le champ n'est jamais plus court. */
  lignesMin?: number
  /** Là où il s'arrête de grandir et se met à défiler. */
  lignesMax?: number
  className?: string
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "onBlur" | "rows" | "className"
>) {
  const zone = useRef<HTMLTextAreaElement>(null)

  // `useLayoutEffect` et non `useEffect` : la hauteur est posée avant que le
  // navigateur peigne, sinon le champ saute d'une frappe à l'autre.
  useLayoutEffect(() => {
    const noeud = zone.current
    if (!noeud) return
    // La ligne se mesure sur le champ lui-même — sa police, son interligne —
    // plutôt que sur une constante qui vieillirait à la première retouche de
    // style. `18` n'est employé que si le navigateur ne rend pas encore de
    // hauteur de ligne calculable, ce qui n'arrive qu'en essai.
    const ligne = parseFloat(getComputedStyle(noeud).lineHeight) || 18
    const bords = noeud.offsetHeight - noeud.clientHeight
    const plancher = ligne * lignesMin
    const plafond = ligne * lignesMax
    // Remettre à zéro d'abord : `scrollHeight` ne redescend jamais tout seul
    // en dessous de la hauteur déjà posée, et le champ ne rétrécirait plus
    // quand on efface.
    noeud.style.height = "0px"
    const voulue = Math.min(Math.max(noeud.scrollHeight, plancher), plafond)
    noeud.style.height = `${voulue + bords}px`
    noeud.style.overflowY = noeud.scrollHeight > plafond ? "auto" : "hidden"
  }, [valeur, lignesMin, lignesMax])

  return (
    <textarea
      ref={zone}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`defile resize-none ${className}`}
      {...reste}
    />
  )
}

/** Le point de la barre d'état. Seul endroit du produit avec un rayon plein. */
export function Point({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[5px] w-[5px] rounded-full"
      style={{ background: couleur }}
    />
  )
}
