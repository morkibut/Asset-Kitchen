// L'écran Guide — la seule prose du produit.
//
// `docs/design-motifs.md` § L'écran Guide, et la seule prose du produit. C'est un
// écran, pas un panneau : on l'ouvre quand on ne sait pas, on le ferme quand on
// sait. Il couvre l'Atelier comme Univers et Découpe.
//
// **Il ne porte pas de fente de refus, et c'est la preuve qu'on a compris la
// règle.** Les deux autres écrans en portent une parce qu'ils couvrent la barre
// d'état et qu'un refus provoqué chez eux serait rendu derrière eux. Le Guide
// ne demande rien au serveur, ne dépense rien, ne peut pas échouer. On ne pose
// pas une fente vide pour la symétrie.
//
// **Sa troisième partie est le corpus des infobulles**, rendu à la file. Un
// seul texte, deux rendus : une explication recopiée dans deux fichiers diverge
// en trois semaines, et c'est celle qui est sous les yeux au moment du doute
// qui sera la fausse.

import { useEffect, useRef, useSyncExternalStore } from "react"
import { AIDE, SANS_ENTREE, type Explication } from "../aide"

// ── Ouvrir le guide depuis n'importe où ─────────────────────────────────────
//
// Le même patron que le repli global du châssis : un magasin de module, parce
// que le lien « Le guide › » d'une infobulle vit dans un panneau qui ne connaît
// pas `App`, et qu'on ne fait pas descendre un rappel à travers quatre étages
// pour un écran qui s'ouvre.

let ouvert = false
let ancre: string | null = null
const abonnes = new Set<() => void>()

function prevenir() {
  abonnes.forEach((f) => f())
}

export function ouvrirGuide(cle?: string) {
  ouvert = true
  ancre = cle ?? null
  prevenir()
}

export function fermerGuide() {
  if (!ouvert) return
  ouvert = false
  ancre = null
  prevenir()
}

export function useGuide() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => {
        abonnes.delete(f)
      }
    },
    () => ouvert,
    () => false,
  )
}

/** Remettre le guide à zéro — les essais d'écran, comme pour le repli. */
export function reinitialiserGuide() {
  ouvert = false
  ancre = null
  prevenir()
}

// ── Le sommaire ─────────────────────────────────────────────────────────────

// **Un lieu, pas un thème.** Quand on cherche une explication, on se souvient
// d'où l'on était, pas de quelle catégorie la chose relève. On range donc par
// endroit du produit, dans l'ordre où on les rencontre : ce qu'on pose une fois,
// ce qu'on nomme, ce qu'on fabrique, ce qu'on juge, ce qu'on retouche, et ce
// qu'on règle une fois pour toutes.
const OU: Record<Explication["ou"], string> = {
  inspiration: "Inspiration",
  jeu: "Réglages du jeu",
  ambiances: "Ambiances et couleurs",
  codex: "Le codex",
  etabli: "L'établi",
  galerie: "La galerie",
  tables: "Les tables",
  fabriques: "Les fabriques",
  reglages: "Les réglages de l'atelier",
}

/** Les trois côtés de l'univers, puis les six lieux d'ailleurs. L'ordre est
 *  écrit une seule fois : le sommaire et le corps le lisent tous les deux.
 *
 *  **Le mot « Dans » n'est pas dans les noms.** Les groupes s'appelaient *Dans
 *  l'univers*, *Dans l'atelier* : répété neuf fois dans une colonne de 240 px,
 *  ça mange la place pour rien. Il est écrit une fois, en tête de chaque moitié.
 *
 *  **Les réglages de l'atelier en dernier, et c'est encore l'ordre des lieux.**
 *  On les pose une fois et on n'y revient qu'en cas de doute : les mettre en
 *  tête ferait commencer un guide de fabrication par une page d'administration. */
const DANS_LUNIVERS = ["inspiration", "jeu", "ambiances"] as const
const AILLEURS = [
  "codex",
  "etabli",
  "galerie",
  "tables",
  "fabriques",
  "reglages",
] as const
const OUS = [...DANS_LUNIVERS, ...AILLEURS] as const

// **Cinq temps, et « nommer » est le premier.** Sur une machine neuve, c'est le
// seul geste possible : il n'y a pas d'établi tant qu'il n'y a pas de chose. La
// boucle est l'ouverture de la partie, pas un temps de plus.
//
// **Quatre lieux, et le guide dit lequel n'est pas un onglet.** On ne visite pas
// des pièces que personne ne peut ouvrir : la Découpe n'est plus un lieu — c'est
// une table parmi les autres —, et l'écran qui s'appelait l'Atelier n'existe
// plus. Ce qu'il faisait se fait sur l'établi d'une chose du jeu.
const PARTIES = [
  {
    id: "geste",
    titre: "Le geste",
    entrees: ["La boucle", "Nommer", "Écrire", "Générer", "Juger", "Garder"],
  },
  {
    id: "lieux",
    titre: "Les lieux",
    entrees: ["L'univers", "Le codex", "La galerie", "L'établi"],
  },
] as const

export function EcranGuide({ onFermer }: { onFermer: () => void }) {
  const corps = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [onFermer])

  // Le lien d'une infobulle ouvre l'écran **à l'ancre du réglage**.
  useEffect(() => {
    if (!ancre) return
    const cible = corps.current?.querySelector(`#reglage-${ancre.replace(/\W/g, "-")}`)
    cible?.scrollIntoView({ block: "start" })
  }, [])

  const aller = (id: string) => {
    corps.current?.querySelector(`#${id}`)?.scrollIntoView({ block: "start" })
  }

  const parOu = (ou: Explication["ou"]) =>
    Object.entries(AIDE).filter(([, e]) => e.ou === ou)

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-fond-0">
      {/* La barre de tête du produit, sans fente de refus : rien ici ne peut
          échouer. Le titre est en serif — c'est un *titre d'écran*, le deuxième
          des trois emplois, et le Guide n'en ouvre pas un quatrième. */}
      <header className="flex h-[44px] shrink-0 items-center gap-4 border-b border-bord bg-fond-1 px-4">
        <h1 className="font-serif text-[17px] leading-none text-texte">Guide</h1>
        <span className="mesure text-[10px] text-texte-3">
          comment marche l'atelier, et ce que fait chaque réglage
        </span>
        <button
          type="button"
          onClick={onFermer}
          className="mesure ml-auto h-[26px] rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte-2 transition-colors duration-[80ms] hover:bg-fond-3"
        >
          fermer · Échap
        </button>
      </header>

      {/* `240px · 1fr` — 240 est la colonne de l'arbre, réemployée : un sommaire,
          c'est *où ça se range*. Aucune troisième largeur n'est inventée. */}
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Le sommaire"
          className="defile min-h-0 overflow-y-auto border-r border-bord bg-fond-1 p-2"
        >
          {PARTIES.map((partie) => (
            <div key={partie.id}>
              <Groupe>{partie.titre}</Groupe>
              {partie.entrees.map((nom) => (
                <Rangee key={nom} onClick={() => aller(ancrer(nom))}>
                  {nom}
                </Rangee>
              ))}
            </div>
          ))}

          <Groupe>Les réglages — dans l'univers</Groupe>
          {DANS_LUNIVERS.map((ou) => (
            <Rangee key={ou} onClick={() => aller(`ou-${ou}`)} compte={parOu(ou).length}>
              {OU[ou]}
            </Rangee>
          ))}

          <Groupe>Les réglages — ailleurs</Groupe>
          {AILLEURS.map((ou) => (
            <Rangee key={ou} onClick={() => aller(`ou-${ou}`)} compte={parOu(ou).length}>
              {OU[ou]}
            </Rangee>
          ))}

          <div className="my-2 h-px bg-bord" />
          <Rangee onClick={() => aller("manque")} compte={SANS_ENTREE.length}>
            Ce qui manque
          </Rangee>
        </nav>

        <div ref={corps} className="defile min-h-0 overflow-y-auto px-12 pt-11 pb-16">
          {/* **La prose est bornée à 36em, et le `em` est celui de la prose.**
              La seule largeur maximale du produit. L'unité n'est pas `ch` :
              `72ch` rend 671 px, soit 88 signes, parce que `ch` vaut l'avance du
              zéro — l'un des signes les plus larges de la police.
              `text-[15px]` n'est pas décoratif : sans lui, `36em` se résolvait
              sur les 13 px hérités du corps et rendait **468 px, soit 61 signes
              par ligne** — mesuré au navigateur le 31 août 2026. La règle en
              vise 74, et la borne était donc trop étroite d'un cinquième, dans
              le sens que personne ne regarde : une colonne trop courte ne se
              remarque pas, elle fatigue. 540 px, 70 signes.
              Calée à gauche, et la place qui reste à droite reste vide : c'est
              ce vide qui dit qu'on est sorti de l'atelier. */}
          <article className="max-w-[36em] text-[15px]">
            <Titre id="la-boucle">La boucle</Titre>
            <P>
              Tu nommes, tu écris, tu génères, tu regardes, tu gardes ce qui est bon.{" "}
              <B>C'est toute l'application.</B> Le reste — l'univers, les tables, le
              catalogue — existe pour que cette boucle-là demande le moins de décisions
              possible.
            </P>

            <H id="nommer">Nommer</H>
            <P>
              Écrire un nom <B>crée la chose</B>. On tape <C>un tonneau cerclé de fer</C>{" "}
              dans le champ du codex : le tonneau entre dans la liste sur-le-champ, et son
              établi s'ouvre. Ce n'est pas un champ de prompt — <B>on ne paie rien en
              nommant</B>.
            </P>
            <P>
              C'est le premier temps parce que sur une machine neuve, c'est le{" "}
              <I>seul geste possible</I> : il n'y a pas d'établi tant qu'il n'y a pas de
              chose. Et c'est le geste que l'atelier connaît déjà pour les poses et les
              pièces d'équipement — nommer, c'est créer, partout.
            </P>

            <H id="ecrire">Écrire</H>
            <P>
              Le champ ne demande que <I>le sujet</I>. Ni le style, ni la palette, ni le
              format : ils sont déjà posés dans l'univers du jeu, et ils partent tout seuls
              à chaque génération. Écrire <C>un tonneau</C> suffit. Écrire{" "}
              <C>un tonneau pixel art 32×32 palette sombre</C> fait le travail une seconde
              fois, et moins bien que l'univers ne le fait.
            </P>
            <P>
              Le champ est <B>en pied d'écran</B>, et il n'existe qu'à deux endroits :
              l'établi d'une chose, et le codex. La galerie n'en a pas — on y juge, on n'y
              paie jamais.
            </P>

            <H id="generer">Générer</H>
            <P>
              N tuiles paraissent aussitôt <B>à leur taille définitive</B>, avec leur jauge et
              leur compteur. La grille ne se recompose pas entre le départ et l'arrivée : ton
              œil reste où il était, et un échec atterrit exactement là où le succès serait
              arrivé — fond rouge sourd, la raison en clair à la place du sprite, et{" "}
              <I>Relancer</I> à la place de la mesure.
            </P>
            <P>
              Le coût est écrit sur le bouton <B>avant</B> le clic. Et{" "}
              <B>rien n'est jamais relancé automatiquement</B> — ni une génération
              interrompue, ni un appel raté, ni une carte qui n'est pas arrivée. Relancer est
              toujours ton geste, partout, sans exception.
            </P>
            <P>
              Entre le bouton et la dépense, <B>un écran s'intercale</B> : il montre tout ce
              qui va partir, ligne par ligne — les textes du jeu, ceux de son ambiance, ton
              sujet, chaque image jointe avec son prix —, chacune avec un interrupteur. Ce
              qu'on y éteint ou corrige ne vaut que pour cet appel-là. Une case le saute pour
              la série en cours, jamais pour toujours.
            </P>
            <P>
              Un appel qui rate a coûté de l'argent sans produire d'image. Il n'entre donc pas
              dans la grille, qui ne montre que ce qu'on peut réutiliser. Où est passé
              l'argent se lit dans <I>les dépenses</I>, qui portent{" "}
              <B>tous les appels payés</B> et pas seulement ceux qui ont raté.
            </P>

            <H id="juger">Juger</H>
            <P>
              La grille est une planche contact : c'est là que tu tries à l'œil. Trois marques
              seulement, et la hiérarchie est volontaire — <B>ce que tu poses est une forme,
              ce que le système constate est un mot.</B>
            </P>
            <Liste
              items={[
                ["Le coin plein en cyan", "favori — la seule marque que tu poses toi-même"],
                ["L'anneau clair", "sélectionné, et rien d'autre ; la fiche est la sélection quand elle vaut un"],
                ["Une pastille en mono", "un état subi : réglé, agent, parent supprimé"],
              ]}
            />
            <P>
              La tuile montre le <B>rendu</B>, pas le brut, dès qu'une recette existe : juger
              sur le brut alors que tu as détouré et remis sur grille ferait juger autre chose
              que ce qui partira dans ton jeu. Le brut reste à un geste — la bascule de la
              fiche.
            </P>
            <P>
              Une vignette de 128 px ne suffit pas toujours. <B>Pose le pointeur sur une image
              et appuie sur la barre d'espace</B> : elle emplit l'écran. Espace encore, Échap,
              ou un clic, et elle s'en va — tu n'as rien quitté. La <I>molette</I> zoome autour
              du pointeur, et au-delà de l'ajustement tu déplaces l'image en la tirant ; le
              pied dit ses dimensions et le facteur, <C>96×96 · 673 %</C>. Ça marche{" "}
              <B>partout dans l'atelier</B>, sur n'importe quelle vignette, sans exception.
            </P>
            <P>
              Pour juger vraiment, il y a la <I>vitrine</I> : l'image en grand, seule, sur le
              fond qu'on choisit et à côté de ce à quoi on veut la comparer. Elle ne modifie
              rien et ne coûte pas un centime — la barre qui paie s'y retire, et son absence
              le dit avant qu'on ait lu quoi que ce soit.
            </P>
            <P>
              Ce que tu vois en grand est <B>exactement l'image qui était sous le pointeur</B> :
              le rendu si la tuile montre le rendu, le brut si la bascule de la fiche est sur
              brut. L'aperçu n'a aucun réglage à lui — il agrandit, il ne décide pas. Et tant
              que tu es en train d'écrire dans un champ, la barre d'espace reste une espace :
              il suffit de bouger la souris sur une image pour la lui rendre.
            </P>

            <H id="garder">Garder</H>
            <P>
              Le traitement est <B>non destructif</B> : l'image brute et la recette sont
              gardées, et le fichier traité n'est qu'un rendu, écrit sur disque comme cache et
              effaçable sans rien perdre. Recalculer coûte des millisecondes ; regénérer coûte
              de l'argent et ne rend jamais la même image.
            </P>
            <P>
              Une recette a <B>sept places</B>, appliquées dans un ordre fixe — détourage,
              recadrage, grille, quantification, bords, contours, la main. Ce n'est pas une
              simplification : trois d'entre elles n'ont aucun sens avant celle qui les
              précède. Rien ne peut se recadrer avant d'avoir un fond enlevé sur lequel
              trouver le sujet.
            </P>
            <P>
              Une sélection sort en archive avec son descriptif. C'est le seul moment où
              quelque chose quitte l'atelier.
            </P>

            <Titre id="l-univers">L'univers</Titre>
            <P>
              <I>Un onglet.</I> Ce que tu poses <B>une fois</B> et qui s'applique ensuite tout
              seul. Il a trois côtés, un seul allumé à la fois, chacun plein écran :{" "}
              <I>Inspiration</I>, le tableau d'images qu'on rassemble pour réfléchir au jeu
              avant d'en fabriquer une seule ; <I>Réglages</I>, les questions qui disent ce
              qu'est ce jeu — les sept textes, la taille de pixel, le barème d'échelles, le
              modèle par famille ; <I>Ambiances et couleurs</I>, où se fabriquent les palettes
              et les lots de style réutilisables.
            </P>
            <P>
              C'est un écran et non un panneau, et c'est le rythme qui le dit : au début d'un
              jeu, puis ponctuellement. Il couvre le travail au lieu de s'y ajouter. Le
              tableau appartient au jeu — supprimer un jeu emporte son tableau, alors que ses
              images sont seulement détachées : une inspiration n'a de sens que dans son
              univers, une image produite en a un partout.
            </P>

            <H id="le-codex">Le codex</H>
            <P>
              <I>Un onglet.</I> L'inventaire de ce que ton monde contient, rangé par famille —
              personnages, décors, objets, interface, équipement — avec ce que chaque chose a
              déjà et ce qui lui manque. C'est le <B>seul endroit où l'on nomme</B>, et le
              second des deux seuls endroits d'où l'argent part.
            </P>
            <P>
              Le manque n'y a aucune couleur d'alerte, et rien n'y réclame jamais rien : une
              case vide est un fait, pas un reproche. On y compte ce qu'on peut fabriquer
              maintenant — ce qui est déjà rangé n'est jamais compté comme manquant.
            </P>

            <H id="la-galerie">La galerie</H>
            <P>
              <I>Un onglet.</I> Toutes les images produites, toutes choses confondues. C'est là
              qu'on juge et qu'on range, et <B>nulle part on n'y paie</B> — elle n'a pas de
              champ de saisie, et c'est délibéré.
            </P>
            <P>
              Les jeux et les collections sont dans la colonne de gauche, avec le total du jeu
              ouvert. Ce total est un lien : il ouvre les dépenses, où tous les appels payés
              se lisent un par un. Il faut pouvoir expliquer une facture.
            </P>
            <P>
              Une animation arrive ici comme une image, avec un bouton de plus :{" "}
              <I>Découper</I>. Il ouvre <B>le montage</B>, à la place de la grille. Deux boucles
              y tournent côte à côte et sur le même métronome — à gauche ce que le modèle a
              rendu, fond compris, pour juger le <B>mouvement</B> ; à droite les mêmes images
              passées par la chaîne de ton jeu, pour juger le <B>découpage</B>. Le ruban en
              dessous porte toutes les images du clip, une tranche chacune : un clic prend ou
              laisse, une loupe suit le pointeur, et les flèches puis la barre d'espace font la
              même chose au clavier.
            </P>
            <P>
              À l'ouverture, l'atelier a déjà regardé le clip et pose deux remarques : où il ne
              bouge presque pas, et où la boucle se referme le mieux. <B>Elles ne décident de
              rien</B> — elles disent où regarder, et tout se reprend image par image ensuite.
              Un même clip donne autant d'animations que tu veux : nomme-en une, garde-la,
              recommence. Elles partagent toutes le même cadre, <B>pour qu'un personnage ne
              change pas de taille en passant du repos à la marche</B>.
            </P>
            <P>
              <B>Rien de tout cela ne dépense</B> : le clip est payé une fois, et l'écran
              t'écrit ce qu'il t'a coûté par animation gardée — <C>$0,0670</C> pour une seule,
              la moitié dès la deuxième. C'est le seul endroit qui te dira combien vaut vraiment
              une animation.
            </P>

            <H id="l-etabli">L'établi</H>
            <P>
              <I>Une profondeur, pas un onglet.</I> Une chose du jeu, ouverte : ce qu'elle est,
              ce qu'elle a déjà, et ce qu'on peut lui ajouter. On n'y arrive pas par la barre —{" "}
              <B>on clique un nom dans le codex</B>, et le fil qui dit où l'on est remplace le
              nom de l'onglet.
            </P>
            <P>
              C'est l'un des deux seuls endroits d'où l'argent part. Sa matrice arme, la barre
              tire : cliquer <I>Fabriquer</I> sur une case remplit le champ et rend la main, il
              n'y a jamais qu'un endroit qui dépense.
            </P>
            <P>
              La découpe, elle, n'est plus un lieu : c'est une table parmi les autres, sur la
              barre des tables d'une image, à droite du trait — la première des deux fabriques.
              Les tables ne se visitent pas non plus : elles s'ouvrent sur une image, et ce
              qu'il faut en savoir est dit au temps <I>Garder</I>.
            </P>

            <Titre id="les-reglages">Les réglages</Titre>
            <P>
              Ce qui suit est <B>le même texte que les infobulles</B> de l'application, rendu à
              la file, avec la version longue quand il y en a une. Survole le nom d'un réglage
              dans un panneau : tu retrouveras les trois premières lignes de son entrée.
            </P>

            {/* **Un groupe sans explication paraît quand même, avec son zéro.**
                Le faire disparaître cacherait le manque ; c'est la règle du
                produit partout ailleurs — ce qui manque le dit — et le guide est
                le dernier endroit où l'on aurait le droit d'y déroger. */}
            {OUS.map((ou) => {
              const miennes = parOu(ou)
              return (
                <section key={ou}>
                  <H id={`ou-${ou}`}>{OU[ou]}</H>
                  {miennes.length === 0 ? (
                    <p className="mesure text-[11px] text-texte-3">
                      0 — rien d'écrit ici pour l'instant.
                    </p>
                  ) : (
                    miennes.map(([cle, e]) => (
                      <Reglage key={cle} cle={cle} entree={e} />
                    ))
                  )}
                </section>
              )
            })}

            <Titre id="manque">Ce qui n'est pas encore écrit</Titre>
            <P>
              Un réglage sans entrée n'a <B>pas de pointillé</B> sous son nom, et rien ne casse :
              aucune bulle vide, aucun « à documenter » dans les panneaux. Un manque de guide
              est un fait sur le guide, et il se range ici.
            </P>
            <ul className="mesure mt-4 flex flex-col gap-1.5 border-l border-bord pl-4 text-[11px] text-texte-3">
              {SANS_ENTREE.map((nom) => (
                <li key={nom}>{nom}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </div>
  )
}

// ── Les pièces de la prose ──────────────────────────────────────────────────
//
// **Aucun quatrième emploi du serif.** Le titre de l'écran en est un ; les
// titres de section reprennent la forme de l'en-tête de panneau — sans 12,5 px,
// majuscules, `letter-spacing .11em` — et la hiérarchie est portée par 48 px
// d'espace. Un sous-titrage serif de 24 px sur la seule page de texte long est
// très exactement le « bascule en blog » que la règle 1 du § Typography annonce.

function ancrer(nom: string) {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\W+/g, "-")
}

function Titre({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 mb-4 font-serif text-[32px] leading-[1.1] font-normal text-texte first:mt-0"
    >
      {children}
    </h2>
  )
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="mt-12 mb-3.5 text-[12.5px] font-semibold tracking-[.11em] text-texte-3 uppercase"
    >
      {children}
    </h3>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 text-[15px] leading-[1.65] text-texte-2">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <b className="font-semibold text-texte">{children}</b>
}

function I({ children }: { children: React.ReactNode }) {
  return <em className="text-texte italic">{children}</em>
}

function C({ children }: { children: React.ReactNode }) {
  return <code className="mesure text-[13px] text-texte">{children}</code>
}

function Liste({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <ul className="mb-4 flex flex-col gap-2 border-l border-bord pl-4">
      {items.map(([quoi, quoi2]) => (
        <li key={quoi} className="text-[15px] leading-[1.6] text-texte-2">
          <b className="font-semibold text-texte">{quoi}</b> — {quoi2}
        </li>
      ))}
    </ul>
  )
}

function Groupe({ children }: { children: React.ReactNode }) {
  return (
    <div className="mesure px-2 pt-3.5 pb-1.5 text-[9.5px] tracking-[.11em] text-texte-3 uppercase">
      {children}
    </div>
  )
}

function Rangee({
  children,
  compte,
  onClick,
}: {
  children: React.ReactNode
  compte?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[26px] w-full items-center gap-2 rounded-[2px] px-2 text-left text-[12.5px] text-texte-2 transition-colors duration-[80ms] hover:bg-fond-2 hover:text-texte"
    >
      <span className="truncate">{children}</span>
      {compte !== undefined && (
        <span className="mesure ml-auto text-[10px] text-texte-3">{compte}</span>
      )}
    </button>
  )
}

/** Une entrée du corpus, en long. Les trois lignes de l'infobulle, plus ce que
 *  le panneau de 280 px ne peut pas porter. */
function Reglage({ cle, entree }: { cle: string; entree: Explication }) {
  return (
    <section id={`reglage-${cle.replace(/\W/g, "-")}`} className="mt-8">
      <h4 className="mb-3 text-[15px] font-semibold text-texte">{entree.nom}</h4>
      <div className="border-l border-bord pl-4">
        <p className="text-[15px] leading-[1.6] text-texte">{entree.quoi}</p>
        <p className="mt-2 text-[15px] leading-[1.6] text-texte-2">{entree.change}</p>
        <p className="mesure mt-3 text-[10px] text-texte-3">{entree.origine}</p>
      </div>
      {entree.long
        ?.split("\n\n")
        .map((para, i) => (
          <p key={i} className="mt-4 text-[15px] leading-[1.65] text-texte-2">
            {para}
          </p>
        ))}
    </section>
  )
}
