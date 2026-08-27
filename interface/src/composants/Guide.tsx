// L'écran Guide — la seule prose du produit.
//
// `docs/DESIGN.md` § L'écran Guide, et la seule prose du produit. C'est un
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

// **Un écran, pas un thème.** Quand on cherche une explication, on se souvient
// d'où l'on était : la Découpe a donc son groupe, comme les trois autres, plutôt
// que d'aller se ranger sous « la retouche » au motif qu'elle vient après.
const OU: Record<Explication["ou"], string> = {
  univers: "Dans l'univers",
  atelier: "Dans l'atelier",
  retouche: "Dans la retouche",
  decoupe: "Dans la découpe",
  reglages: "Dans les réglages",
}

/** L'ordre des groupes de réglages — celui des écrans, et il est écrit une
 *  seule fois : le sommaire et le corps le lisent tous les deux. */
// **Les réglages en dernier, et c'est encore l'ordre des écrans.** On les pose
// une fois et on n'y revient qu'en cas de doute : les mettre en tête ferait
// commencer un guide de fabrication par une page d'administration.
const OUS = ["univers", "atelier", "retouche", "decoupe", "reglages"] as const

const PARTIES = [
  { id: "geste", titre: "Le geste", entrees: ["La boucle", "Écrire", "Générer", "Juger", "Garder"] },
  { id: "ecrans", titre: "Les écrans", entrees: ["Atelier", "Univers", "Découpe", "Bibliothèque"] },
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
        <nav className="defile min-h-0 overflow-y-auto border-r border-bord bg-fond-1 p-2">
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

          <Groupe>Les réglages</Groupe>
          {OUS.map((ou) => (
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
          {/* **La prose est bornée à 36em — 504 px, 74 signes par ligne.** La
              seule largeur maximale du produit, et l'unité n'est pas `ch` :
              `72ch` rend 671 px, soit 88 signes, parce que `ch` vaut l'avance
              du zéro. Calée à gauche, et la place qui reste à droite reste
              vide : c'est ce vide qui dit qu'on est sorti de l'atelier. */}
          <article className="max-w-[36em]">
            <Titre id="la-boucle">La boucle</Titre>
            <P>
              Tu écris ce que tu veux dans le champ du haut, tu génères, tu regardes, tu
              gardes ce qui est bon. <B>C'est toute l'application.</B> Le reste — l'univers,
              la découpe, le catalogue — existe pour que cette boucle-là demande le moins de
              décisions possible.
            </P>

            <H id="ecrire">Écrire</H>
            <P>
              Le champ de prompt ne demande que <I>le sujet</I>. Ni le style, ni la palette,
              ni le format : ils sont déjà posés dans l'univers du projet, et ils partent
              tout seuls à chaque génération. Écrire <C>un tonneau</C> suffit. Écrire{" "}
              <C>un tonneau pixel art 32×32 palette sombre</C> fait le travail une seconde
              fois, et moins bien que l'univers ne le fait.
            </P>
            <P>
              Le bloc <I>Ce qui part</I>, en bas du panneau de réglages, est en lecture seule :
              il répond d'avance à « qu'est-ce qui accompagne ma demande ? » — le nombre de
              références et leur plafond, les artworks retenus et leur famille, le projet, les
              champs de bible actifs, la palette, la grille imposée. Le compte est{" "}
              <B>calculé par le serveur</B>, jamais par l'écran : celui qui compte est celui
              qui part.
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
              Un appel qui rate a coûté de l'argent sans produire d'image. Il n'entre donc pas
              dans la grille, qui ne montre que ce qu'on peut réutiliser — il va dans le{" "}
              <I>journal</I>, sous l'arbre, avec son coût. Le journal ne paraît que s'il y a eu
              un raté.
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

            <H id="garder">Garder</H>
            <P>
              Le traitement est <B>non destructif</B> : l'image brute et la recette sont
              gardées, et le fichier traité n'est qu'un rendu, écrit sur disque comme cache et
              effaçable sans rien perdre. Recalculer coûte des millisecondes ; regénérer coûte
              de l'argent et ne rend jamais la même image.
            </P>
            <P>
              Une recette a cinq places, appliquées dans un ordre fixe — détourage, recadrage,
              grille, quantification, bords. Ce n'est pas une simplification : trois des cinq
              n'ont aucun sens avant celle qui les précède. Rien ne peut se recadrer avant
              d'avoir un alpha sur lequel trouver le sujet.
            </P>
            <P>
              Une sélection sort en archive avec son descriptif. C'est le seul moment où
              quelque chose quitte l'atelier.
            </P>

            <Titre id="atelier">Atelier</Titre>
            <P>
              Quatre colonnes : où ça se range (240 px), ce qu'on règle (300 px), le prompt et
              la grille au milieu, la fiche à droite (380 px). L'atelier ne montre que ce que
              tu touches <B>à chaque</B> génération — le sujet, le modèle, le nombre de
              variations. Résolution, format, champs de bible, rôles de réinjection existent
              tous : ils sont repliés, tenus par un défaut du projet, ou vivent dans l'écran
              Univers.
            </P>

            <H id="univers">Univers</H>
            <P>
              Ce que tu poses <B>une fois</B> et qui s'applique ensuite tout seul : la bible,
              la palette, le barème d'échelles, la taille de pixel imposée, et le tableau
              d'inspiration d'où sortent les artworks officiels.
            </P>
            <P>
              C'est un écran et non un panneau, et c'est le rythme qui le dit : au début d'un
              projet, puis ponctuellement. Il couvre l'atelier au lieu de s'y ajouter. Le
              tableau appartient au projet — supprimer un projet emporte son tableau, alors
              que ses assets sont seulement détachés : une inspiration n'a de sens que dans
              son univers, une image produite en a un partout.
            </P>

            <H id="decoupe">Découpe</H>
            <P>
              Une planche qui contient plusieurs sprites se découpe en autant d'assets. Tu
              dessines des rectangles sur l'image, et leur numéro est l'ordre de lecture —
              c'est celui que la découpe garde.
            </P>
            <P>
              Elle s'ouvre <B>depuis la fiche</B>, jamais depuis la barre d'outils : on
              découpe une image, pas une sélection. Et le geste est toujours visible, parce que
              rien ne permet de savoir d'avance qu'une image est une planche — un bouton qui
              paraîtrait ou disparaîtrait selon ce qu'on croit deviner serait faux la moitié du
              temps.
            </P>

            <H id="bibliotheque">Bibliothèque</H>
            <P>
              Les projets et les collections, dans la colonne de gauche. C'est la seule colonne
              qui parle d'argent : elle porte le total du projet ouvert, et le journal des
              ratés juste en dessous. Il faut pouvoir expliquer une facture.
            </P>

            <Titre id="les-reglages">Les réglages</Titre>
            <P>
              Ce qui suit est <B>le même texte que les infobulles</B> de l'application, rendu à
              la file, avec la version longue quand il y en a une. Survole le nom d'un réglage
              dans un panneau : tu retrouveras les trois premières lignes de son entrée.
            </P>

            {OUS.map((ou) => (
              <section key={ou}>
                <H id={`ou-${ou}`}>{OU[ou]}</H>
                {parOu(ou).map(([cle, e]) => (
                  <Reglage key={cle} cle={cle} entree={e} />
                ))}
              </section>
            ))}

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
