// L'écran Univers — le tableau d'inspiration, la bible, la palette, le barème.
//
// « Au début d'un projet, puis ponctuel » (`docs/archi-versions.md` §6.2). C'est
// la contrepartie exacte de l'Atelier : celui-ci ne montre que ce qu'on touche
// **à chaque** génération, celui-là tout ce qu'on pose **une fois** et qui
// s'applique ensuite tout seul.
//
// **Deux colonnes en grille, trois en toile.** `380px · 1fr` — l'univers à
// gauche, le tableau à droite ; `380px · 1fr · 380px` quand la toile est
// ouverte, la réserve prenant la troisième (`docs/DESIGN.md` § Layout). La
// largeur de 380 est celle de la fiche asset : c'est *la* colonne de ce qu'on
// manipule, et lui donner une **valeur** de plus ferait un troisième vocabulaire
// de largeur. Une **colonne** de plus, non — la réserve reprend la 380 telle
// quelle, pour ce qu'elle nomme déjà.
//
// **Et chacune des deux colonnes se replie par choix.** Même bascule qu'à
// l'atelier, même case de grille qui tombe à zéro, mêmes 160 ms sur la largeur
// (`docs/DESIGN.md` § Motion) : repliées toutes les deux, la toile tient la
// largeur de l'écran. **Replier n'est pas fermer** — les deux panneaux restent
// montés, et la réserve garde ses 380 px sous une case qui les rogne. C'est ce
// qui laisse à l'aimant de la toile la grille qu'il mesure, et à la colonne son
// défilement là où on l'avait laissé.
//
// **Les réglages de l'univers restent visibles pendant qu'on compose**, et c'est
// la raison d'être de la colonne de gauche : on classe des inspirations en
// regardant ce qu'elles contraignent.
//
// **Aucune rubrique n'y paraît vide sans le dire.** Montrer du cadrage au lieu
// de servir le geste est le reproche qui a fait écarter la maquette : un univers
// vide ne montre donc pas des champs morts, il montre ce qu'ils feront.

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  api,
  FAMILLES,
  AUCUNE_CIBLE,
  NOM_CHAMP,
  NOM_FAMILLE,
  Refus,
  type Carte,
  type Echelle,
  type Famille,
  type Lien,
  type Modele,
  type Personnage,
  type Teinte,
  type Univers,
} from "../api"
import {
  Bloc,
  Curseur,
  EnTetePanneau,
  Libelle,
  Raison,
  Segments,
} from "./chassis"
import type { Fente } from "./BarreChassis"
import { Reserve, Tableau, useCollage, type Vue } from "./Tableau"
import { Toile, ilotPerdu, useCrans, type Geste } from "./Toile"
import { PANNEAU } from "./Infobulle"

/** Les cibles proposées, reprises de la fiche — 16 pour une tuile, 64 pour un
 *  sprite, 128 pour un décor. Elles se choisissent **ici** depuis T4 : la taille
 *  de pixel est une propriété du projet, imposée à tout ce qui rentre (US-60).
 *
 *  **« Aucune » ouvre la liste depuis R2** (US-163), et elle est en tête parce
 *  qu'elle est le cas d'un jeu qui n'est pas en pixel art — la première
 *  question, pas la dernière. C'est un segment comme les autres et non un
 *  interrupteur à côté : trancher entre « pas de grille » et « une grille de
 *  16 px » est un seul choix, et deux contrôles en auraient fait deux. */
const CIBLES = [AUCUNE_CIBLE, 16, 24, 32, 48, 64, 96, 128] as const

/** Ce que l'auteur lit d'une cible. Zéro n'est pas « 0 px » — c'est l'absence
 *  de remise sur grille, et l'écrire en pixels serait un mensonge de mesure. */
const NOM_CIBLE: Partial<Record<string, string>> = { "0": "aucune" }
const COULEURS = [8, 12, 16, 24, 32, 48] as const

/** Poser un réglage, et **dire s'il a pris**. Le booléen n'est pas de la
 *  politesse : un bloc qui tient un brouillon doit savoir revenir à la valeur
 *  d'avant quand le serveur refuse, sinon l'écran reste sur la valeur tentée —
 *  celle que le fichier du projet ne porte pas. */
type Regler = (reglage: Parameters<typeof api.reglerUnivers>[0]) => Promise<boolean>

export function EcranUnivers({
  univers,
  modeles,
  cartes,
  liens,
  teintes,
  personnages,
  cote,
  onCote,
  vue,
  onVue,
  replies,
  onFente,
  onUnivers,
  onRelire,
}: {
  univers: Univers
  modeles: Modele[]
  /** Le tableau, tenu par `App` — comme la grille et l'arbre. **Un seul endroit
   *  écoute le flux**, pour toute la vie de l'onglet : un second abonnement
   *  ouvert à l'ouverture de cet écran-ci se rebrancherait à chaque aller-retour
   *  vers l'atelier, et le serveur renverrait l'état complet à chaque fois. */
  cartes: Carte[]
  /** Les traits de la toile, et les teintes de ses îlots. Ils arrivent par la
   *  même route que les cartes — une toile se lit en un aller-retour, parce
   *  qu'elle *est* le tableau. */
  liens: Lien[]
  teintes: Record<string, Teinte>
  /** Les personnages du projet. Le tableau les lit pour deux choses : dire d'un
   *  coup d'œil **ce qui sert et ce qui dort** (US-125), et désigner une carte
   *  comme concept art depuis son menu (US-124). */
  personnages: Personnage[]
  /** Lequel des côtés est allumé, et les colonnes repliées. **Montés dans `App`
   *  avec la V2.1** : la barre du châssis rend les bascules de repli de l'écran
   *  actif, et la réserve n'a de bascule qu'en vue toile. Un état qui décide du
   *  contenu d'une bande partagée ne peut pas vivre sous cette bande. */
  cote: Cote
  onCote: (cote: Cote) => void
  vue: Vue
  onVue: (vue: Vue) => void
  replies: { univers: boolean; reserve: boolean }
  /** Ce que cet écran a à dire dans la barre du châssis — un refus, ou le
   *  compte rendu d'un réalignement. **Il n'a plus sa fente à lui** : elle
   *  n'existait que parce que cet écran couvrait l'atelier, et qu'une raison
   *  envoyée à la barre d'état se serait rendue *derrière* lui. Devenu un
   *  onglet, il partage la fente du châssis et la barre d'état du produit. */
  onFente: (fente: Fente) => void
  /** Poser l'univers que le serveur vient de rendre. **Un réglage arrive par
   *  deux chemins qui se croisent** — la réponse du PUT et l'annonce du flux —,
   *  comme un personnage ou une carte, et l'écran jetait ici le premier des
   *  deux. Un écran qui ne sait pas poser ce qu'on lui rend est un piège qui se
   *  réveille ailleurs : il se corrige même quand le flux suffirait. */
  onUnivers: (univers: Univers) => void
  onRelire: () => void
}) {
  const [choisie, setChoisir] = useState<string | null>(null)

  /** **Le refus se pose où le geste a eu lieu**, et il y va par la fente du
   *  châssis. Cet écran écrit dans la bande du haut, comme avant ; ce qui a
   *  changé, c'est qu'il ne la possède plus. */
  const setRefus = (texte: string) =>
    onFente(texte ? { ton: "echec", texte } : null)

  // ── Les deux vues, et ce qu'elles partagent ──────────────────────────────
  //
  // « L'écran ne se dédouble pas, c'est la même matière regardée autrement » :
  // le collage est donc branché **ici**, au-dessus des deux. Deux surfaces qui
  // l'installeraient chacune feraient deux cartes pour un seul Ctrl+V.
  const collage = useCollage({ onErreur: setRefus, onRafraichir: onRelire })

  // La grille de la réserve, mesurée pour donner ses trois crans à l'aimant de
  // la largeur libre. Une seule mesure, trois déclencheurs.
  const grilleReserve = useRef<HTMLDivElement>(null)
  const crans = useCrans(grilleReserve, vue)

  // **La pile d'annulation vit ici, donc elle meurt avec l'écran** (`docs/PLAN.md`
  // T8) : ce n'est pas de l'historique de projet, c'est le rattrapage du geste en
  // cours. Rien ne la vide au départ, et il ne faut rien écrire pour ça — un
  // `useRef` est neuf à chaque montage, et une remise à zéro posée en plus
  // laisserait croire que c'est elle qui tient la promesse. Au retour, ce qui est
  // sur le disque fait foi.
  const pile = useRef<Geste[]>([])

  /** Ramener une carte en réserve : ni classée, ni posée, en un seul appel.
   *
   *  **Et le geste retient ce qu'il fait disparaître** (T9) : si c'était le
   *  dernier membre d'un groupe, l'îlot cesse d'exister, et le serveur emporte
   *  avec lui les liens qui y aboutissaient et sa teinte. Sans ça, Ctrl+Z
   *  rendrait son groupe à la carte et ferait reparaître un îlot **nu** — les
   *  traits et la couleur perdus en silence, ce qui est le contraire de ce que
   *  « le champ retrouve sa valeur d'avant » promet. */
  const rendre = (identifiant: string) => {
    const carte = cartes.find((c) => c.identifiant === identifiant)
    if (!carte || carte.en_reserve) return
    pile.current.push({
      genre: "carte",
      carte: identifiant,
      avant: { groupe: carte.groupe, position: carte.position ?? [] },
      ilot: ilotPerdu(carte, cartes, liens, teintes),
    })
    void api
      .reglerCarte(identifiant, { groupe: "", position: [] })
      .catch((e) => setRefus(e instanceof Refus ? e.message : "la carte n'a pas pu revenir"))
  }

  const realigner = async () => {
    try {
      const fait = await api.realigner()
      onFente({
        ton: "ok",
        texte: (
          <>
            {fait.realignes} remis à jour · {fait.conserves} conservés tels quels
            {/* Sans cible, le balayage a remis la palette et **retiré** la
                grille : il n'a rééchantillonné personne, et le dire tient en
                quatre mots plutôt qu'en une infobulle (US-163). */}
            {!fait.sur_grille && " · aucune remise sur grille"}
          </>
        ),
      })
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "réalignement refusé")
    }
  }

  // Les colonnes du côté Inspiration : `1fr` en grille, `1fr · 380px` en toile,
  // avec la case qui tombe à zéro quand on replie la réserve. **La colonne de
  // 380 px de l'univers n'est plus là** : elle est passée du côté Réglages avec
  // E7, et le tableau prend toute la largeur, ce qui est son métier.
  const colonnes = [
    "minmax(0,1fr)",
    ...(vue === "toile" ? [`${replies.reserve ? 0 : 380}px`] : []),
  ].join(" ")

  return (
    // `data-univers` marque ce qui appartient à cet écran : c'est ce qui permet
    // à Ctrl+Z de distinguer un champ qu'on est en train d'écrire *ici* d'un
    // champ de la galerie, resté focalisé sur l'autre onglet depuis le
    // démarrage. La marque reste utile après la V2.1 : les onglets se
    // démontent, mais le focus, lui, se rétablit au retour.
    <div data-univers className="flex min-h-0 flex-col bg-fond-0">
      {/* **Plus d'en-tête à lui.** Il en portait un de 44 px — son nom, ses
          bascules de repli, sa fente de refus, et un bouton pour retourner à
          l'atelier. Les trois premiers sont montés dans la barre du châssis,
          qui les rend pour l'onglet actif ; le quatrième n'a plus d'objet, un
          onglet ne se ferme pas. */}

      {/* **Trois côtés, un seul allumé, et le côté allumé prend tout l'écran**
          (E7). Personne ne grignote personne : ce qui a cassé la version d'avant
          est d'avoir mis sur le même écran deux choses qui servent à *chercher
          une idée* et deux qui servent à *remplir des réglages*. Mesuré : la
          bande de réglages faisait 1 843 px de haut dans 646 px visibles, et la
          première image d'inspiration était à 4 161 px de défilement. */}
      {cote !== "inspiration" && <BarreDesCotes cote={cote} onCote={onCote} />}

      {cote === "inspiration" && (
        /* Deux colonnes en toile, une seule en grille — et **aucun réglage
           au-dessus du tableau**. La colonne de 380 px de l'univers est partie
           du côté Réglages, où elle a de la place ; ce qui reste ici est la
           matière qu'on regarde, sur toute la largeur.

           **Chaque case est `flex`, et c'est ce qui borne le panneau qu'elle
           porte** (`docs/DESIGN.md` § Un panneau est borné par l'écran). */
        <div
          data-colonnes
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: colonnes,
            transition: "grid-template-columns 160ms ease-in-out",
          }}
        >
          <div className="flex min-h-0 min-w-0 overflow-hidden">
            {vue === "grille" ? (
              <Tableau
                cartes={cartes}
                personnages={personnages}
                vue={vue}
                onVue={onVue}
                choisie={choisie}
                onChoisir={setChoisir}
                onErreur={setRefus}
                collage={collage}
                cotes={<Cotes cote={cote} onCote={onCote} />}
              />
            ) : (
              <Toile
                cartes={cartes}
                personnages={personnages}
                liens={liens}
                teintes={teintes}
                vue={vue}
                onVue={onVue}
                choisie={choisie}
                onChoisir={setChoisir}
                onErreur={setRefus}
                collage={collage}
                crans={crans}
                pile={pile}
                cotes={<Cotes cote={cote} onCote={onCote} />}
              />
            )}
          </div>

          {vue === "toile" && (
            <div className="flex min-h-0 overflow-hidden">
              <Reserve
                cartes={cartes}
                personnages={personnages}
                choisie={choisie}
                onChoisir={setChoisir}
                onErreur={setRefus}
                collage={collage}
                cadre={grilleReserve}
                onDepot={rendre}
              />
            </div>
          )}
        </div>
      )}

      {cote === "reglages" && (
        <CoteReglages
          univers={univers}
          modeles={modeles}
          artworks={cartes.filter((c) => c.artwork)}
          onUnivers={onUnivers}
          onErreur={setRefus}
          onRealigner={realigner}
        />
      )}

      {cote === "ambiances" && <CoteAmbiances />}
    </div>
  )
}

// ── Les trois côtés ─────────────────────────────────────────────────────────
//
// L'onglet tient quatre choses très différentes, et c'est ce qui a cassé sa
// version d'avant : deux d'entre elles servent à **chercher une idée** — le
// tableau rangé, le tableau à la main —, les deux autres à **remplir des
// réglages** — les réglages du jeu, les ambiances. Ce ne sont pas les mêmes
// besoins, et les mettre sur le même écran a fait perdre les deux.
//
// Trois mots en haut de l'onglet, un seul allumé, et le côté allumé prend tout
// l'écran. Personne ne grignote personne.

export type Cote = "inspiration" | "reglages" | "ambiances"

/** L'ordre n'est pas arbitraire : on regarde des images pour se donner une
 *  idée, on règle son jeu, on fabrique les lots de style qui s'en servent. Il
 *  est écrit une fois, ici. */
const COTES: readonly { cle: Cote; nom: string }[] = [
  { cle: "inspiration", nom: "Inspiration" },
  { cle: "reglages", nom: "Réglages" },
  { cle: "ambiances", nom: "Ambiances et couleurs" },
]

/** Les trois mots, sans leur bande — pour les poser dans une barre qui existe
 *  déjà. **Deux bandes empilées au-dessus du travail, jamais trois** : celle du
 *  châssis fait 44 px, celle-ci 38, et le côté Inspiration n'en ajoute pas une
 *  troisième pour ses trois mots (`docs/maquettes-v2.1/06-univers.html`, au
 *  paragraphe « La forme retenue — trois côtés, jamais deux à la fois »). */
export function Cotes({ cote, onCote }: { cote: Cote; onCote: (cote: Cote) => void }) {
  return (
    <div role="tablist" aria-label="Les trois côtés de l'univers" className="flex shrink-0 items-center gap-1">
      {COTES.map(({ cle, nom }) => (
        <button
          key={cle}
          type="button"
          role="tab"
          aria-selected={cote === cle}
          onClick={() => onCote(cle)}
          className={[
            "h-[26px] rounded-[2px] px-2 text-[11.5px] transition-colors duration-[80ms]",
            cote === cle
              ? "bg-fond-3 text-texte"
              : "text-texte-3 hover:bg-fond-2 hover:text-texte-2",
          ].join(" ")}
        >
          {nom}
        </button>
      ))}
    </div>
  )
}

/** La barre des côtés quand le côté allumé n'en a pas déjà une. Même hauteur —
 *  38 px, celle de toute barre d'outils du produit —, mêmes trois mots. */
function BarreDesCotes({
  cote,
  onCote,
  children,
}: {
  cote: Cote
  onCote: (cote: Cote) => void
  children?: ReactNode
}) {
  return (
    <div className="flex h-[38px] shrink-0 items-center gap-3 border-b border-bord bg-fond-1 px-4">
      <Cotes cote={cote} onCote={onCote} />
      {children}
    </div>
  )
}

// ── Le côté Réglages ────────────────────────────────────────────────────────

/** Les étapes du côté Réglages, dans l'ordre où on les remplit.
 *
 *  **C'est la liste que l'assistant de E8 reprendra**, et elle est déjà celle
 *  des blocs d'aujourd'hui : la V2.1 ne change pas ce qu'on règle, elle change
 *  l'endroit où ça se règle. Écrire ici cinq étapes qui n'existent pas encore
 *  ferait une liste qui ment sur ce que l'écran contient. */
const ETAPES = [
  { cle: "bible", nom: "La bible du style" },
  { cle: "palette", nom: "La palette du jeu" },
  { cle: "grille", nom: "La taille de pixel" },
  { cle: "bareme", nom: "Le barème d'échelles" },
  { cle: "defauts", nom: "Les modèles par défaut" },
] as const

type Etape = (typeof ETAPES)[number]["cle"]

/**
 * Le côté Réglages — la liste des étapes à gauche, l'étape ouverte à droite.
 *
 * **240 px, la colonne de ce qui range** (`docs/DESIGN.md` § Largeurs de
 * colonne), la même que l'arbre de la galerie et que les familles du codex.
 * Aucune largeur neuve : c'est ce que la V2.1 s'est imposé, et c'est ce que
 * cette colonne nomme déjà.
 *
 * **Ce que ça règle, mesuré.** La même matière tenait dans une bande de 380 px
 * haute de 1 843 px, dans 646 px visibles : il fallait faire défiler deux fois
 * et demie sa propre hauteur pour atteindre le dernier bloc, et la liste des
 * étapes n'existait nulle part. Une étape à la fois tient dans un écran.
 */
function CoteReglages({
  univers,
  modeles,
  artworks,
  onUnivers,
  onErreur,
  onRealigner,
}: {
  univers: Univers
  modeles: Modele[]
  artworks: Carte[]
  onUnivers: (univers: Univers) => void
  onErreur: (raison: string) => void
  onRealigner: () => void
}) {
  const [etape, setEtape] = useState<Etape>("bible")

  const regler: Regler = async (reglage) => {
    try {
      onUnivers((await api.reglerUnivers(reglage)).univers)
      return true
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "réglage refusé")
      return false
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
      <aside
        {...PANNEAU}
        className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
      >
        <EnTetePanneau>Ce jeu</EnTetePanneau>
        <div className="defile min-h-0 flex-1 overflow-y-auto p-2">
          {ETAPES.map(({ cle, nom }) => (
            <button
              key={cle}
              type="button"
              aria-pressed={etape === cle}
              onClick={() => setEtape(cle)}
              className={[
                "flex h-[26px] w-full items-center rounded-[2px] px-2 text-left text-[11.5px] transition-colors duration-[80ms]",
                etape === cle ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
              ].join(" ")}
            >
              {nom}
            </button>
          ))}
        </div>
        {/* **Ce que cet univers envoie**, en pied de la colonne qui le règle et
            nulle part ailleurs. Voir `CeQueLUniversEnvoie`. */}
        <CeQueLUniversEnvoie univers={univers} artworks={artworks} />
      </aside>

      {/* **C'est un panneau de réglages, et il se déclare** (`docs/design-motifs.md`
          § L'infobulle explique) : c'est ce qui dit à une bulle de sortir par le
          bord de la colonne plutôt que par celui de l'écran. Le marqueur vivait
          sur la colonne de 380 px ; il suit ce qu'elle portait. */}
      <div
        {...PANNEAU}
        className="defile flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto p-4"
      >
        {etape === "bible" && (
          <Bible bible={univers.bible} onRegler={(bible) => regler({ bible })} />
        )}
        {etape === "palette" && (
          <Palette univers={univers} artworks={artworks} onRegler={regler} />
        )}
        {etape === "grille" && (
          <Grille univers={univers} onRegler={regler} onRealigner={onRealigner} />
        )}
        {etape === "bareme" && <Bareme univers={univers} onRegler={regler} />}
        {etape === "defauts" && (
          <Defauts univers={univers} modeles={modeles} onRegler={regler} />
        )}
      </div>
    </div>
  )
}

/**
 * Ce que cet univers envoie — le bloc en pied de colonne.
 *
 * **Un univers ne se lisait nulle part.** Sept cases de texte, chacune avec son
 * interrupteur, une palette, une taille de pixel, un barème : rien ne disait ce
 * qui part vraiment avec un appel, ni combien ça pèse. Mesuré dans ce dépôt, le
 * style représente 53 % du texte envoyé et le sujet 2 % — un chiffre qu'aucun
 * écran ne montrait, et qui décide de ce qu'on peut espérer changer en
 * réécrivant son prompt.
 *
 * **Il dit aussi ce qui n'agit qu'au retour**, et c'est la moitié la moins
 * évidente : la taille de pixel et le barème ne partent pas chez le
 * fournisseur — ils s'appliquent à l'image quand elle revient. Les mélanger
 * avec ce qui part ferait croire qu'on peut demander au modèle de rendre du
 * 64 px, ce qu'aucun modèle ne fait.
 */
function CeQueLUniversEnvoie({
  univers,
  artworks,
}: {
  univers: Univers
  artworks: Carte[]
}) {
  const actives = univers.bible.filter((c) => c.actif && c.texte.trim())
  const signes = actives.reduce((somme, c) => somme + c.texte.trim().length, 0)
  return (
    <div className="mesure shrink-0 border-t border-bord p-2 text-[10px] text-texte-3">
      <p className="mb-1 text-[9.5px] tracking-[.11em] uppercase">
        Ce que cet univers envoie
      </p>
      <p className="flex items-center gap-2">
        <span>cases de style</span>
        <span className="ml-auto text-texte-2">
          {actives.length} sur {univers.bible.length}
        </span>
      </p>
      <p className="flex items-center gap-2">
        <span>signes de texte</span>
        <span className="ml-auto text-texte-2">{signes}</span>
      </p>
      <p className="flex items-center gap-2">
        <span>images officielles</span>
        <span className="ml-auto text-texte-2">{artworks.length}</span>
      </p>
      {/* **Ce qui n'agit qu'au retour**, dit à part et nommé comme tel. */}
      <p className="mt-1 flex items-start gap-1.5 border-t border-bord pt-1">
        <span aria-hidden className="mt-1.5 inline-block h-px w-2 shrink-0 bg-texte-3" />
        <span>
          la taille de pixel et le barème ne partent pas : ils s'appliquent à
          l'image qui revient
        </span>
      </p>
    </div>
  )
}

// ── Le côté Ambiances et couleurs ───────────────────────────────────────────

/**
 * Le troisième côté, et il est vide — **avec sa raison, en toutes lettres**.
 *
 * Le produit interdit de proposer puis de refuser ; il n'autorise pas non plus
 * à cacher ce qui existera. Un côté qui apparaîtrait le jour où il se remplit
 * serait une surprise au moment précis où l'on cherche à comprendre où les
 * choses se règlent — c'est l'argument que l'écran des dépenses fait déjà pour
 * sa colonne vide.
 */
function CoteAmbiances() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="flex max-w-[504px] flex-col items-center gap-3 text-center">
        <p className="font-serif text-[32px] leading-tight text-texte-3">
          Rien n'est encore fabriqué ici.
        </p>
        <p className="mesure text-[10px] leading-relaxed text-texte-3">
          Ce côté tiendra deux listes — les palettes qu'on a fabriquées, les
          ambiances qu'on en a tirées — et le panneau de celle qui est ouverte.
          Les deux gestes qui les créent existent déjà, dans le menu d'un paquet
          de cartes du côté Inspiration ; ils y sont grisés pour la même raison.
        </p>
      </div>
    </div>
  )
}

// ── Les cinq réglages du jeu ────────────────────────────────────────────────
//
// **La colonne de 380 px est morte avec E7.** Elle empilait ces cinq blocs sur
// 1 843 px de hauteur dans 646 px visibles, à côté d'un tableau qui n'avait plus
// que la moitié de l'écran. Ils vivent maintenant un par un dans le côté
// Réglages, où chacun a la place entière, et la liste de gauche dit lequel est
// ouvert.

/** La bible — sept champs nommés, chacun activable indépendamment (US-56).
 *
 *  Le texte libre est ce qu'on retape ; les champs nommés sont ce qu'on dose.
 *  L'interrupteur est à côté du champ et pas dans un menu : « doser ce qui
 *  contraint » est un geste qu'on fait en regardant ce qu'on relâche. */
function Bible({
  bible,
  onRegler,
}: {
  bible: { nom: string; texte: string; actif: boolean }[]
  onRegler: (bible: { nom: string; texte: string; actif: boolean }[]) => Promise<boolean>
}) {
  const [brouillon, setBrouillon] = useState(bible)

  useEffect(() => setBrouillon(bible), [bible])

  /** **Le seul bloc de l'univers qui tienne un brouillon**, parce qu'il porte
   *  du texte qu'on tape. Les quatre autres lisent l'univers tel qu'il est, et
   *  une valeur refusée ne s'y affiche donc jamais. Ici il faut le dire :
   *  refusé, le brouillon revient à ce que le projet porte. */
  const poser = async (suivante: typeof bible) => {
    setBrouillon(suivante)
    if (!(await onRegler(suivante))) setBrouillon(bible)
  }

  const actifs = brouillon.filter((c) => c.actif && c.texte.trim()).length

  return (
    <Bloc
      cle="univers.bible"
      aide="univers.bible"
      titre="Bible"
      etat={actifs ? `${actifs} champ${actifs > 1 ? "s" : ""}` : null}
      mesure={`${actifs} champ${actifs > 1 ? "s" : ""} part${actifs > 1 ? "ent" : ""} avec chaque génération`}
    >
      {brouillon.map((champ, rang) => (
        <div key={champ.nom} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={champ.actif}
              aria-label={`${NOM_CHAMP[champ.nom] ?? champ.nom} — ${champ.actif ? "actif" : "inactif"}`}
              onClick={() =>
                void poser(
                  brouillon.map((c, i) => (i === rang ? { ...c, actif: !c.actif } : c)),
                )
              }
              className={[
                "mesure h-[26px] w-[26px] shrink-0 rounded-[2px] border text-[10px] transition-colors duration-[80ms]",
                champ.actif
                  ? "border-signal bg-signal/13 text-signal"
                  : "border-bord bg-fond-2 text-texte-3 hover:bg-fond-3",
              ].join(" ")}
            >
              {champ.actif ? "●" : "○"}
            </button>
            {/* Sept champs voisins, tous du texte libre, et rien à l'écran ne
                disait lequel porte quoi : la forme exacte du défaut `groupe`
                contre `famille`, à sept exemplaires. Chacun porte donc son
                pointillé, et son entrée dit sous quel intitulé anglais il
                part. */}
            <Libelle aide={`bible.${champ.nom}`} eteint={!(champ.actif && champ.texte.trim())}>
              {NOM_CHAMP[champ.nom] ?? champ.nom}
            </Libelle>
          </div>
          <textarea
            value={champ.texte}
            rows={2}
            placeholder={PLACEHOLDERS[champ.nom] ?? ""}
            onChange={(e) =>
              setBrouillon(
                brouillon.map((c, i) => (i === rang ? { ...c, texte: e.target.value } : c)),
              )
            }
            onBlur={() => void poser(brouillon)}
            className={[
              "resize-none rounded-[2px] border border-bord bg-fond-2 px-2 py-1 text-[11.5px] leading-snug placeholder:text-texte-3",
              champ.actif ? "text-texte" : "text-texte-3",
            ].join(" ")}
          />
        </div>
      ))}
    </Bloc>
  )
}

const PLACEHOLDERS: Record<string, string> = {
  monde: "royaume de tourbe et de fer, marais au nord",
  epoque: "haut moyen âge, avant la poudre",
  rendu: "pixel art 16 bits, palette limitée",
  trait: "contour brun d'un pixel, aplats, pas de dégradé",
  eclairage: "lumière rasante, ombres portées courtes",
  vue: "trois quarts, corps entier, sujet centré",
  technique: "sprite sur fond uni, une seule pose",
}

/** La palette — **déduite par calcul, jamais saisie** (US-54).
 *
 *  Montrée pour qu'on vérifie ce que la machine y a lu, et recalculée dès qu'on
 *  retire un artwork (US-55). Le seul réglage qu'on ait sur elle est le nombre
 *  de couleurs qu'on lui demande. */
function Palette({
  univers,
  artworks,
  onRegler,
}: {
  univers: Univers
  artworks: Carte[]
  onRegler: Regler
}) {
  return (
    <Bloc
      cle="univers.palette"
      aide="univers.palette"
      titre="Palette"
      etat={univers.palette.length ? `${univers.palette.length} couleurs` : null}
      mesure={
        univers.palette.length
          ? `${univers.palette.length} couleurs · ${artworks.length} artwork${artworks.length > 1 ? "s" : ""}`
          : "déduite des artworks"
      }
    >

      {univers.palette.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-[2px]">
            {univers.palette.map((couleur) => (
              <span
                key={couleur}
                title={couleur}
                style={{ background: couleur }}
                className="h-5 w-5 rounded-[2px] border border-bord"
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1">
            <Libelle aide="univers.couleurs">Couleurs demandées</Libelle>
            <Segments
              valeurs={COULEURS}
              valeur={
                (COULEURS.includes(univers.couleurs as (typeof COULEURS)[number])
                  ? univers.couleurs
                  : 24) as (typeof COULEURS)[number]
              }
              onChange={(couleurs) => void onRegler({ couleurs })}
            />
          </div>
        </>
      ) : (
        <div className="rounded-[2px] border border-bord bg-fond-2 px-2 py-2">
          <Raison texte="aucun artwork officiel — promeus une carte du tableau" />
        </div>
      )}
    </Bloc>
  )
}

/** La taille de pixel du projet — imposée à tout ce qui rentre, jamais déduite
 *  de l'image reçue (US-60, US-61) — **ou aucune** (US-163).
 *
 *  Sans cible, ce que le modèle a rendu revient tel quel : le détourage et le
 *  recadrage continuent de s'appliquer, la quantification reste liée à
 *  l'existence d'une palette, et seule la remise sur grille disparaît. C'est ce
 *  que le bloc dit sous ses segments plutôt que de le laisser deviner — il n'y
 *  a rien de grisé à regarder, l'étape n'est simplement plus là. */
function Grille({
  univers,
  onRegler,
  onRealigner,
}: {
  univers: Univers
  onRegler: Regler
  onRealigner: () => void
}) {
  const aucune = univers.cible_px === AUCUNE_CIBLE
  return (
    <Bloc
      cle="univers.grille"
      aide="univers.cible_px"
      titre="Taille de pixel"
      etat={aucune ? "aucune" : `${univers.cible_px} px`}
      mesure={aucune ? "le rendu du modèle entre tel quel" : "imposée à ce qui rentre"}
    >
      <Segments
        valeurs={CIBLES}
        valeur={
          (CIBLES.includes(univers.cible_px as (typeof CIBLES)[number])
            ? univers.cible_px
            : 64) as (typeof CIBLES)[number]
        }
        libelles={NOM_CIBLE}
        onChange={(cible_px) => void onRegler({ cible_px })}
      />
      {aucune && (
        <p className="mesure pt-1 text-[10px] leading-4 text-texte-3">
          aucune remise sur grille — le détourage, le recadrage et la palette
          s'appliquent toujours
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="mesure text-[10px] text-texte-3">
          les assets déjà là ne bougent pas tout seuls
        </span>
        <button
          type="button"
          onClick={onRealigner}
          className="mesure text-[10px] text-signal hover:text-signal-clair"
        >
          Tout réaligner ›
        </button>
      </div>
    </Bloc>
  )
}

/** Le barème d'échelles — quelle part de la toile un sujet occupe selon sa nature.
 *
 *  « Sans lui, tout ce qui sort du produit fait la même hauteur » : la séance du
 *  27 août l'a montré sur cinq sujets réels, un coffre aussi haut qu'un
 *  personnage. Une échelle porte aussi sa **famille**, et c'est ce qui garde un
 *  seul contrôle au générateur : dire « c'est un objet tenu en main », c'est du
 *  même coup dire quels artworks partent. */
function Bareme({
  univers,
  onRegler,
}: {
  univers: Univers
  onRegler: Regler
}) {
  const poser = (bareme: Echelle[]) => void onRegler({ bareme })

  return (
    <Bloc
      cle="univers.bareme"
      aide="univers.bareme"
      titre="Barème d'échelles"
      etat={
        univers.bareme.length
          ? `${univers.bareme.length} échelle${univers.bareme.length > 1 ? "s" : ""}`
          : null
      }
      mesure="part de la case, et famille"
    >
      {/* **L'occupation n'agit que par la grille**, qui est ce qui met un sujet
          à l'échelle de sa case : sans taille de pixel, elle ne s'applique
          pas. La famille et la silhouette, elles, continuent — l'une décide des
          artworks qui partent, l'autre du détourage. Le barème reste donc
          lisible et réglable : ce qui manque est une étape, pas un droit. */}
      {univers.cible_px === AUCUNE_CIBLE && (
        <Raison texte="sans taille de pixel, l'occupation ne s'applique pas — la famille et la silhouette, si" />
      )}
      <ul className="flex flex-col rounded-[2px] border border-bord">
        {univers.bareme.map((echelle, rang) => (
          <li
            key={echelle.nom}
            className="flex flex-col gap-1 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate text-[11.5px] text-texte">{echelle.nom}</span>
              <select
                value={echelle.famille}
                onChange={(e) =>
                  poser(
                    univers.bareme.map((x, i) =>
                      i === rang ? { ...x, famille: e.target.value as Famille } : x,
                    ),
                  )
                }
                className="mesure h-[26px] rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
              >
                {FAMILLES.map((f) => (
                  <option key={f} value={f}>
                    {NOM_FAMILLE[f]}
                  </option>
                ))}
              </select>
            </div>
            <Curseur
              valeur={echelle.occupation}
              min={10}
              max={100}
              unite=" %"
              onChange={(occupation) =>
                poser(
                  univers.bareme.map((x, i) => (i === rang ? { ...x, occupation } : x)),
                )
              }
            />
            <button
              type="button"
              aria-pressed={echelle.silhouette}
              onClick={() =>
                poser(
                  univers.bareme.map((x, i) =>
                    i === rang ? { ...x, silhouette: !x.silhouette } : x,
                  ),
                )
              }
              className={[
                "mesure self-start text-[9.5px] transition-colors duration-[80ms]",
                echelle.silhouette ? "text-texte-3 hover:text-signal" : "text-epingle",
              ].join(" ")}
            >
              {echelle.silhouette
                ? "se détoure et vit dans une case"
                : "plein cadre, aucun détourage"}
            </button>
          </li>
        ))}
      </ul>
    </Bloc>
  )
}

/** Le modèle par défaut, **par famille** — pas un réglage global (US-58). */
function Defauts({
  univers,
  modeles,
  onRegler,
}: {
  univers: Univers
  modeles: Modele[]
  onRegler: Regler
}) {
  const poses = FAMILLES.filter((f) => f !== "tous" && univers.modeles[f]).length

  return (
    <Bloc
      cle="univers.defauts"
      aide="univers.modeles"
      titre="Modèle par défaut"
      etat={
        poses ? `${poses} famille${poses > 1 ? "s" : ""} réglée${poses > 1 ? "s" : ""}` : null
      }
      mesure="sinon, le défaut du catalogue"
    >
      <ul className="flex flex-col rounded-[2px] border border-bord">
        {FAMILLES.filter((f) => f !== "tous").map((famille) => (
          <li
            key={famille}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2">
              {NOM_FAMILLE[famille]}
            </span>
            <select
              value={univers.modeles[famille] ?? ""}
              onChange={(e) =>
                void onRegler({
                  modeles: { ...univers.modeles, [famille]: e.target.value },
                })
              }
              className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
            >
              <option value="">—</option>
              {modeles.map((m) => (
                <option key={m.identifiant} value={m.identifiant}>
                  {m.nom}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {/* **Deux défauts d'appel, et pas une famille de plus** (C2). La liste
          au-dessus est indexée par *ce qu'on fabrique* ; ces deux-ci répondent
          à *quelle sorte d'appel on fait*, et les mêler aurait demandé deux clés
          réservées dans un espace de noms qui est celui de l'auteur.

          Deux, et pas un : à l'essai du 28 août, un modèle rend les traits du
          gabarit dans l'image là où un autre les ignore comme demandé. */}
      <ul className="mt-2 flex flex-col rounded-[2px] border border-bord">
        {(
          [
            ["modele_planche", "planche", "quand un lot d'attitudes part"],
            ["modele_edition", "édition", "quand un corps se retouche"],
          ] as const
        ).map(([champ, nom, quand]) => (
          <li
            key={champ}
            className="flex items-center gap-2 border-b border-bord px-2 py-1.5 last:border-b-0"
          >
            <span className="w-[80px] shrink-0 text-[11px] text-texte-2" title={quand}>
              {nom}
            </span>
            <select
              value={univers[champ] ?? ""}
              onChange={(e) => void onRegler({ [champ]: e.target.value })}
              aria-label={`Modèle par défaut pour une ${nom}`}
              className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-1 text-[10px] text-texte-2"
            >
              <option value="">—</option>
              {modeles.map((m) => (
                <option key={m.identifiant} value={m.identifiant}>
                  {m.nom}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Bloc>
  )
}
