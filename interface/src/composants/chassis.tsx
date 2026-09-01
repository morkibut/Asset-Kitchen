// Le châssis : les quelques pièces que tout le reste réutilise.
// Elles portent les hauteurs de contrôle de `docs/DESIGN.md` § Spacing —
// c'est cette grille de densité, pas les marges, qui fait l'instrument.

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type Ref,
} from "react"
import { quantite, secondes, type Modele, type Reserve } from "../api"
import { POINTILLE, useInfobulle } from "./Infobulle"

/** Comment un modèle se dit dans une liste déroulante (F1).
 *
 *  **Le fournisseur devant, toujours.** Deux fournisseurs peuvent proposer un
 *  modèle du même nom — le relevé du 31 août a trouvé les modèles de Leonardo
 *  hébergés chez Cloudflare —, et deux lignes identiques dans un menu déroulant
 *  font du choix un tirage au sort. C'est écrit ici, une fois, parce que ces
 *  listes sont trois et qu'une quatrième viendra.
 *
 *  Le nom du catalogue porte déjà l'éditeur quand il en a un — `Meta: Muse
 *  Image` —, donc on ne le répète pas : ce qu'on ajoute est **à qui l'appel se
 *  paie**, qui est une autre question. */
export function libelleModele(modele: Modele): string {
  return modele.fournisseur ? `${modele.fournisseur} · ${modele.nom}` : modele.nom
}

/** Ce qui reste chez un fournisseur, **et d'où le chiffre vient** (F2).
 *
 *  Écrit ici parce que deux écrans le disent — celui où l'on choisit un modèle
 *  et celui qui confirme un appel — et qu'ils doivent dire *la même chose*.
 *  C'est la règle payée en écrivant E13 : deux calculs à deux endroits ont
 *  annoncé $0,0128 et $0,0160 pour le même appel, à trois centimètres l'un de
 *  l'autre.
 *
 *  **Trois phrases possibles, et la première est la plus fréquente.** Aucun
 *  fournisseur du produit n'annonce d'allocation aujourd'hui : Pollinations
 *  limite une cadence, pas un nombre. Écrire « il reste 0 » serait faux —
 *  *rien* ne reste à épuiser. On dit alors ce qui est parti, et depuis quand.
 */
export function phrasesDeReserve(reserve: Reserve): string[] {
  const dit: string[] = []
  const releve =
    reserve.source === "fournisseur"
      ? "relevé chez le fournisseur"
      : "compté ici, sur les appels partis de cette machine"

  if (reserve.reste === null) {
    dit.push(
      `ce fournisseur n'annonce aucune réserve — ${quantite(
        reserve.consomme,
        reserve.unite,
      )} parti${reserve.consomme >= 2 ? "s" : ""}${
        reserve.renouvellement ? ` depuis ${reserve.renouvellement}` : ""
      }, ${releve}.`,
    )
  } else {
    dit.push(
      `il reste ${quantite(reserve.reste, reserve.unite)} sur ${quantite(
        reserve.plafond ?? 0,
        reserve.unite,
      )}${
        reserve.renouvellement ? `, renouvelés à ${reserve.renouvellement}` : ""
      } — ${releve}.`,
    )
  }

  if (reserve.cadence_s)
    dit.push(
      `un appel toutes les ${reserve.cadence_s} secondes, pas davantage — c'est une cadence, pas un quota.`,
    )

  // **Ce qui manquerait pour finir ce lot-ci**, annoncé avant qu'il ne parte.
  // Posé par l'écran qui confirme seulement : celui où l'on choisit ne sait pas
  // encore ce qui partira.
  if (reserve.manque)
    dit.push(
      `il manquerait ${quantite(
        reserve.manque,
        reserve.unite,
      )} pour finir ce lot — la réserve n'y suffit pas.`,
    )

  return dit
}

/** Les mêmes phrases, posées à l'écran. Le manque passe en épinglé : c'est le
 *  seul des trois qui demande une décision — attendre demain, ou payer. */
export function LigneReserve({ reserve }: { reserve: Reserve }) {
  return (
    <p className="mesure text-[9.5px] leading-4 text-texte-3">
      {phrasesDeReserve(reserve).map((phrase, rang) => (
        <span
          key={phrase}
          className={
            rang === phrasesDeReserve(reserve).length - 1 && reserve.manque
              ? "text-epingle"
              : undefined
          }
        >
          {rang > 0 ? " " : ""}
          {phrase}
        </span>
      ))}
    </p>
  )
}

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
  plusieursRangees = false,
}: {
  valeurs: readonly T[]
  valeur: T
  onChange: (v: T) => void
  indisponibles?: readonly T[]
  /** Ce que l'auteur lit, quand ce n'est pas ce que l'API transporte. Le nom
   *  d'un moteur voyage sans accent — il traverse du JSON et des chemins — mais
   *  ce qui s'affiche est français, comme tout le reste de l'écran. */
  libelles?: Partial<Record<string, string>>
  /** Autorise la suite à passer à la ligne quand elle est trop longue pour sa
   *  colonne. **Faux par défaut, et c'est voulu** : dans une bande de hauteur
   *  fermée — la barre d'outils —, une deuxième rangée sortirait de la bande.
   *
   *  **Mesuré au navigateur le 31 août 2026**, sur la cible de la table de
   *  grille : neuf segments réclament 347 px et la colonne n'en offre que 224,
   *  barre de défilement verticale déduite. Le débordement ne se voyait pas
   *  comme un défaut — le panneau se mettait simplement à défiler de côté, et
   *  **les deux plus grandes valeurs, 128 et 256, tombaient hors de l'écran**.
   *  Un réglage qu'on ne peut pas atteindre n'existe pas. Sur deux rangées la
   *  suite tient — six puis trois — et le défilement latéral disparaît.
   *
   *  **Le croquis les montre sur une rangée, et ce n'est pas une contradiction
   *  à corriger** : il pose son libellé *au-dessus* des segments, qui disposent
   *  alors de toute la colonne, et il les dessine plus petits que ceux du
   *  produit. L'écran, lui, met le libellé *à côté*, comme tous ses autres
   *  réglages. À cette largeur-là, aucune taille de segment ne fait tenir neuf
   *  valeurs sur une rangée — vérifié au navigateur avant d'en arriver là. */
  plusieursRangees?: boolean
}) {
  return (
    <div className={plusieursRangees ? "flex flex-wrap gap-1" : "flex gap-1"}>
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
 * **Et sa valeur s'écrit** (U3, 1<sup>er</sup> septembre 2026). Le geste
 * d'origine reste le bon — on fait glisser, on regarde — mais il ne suffit pas
 * quand on connaît déjà le nombre : refaire à la souris un réglage qu'on a noté
 * sur l'image d'à côté est une punition, et aucun logiciel d'image ne l'impose.
 * Le champ est à droite, à la place où la valeur s'écrivait déjà ; **la frappe
 * pendant qu'on tient le curseur le remplit sans qu'on ait à le viser**, comme
 * ailleurs. Entrée valide, Échap rend la valeur d'avant, quitter le champ vaut
 * Entrée.
 *
 * **Un chiffre écrit vaut un relâchement** : un seul envoi, jamais un par
 * frappe. C'est la règle de T2, appliquée à l'autre façon de régler.
 *
 * Il n'introduit aucune couleur : rail en `--bord`, curseur en `--signal`,
 * valeur en mono à droite comme toute mesure du produit.
 */
/** Le nom du réglage qu'on est en train de rendre (U3).
 *
 *  **Une seule ligne à écrire plutôt que dix-sept.** Le champ où une valeur
 *  s'écrit a besoin d'un nom pour être trouvable — cinq champs de nombre dans
 *  une colonne se ressemblent tous —, et ce nom est déjà écrit à gauche du
 *  contrôle, dans la rangée qui le porte. Le lui faire redire à chaque emploi
 *  aurait fabriqué dix-sept occasions de le laisser diverger du libellé visible. */
export const NomDuReglage = createContext<string | undefined>(undefined)

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
  libelle,
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
  /** Le nom du réglage, pour le champ où sa valeur s'écrit (U3). Sans lui le
   *  champ s'appelle *valeur*, ce qui suffit à le trouver mais pas à savoir
   *  lequel on tient quand il y en a cinq dans la colonne. */
  libelle?: string
}) {
  /** Le cran le plus proche, ou la valeur telle quelle. */
  const arrondir = (brute: number) =>
    crans && crans.length
      ? crans.reduce((a, b) => (Math.abs(b - brute) < Math.abs(a - brute) ? b : a))
      : brute
  const fini = (e: { currentTarget: HTMLInputElement }) =>
    onFini?.(arrondir(Number(e.currentTarget.value)))

  // ── Le champ où la valeur s'écrit (U3) ──────────────────────────────────
  //
  // **`null` tant qu'on n'écrit pas.** Le champ montre alors la valeur du
  // curseur, si bien que les deux disent toujours la même chose sans qu'un état
  // ait à les tenir d'accord. Il ne prend une valeur à lui que pendant la
  // frappe, qui est un état de passage.
  const [ecrit, setEcrit] = useState<string | null>(null)
  // **Ce qu'on a ramené, et il se dit.** Une valeur hors bornes n'est pas
  // refusée — un champ qui rejette une frappe oblige à deviner ce qu'il
  // accepte —, elle est ramenée, et la ligne dessous dit laquelle. Elle part à
  // la frappe suivante.
  const [ramene, setRamene] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)
  const nom = libelle ?? useContext(NomDuReglage)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseFloat(texte.replace(",", ".").replace(/[^\d.-]/g, ""))
    if (!Number.isFinite(lu)) return
    const borne = Math.max(min, Math.min(max, lu))
    const pose = arrondir(borne)
    if (pose !== lu)
      setRamene(
        borne !== lu
          ? `ramené à ${pose}${unite} — les bornes sont ${min} et ${max}`
          : `ramené à ${pose}${unite} — c'est le cran le plus proche`,
      )
    else setRamene(null)
    // **Un chiffre écrit vaut un relâchement** : la valeur bouge et se pose
    // dans le même geste, un seul envoi. `onChange` seul laisserait le réglage
    // à l'écran sans jamais l'appliquer sur les places qui attendent `onFini`.
    onChange(pose)
    onFini?.(pose)
  }

  return (
    <div className="flex flex-col gap-1">
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
          // **La frappe pendant qu'on tient le curseur remplit le champ**
          // (U3), sans qu'on ait eu à le viser — le geste des logiciels
          // d'image. Les touches qui font vivre le curseur lui-même — les
          // flèches, Origine, Fin — ne sont pas détournées.
          onKeyDown={(e) => {
            if (!/^[0-9]$/.test(e.key)) return
            e.preventDefault()
            setEcrit(e.key)
            setRamene(null)
            champ.current?.focus()
          }}
          className="curseur h-[26px] min-w-0 flex-1"
        />
        <input
          ref={champ}
          type="text"
          inputMode="numeric"
          aria-label={nom ? `${nom}, en chiffres` : "Valeur, en chiffres"}
          disabled={inactif}
          value={ecrit ?? `${valeur}${unite}`}
          onChange={(e) => {
            setEcrit(e.target.value)
            setRamene(null)
          }}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              valider((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).blur()
            }
            // Échap rend la valeur d'avant, comme partout ailleurs.
            if (e.key === "Escape") {
              setEcrit(null)
              setRamene(null)
            }
          }}
          // **Quitter le champ vaut Entrée.** Sans quoi une valeur tapée puis
          // abandonnée resterait à l'écran sans agir : le champ dirait une
          // chose et l'image en montrerait une autre.
          onBlur={(e) => ecrit !== null && valider(e.target.value)}
          className={[
            "mesure w-[46px] shrink-0 rounded-[2px] border border-transparent bg-transparent px-1 text-right text-[10px] tabular-nums",
            "hover:border-bord focus:border-bord-fort focus:bg-fond-2 focus:outline-none",
            inactif ? "text-texte-3" : "text-texte-2",
          ].join(" ")}
        />
      </div>
      {ramene && <Raison texte={ramene} />}
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
  const ecoule = useEcoule(demarreLe)

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
 * Le temps écoulé depuis un départ, rafraîchi quatre fois par seconde.
 *
 * **Extrait de la jauge le 31 août 2026**, quand le bouton qui paie s'est mis à
 * porter son propre compteur (E-BUG-2). Les deux montrent le même temps, du même
 * départ, et un second `setInterval` écrit à la main aurait fini par battre à
 * contretemps du premier — deux durées pour un seul fait est la panne que ce
 * dépôt refuse partout ailleurs.
 *
 * Le quart de seconde n'est pas un réglage de confort : la barre transitionne
 * sur 240 ms (§ Motion), et rafraîchir plus vite ne ferait qu'écraser une
 * transition en cours par la suivante.
 */
export function useEcoule(demarreLe: number | null): number {
  const [ecoule, setEcoule] = useState(() => depuis(demarreLe))

  useEffect(() => {
    setEcoule(depuis(demarreLe))
    const battement = setInterval(() => setEcoule(depuis(demarreLe)), 250)
    return () => clearInterval(battement)
  }, [demarreLe])

  return ecoule
}

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

/** **Le rectangle que l'image occupe vraiment dans la surface qui reçoit le
 *  geste** (U2, puis U11).
 *
 *  Le dépôt a déjà appris cette leçon une fois, sur l'écran de découpe : *le
 *  cadre **est** l'image, mis à l'échelle par calcul ; une boîte qui ment
 *  décale ce qu'on pose dessus.* Elle se réapprend ici, à deux endroits — le
 *  rectangle de recadrage et le pinceau de la main —, et c'est la même erreur :
 *  la surface est dimensionnée d'après les mesures que l'atelier garde de
 *  l'image, l'image est posée dedans en *tenant dans le cadre*, donc centrée
 *  avec des bandes vides de chaque côté dès que les deux proportions diffèrent
 *  d'un cheveu. Un calcul qui mesure la surface au lieu de l'image se décale de
 *  la largeur de la bande, et un recadrage change précisément les proportions
 *  du rendu.
 *
 *  Cette fonction refait ce que `object-contain` fait — la plus grande échelle
 *  qui tienne, centrée — et rend le rectangle en coordonnées d'écran. Toute
 *  surface qui transforme un clic en pixel d'image passe par elle. */
export function rectangleDeLImage(
  surface: { left: number; top: number; width: number; height: number },
  largeur: number,
  hauteur: number,
) {
  if (largeur <= 0 || hauteur <= 0) return surface
  const echelle = Math.min(surface.width / largeur, surface.height / hauteur)
  const rendue = { width: largeur * echelle, height: hauteur * echelle }
  return {
    left: surface.left + (surface.width - rendue.width) / 2,
    top: surface.top + (surface.height - rendue.height) / 2,
    ...rendue,
  }
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
