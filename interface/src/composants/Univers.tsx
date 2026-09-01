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

import { useRef, useState, type ReactNode } from "react"
import {
  api,
  Refus,
  type Carte,
  type Fabrique,
  type Lien,
  type Modele,
  type Personnage,
  type Teinte,
  type Univers,
} from "../api"
import type { Fente } from "./BarreChassis"
import { DECOUPER, Reserve, Tableau, useCollage, type Vue } from "./Tableau"
import { EcranDecoupe } from "./Decoupe"
import { Toile, ilotPerdu, useCrans, type Geste } from "./Toile"
import { Assistant } from "./Assistant"
import { CoteAmbiancesEtCouleurs, type CibleAmbiances } from "./Ambiances"


export function EcranUnivers({
  univers,
  modeles,
  cartes,
  liens,
  teintes,
  personnages,
  cote,
  onCote,
  onSortirDeLAssistant,
  onDeposee,
  vue,
  onVue,
  replies,
  onFente,
  onUnivers,
  onRelire,
  fabriques,
  onAllerAuxAmbiances,
  cibleAmbiances,
  onCibleVue,
  carteDecoupee,
  onDecouperCarte,
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
  /** **Sortir de l'assistant** (E19) : on tombe dans le codex, champ qui nomme
   *  allumé. C'est `App` qui sait où l'on tombe — cet écran-ci ne connaît que
   *  le sien. */
  onSortirDeLAssistant: () => void
  /** **Un secret vient d'être déposé à l'étape 10** (F3). L'écran ne s'en sert
   *  pas lui-même : il le fait passer à l'assistant, parce que ce que le dépôt
   *  change — la barre du haut et le grisé des modèles — est rendu ailleurs. */
  onDeposee: () => void
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
           porte** (`docs/DESIGN.md` § Un panneau est borné par l'écran). */
        <DECOUPER.Provider value={onDecouperCarte}>
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

      {cote === "reglages" && (
        <Assistant
          onSortir={onSortirDeLAssistant}
          univers={univers}
          modeles={modeles}
          artworks={cartes.filter((c) => c.artwork)}
          onUnivers={onUnivers}
          onErreur={setRefus}
          onRealigner={realigner}
          onDeposee={onDeposee}
        />
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

// ── Le côté Ambiances et couleurs ───────────────────────────────────────────
//
// **Le troisième côté vit dans son propre fichier** (E11) : il tient deux listes
// et deux panneaux, et le garder ici aurait fait du fichier de l'onglet Univers
// le troisième écran du produit — le premier était l'atelier, le deuxième
// l'assistant, et les deux ont fini par sortir.
