/**
 * Le carnet — la colonne de gauche, 300 px, **jamais recouverte**.
 *
 * `docs/pistes-2026-09-04/carnet/Navigation.dc.html`. Il remplace les trois
 * onglets : le sommaire du jeu, toujours à l'écran, même pendant une
 * génération. On n'est jamais à plus de deux clics d'où que ce soit, et jamais
 * coincé.
 *
 * **Onze lignes au repos** — le nom du jeu, puis dix, quel que soit le nombre
 * de sujets. Trois sections, et sous elles le pied, qui ne compte pas dans les
 * dix : il est sous le trait, il ne bouge pas quand une section s'ouvre, et il
 * porte ce qui n'appartient à aucun jeu.
 *
 * **Trois règles le tiennent, et elles sont essayées** (`tests/test_b0.py`,
 * `App.test.tsx`) :
 *
 * 1. *Une seule ligne ouverte à la fois.* En ouvrir une referme l'autre.
 * 2. *Le carnet ne dépasse jamais trente lignes*, ouvert au plus grand. Au-delà,
 *    c'est qu'une règle a été enfreinte, pas que le jeu est trop gros.
 * 3. *Il ne se ferme jamais tout seul.* Aucun écran de travail ne prend la
 *    fenêtre entière — seules l'ouverture et le parcours de création le font, et
 *    les deux se demandent.
 *
 * **Ce qu'une famille déplie, ce sont ses collections, jamais ses sujets.**
 * Trois personnages ou cinquante-quatre, le carnet garde la même hauteur : les
 * sujets, c'est la grille qui les montre. Tant que la collection n'est pas un
 * vrai groupe (`B8`), une famille n'en déplie qu'une — « Tous » —, ce que la
 * planche prévoit pour un petit jeu.
 */

import { useState } from "react"
import { dollars, type Projet } from "../api"
import { TOUCHE_DE_LA_BARRE } from "./Barre"

/** Le plafond de la règle n°2, écrit une fois. */
export const LIGNES_AU_PLUS = 30

/**
 * Comment une famille se nomme **dans le carnet**, et nulle part ailleurs.
 *
 * Avec son article, comme la planche l'écrit. Ce n'est pas de la coquetterie :
 * la grille du codex a déjà des boutons nommés *Personnages*, et deux gestes
 * différents portant le même nom dans la même fenêtre ne se distinguent ni à
 * l'œil ni à l'oreille.
 */
export const NOM_DANS_LE_CARNET: Record<string, string> = {
  personnages: "Les personnages",
  objets: "Les objets",
  decors: "Les décors",
  interface: "L'interface",
  equipement: "Les équipements",
}

/** Ce qu'une ligne de famille montre. */
export type LigneDeFamille = {
  cle: string
  nom: string
  /** Le compte, ou `null` quand il n'y en a aucun — la ligne écrit « aucun »
   *  plutôt que zéro : *un chiffre affiché est un chiffre compté*, et zéro se
   *  dit mieux avec un mot. */
  compte: number | null
}

/** Les cinq derniers jeux travaillés, au plus, plus ce qu'on en sait. */
export type AutreJeu = { identifiant: string; nom: string; seconde: string }

// ── Les pièces ──────────────────────────────────────────────────────────────

/** L'entête d'une section — mono 10.5, majuscules, +.14em. Elle ne se clique
 *  pas : ce n'est pas une ligne du carnet, c'est ce qui les groupe. */
function EnTete({ enfants }: { enfants: string }) {
  return (
    <div className="mesure px-[14px] pt-[14px] pb-[4px] text-[10.5px] uppercase tracking-[0.14em] text-encre-4">
      {enfants}
    </div>
  )
}

/**
 * Une ligne du carnet — **trois états, pas quatre** : au repos, survolée,
 * ouverte. `docs/DESIGN.md` § Les onze pièces.
 *
 * Le compte est à droite, en chasse fixe : c'est un fait mesuré. Il ne porte
 * jamais de prix — sauf la ligne des dépenses, dont c'est le sujet.
 */
function Ligne({
  nom,
  compte,
  ouverte,
  decale,
  onAller,
}: {
  nom: string
  compte?: string | null
  ouverte?: boolean
  decale?: boolean
  onAller: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAller}
      aria-current={ouverte ? "true" : undefined}
      data-ligne-du-carnet
      className={[
        "flex h-[30px] w-full shrink-0 items-center gap-[8px] text-left text-[14px]",
        decale ? "pl-[34px] pr-[14px]" : "px-[14px]",
        "transition-colors duration-120",
        ouverte
          ? "bg-ligne-ouverte text-encre"
          : "text-encre-controle hover:bg-papier",
      ].join(" ")}
    >
      <span className="truncate">{nom}</span>
      {compte != null && (
        <span className="mesure ml-auto shrink-0 text-[11px] text-encre-4">
          {compte}
        </span>
      )}
    </button>
  )
}

// ── Le carnet ───────────────────────────────────────────────────────────────

export function Carnet({
  jeu,
  seconde,
  familles,
  regles,
  images,
  depense,
  autresJeux,
  ouvert,
  surLeJeu,
  surLaFamille,
  surLesRegles,
  surLaGalerie,
  surLesDepenses,
  surUnAutreJeu,
  surTousLesJeux,
  surCommencerUnJeu,
  surLaBarre,
  surLeGuide,
  surLInstallation,
  atelierMuet,
  surReessayer,
  cleAbsente,
}: {
  jeu: string
  /** « 45 images · 12 poses sur 18 » — jamais un prix : on ne choisit pas un
   *  jeu sur ce qu'il a coûté. */
  seconde: string
  familles: readonly LigneDeFamille[]
  /** Ce que la toile de l'univers porte, ou `null`. */
  regles: number | null
  images: number
  depense: number
  autresJeux: readonly AutreJeu[]
  /** Le lieu où l'on est, pour que la ligne le dise. */
  ouvert: string | null
  surLeJeu: () => void
  surLaFamille: (cle: string) => void
  surLesRegles: () => void
  surLaGalerie: () => void
  surLesDepenses: () => void
  surUnAutreJeu: (identifiant: string) => void
  surTousLesJeux: () => void
  surCommencerUnJeu: () => void
  /** B6 — la barre. Le pied du carnet l'annonçait depuis `B0` sur un bouton
   *  éteint : elle existe, il s'allume. */
  surLaBarre: () => void
  surLeGuide: () => void
  surLInstallation: () => void
  /** L'atelier ne répond plus. **C'est le seul cas où le pied grandit**, et la
   *  ligne part dès qu'il répond. */
  atelierMuet?: boolean
  surReessayer?: () => void
  /** Aucune clé posée : un point rouille sur l'installation, et rien d'autre.
   *  Pas de bandeau, pas de fenêtre — le point suffit à dire où aller. */
  cleAbsente?: boolean
}) {
  /** **Une seule ligne dépliée à la fois**, et c'est la règle n°4 du design.
   *  Un seul état la tient : en ouvrir une referme l'autre par construction,
   *  plutôt que par une discipline qu'un écran de plus oublierait. */
  const [depliee, setDepliee] = useState<string | null>(null)
  const deplier = (cle: string) => setDepliee((deja) => (deja === cle ? null : cle))

  return (
    <nav
      aria-label="Le carnet"
      data-carnet
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-trait bg-papier-cote"
    >
      <div className="defile flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* ── Le nom du jeu — deux cibles sur une ligne ───────────────────── */}
        {/* Le nom ramène au tableau de bord : **c'est le seul chemin de
            retour**, partout ailleurs on descend dans le jeu. Le chevron
            déplie sur place, dans le carnet, comme une famille déplie ses
            collections — ce n'est pas un menu qui flotte, il n'y en a pas. */}
        <div className="flex items-start gap-[4px] px-[14px] pt-[14px] pb-[8px]">
          <button
            type="button"
            onClick={surLeJeu}
            /* Une marque, pas une étiquette : le nom accessible de ce bouton
               est déjà le bon — le nom du jeu et ce qu'il contient. Le
               réécrire en ferait deux vérités à tenir d'accord. */
            data-vers-le-tableau-de-bord
            className="min-w-0 flex-1 text-left"
          >
            <span className="block truncate font-serif text-[25px] leading-[1.15] text-encre">
              {jeu}
            </span>
            <span className="mesure block truncate text-[11px] text-encre-4">
              {seconde}
            </span>
          </button>
          <button
            type="button"
            onClick={() => deplier("jeux")}
            aria-expanded={depliee === "jeux"}
            aria-label="Les autres jeux"
            className="mt-[4px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-5 text-[13px] text-encre-3 transition-colors duration-120 hover:bg-papier"
          >
            <span aria-hidden>{depliee === "jeux" ? "⌄" : "›"}</span>
          </button>
        </div>

        {depliee === "jeux" && (
          <div className="ligne-qui-souvre">
            {/* Cinq jeux au plus, les cinq derniers travaillés. Le reste est sur
                l'écran d'ouverture, qui les montre en grand et a sa recherche :
                aucun champ de recherche n'apparaît ici. Le jeu ouvert n'y est
                pas — c'est la ligne juste au-dessus. */}
            <EnTete enfants="Les autres jeux" />
            {autresJeux.map((autre) => (
              <button
                key={autre.identifiant}
                type="button"
                onClick={() => surUnAutreJeu(autre.identifiant)}
                className="flex h-[34px] w-full shrink-0 flex-col justify-center pl-[34px] pr-[14px] text-left transition-colors duration-120 hover:bg-papier"
              >
                <span className="truncate text-[13px] text-encre-controle">
                  {autre.nom}
                </span>
                <span className="mesure truncate text-[11px] text-encre-4">
                  {autre.seconde}
                </span>
              </button>
            ))}
            {autresJeux.length > 0 && (
              <Ligne nom="Tous les jeux…" decale onAller={surTousLesJeux} />
            )}
            <Ligne nom="＋ Commencer un jeu" decale onAller={surCommencerUnJeu} />
          </div>
        )}

        {/* ── Ce qui s'applique à tout le jeu ─────────────────────────────── */}
        <EnTete enfants="Les règles du jeu" />
        <Ligne
          nom="La toile de l'univers"
          compte={regles == null ? null : String(regles)}
          ouverte={ouvert === "univers"}
          onAller={surLesRegles}
        />

        {/* ── Ce que le jeu contient ──────────────────────────────────────── */}
        <EnTete enfants="Ce que le jeu contient" />
        {familles.map((famille) => (
          <div key={famille.cle} className="contents">
            <Ligne
              nom={famille.nom}
              compte={famille.compte == null ? "aucun" : String(famille.compte)}
              ouverte={ouvert === famille.cle}
              onAller={() => {
                deplier(famille.cle)
                surLaFamille(famille.cle)
              }}
            />
            {depliee === famille.cle && (
              <div className="ligne-qui-souvre">
                {/* Sans collection, une famille n'en déplie qu'une : « Tous ».
                    La grille suffit à voir les trois. */}
                <Ligne
                  nom="Tous"
                  decale
                  compte={famille.compte == null ? "aucun" : String(famille.compte)}
                  onAller={() => surLaFamille(famille.cle)}
                />
              </div>
            )}
          </div>
        ))}

        {/* ── Toutes les images ───────────────────────────────────────────── */}
        <EnTete enfants="Toutes les images" />
        <Ligne
          nom="La galerie"
          compte={String(images)}
          ouverte={ouvert === "galerie"}
          onAller={surLaGalerie}
        />
        <Ligne
          nom="Les dépenses"
          compte={dollars(depense)}
          ouverte={ouvert === "depenses"}
          onAller={surLesDepenses}
        />

        <div className="h-[14px] shrink-0" />
      </div>

      {/* ── Le pied — sous le trait, il ne compte pas dans les dix ────────── */}
      {/* Tout ce qui appartient au jeu est au-dessus du trait ; ce qui
          appartient à l'atelier est en dessous. Deux boutons, jamais trois, et
          chacun porte la touche qui l'ouvre : c'est le seul endroit du carnet
          qui ne bouge jamais, et on finit par savoir les touches sans les avoir
          apprises. */}
      <div data-pied-du-carnet className="shrink-0 border-t border-trait">
        <button
          type="button"
          onClick={surLaBarre}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          <span className="mesure rounded-5 border border-contour px-[4px] py-px text-[10.5px]">
            {TOUCHE_DE_LA_BARRE}
          </span>
          <span>chercher, ou faire</span>
        </button>
        <button
          type="button"
          onClick={surLeGuide}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          <span className="mesure rounded-5 border border-contour px-[4px] py-px text-[10.5px]">
            ?
          </span>
          <span>Le guide et les touches</span>
        </button>
        <button
          type="button"
          onClick={surLInstallation}
          className="flex h-[30px] w-full items-center gap-[8px] px-[14px] text-left text-[13px] text-encre-controle transition-colors duration-120 hover:bg-papier"
        >
          {cleAbsente && (
            <span
              aria-label="aucune clé n'est posée"
              className="h-[4px] w-[4px] shrink-0 rounded-5 bg-signal"
            />
          )}
          <span>L'installation</span>
        </button>
        {atelierMuet && (
          <div className="flex h-[30px] items-center gap-[8px] border-t border-trait-echec bg-fond-echec px-[14px] text-[12.5px] text-echec">
            <span>l'atelier ne répond plus</span>
            {surReessayer && (
              <button
                type="button"
                onClick={surReessayer}
                className="ml-auto underline"
              >
                réessayer
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

/**
 * Les cinq derniers jeux travaillés, au plus — et **jamais l'ouvert**.
 *
 * ⚠️ **L'ordre devrait être celui du dernier passage, et il ne l'est pas
 * encore** : le serveur ne sait sortir la liste que par date de création, et la
 * date du dernier travail n'est servie par aucune route. C'est écrit dans la
 * planche comme *à écrire*, et ça reste vrai après `B0` — la liste est donc
 * celle de la création, à l'envers, et la seconde ligne dit ce qu'elle sait
 * vraiment : le compte d'images.
 */
export function derniersJeux(
  projets: readonly Projet[],
  courant: string | null,
): AutreJeu[] {
  return projets
    .filter((p) => p.identifiant !== courant)
    .slice(0, 5)
    .map((p) => ({
      identifiant: p.identifiant,
      nom: p.nom,
      seconde: p.assets === 0 ? "aucune image" : `${p.assets} images`,
    }))
}
