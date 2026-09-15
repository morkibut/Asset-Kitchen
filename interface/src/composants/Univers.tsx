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
// l'atelier, même case de grille qui tombe à zéro, mêmes 220 ms sur la largeur
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

import { useRef, useState, type ReactNode } from "react"
import {
  api,
  Refus,
  type Bande,
  type Carte,
  type Fabrique,
  type Lien,
  type Personnage,
  type Teinte,
} from "../api"
import type { Fente } from "./EnTeteDeSurface"
import { DECOUPER, Reserve, Tableau, useCollage, type Vue } from "./Tableau"
import { EcranDecoupe } from "./Decoupe"
import { Toile, ilotPerdu, useCrans, type Geste } from "./Toile"
import { CoteAmbiancesEtCouleurs, type CibleAmbiances } from "./Ambiances"


export function EcranUnivers({
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
  onRelire,
  fabriques,
  onAllerAuxAmbiances,
  cibleAmbiances,
  onCibleVue,
  carteDecoupee,
  onDecouperCarte,
  onAnimerCarte,
  projet,
}: {
  /** **Le jeu ouvert** — nécessaire depuis qu'une vidéo posée sur la toile
   *  passe par `poserClipSurToile`, qui le nomme dans son chemin. */
  projet: string
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
  onRelire: () => void
  /** Ce que chaque paquet du tableau a produit (U7) — sa palette, son ambiance.
   *  Il arrive avec les cartes, par la même route, pour la même raison que les
   *  liens : un îlot qui montrerait sa marque un aller-retour après les cartes
   *  aurait un instant où il paraît n'avoir rien fabriqué. */
  fabriques: Record<string, Fabrique>
  /** Ouvrir un objet du côté Ambiances depuis la toile (U7). **C'est `App` qui
   *  sait, parce que le côté et la toile n'ont que lui en commun.** */
  onAllerAuxAmbiances: (cible: CibleAmbiances) => void
  cibleAmbiances: CibleAmbiances | null
  onCibleVue: () => void
  /** La carte qu'on découpe, ou rien — **tenue par `App`, parce que c'est le fil
   *  d'Ariane qui la nomme**. Cet écran-ci n'en fait que deux choses : il ouvre
   *  la découpe depuis le menu d'une carte, et il la rend à la place du
   *  tableau. */
  carteDecoupee: Carte | null
  onDecouperCarte: (carte: Carte | null) => void
  /** **La seconde sortie de la découpe d'une carte** (`RP21`) : la bande qui
   *  vient de naître. Absente, le bouton *Animer* ne paraît pas dans l'écran
   *  de découpe — même règle que pour une planche de la bibliothèque. */
  onAnimerCarte?: (bandes: Bande[]) => void
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
  const collage = useCollage({ projet, onErreur: setRefus, onRafraichir: onRelire })

  // La grille de la réserve, mesurée pour donner ses trois crans à l'aimant de
  // la largeur libre. Une seule mesure, trois déclencheurs.
  const grilleReserve = useRef<HTMLDivElement>(null)
  const crans = useCrans(grilleReserve, vue)

  // **La pile d'annulation vit ici, donc elle meurt avec l'écran** (`docs/archive/plan-versions-tenues.md`
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
    <div data-univers className="flex min-h-0 flex-col bg-papier">
      {/* **Plus d'en-tête à lui.** Il en portait un de 44 px — son nom, ses
          bascules de repli, sa fente de refus, et un bouton pour retourner à
          l'atelier. Les trois premiers sont montés dans la barre du châssis,
          qui les rend pour l'onglet actif ; le quatrième n'a plus d'objet, un
          onglet ne se ferme pas. */}

      {/* **Deux côtés, un seul allumé, et le côté allumé prend tout l'écran**
          (E7). Personne ne grignote personne : ce qui a cassé la version d'avant
          est d'avoir mis sur le même écran ce qui sert à *chercher une idée* et
          ce qui sert à *remplir des réglages*. Mesuré : la bande de réglages
          faisait 1 843 px de haut dans 646 px visibles, et la première image
          d'inspiration était à 4 161 px de défilement.

          **Il n'y en a plus que deux depuis `C2`** : le côté *Réglages* était
          `Assistant.tsx`, doublon vrai de `ReglesDuJeu.tsx`, et il est parti —
          le relevé de ce qu'il savait faire est en tête de ce fichier-là. */}
      {cote !== "inspiration" && <BarreDesCotes cote={cote} onCote={onCote} />}

      {/* **Découper prend la place du tableau, il ne se pose pas dessus.**
          C'est un étage de plus, comme la découpe d'une planche dans la
          galerie : le fil d'Ariane dit où l'on est, et chaque segment ramène.
          Un écran par-dessus un autre serait la faute que la V2.1 a passé son
          temps à défaire. */}
      {cote === "inspiration" && carteDecoupee && (
        <div className="grid min-h-0 flex-1">
          <EcranDecoupe
            sujet={{
              famille: "carte",
              carte: carteDecoupee,
              onDecoupe: () => {
                // **Rien à ouvrir derrière.** Les morceaux arrivent dans la
                // réserve, non promus, et promouvoir reste un geste : on
                // retombe sur le tableau, où ils sont.
                onDecouperCarte(null)
                onRelire()
              },
              // **La seconde sortie mène là où l'auteur voulait aller**
              // (`RP21`, à l'identique d'`AU19` côté planche) : l'atelier de
              // l'animation qu'on vient de monter, où elle tourne, se règle
              // et se range sur un sujet.
              onAnimer: onAnimerCarte
                ? (bandes) => {
                    onDecouperCarte(null)
                    onAnimerCarte(bandes)
                  }
                : undefined,
            }}
            onFermer={() => onDecouperCarte(null)}
            onFente={onFente}
          />
        </div>
      )}

      {cote === "inspiration" && !carteDecoupee && (
        /* Deux colonnes en toile, une seule en grille — et **aucun réglage
           au-dessus du tableau**. La colonne de 380 px de l'univers est partie
           du côté Réglages, où elle a de la place ; ce qui reste ici est la
           matière qu'on regarde, sur toute la largeur.

           **Chaque case est `flex`, et c'est ce qui borne le panneau qu'elle
           porte** (`docs/archive/DESIGN-chassis-chaud-2026-09-04.md`
           § Six règles de comportement, la première). */
        <DECOUPER.Provider value={onDecouperCarte}>
          <div
            data-colonnes
            className="grid min-h-0 flex-1"
            style={{
              gridTemplateColumns: colonnes,
              transition: "grid-template-columns 220ms var(--ease-entree)",
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
                  fabriques={fabriques}
                  onAllerAuxAmbiances={onAllerAuxAmbiances}
                  onRelire={onRelire}
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
        </DECOUPER.Provider>
      )}

      {cote === "ambiances" && (
        <CoteAmbiancesEtCouleurs
          onErreur={setRefus}
          cible={cibleAmbiances}
          onCibleVue={onCibleVue}
        />
      )}
    </div>
  )
}

// ── Les deux côtés ──────────────────────────────────────────────────────────
//
// L'onglet tenait quatre choses très différentes, et c'est ce qui a cassé sa
// version d'avant : deux d'entre elles servaient à **chercher une idée** — le
// tableau rangé, le tableau à la main —, les deux autres à **remplir des
// réglages** — les réglages du jeu, les ambiances.
//
// **`C2` a retiré le premier des deux réglages** : les règles du jeu se posent
// dans `ReglesDuJeu.tsx`, en papier, et le côté *Réglages* de cet onglet était
// le même formulaire écrit une seconde fois. Restent deux mots en haut de
// l'onglet, un seul allumé, et le côté allumé prend tout l'écran.

export type Cote = "inspiration" | "ambiances"

/** L'ordre n'est pas arbitraire : on regarde des images pour se donner une
 *  idée, puis on fabrique les lots de style qui s'en servent. Il est écrit une
 *  fois, ici. */
const COTES: readonly { cle: Cote; nom: string }[] = [
  { cle: "inspiration", nom: "Inspiration" },
  { cle: "ambiances", nom: "Ambiances et couleurs" },
]

/** Les deux mots, sans leur bande — pour les poser dans une barre qui existe
 *  déjà. **Une seule bande au-dessus du travail** : le côté Inspiration n'en
 *  ajoute pas une seconde pour ses mots.
 *
 *  **Sur un rail, pas côte à côte** (`D2`) : `Toile.dc.html` dessine les deux
 *  mots dans une piste creuse — `--ligne-ouverte` —, et le mot allumé est une
 *  carte posée dessus. C'est la même forme que les segments du carnet, à ceci
 *  près qu'elle porte des mots et non des valeurs ; la piste est ce qui dit
 *  qu'il y en a deux et qu'un seul peut être allumé. Deux boutons sans rail
 *  disaient la même chose, mais seulement à qui les avait déjà cliqués. */
export function Cotes({ cote, onCote }: { cote: Cote; onCote: (cote: Cote) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Les deux côtés de l'univers"
      className="flex shrink-0 items-center gap-1 rounded-8 bg-ligne-ouverte p-[4px]"
    >
      {COTES.map(({ cle, nom }) => (
        <button
          key={cle}
          type="button"
          role="tab"
          aria-selected={cote === cle}
          onClick={() => onCote(cle)}
          className={[
            "h-[22px] rounded-7 px-2 text-[12.5px] transition-colors duration-[120ms]",
            cote === cle
              ? "border border-contour bg-carte font-medium text-encre"
              : "text-encre-3 hover:text-encre",
          ].join(" ")}
        >
          {nom}
        </button>
      ))}
    </div>
  )
}

/** La barre des côtés quand le côté allumé n'en a pas déjà une. Même hauteur —
 *  34 px, celle de toute barre d'outils du carnet —, mêmes mots. */
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
    <div className="flex h-[34px] shrink-0 items-center gap-3 border-b border-trait bg-papier-cote px-4">
      <Cotes cote={cote} onCote={onCote} />
      {children}
    </div>
  )
}

// ── Le côté Ambiances et couleurs ───────────────────────────────────────────
//
// **Le troisième côté vit dans son propre fichier** (E11) : il tient deux listes
// et deux panneaux, et le garder ici aurait fait du fichier de l'onglet Univers
// le troisième écran du produit — le premier était l'atelier, le deuxième
// l'assistant, et les deux ont fini par sortir.
