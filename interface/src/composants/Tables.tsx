// Les tables — l'endroit où l'on retouche.
//
// **Ce que ça remplace.** Cinq blocs repliés dans une colonne de 380 px, à côté
// d'une image de 380 px de large, sous le bouton qui paie. On y réglait un
// détourage en regardant une vignette, et quatre réglages que le modèle porte
// depuis T2 n'avaient jamais eu d'écran du tout.
//
// **La barre de tables** montre les huit places de la recette **dans l'ordre où
// elles s'appliquent**, et cet ordre ne se change pas : c'est celui du domaine,
// et le lire autrement serait mentir sur ce que l'image a subi. Chaque place dit
// d'un carré si elle agit — plein quand elle **change l'image**, creux quand
// elle est vide, aucun carré quand elle est indisponible. Aucun mot, aucun
// glyphe neuf.
//
// **Deux fabriques après un trait.** Le découpage coupe une image en plusieurs,
// la superposition en pose deux l'une sur l'autre. Les deux **écrivent des
// fichiers** et ne posent rien sur l'image courante — c'est pour ça qu'elles
// n'ont pas de carré, et c'est le critère qui les range
// (`docs/maquettes-v2.1/03-chassis-des-tables.html`, au paragraphe « Le
// wrapper »).
//
// **Le wrapper** est `380px · 1fr · 380px` : la colonne de la table, l'image en
// grand, ses sœurs. C'est la grille de l'onglet Univers en vue toile, réemployée
// — aucune largeur neuve.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  api,
  NOM_DE_LA_NATURE,
  NOM_FAMILLE,
  Refus,
  type Asset,
  type DefautDetourage,
  type EtatTraitement,
  type Famille,
  type Impose,
  type Nature,
  type Passe,
  type Place,
  type Recette,
  type TachesDeLAsset,
  type Univers,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { EnTetePanneau, Libelle, Raison, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"
// **Les quatre surfaces à coordonnées ont déménagé** (B23). Elles vivaient ici
// depuis le lot U ; elles sont désormais dans l'écran du carnet, et cet
// écran-ci les emprunte au lieu d'en garder une seconde copie. Deux
// implémentations d'un même geste finiraient par ne plus viser le même pixel —
// c'est l'invariant que `B18` a payé sur `palette.py`, et c'est pour ça que
// l'ancien écran importe le neuf plutôt que l'inverse : il s'en va en `B26`, et
// ce qui s'en va n'emporte rien.
import {
  CadreDeRecadrage,
  PipetteSurImage,
  ToileDeLaMain,
  TraceSurImage,
} from "./Retouche"
import { EcranSuperposition } from "./Superposition"
import {
  avecPassage,
  mainDe,
  MOTEUR,
  PanneauBords,
  PanneauContours,
  PanneauDetourage,
  PanneauGrille,
  PanneauMain,
  PanneauQuantification,
  PanneauRecadrage,
  PanneauRetournement,
  passagesDe,
  RESUME,
  sansLeDernier,
  useEtatMain,
  useMesures,
  useRecette,
} from "./Places"

// ── L'ordre, et il ne se change pas ─────────────────────────────────────────

export type Table =
  | "detourage"
  | "recadrage"
  | "grille"
  | "quantification"
  | "bords"
  | "contours"
  | "retournement"
  | "main"
  | "decoupage"
  | "superposition"

/** Les huit places, puis le trait, puis les deux fabriques.
 *
 *  **L'ordre est celui du traitement**, et il est écrit une fois — ici. Le
 *  domaine l'applique dans cet ordre-là ; deux listes ordonnées de la même
 *  chose finiraient par diverger, et celle de l'écran mentirait alors sur ce
 *  que l'image a subi.
 *
 *  Les deux places qui manquent — **le contour** et **la main** — occupent déjà
 *  leur rang : elles arrivent en E5, et une place qui apparaîtrait le jour où
 *  elle existe déplacerait tout ce qui la suit sous les yeux de quelqu'un qui
 *  a appris l'ordre. */
export const TABLES: readonly { cle: Table; nom: string; fabrique?: true }[] = [
  { cle: "detourage", nom: "détourage" },
  { cle: "recadrage", nom: "recadrage" },
  { cle: "grille", nom: "grille" },
  { cle: "quantification", nom: "quantification" },
  { cle: "bords", nom: "bords" },
  { cle: "contours", nom: "contours" },
  // **En queue et avant la main** (B1). Les deux planches ne la plaçaient pas au
  // même endroit ; le plan a tranché pour la fin de la chaîne, et le domaine la
  // déclare au même rang — l'ordre du fichier est l'ordre d'exécution des deux
  // côtés.
  { cle: "retournement", nom: "retournement" },
  { cle: "main", nom: "la main" },
  { cle: "decoupage", nom: "découpage", fabrique: true },
  { cle: "superposition", nom: "superposition", fabrique: true },
]

/** Ce qu'une place vaut, ou rien.
 *
 *  **Le carré se remplit quand la place change l'image, pas quand elle figure
 *  dans la recette.** Les deux ont longtemps coïncidé, et le recadrage a montré
 *  qu'elles ne coïncident pas toujours : il est posé dès la naissance de tout
 *  asset qui a une silhouette, et une marge de zéro ne change rien. */
export function valeur(table: Table, recette: Recette): string | null {
  switch (table) {
    case "detourage":
      return recette.passes.length > 0 ? RESUME.detourage(recette) : null
    case "recadrage":
      return recette.recadrage &&
        (recette.recadrage.marge > 0 || recette.recadrage.boite !== null)
        ? RESUME.recadrage(recette.recadrage)
        : null
    case "grille":
      return recette.grille ? RESUME.grille(recette.grille) : null
    case "quantification":
      return recette.quantification ? RESUME.quantification(recette.quantification) : null
    // **Trois moteurs depuis B17, et le carré se remplit sur n'importe lequel**
    // — le grain de couleur et l'escalier agissent sans qu'aucune tache ne
    // parte. Ne regarder que `aire_min` aurait laissé la barre annoncer une
    // table creuse pendant que l'image change sous les yeux.
    case "bords":
      return recette.bords &&
        (recette.bords.aire_min > 0 ||
          (recette.bords.grain_min ?? 0) > 0 ||
          (recette.bords.lissage ?? 0) > 0)
        ? RESUME.bords(recette.bords)
        : null
    case "contours":
      return recette.contours ? RESUME.contours(recette.contours) : null
    // Le carré se remplit dès que la place est là : un retournement n'a pas de
    // valeur neutre — le seul sens qu'il porte retourne l'image.
    case "retournement":
      return recette.retournement ? RESUME.retournement(recette.retournement) : null
    // **Une pile de calques vides ne change pas l'image**, donc son carré reste
    // creux : le carré se remplit quand la place *change l'image*, pas quand
    // elle figure dans la recette. Le calque, lui, est gardé — on l'a créé.
    case "main":
      return recette.main && passagesDe(recette.main) > 0
        ? RESUME.main(recette.main)
        : null
    default:
      return null
  }
}

/** Pourquoi une place est indisponible, ou rien.
 *
 *  **Une table indisponible s'ouvre quand même**, et son panneau porte la
 *  raison en clair à la place de ses réglages, avec ce qu'il faut faire pour
 *  l'allumer. C'est la règle de T1 — *le grisé porte sa raison* — qui change
 *  d'endroit, pas qui disparaît : une puce n'a pas la place d'une phrase. */
export function indisponible(
  table: Table,
  traitement: EtatTraitement,
  mesures: TachesDeLAsset | null,
): string | null {
  if (table === "quantification") return traitement.quantification.raison
  // **Le seul cas du contour, et il est franc.** Une image entièrement opaque
  // n'a pas de silhouette : tracer un contour dessus reviendrait à encadrer
  // l'image entière — un rectangle sur les quatre bords, qui n'est jamais ce
  // qu'on voulait. La seconde phrase compte autant que la première : elle dit
  // quoi faire, et le détourage est la première de la barre.
  if (table === "contours" && mesures?.opaque)
    return "cette image est entièrement opaque : il n'y a pas de bord de sujet à tracer, seulement les quatre bords du cadre. Détoure-la d'abord — c'est la première table de la barre."
  // **Le retournement n'est jamais indisponible non plus** (B1), et ce n'est
  // pas définitif : la planche demande qu'il se grise sur la famille interface
  // — des lettres retournées sont illisibles — et sur les décors, dont l'ombre
  // change de côté. Les deux refus supposent de lire la famille de l'image, ce
  // que cette table ne fait pas encore ; ils viennent avec les neuf autres sens.
  //
  // **La main n'est jamais indisponible**, et c'est l'exacte symétrie du
  // contour : toute image se retouche, y compris une image entièrement opaque
  // — *ôter* y crée de la transparence, et un calque de dessin s'y pose comme
  // partout. Son carré est donc toujours là. La superposition non plus : elle
  // marche sur n'importe quelles deux images de la bibliothèque, et c'est très
  // exactement ce qui l'a sortie de la recette — la place `Difference` était
  // grisée sur presque toute la bibliothèque, faute de savoir *par rapport à
  // quoi*.
  return null
}

// ── La veille : quelle table occupe quelle place ────────────────────────────

/** La place de la recette qu'une table règle — ou rien, pour une fabrique.
 *
 *  **Deux listes qui se ressemblent, et il fallait les relier quelque part.**
 *  La barre compte dix tables, la recette huit places : les deux fabriques
 *  écrivent d'autres fichiers et ne posent rien sur celle-ci, donc elles n'ont
 *  rien à éteindre. Écrit ici, au même endroit que l'ordre des tables, pour que
 *  la correspondance se relise d'un coup d'œil le jour où une place bouge. */
export function placeDe(table: Table): Place | null {
  return table === "decoupage" || table === "superposition" ? null : table
}

/** Cette table dort-elle ? **La seule lecture de la veille dans l'écran.** */
export function dort(recette: Recette, table: Table): boolean {
  const place = placeDe(table)
  return place !== null && recette.veille.includes(place)
}

/** La même recette, cette place-ci endormie ou réveillée.
 *
 *  Triée à l'écriture comme le serveur la trie à la lecture : éteindre la
 *  grille puis la palette doit donner exactement le même rendu que l'inverse,
 *  et l'empreinte se calcule sur le texte de la recette. */
export function avecVeille(recette: Recette, table: Table, dort: boolean): Recette {
  const place = placeDe(table)
  if (place === null) return recette
  const restantes = recette.veille.filter((p) => p !== place)
  return {
    ...recette,
    veille: (dort ? [...restantes, place] : restantes).sort(),
  }
}

// ── La barre ────────────────────────────────────────────────────────────────

/** Les trois états d'une place, et ils se distinguent à l'œil.
 *
 *  **Éteinte et vide ne sont pas le même état** (U4), et c'est tout l'intérêt
 *  de la veille : l'une garde ses réglages, l'autre n'en a pas. Un carré grisé
 *  aurait dit *presque vide* ; le carré barré dit *il y a quelque chose ici, et
 *  ça ne s'applique pas* — la seule phrase qui soit vraie. */
function Carre({ etat }: { etat: "posee" | "vide" | "eteinte" }) {
  if (etat === "eteinte")
    return (
      <svg
        aria-hidden
        data-carre="eteinte"
        viewBox="0 0 9 9"
        className="inline-block h-[9px] w-[9px] shrink-0 text-texte-3"
      >
        <rect
          x="0.5"
          y="0.5"
          width="8"
          height="8"
          fill="none"
          stroke="currentColor"
        />
        <line x1="1" y1="8" x2="8" y2="1" stroke="currentColor" />
      </svg>
    )
  return (
    <span
      aria-hidden
      data-carre={etat}
      className={[
        "inline-block h-[9px] w-[9px] shrink-0",
        etat === "posee" ? "bg-ancien-signal" : "border border-texte-3",
      ].join(" ")}
    />
  )
}

// ── Ce qui voyage d'une image à l'autre (U5) ────────────────────────────────
//
// **Le presse-papiers vit hors de React, et c'est délibéré.** Copier sur une
// image et coller sur une autre suppose de survivre au démontage de l'écran :
// on change d'image, donc de composant. Le tenir dans un état de React aurait
// demandé de le remonter jusqu'à l'ancêtre commun de toutes les images, qui est
// l'application entière — une variable de séance de plus dans le composant qui
// en a déjà le plus, pour un usage qui ne concerne que cette barre-ci.
//
// **Il ne survit pas au rechargement de la page**, et c'est le contrat : « pour
// la séance en cours ». Ce qui survit à la séance a un autre nom et un autre
// geste — les recettes nommées, juste en dessous.
let copiee: Recette | null = null

/** Oublier ce qui a été copié. **N'existe que pour les essais** : deux essais
 *  qui partageraient un presse-papiers se raconteraient l'un l'autre. */
export function reinitialiserPressePapier(): void {
  copiee = null
}

/** Les gestes qui font voyager une recette, dans un panneau de la barre.
 *
 *  **Un seul point d'entrée pour les deux durées de vie.** Copier-coller sert
 *  la séance, les recettes nommées lui survivent ; ils répondent à la même
 *  question — *je veux ces réglages-là, ailleurs* — et les éloigner l'un de
 *  l'autre aurait obligé à savoir d'avance lequel on voulait. La barre fait
 *  34 px et déborde déjà : quatre boutons de plus en auraient fait une bande à
 *  faire glisser pour atteindre un geste de portée générale. */
function PanneauDesRecettes({
  recette,
  nommees,
  onFermer,
  onLister,
  onCopier,
  onColler,
  onEnregistrer,
  onAppliquer,
  onOublier,
  aCopier,
  annonce,
}: {
  recette: Recette
  nommees: string[]
  onFermer: () => void
  /** Relire la liste. Appelée à l'ouverture du panneau et nulle part ailleurs :
   *  les gestes qui changent la liste la rendent entière. */
  onLister: () => void
  onCopier: () => void
  onColler: () => void
  onEnregistrer: (nom: string) => void
  onAppliquer: (nom: string) => void
  onOublier: (nom: string) => void
  /** Y a-t-il quelque chose dans le presse-papiers ? */
  aCopier: boolean
  /** Ce que le serveur a laissé au dernier voyage, ou ce qui vient d'être
   *  fait. **Rendue par le serveur, jamais recalculée ici** : la règle du
   *  voyage vit d'un seul côté. */
  annonce: string[] | null
}) {
  const [nom, setNom] = useState("")
  const [aRemplacer, setARemplacer] = useState<string | null>(null)
  const propre = nom.trim()
  const dejaPris = nommees.includes(propre)

  useEffect(() => {
    const ecouter = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") onFermer()
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [onFermer])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onLister(), [])

  const enregistrer = () => {
    if (!propre) return
    // **Un nom déjà pris propose de remplacer, et ne remplace jamais en
    // silence.** Le second clic est la confirmation : un dialogue par-dessus
    // un panneau par-dessus une barre aurait empilé trois surfaces pour une
    // question à un mot.
    if (dejaPris && aRemplacer !== propre) return setARemplacer(propre)
    setARemplacer(null)
    onEnregistrer(propre)
  }

  return (
    <div
      data-recettes
      className="paraitre absolute right-0 top-full z-30 mt-[3px] w-[300px] rounded-[2px] border border-bord bg-fond-1 p-3 text-left"
    >
      {/* ── La séance ──────────────────────────────────────────────────── */}
      <p className="mesure mb-2 text-[10px] text-texte-3">
        Les réglages de cette image, ailleurs
      </p>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={onCopier}
          className="mesure h-[26px] flex-1 rounded-[2px] border border-bord text-[10px] text-texte-2 hover:text-ancien-signal"
        >
          Copier les réglages
        </button>
        <button
          type="button"
          onClick={onColler}
          disabled={!aCopier}
          className="mesure h-[26px] flex-1 rounded-[2px] border border-bord text-[10px] text-texte-2 hover:text-ancien-signal disabled:cursor-not-allowed disabled:text-texte-3 disabled:hover:text-texte-3"
        >
          Coller
        </button>
      </div>
      {!aCopier && (
        <Raison texte="rien de copié pour l'instant — copie d'abord les réglages d'une image." />
      )}

      {/* ── Ce qui survit à la séance ──────────────────────────────────── */}
      <p className="mesure mb-2 mt-3 border-t border-bord pt-3 text-[10px] text-texte-3">
        Les recettes nommées
      </p>
      <div className="mb-2 flex gap-2">
        <input
          value={nom}
          onChange={(evenement) => {
            setNom(evenement.target.value)
            setARemplacer(null)
          }}
          onKeyDown={(evenement) => evenement.key === "Enter" && enregistrer()}
          placeholder="un nom pour ces réglages"
          aria-label="le nom de la recette"
          className="mesure h-[26px] min-w-0 flex-1 rounded-[2px] border border-bord bg-fond-2 px-2 text-[10px] text-texte placeholder:text-texte-3"
        />
        <button
          type="button"
          onClick={enregistrer}
          disabled={!propre}
          className="mesure h-[26px] shrink-0 rounded-[2px] border border-bord px-2 text-[10px] text-texte-2 hover:text-ancien-signal disabled:cursor-not-allowed disabled:text-texte-3 disabled:hover:text-texte-3"
        >
          {aRemplacer === propre ? "Remplacer ›" : "Enregistrer"}
        </button>
      </div>
      {aRemplacer === propre && (
        <Raison
          texte={`« ${propre} » existe déjà — reclique pour la remplacer par les réglages de cette image.`}
        />
      )}

      {nommees.length === 0 ? (
        <p className="mesure text-[10px] text-texte-3">
          aucune recette nommée pour l'instant.
        </p>
      ) : (
        <ul className="defile flex max-h-[180px] flex-col overflow-y-auto">
          {nommees.map((enregistree) => (
            <li
              key={enregistree}
              className="flex items-center gap-2 border-t border-bord/50 py-1 first:border-t-0"
            >
              <span className="mesure min-w-0 flex-1 truncate text-[10px] text-texte-2">
                {enregistree}
              </span>
              <button
                type="button"
                onClick={() => onAppliquer(enregistree)}
                className="mesure shrink-0 text-[10px] text-texte-3 hover:text-ancien-signal"
              >
                appliquer
              </button>
              <button
                type="button"
                onClick={() => onOublier(enregistree)}
                aria-label={`oublier « ${enregistree} »`}
                className="mesure shrink-0 text-[10px] text-texte-3 hover:text-ancien-echec"
              >
                oublier
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* **Ce qui n'a pas voyagé se dit là où le geste a eu lieu**, et reste
          jusqu'au geste suivant : la phrase décrit une image qu'on est en
          train de regarder, et l'effacer au bout de trois secondes la ferait
          rater exactement quand on la lisait sur l'image plutôt qu'ici. */}
      {annonce !== null && (
        <div
          data-recettes-annonce
          role="status"
          className="mesure mt-3 border-t border-bord pt-3 text-[10px] leading-snug text-texte-2"
        >
          {annonce.length === 0 ? (
            <span>c'est posé — tous les réglages ont voyagé.</span>
          ) : (
            <>
              <span className="text-epingle">
                posé, sauf ce qui désignait un endroit de l'autre image :
              </span>
              <ul className="mt-1 flex flex-col gap-0.5 text-texte-3">
                {annonce.map((phrase) => (
                  <li key={phrase}>· {phrase}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* La recette courante en un mot, pour savoir ce qu'on s'apprête à
          copier ou à nommer sans avoir à parcourir la barre. */}
      <p className="mesure mt-3 border-t border-bord pt-2 text-[9.5px] text-texte-3">
        {TABLES.filter((t) => valeur(t.cle, recette) !== null)
          .map((t) => t.nom)
          .join(" · ") || "cette image n'a aucun réglage posé"}
      </p>
    </div>
  )
}

export function BarreDesTables({
  recette,
  traitement,
  mesures,
  ouverte,
  onOuvrir,
  onVeille,
  onToutDefaire,
  recettes,
}: {
  recette: Recette
  traitement: EtatTraitement
  /** Ce que le serveur a mesuré. Le contour s'y lit une seule chose — *cette
   *  image a-t-elle un bord de sujet ?* — et tant que la réponse n'est pas
   *  arrivée, la table n'est pas grisée : on ne grise pas sur une ignorance. */
  mesures: TachesDeLAsset | null
  ouverte: Table
  onOuvrir: (table: Table) => void
  /** Éteindre ou rallumer une place **sans ouvrir sa table** (U4). C'est le
   *  geste de la barre, et il pose la recette : la veille est un champ de la
   *  recette, pas un état d'écran. */
  onVeille: (table: Table, dort: boolean) => void
  onToutDefaire: () => void
  /** Les recettes nommées, et les gestes qui les servent (U5). Tenus par
   *  l'écran des tables plutôt que par la barre : appliquer une recette change
   *  l'image, donc l'état de l'écran, et une barre qui poserait des recettes
   *  aurait à rendre compte de ce que l'écran affiche. */
  recettes: {
    nommees: string[]
    annonce: string[] | null
    aCopier: boolean
    onLister: () => void
    onCopier: () => void
    onColler: () => void
    onEnregistrer: (nom: string) => void
    onAppliquer: (nom: string) => void
    onOublier: (nom: string) => void
  }
}) {
  const [ouvertes, setOuvertes] = useState(false)
  return (
    // **La bande ne grandit pas, et ce qui dépasse défile** — la règle du
    // panneau borné par l'écran (`docs/DESIGN.md`), appliquée à une bande.
    // **Remesuré au navigateur en tenant B1**, le 6 septembre 2026, la huitième
    // place posée : à sept places qui portent une valeur, la bande demande
    // 1 491 px, et la fenêtre n'en offre que 1 064 à 1 280 — il manque 427 px.
    // Elle cesse de manquer à partir de 1 710 px de fenêtre. *La mesure d'E5
    // disait 1 323 pour 1 280 offerts, à sept places ; la conclusion n'a pas
    // bougé, le chiffre si.* Une bande qui s'épaissirait mentirait sur la liste
    // fermée des cinq hauteurs : elle défile, elle ne grandit pas.
    //
    // **La place la plus large est le retournement, à 229 px**, parce que son
    // résumé écrit `miroir gauche-droite` en toutes lettres. Viennent ensuite
    // la quantification (187) et les contours (169).
    //
    // **Ce qui défile, ce sont les places — jamais le geste qui les vide.**
    // `tout défaire` est hors de la zone qui défile : poussé dedans, il aurait
    // fallu faire glisser la bande pour l'atteindre, et un geste de portée
    // générale ne se cherche pas.
    <div className="flex h-[34px] shrink-0 items-center border-b border-bord bg-fond-1">
      <div className="defile flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-4">
      {TABLES.map(({ cle, nom, fabrique }, rang) => {
        const dehors = indisponible(cle, traitement, mesures)
        const vaut = valeur(cle, recette)
        const eteinte = dort(recette, cle)
        // **Le carré ne se clique que là où il y a quelque chose à éteindre.**
        // Une place vide qu'on endort ne change rien à l'image et écrit
        // pourtant un mot dans la recette : c'est un interrupteur qui ne
        // commande rien, donc un mensonge poli. Sur une place vide, le carré
        // reste ce qu'il a toujours été — une marque, pas un bouton.
        const commutable = !fabrique && !dehors && vaut !== null
        const chip = [
          // `whitespace-nowrap` : la bande fait 34 px et ne grandit pas.
          // Trouvé au navigateur en tenant E5 — dès que deux places voisines
          // portent une valeur, `modèle · 28` et
          // `128 px · 100 %` se repliaient chacun sur deux lignes et
          // débordaient de la bande par le haut et par le bas.
          "mesure flex h-[24px] shrink-0 items-center whitespace-nowrap text-[10px] transition-colors duration-[80ms]",
          ouverte === cle
            ? "bg-fond-3 text-texte"
            : dehors || eteinte
              ? "text-texte-3 hover:bg-fond-2"
              : "text-texte-2 hover:bg-fond-2",
        ].join(" ")
        return (
          <span key={cle} className="flex items-center gap-1">
            {/* Le trait qui sépare les huit places des deux fabriques. Il ne
                sépare pas deux groupes de contrôles : il sépare **ce qui pose
                sur cette image** de **ce qui écrit d'autres fichiers**. */}
            {fabrique && rang > 0 && !TABLES[rang - 1].fabrique && (
              <span aria-hidden className="mx-2 h-4 w-px bg-bord" />
            )}
            {/* **Deux boutons collés, et pas un bouton dans un bouton** (U4).
                Le carré commande la veille, le nom ouvre la table : ce sont
                deux gestes, et un bouton imbriqué dans un autre n'est ni du
                HTML valide ni atteignable au clavier. Ils partagent le fond et
                l'arrondi, donc à l'œil la puce reste une puce. */}
            <span className={["flex items-center rounded-[2px]", chip].join(" ")}>
              {commutable ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={!eteinte}
                  aria-label={`${nom} — ${eteinte ? "éteinte" : "allumée"}`}
                  title={
                    eteinte
                      ? `${nom} est éteinte : ses réglages sont gardés et elle ne change pas l'image. Clique pour la rallumer.`
                      : `éteindre ${nom} sans perdre ses réglages`
                  }
                  onClick={() => onVeille(cle, !eteinte)}
                  className="flex h-[24px] shrink-0 items-center pl-2 pr-1.5 hover:text-ancien-signal"
                >
                  <Carre etat={eteinte ? "eteinte" : "posee"} />
                </button>
              ) : (
                // Une fabrique n'a pas de carré : il n'y a pas de place à
                // remplir. Une place indisponible non plus, et pour la même
                // raison — le carré dit *qu'il y a une place ici*.
                !fabrique && !dehors && (
                  <span className="flex h-[24px] shrink-0 items-center pl-2 pr-1.5">
                    <Carre etat="vide" />
                  </span>
                )
              )}
              <button
                type="button"
                aria-pressed={ouverte === cle}
                onClick={() => onOuvrir(cle)}
                className={[
                  "flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap pr-2",
                  fabrique || dehors ? "pl-2" : "",
                ].join(" ")}
              >
                <span>{nom}</span>
                {/* **Une valeur barrée, jamais une valeur effacée.** La place
                    porte toujours ses réglages : les cacher pendant qu'elle
                    dort les ferait croire perdus, et c'est exactement ce que la
                    veille promet de ne pas faire. */}
                {vaut && (
                  <span
                    className={
                      eteinte ? "text-texte-3 line-through" : "text-ancien-signal"
                    }
                  >
                    {vaut}
                  </span>
                )}
              </button>
            </span>
          </span>
        )
      })}
      </div>

      {/* **`tout défaire` vit au bout de la barre, pas dans l'en-tête d'une
          table.** Il y était posé en face du nom de la table, et il vidait la
          recette entière — donc il mentait sur sa portée. La barre *est* la
          recette : le geste qui la vide appartient à ce qui la représente. Le
          pied de chaque table garde son `Sans <table> ›`, qui ne touche qu'elle. */}
      <span aria-hidden className="mx-2 h-4 w-px shrink-0 bg-bord" />

      {/* **Les recettes vivent au bout de la barre, à côté de `tout défaire`.**
          Les deux ont la même portée — la recette entière, pas une place — et
          c'est ce qui les range ensemble, hors de ce qui défile : un geste de
          portée générale ne se cherche pas en faisant glisser une bande. */}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-expanded={ouvertes}
          onClick={() => setOuvertes((deja) => !deja)}
          className={[
            "mesure flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[2px] px-2 text-[10px] transition-colors duration-[80ms]",
            ouvertes ? "bg-fond-3 text-texte" : "text-texte-2 hover:bg-fond-2",
          ].join(" ")}
        >
          recettes ›
        </button>
        {ouvertes && (
          <PanneauDesRecettes
            recette={recette}
            nommees={recettes.nommees}
            annonce={recettes.annonce}
            aCopier={recettes.aCopier}
            onFermer={() => setOuvertes(false)}
            onLister={recettes.onLister}
            onCopier={recettes.onCopier}
            onColler={recettes.onColler}
            onEnregistrer={recettes.onEnregistrer}
            onAppliquer={recettes.onAppliquer}
            onOublier={recettes.onOublier}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onToutDefaire}
        className="mesure flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2 pr-4 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-ancien-echec"
      >
        <span aria-hidden>×</span> tout défaire
      </button>
    </div>
  )
}

// ── Le comparateur ──────────────────────────────────────────────────────────
//
// **Deux contrôles, parce qu'il y a deux questions.** Un seul groupe de quatre
// segments — `brut · rendu · côte à côte · superposé` — mélangeait *quelle image
// je regarde* et *combien d'images sont à l'écran*. Les quatre s'excluaient,
// donc c'était un choix ; ils s'excluaient parce qu'on les avait mis ensemble.
//
// **Ce que ça coûtait, mesuré table par table** : les quatre surfaces qui
// portent un geste — la pipette qui vise une couleur, le tracé de la sélection
// magique, le rectangle de recadrage, le pinceau — étaient toutes gardées par la
// même condition, `mode === "rendu" || mode === "brut"`, répétée quatre fois.
// Choisir une comparaison rendait deux balises `img` et **plus rien d'autre** :
// le panneau de gauche montrait toujours les réglages de la table, on pouvait
// changer un seuil, et on ne pouvait plus désigner un point sur l'image —
// c'est-à-dire faire ce pour quoi on avait ouvert les deux vues côte à côte.
//
// **La règle qui en sort** : *une comparaison ne retire jamais un geste ; elle
// pose un témoin à côté.* C'est elle qui interdit que le défaut revienne — la
// prochaine façon de comparer, un rideau, un clignotement, ne demandera pas non
// plus si l'outil doit disparaître.
//
// Douze combinaisons, douze qui marchent. Le tout est dessiné dans
// `docs/maquettes-v2.1/03bis-comparer-sans-lacher-l-outil.html`.

/** L'image que l'outil touche. **C'est toujours celle-là**, quel que soit le
 *  témoin posé à côté. */
type Travail = "brut" | "rendu"

/** Ce qu'on met à côté pour comparer. **Il ne porte jamais rien** : on le
 *  regarde, on n'y touche pas. */
type Temoin = "aucun" | "cote" | "dessus"

const TRAVAUX: Record<Travail, string> = { brut: "brut", rendu: "rendu" }

const TEMOINS: Record<Temoin, string> = {
  aucun: "aucun",
  cote: "à côté",
  dessus: "par-dessus",
}

/**
 * Sous l'image, sur toutes les tables.
 *
 * **Ce qu'on travaille se dit toujours** — écrit en clair, en ambre, dès que ce
 * n'est pas le rendu. Un état durable qu'on oublie est le danger que l'appui
 * *Avant ›* de C4 évitait ; le dire est ce qui autorise à le rendre durable.
 *
 * **Le témoin, lui, ne se redit pas** : son contrôle est à trois valeurs et il
 * porte déjà la sienne. La phrase ambre ne reste que pour le seul état qui
 * change ce qu'un outil touche vraiment.
 */
function Comparateur({
  asset,
  travail,
  onTravail,
  temoin,
  onTemoin,
  opacite,
  onOpacite,
  peint,
  onAvant,
  zoom,
  onZoom,
  ajuste,
}: {
  asset: Asset
  travail: Travail
  onTravail: (travail: Travail) => void
  temoin: Temoin
  onTemoin: (temoin: Temoin) => void
  opacite: number
  onOpacite: (opacite: number) => void
  /** La table ouverte se peint-elle ? **La seule chose que ça retire est le
   *  brut** : le pinceau écrit sur le résultat, et il n'y a rien à peindre sur
   *  une image d'origine que la recette réécrit ensuite. Les trois témoins,
   *  eux, lui sont ouverts — c'est même la table où comparer sert le plus, on
   *  peint un masque et on veut voir ce qu'il enlève pendant qu'on peint. */
  peint?: boolean
  onAvant?: (tenu: boolean) => void
  /** Le cran d'agrandissement choisi, ou `ajusté`. */
  zoom: ZoomTable
  onZoom: (zoom: ZoomTable) => void
  /** Ce que `ajusté` vaut en ce moment — il se dit à côté du contrôle, parce
   *  qu'un mot qui cache un nombre laisse deviner ce qu'on regarde. */
  ajuste: number
}) {
  /** Le mot qui dit de quoi le contrôle d'à côté répond.
   *
   *  **Il part avant les gestes**, comme les dimensions et pour la même raison :
   *  un libellé n'est pas un geste. L'ordre de sacrifice de la bande est donc
   *  entier — les dimensions, les deux libellés, et rien d'autre ne bouge. */
  const libelle = (nom: string) => (
    <span className="min-w-0 shrink overflow-hidden whitespace-nowrap text-texte-3">
      {nom}
    </span>
  )
  return (
    <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px]">
      {/* **Ce qui sort quand la place manque est une mesure, jamais un geste**
          (`docs/DESIGN.md`). Les dimensions sont la seule mesure de la bande
          qui se relise ailleurs — dans la fiche, dans le panneau —, donc elles
          partent en premier, et tout le reste est `shrink-0`.

          **Ce que ça rend, mesuré au navigateur** : la bande d'avant réclamait
          973 px en superposé pour 840 disponibles à 1 600 de fenêtre, les deux
          colonnes ouvertes, et ce qui sortait était le bouton. Celle-ci en
          réclame 753 avec ses libellés, 681 sans eux — elle tient à 1 600, et
          elle tient à 1 440 dès que les dimensions partent, ce qu'aucun
          arrangement de la bande d'avant ne permettait.

          **Une barre de défilement a été essayée et retirée** : elle prend
          16 px sur les 38 de la bande, et les segments de 26 s'y trouvent
          rognés de quatre. Une bande qui écrase ses contrôles ment sur leur
          état, ce que le produit s'interdit ailleurs ; sous 1 440, replier une
          colonne rend 380 px d'un coup. */}
      <span className="min-w-0 shrink truncate text-texte-3">
        {asset.largeur}×{asset.hauteur} · {asset.type_media}
      </span>

      {/* **Deux contrôles, deux questions.** *On travaille sur* dit quelle
          image porte l'outil ; *témoin* dit ce qu'on met à côté pour comparer.
          Aucun croisement n'est interdit. */}
      {libelle("sur")}
      <Segments
        valeurs={["brut", "rendu"] as const}
        valeur={travail}
        libelles={TRAVAUX}
        // **Montré grisé plutôt que caché**, la règle du produit : on apprend
        // qu'il existe. Le pinceau écrit sur le résultat, et l'appui *Avant ›*
        // juste à côté rend l'image d'origine le temps qu'on le tient.
        indisponibles={peint ? (["brut"] as const) : []}
        onChange={(v) => onTravail(v as Travail)}
      />
      {libelle("témoin")}
      <Segments
        valeurs={["aucun", "cote", "dessus"] as const}
        valeur={temoin}
        libelles={TEMOINS}
        onChange={(v) => onTemoin(v as Temoin)}
      />

      {/* **La bande fait 38 px, et elle ne grandit pas.** Mesuré au navigateur
          en tenant E5 : la phrase qui expliquait le grisé la faisait passer sur
          trois lignes, repliait les segments avec elle et poussait le bouton
          hors de l'écran. **Elle est descendue dans le panneau**, qui a la
          place d'une phrase ; ici il ne reste que le geste.

          **Il reste, et il change de raison.** Il existait pour compenser ce
          que la table qui peint retirait ; il n'y a plus rien à compenser. Un
          appui maintenu est simplement plus rapide que deux clics, et il ne
          coûte aucune place — c'est un geste, pas un réglage. */}
      {peint && (
        <button
          type="button"
          onPointerDown={() => onAvant?.(true)}
          onPointerUp={() => onAvant?.(false)}
          onPointerLeave={() => onAvant?.(false)}
          className="mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border border-bord-fort px-2 text-[10px] text-texte-2 hover:text-ancien-signal"
        >
          Avant ›
        </button>
      )}
      {temoin === "dessus" && (
        <input
          type="range"
          min={0}
          max={100}
          value={opacite}
          aria-label="Opacité du témoin par-dessus"
          onChange={(e) => onOpacite(Number(e.target.value))}
          className="w-[104px] shrink-0"
        />
      )}

      {/* **Le zoom, à côté des modes** — refait en U2. Il vit dans la fente qui
          existe déjà : la bande fait 38 px et elle ne grandit pas.

          Quatre commandes, et chacune fait une seule chose : *moins*, le pour
          cent qu'on écrit, *plus*, et le retour à cent — celui qui rend un
          pixel d'image pour un pixel d'écran. *ajusté* garde sa place, parce
          que c'est l'état d'ouverture et le seul qui suive le cadre. */}
      <span aria-hidden className="h-4 w-px shrink-0 bg-bord" />
      <CommandesDeZoom zoom={zoom} onZoom={onZoom} ajuste={ajuste} />

      {/* **Le PNG de l'état courant, depuis n'importe quelle table** (U2), et
          **habillé en bouton**. Il existait déjà, présent partout, et on ne le
          voyait pas : son libellé était en JetBrains Mono 10 px dans
          `--texte-2`, exactement l'habit des mesures de la bande. Dans une
          bande où sept éléments sur huit sont des faits en mono, un huitième
          fait en mono ne se lit pas comme un geste. Instrument Sans 11,5 px sur
          `--fond-2`, donc : la forme de tous les boutons compacts du produit,
          et la seule chose de la bande qui ne soit pas en mono. */}
      <a
        href={api.telechargementAsset(asset.identifiant, travail === "brut")}
        download={`${asset.label || asset.identifiant}${travail === "brut" ? "-brut" : ""}.png`}
        // **L'infobulle nomme toujours ce qu'il emporte** : le geste est le
        // même, ce qui part ne l'est pas.
        title={
          travail === "brut"
            ? "Télécharger l'image d'origine, telle qu'elle est arrivée"
            : "Télécharger le rendu, avec les passes de la recette"
        }
        className="flex h-[26px] shrink-0 items-center rounded-[2px] border border-bord-fort bg-fond-2 px-2 text-[11.5px] whitespace-nowrap text-texte-2 transition-colors duration-[80ms] hover:bg-fond-3 hover:text-ancien-signal"
      >
        PNG ↓
      </a>

      {/* **Le seul état durable qui change ce qu'un outil touche.** La phrase
          du mode disparaît avec le mode qu'elle nommait — le contrôle du témoin
          dit déjà la sienne, et redire une valeur qu'un segment allumé porte
          est du bruit. */}
      {travail === "brut" && (
        <span className="ml-auto shrink-0 whitespace-nowrap text-epingle">
          on travaille sur le brut
        </span>
      )}
    </div>
  )
}

/** *moins*, le pour cent, *plus*, et le retour à cent (U2).
 *
 *  **Le champ suit le zoom effectif, y compris en `ajusté`** : un champ vide
 *  pendant qu'on regarde une image à 59 % laisserait deviner le nombre, et ce
 *  produit écrit ses mesures. Il se réécrit sous les doigts pendant qu'on tape,
 *  et ne s'envoie qu'à Entrée ou en sortant — la règle des curseurs de T2, qui
 *  vaut ici pour la même raison : une valeur en cours de frappe est un état de
 *  passage, pas une intention. */
function CommandesDeZoom({
  zoom,
  onZoom,
  ajuste,
}: {
  zoom: ZoomTable
  onZoom: (zoom: ZoomTable) => void
  ajuste: number
}) {
  const effectif = zoom === "ajuste" ? ajuste : zoom
  const [ecrit, setEcrit] = useState<string | null>(null)

  const valider = (texte: string) => {
    setEcrit(null)
    const lu = Number.parseInt(texte.replace(/[^\d]/g, ""), 10)
    // **Hors bornes, on ramène — on ne refuse pas.** Un champ qui rejette une
    // frappe oblige à deviner ce qu'il accepte ; un champ qui ramène le dit en
    // affichant la valeur retenue.
    if (Number.isFinite(lu)) onZoom(borner(lu))
  }

  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Reculer"
        title="Reculer"
        disabled={effectif <= ZOOM_MIN}
        onClick={() =>
          onZoom(
            borner(
              [...ARRETS_ZOOM].reverse().find((a) => a < effectif) ?? ZOOM_MIN,
            ),
          )
        }
        className="h-[24px] w-[24px] rounded-[2px] border border-bord-fort text-texte-2 hover:text-ancien-signal disabled:cursor-not-allowed disabled:text-texte-3"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Pour cent d'agrandissement"
        value={ecrit ?? `${effectif}`}
        onChange={(e) => setEcrit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") valider((e.target as HTMLInputElement).value)
          // Échap rend la valeur d'avant — comme partout ailleurs.
          if (e.key === "Escape") setEcrit(null)
        }}
        onBlur={(e) => ecrit !== null && valider(e.target.value)}
        className="mesure h-[24px] w-[44px] rounded-[2px] border border-bord bg-fond-2 px-1 text-right text-[10px] text-texte tabular-nums"
      />
      <span className="text-texte-3">%</span>
      <button
        type="button"
        aria-label="Approcher"
        title="Approcher"
        disabled={effectif >= ZOOM_MAX}
        onClick={() =>
          onZoom(borner(ARRETS_ZOOM.find((a) => a > effectif) ?? ZOOM_MAX))
        }
        className="h-[24px] w-[24px] rounded-[2px] border border-bord-fort text-texte-2 hover:text-ancien-signal disabled:cursor-not-allowed disabled:text-texte-3"
      >
        +
      </button>
      <button
        type="button"
        title="Un pixel d'image pour un pixel d'écran"
        onClick={() => onZoom(100)}
        className={`mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border px-2 text-[10px] ${
          zoom === 100
            ? "border-ancien-signal bg-fond-3 text-ancien-signal"
            : "border-bord-fort text-texte-2 hover:text-ancien-signal"
        }`}
      >
        100 %
      </button>
      <button
        type="button"
        title="Toute l'image dans le cadre"
        onClick={() => onZoom("ajuste")}
        className={`mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border px-2 text-[10px] ${
          zoom === "ajuste"
            ? "border-ancien-signal bg-fond-3 text-ancien-signal"
            : "border-bord-fort text-texte-2 hover:text-ancien-signal"
        }`}
      >
        ajusté
      </button>
    </span>
  )
}

// ── Le zoom de la table ─────────────────────────────────────────────────────

/**
 * **Un zoom d'outil, pas un zoom de vitrine** (U2, arbitrage du 31 août 2026).
 *
 * La table n'offrait que des multiples entiers — 1×, 2×, 4×, 8×, 16× — plus un
 * *ajusté* qui ne descendait jamais sous 1×. La règle qui l'imposait est celle
 * de la vitrine et de la grille : un sprite agrandi à une échelle qui n'est pas
 * entière fabrique des pixels qui n'existent pas, et on jugerait alors un
 * défaut né de la fenêtre où on l'a regardé. **Elle appartient à ce qui
 * *montre* une image ; l'atelier est ce qui la *travaille*.**
 *
 * Le prix de l'avoir appliquée ici est mesuré, et c'est U2 entière : une image
 * d'origine de 1 024 px de côté dans un cadre de 606 × 626 ne pouvait pas
 * descendre sous 1×, donc on n'en voyait **qu'un coin** — et ce coin étant
 * transparent, ce que l'écran montrait était le damier. C'est le « bruit » du
 * relevé d'usage, et c'est ce qui a fait croire que la table de recadrage était
 * cassée.
 *
 * Le pour cent est donc **libre entre 1 et 250**, il s'écrit à la main, et il
 * n'a plus de marque.
 */
const ZOOM_MIN = 1
const ZOOM_MAX = 250

/** Les arrêts de *plus* et *moins*.
 *
 *  **Une échelle, pas un pas fixe.** Un pas de dix pour cent demanderait vingt
 *  clics pour traverser la plage, et un pas multiplicatif rendrait des nombres
 *  que personne n'écrirait — 141 %, 199 %. La liste ci-dessous est serrée là où
 *  l'on règle et lâche là où l'on regarde de loin, et elle contient 100, qui
 *  est le seul arrêt qui ait un sens propre. */
const ARRETS_ZOOM = [
  1, 3, 6, 12, 25, 33, 50, 66, 75, 100, 125, 150, 175, 200, 225, 250,
] as const

/** `ajusté` n'est pas un arrêt : c'est **le pour cent qui fait tenir l'image
 *  entière dans le cadre**, recalculé quand le cadre change. Il est l'état
 *  d'ouverture, et il peut descendre sous cent — c'était tout le défaut. */
type ZoomTable = number | "ajuste"

const borner = (pour_cent: number) =>
  Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(pour_cent)))

/** Les 24 px de `p-6`, des deux côtés — la marge du cadre, à retirer de ce qui
 *  est disponible. Écrite ici parce que la mesure et la classe doivent dire la
 *  même chose, et qu'elles sont à deux endroits. */
const MARGE_CADRE = 48

// ── L'écran ─────────────────────────────────────────────────────────────────

export function EcranTables({
  asset,
  soeurs,
  traitement,
  univers,
  ouverte,
  onOuvrir,
  onSoeur,
  decoupe,
  onErreur,
  onUnivers,
  BlocPasse,
}: {
  asset: Asset
  /** Les images voisines — les attitudes de la chose, ou les tuiles de la
   *  grille. **On passe à l'image voisine sans que la table ouverte se
   *  referme** : c'est le geste qui distingue une table d'un panneau. */
  soeurs: Asset[]
  traitement: EtatTraitement
  univers: Univers
  ouverte: Table
  onOuvrir: (table: Table) => void
  onSoeur: (identifiant: string) => void
  /** La fabrique du découpage, rendue **dans le cadre de la table** — pas
   *  ailleurs. « On ne le cherche plus : il est là quand il sert. » */
  decoupe: React.ReactNode
  onErreur: (raison: string) => void
  /** **Le dossier du jeu vient de changer** (M7) — promouvoir un détourage en
   *  défaut du projet l'écrit, et l'atelier doit en tenir compte sans recharger.
   *  Absent, le geste se fait quand même : c'est l'écran d'à côté qui montrerait
   *  l'ancien réglage jusqu'au prochain aller-retour. */
  onUnivers?: (univers: Univers) => void
  /** Le bloc d'une passe de détourage, rendu par la fiche depuis T2. Passé en
   *  paramètre plutôt qu'importé : il vit encore dans la fiche, et E4 le fera
   *  descendre ici avec le reste. */
  BlocPasse: React.ComponentType<any>
}) {
  const { recette, setRecette, regler, poser, revenirAuBrut } = useRecette(
    asset,
    onErreur,
  )
  const mesures = useMesures(asset)
  const [travail, setTravail] = useState<Travail>("rendu")
  const [temoin, setTemoin] = useState<Temoin>("aucun")
  const [opacite, setOpacite] = useState(50)
  const etatMain = useEtatMain(univers)
  /** **Tenir montre l'avant** — un état d'appui, jamais une bascule : une
   *  bascule laisserait l'écran sur l'avant après le regard, et la retouche
   *  suivante se ferait sur une image qui n'est pas celle qu'on croit. */
  const [avant, setAvant] = useState(false)

  /** La passe de détourage qui attend son clic dans l'image, ou `null`.
   *
   *  **L'état vit ici et pas dans la colonne** : la passe se règle à gauche et
   *  se vise au milieu, et les deux moitiés du geste n'ont que cet écran-ci en
   *  commun. */
  const [viseeArmee, setViseeArmee] = useState<number | null>(null)
  /** **Dérivée, jamais nettoyée par un effet.** Retirer une passe ou la faire
   *  repasser au bord laisserait un rang armé qui ne désigne plus rien ; le
   *  vérifier au moment de s'en servir évite d'avoir à le corriger après coup,
   *  et un état qu'on corrige après coup est visible un rendu sur deux. */
  const visee =
    viseeArmee !== null && recette.passes[viseeArmee]?.moteur === "couleur"
      ? viseeArmee
      : null
  /** La passe qui attend qu'on **entoure** dans l'image (U12) — le même état
   *  armé, lu par l'autre moteur. Deux états auraient pu s'armer ensemble, et
   *  la surface aurait alors reçu deux gestes à la fois. */
  const entourage =
    viseeArmee !== null && recette.passes[viseeArmee]?.moteur === "trace"
      ? viseeArmee
      : null

  const dehors = indisponible(ouverte, traitement, mesures)

  // ── Une table éteinte se réveille dès qu'on la touche, et elle le dit ─────
  //
  // **C'était l'autre moitié du relevé de séance** (U4). Rien ne distinguait à
  // l'écran une table qui agit d'une table qui n'agit pas, et toucher n'importe
  // quel réglage la rallumait sans prévenir : on posait une valeur, l'image
  // changeait pour deux raisons à la fois, et l'on ne savait plus laquelle
  // regarder.
  //
  // **Réveiller plutôt que refuser**, et c'est le choix qui compte : bloquer un
  // curseur parce que sa table dort obligerait à faire un geste préalable pour
  // avoir le droit de faire le geste qu'on voulait. Toucher un réglage *dit*
  // qu'on veut cette place ; la rallumer est la lecture juste de ce geste. Ce
  // qu'on doit à l'auteur, c'est de le lui dire — pas de l'en empêcher.
  const eteinte = dort(recette, ouverte)
  const [reveil, setReveil] = useState<string | null>(null)
  useEffect(() => setReveil(null), [ouverte, asset.identifiant])

  const veiller = useCallback(
    (table: Table, endort: boolean) => {
      if (table === ouverte) setReveil(null)
      void poser(avecVeille(recette, table, endort))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recette, ouverte, poser],
  )

  /** Le même `poser`, qui réveille la table ouverte au passage.
   *
   *  **Posé autour du couple, jamais dans `useRecette`.** Le crochet sert toutes
   *  les recettes de l'écran, y compris celle que la barre pose pour endormir ;
   *  un réveil câblé là-dedans aurait rendu l'endormissement impossible — poser
   *  la recette qui endort aurait rallumé la place dans le même souffle. Ici, le
   *  réveil sait *quelle table est ouverte* et n'agit que pour elle.
   *
   *  **Et sur `poser` seul, pas sur `regler`.** `regler` ne fait que bouger
   *  l'état local — il part cent fois pendant qu'un curseur glisse. Réveiller
   *  là aurait annoncé le réveil au premier pixel de glissement, avant même
   *  qu'une valeur soit posée, et l'annonce serait partie avant le geste
   *  qu'elle décrit. */
  const poserEveille = (suivante: Recette) => {
    if (!dort(suivante, ouverte)) return poser(suivante)
    setReveil(
      `${TABLES.find((t) => t.cle === ouverte)?.nom ?? "cette table"} s'est rallumée : tu viens d'y toucher un réglage.`,
    )
    return poser(avecVeille(suivante, ouverte, false))
  }

  const reglages = {
    recette,
    univers,
    traitement,
    regler,
    poser: poserEveille,
    mesures,
  }

  // ── Ce qui voyage d'une image à l'autre (U5) ──────────────────────────────
  //
  // **La liste des noms est relue à l'ouverture du panneau, et une seule fois
  // par ouverture.** Elle vit sur le disque de l'atelier, pas dans cet écran :
  // une seconde fenêtre peut en avoir nommé une entre-temps. Les gestes qui la
  // changent — enregistrer, oublier — rendent la liste entière, donc rien n'est
  // relu entre deux ouvertures.
  const [nommees, setNommees] = useState<string[]>([])

  /** Ce que le dernier voyage a laissé — `null` tant qu'il n'y en a pas eu.
   *
   *  **Une liste vide et `null` ne disent pas la même chose** : la première dit
   *  *tout a voyagé*, la seconde dit *rien ne s'est encore passé*. Les
   *  confondre aurait effacé la seule bonne nouvelle que le panneau ait à
   *  donner. */
  const [annonce, setAnnonce] = useState<string[] | null>(null)
  const [aCopier, setACopier] = useState(copiee !== null)

  // **L'annonce ne suit pas l'image.** Elle décrit ce qui vient d'être posé
  // *ici* ; la garder en passant à la sœur d'à côté la ferait lire comme le
  // compte rendu d'un collage qui n'a pas eu lieu sur celle-là.
  useEffect(() => setAnnonce(null), [asset.identifiant])

  /** Ce que le serveur a posé revient dans l'écran, recette comprise.
   *
   *  Coller et appliquer ne passent pas par `poser` : c'est le serveur qui
   *  décide de ce qui arrive, et l'écran doit prendre ce qu'il a décidé plutôt
   *  que ce qu'il avait envoyé. */
  const recevoir = (recu: { asset: Asset; laisse: string[] }) => {
    setRecette(recu.asset.recette)
    setAnnonce(recu.laisse)
  }

  const recettes = {
    nommees,
    annonce,
    aCopier,
    onLister: () => {
      void api
        .recettesNommees()
        .then((recu) => setNommees(Object.keys(recu.recettes).sort()))
        // Une liste qu'on n'a pas pu lire est une liste vide **et rien de
        // plus** : le panneau dit alors « aucune recette nommée », ce qui est
        // faux mais sans conséquence, là où un refus en travers du panneau
        // empêcherait de copier et de coller, qui n'en dépendent pas.
        .catch(() => setNommees([]))
    },
    onCopier: () => {
      copiee = recette
      setACopier(true)
      setAnnonce(null)
    },
    onColler: () => {
      if (copiee === null) return
      void api
        .collerRecette(asset.identifiant, copiee)
        .then(recevoir)
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "collage refusé"),
        )
    },
    onEnregistrer: (nom: string) => {
      void api
        .nommerRecette(nom, recette)
        .then((recu) => {
          setNommees(Object.keys(recu.recettes).sort())
          setAnnonce(recu.laisse)
        })
        .catch((erreur) =>
          onErreur(
            erreur instanceof Error ? erreur.message : "recette non enregistrée",
          ),
        )
    },
    onAppliquer: (nom: string) => {
      void api
        .appliquerRecette(asset.identifiant, nom)
        .then(recevoir)
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "recette refusée"),
        )
    },
    onOublier: (nom: string) => {
      void api
        .oublierRecette(nom)
        .then((recu) => setNommees(Object.keys(recu.recettes).sort()))
        .catch((erreur) =>
          onErreur(erreur instanceof Error ? erreur.message : "oubli refusé"),
        )
    },
  }

  /** **Une table qui se peint travaille sur le rendu**, et c'est tout ce
   *  qu'elle impose désormais.
   *
   *  Elle forçait les quatre modes à un seul, et l'argument qui l'imposait
   *  était *côte à côte* : deux images à l'écran, et la main n'aurait pas su
   *  sur laquelle elle écrit. L'argument tombe avec la scène qui l'a créé — le
   *  témoin ne porte plus rien, l'anneau `--lumiere` dit laquelle est
   *  l'ouvrage, et la surimpression ne prend pas le pointeur. **Il ne reste que
   *  le brut**, et pour une autre raison : le pinceau écrit sur le résultat,
   *  et une image d'origine que la recette réécrit derrière n'a rien à
   *  recevoir. C'est même la table où comparer sert le plus — on peint un
   *  masque, on veut voir ce qu'il enlève pendant qu'on peint. */
  const peint = ouverte === "main"
  useEffect(() => {
    if (peint) setTravail("rendu")
  }, [peint])

  // ── L'image ouvre à la taille du cadre ────────────────────────────────────
  //
  // **Cet écran n'a qu'un métier : montrer des pixels assez grands pour qu'on
  // les juge.** Il ne le tenait pas. L'image s'affichait un pixel d'image pour
  // un pixel d'écran, quelle que soit la table — mesuré le 31 août 2026, un
  // sprite de 96 × 96 occupait **1,9 %** d'un cadre de 670 × 742, et aucune
  // commande de zoom n'existait, ni bouton, ni molette annoncée, ni raccourci.
  //
  // Ce qui rendait le défaut invisible est la table de **recadrage** : elle
  // travaille sur l'image d'origine, qui fait cinq cents pixels de côté et
  // remplit l'écran. Toutes les tables qui travaillent sur le **résultat** —
  // celui de 96 ou 128 px, c'est-à-dire le sprite du jeu — redevenaient un
  // timbre-poste. Le pire cas était **la main**, celle où l'on repeint pixel
  // par pixel : la table qui demande le plus de précision offrait le moins.
  //
  // Rien de neuf n'est inventé : `image-rendering: pixelated` était déjà posé
  // partout, et les surfaces qui reçoivent un geste — la main, la pipette, le
  // rectangle de recadrage — lisent toutes leurs coordonnées dans le rectangle
  // rendu, jamais dans une taille supposée. Agrandir le cadre les suit donc
  // sans qu'aucune ne change de calcul.
  const cadre = useRef<HTMLDivElement>(null)
  const [dispo, setDispo] = useState({ largeur: 0, hauteur: 0 })

  // Pas de `ResizeObserver` — le piège s'est refermé quatre fois dans ce dépôt
  // (`docs/PIEGES.md`) : un onglet qui ne compose pas ses images ne reçoit
  // jamais ses rappels. Un rectangle se lit à la demande, dans tous les cas.
  const mesurerCadre = useCallback(() => {
    const noeud = cadre.current
    if (!noeud) return
    const largeur = noeud.clientWidth - MARGE_CADRE
    const hauteur = noeud.clientHeight - MARGE_CADRE
    setDispo((deja) =>
      Math.abs(deja.largeur - largeur) < 1 && Math.abs(deja.hauteur - hauteur) < 1
        ? deja
        : { largeur, hauteur },
    )
  }, [])

  useLayoutEffect(mesurerCadre, [
    mesurerCadre,
    ouverte,
    travail,
    temoin,
    dehors,
    asset.identifiant,
  ])
  useEffect(() => {
    window.addEventListener("resize", mesurerCadre)
    return () => window.removeEventListener("resize", mesurerCadre)
  }, [mesurerCadre])

  // **Ce qui est réellement sous les yeux, et ce n'est pas toujours le rendu.**
  // Le rectangle de recadrage et la pipette se posent sur l'image d'origine —
  // c'est ce qui les fait survivre aux passes qui les précèdent —, et le mode
  // *brut* la montre aussi. Mesurer le cadre sur le rendu dans ces cas-là
  // donnerait un ajustement calculé sur une image qui n'est pas à l'écran.
  const surLeBrut =
    travail === "brut" ||
    ouverte === "recadrage" ||
    (ouverte === "detourage" && visee !== null)
  const largeurVue = (surLeBrut ? asset.largeur : asset.rendu_largeur || asset.largeur) || 1
  const hauteurVue = (surLeBrut ? asset.hauteur : asset.rendu_hauteur || asset.hauteur) || 1

  const [zoom, setZoom] = useState<ZoomTable>("ajuste")
  // Changer d'image rouvre en ajusté : la sœur suivante n'a aucune raison
  // d'hériter du cran choisi pour la précédente, qui peut faire trois fois sa
  // taille.
  useEffect(() => setZoom("ajuste"), [asset.identifiant])

  /** **Le pour cent qui fait tenir l'image entière dans le cadre** (U2).
   *
   *  Il descend sous cent, et c'est tout ce qui change : le calcul d'avant
   *  plafonnait à un plancher de 1× — donc une image de 1 024 px dans un cadre
   *  de 606 n'en montrait qu'un coin, et ce coin étant transparent, l'écran
   *  montrait le damier. Il ne s'arrondit plus à un multiple entier non plus :
   *  la règle des multiples entiers appartient à ce qui *montre* une image, pas
   *  à ce qui la travaille. */
  const ajuste = borner(
    Math.min(
      dispo.largeur > 0
        ? dispo.largeur / (largeurVue * (temoin === "cote" ? 2 : 1))
        : 1,
      dispo.hauteur > 0 ? dispo.hauteur / hauteurVue : 1,
    ) * 100 || 100,
  )
  const facteur = (zoom === "ajuste" ? ajuste : zoom) / 100

  /** La boîte où l'image se pose, en pixels d'écran. Tout ce qui se rend au
   *  milieu la remplit — l'image seule, les deux côte à côte, la surface qui se
   *  peint —, et c'est elle, et elle seule, qui porte le zoom. */
  const boiteCadre = {
    width: Math.max(
      1,
      Math.round(
        largeurVue * facteur * (temoin === "cote" ? 2 : 1) +
          (temoin === "cote" ? 16 : 0),
      ),
    ),
    height: Math.max(1, Math.round(hauteurVue * facteur)),
  }

  // ── La molette approche et recule, et le point visé ne bouge pas ──────────
  //
  // **Un écouteur natif et non `onWheel`.** React pose ses écouteurs de molette
  // en *passif* sur la racine : `preventDefault` y est ignoré, et la page
  // défilerait derrière le zoom. Posé à la main avec `{ passive: false }`, il
  // arrête le défilement — c'est un critère de l'étape, et c'est aussi la
  // seule façon de rendre la molette utilisable dans un cadre qui défile.
  //
  // **Le point sous le pointeur reste sous le pointeur**, et ça se fait en deux
  // temps : on note où l'on était *dans l'image* au moment du geste, puis on
  // rattrape le défilement une fois que la nouvelle taille est posée. Le faire
  // en un temps demanderait de prédire la mise en page — les marges
  // automatiques qui centrent une image plus petite que son cadre, la garde de
  // 24 px — et une prédiction fausse se voit comme un sursaut.
  const boite = useRef<HTMLDivElement>(null)
  const ancre = useRef<{ ux: number; uy: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const noeud = cadre.current
    if (!noeud) return
    const molette = (evenement: WheelEvent) => {
      evenement.preventDefault()
      const rectangle = boite.current?.getBoundingClientRect()
      if (rectangle && rectangle.width > 0 && rectangle.height > 0)
        ancre.current = {
          ux: (evenement.clientX - rectangle.left) / rectangle.width,
          uy: (evenement.clientY - rectangle.top) / rectangle.height,
          x: evenement.clientX,
          y: evenement.clientY,
        }
      // Un cran de molette vaut un huitième d'octave : assez pour que le geste
      // réponde, assez peu pour qu'on s'arrête où l'on veut.
      const pas = evenement.deltaY < 0 ? 1.09 : 1 / 1.09
      setZoom((courant) =>
        borner((courant === "ajuste" ? ajusteVu.current : courant) * pas),
      )
    }
    noeud.addEventListener("wheel", molette, { passive: false })
    return () => noeud.removeEventListener("wheel", molette)
  }, [])

  // `ajuste` est recalculé à chaque rendu ; l'écouteur, lui, est posé une fois.
  // Un repère plutôt qu'une dépendance : rebrancher l'écouteur à chaque
  // redimensionnement du cadre en poserait un par image de rendu.
  const ajusteVu = useRef(ajuste)
  ajusteVu.current = ajuste

  useLayoutEffect(() => {
    const vise = ancre.current
    ancre.current = null
    const noeud = cadre.current
    const rectangle = boite.current?.getBoundingClientRect()
    if (!vise || !noeud || !rectangle) return
    noeud.scrollLeft += rectangle.left + vise.ux * rectangle.width - vise.x
    noeud.scrollTop += rectangle.top + vise.uy * rectangle.height - vise.y
  }, [facteur])

  // Ctrl + Z retire le dernier passage de la couche active. La touche n'est
  // écoutée que dans la table de la main : ailleurs elle appartient à la toile
  // du tableau d'inspiration, et deux piles d'annulation sur la même touche
  // seraient une pile de trop.
  useEffect(() => {
    if (!peint) return
    const ecouter = (evenement: KeyboardEvent) => {
      if (!(evenement.ctrlKey || evenement.metaKey) || evenement.key !== "z") return
      const main = mainDe(recette)
      if (passagesDe(main) === 0) return
      evenement.preventDefault()
      void poser({ ...recette, main: sansLeDernier(main, etatMain.actif) })
    }
    window.addEventListener("keydown", ecouter)
    return () => window.removeEventListener("keydown", ecouter)
  }, [peint, recette, etatMain.actif, poser])

  return (
    <div data-tables className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BarreDesTables
        recette={recette}
        traitement={traitement}
        mesures={mesures}
        ouverte={ouverte}
        onOuvrir={onOuvrir}
        onVeille={veiller}
        onToutDefaire={() => void revenirAuBrut()}
        recettes={recettes}
      />

      {/* **La fabrique prend le cadre entier.** Elle ne pose rien sur l'image
          courante : elle en écrit d'autres, et le montrer entre une colonne de
          réglages et une colonne de sœurs mentirait sur ce qu'elle fait. */}
      {ouverte === "decoupage" ? (
        decoupe
      ) : ouverte === "superposition" ? (
        <EcranSuperposition
          asset={asset}
          soeurs={soeurs}
          onErreur={onErreur}
          onFabrique={(nees) => nees.length > 0 && onSoeur(nees[0].identifiant)}
        />
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-[380px_minmax(0,1fr)_380px]">
        {/* ── La colonne de la table ────────────────────────────────────── */}
        <aside
          {...PANNEAU}
          className="flex min-h-0 flex-col border-r border-bord bg-fond-1"
        >
          <EnTetePanneau>{TABLES.find((t) => t.cle === ouverte)?.nom}</EnTetePanneau>

          {/* **Une table éteinte le dit quand on l'ouvre** (U4), et le geste
              pour la rallumer est là, dans la phrase qui l'annonce. Au-dessus
              de la zone qui défile : une bande qui dirait *ceci ne s'applique
              pas* et qui pourrait sortir de l'écran en faisant glisser les
              réglages serait pire que pas de bande du tout. */}
          {!dehors && eteinte && (
            <div
              data-table-eteinte
              className="mesure flex shrink-0 items-start gap-2 border-b border-bord bg-fond-2 px-3 py-2 text-[10px] text-texte-2"
            >
              <span aria-hidden className="mt-[3px]">
                <Carre etat="eteinte" />
              </span>
              <p className="min-w-0 flex-1">
                Cette table est éteinte : ses réglages sont gardés et elle ne
                change pas l'image.{" "}
                <button
                  type="button"
                  onClick={() => veiller(ouverte, false)}
                  className="text-ancien-signal underline-offset-2 hover:underline"
                >
                  La rallumer ›
                </button>
              </p>
            </div>
          )}

          {/* L'annonce du réveil. Elle reste jusqu'à ce qu'on change de table :
              une phrase qui s'efface toute seule au bout de trois secondes se
              rate exactement quand on regardait l'image plutôt que la colonne
              — c'est-à-dire toujours, puisqu'on venait de poser un réglage. */}
          {!dehors && reveil && (
            <p
              data-table-reveillee
              role="status"
              className="mesure shrink-0 border-b border-bord bg-fond-2 px-3 py-2 text-[10px] text-ancien-signal"
            >
              {reveil}
            </p>
          )}

          <div
            className={[
              "defile flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3",
              // **Éteinte, pas verrouillée.** Les réglages restent lisibles et
              // manœuvrables — les toucher rallume la table, et c'est le geste
              // que l'on veut rendre possible. L'opacité dit *ceci ne
              // s'applique pas en ce moment*, elle n'interdit rien.
              eteinte ? "opacity-50" : "",
            ].join(" ")}
          >
            {dehors ? (
              // **À la place des réglages, jamais à côté d'eux.** Une table
              // indisponible n'a rien à régler : montrer des contrôles morts
              // sous une raison serait proposer puis refuser.
              <Raison texte={dehors} />
            ) : ouverte === "detourage" ? (
              <PanneauDetourage
                {...reglages}
                BlocPasse={BlocPasse}
                visee={visee}
                onViser={setViseeArmee}
                promotion={
                  <PromouvoirLeDetourage
                    asset={asset}
                    recette={recette}
                    univers={univers}
                    onUnivers={onUnivers}
                    onErreur={onErreur}
                  />
                }
              />
            ) : ouverte === "recadrage" ? (
              <PanneauRecadrage {...reglages} />
            ) : ouverte === "grille" ? (
              <PanneauGrille {...reglages} />
            ) : ouverte === "quantification" ? (
              <PanneauQuantification {...reglages} />
            ) : ouverte === "bords" ? (
              <PanneauBords {...reglages} />
            ) : ouverte === "contours" ? (
              <PanneauContours {...reglages} />
            ) : ouverte === "retournement" ? (
              <PanneauRetournement
                {...reglages}
                asset={asset}
                onErreur={onErreur}
                onFabrique={(miroir) => onSoeur(miroir.identifiant)}
              />
            ) : ouverte === "main" ? (
              <PanneauMain {...reglages} etat={etatMain} />
            ) : null}
          </div>

          {/* **Le pied de chaque table ne touche qu'elle.** Deux échelles, deux
              endroits, et chacun dit lequel : `tout défaire` vide la recette au
              bout de la barre, `Sans <table>` vide cette place-ci. */}
          {/* **Vider une table éteinte l'éteint plus** : la place n'a plus rien
              à mettre en veille, et laisser son nom dans la liste garderait un
              interrupteur qui ne commande rien. C'est `poser` et non le `poser`
              qui réveille : on ne vient pas de toucher un réglage, on vient de
              tout retirer, et l'annoncer comme un réveil serait faux. */}
          {!dehors && VIDER[ouverte] && (
            <button
              type="button"
              onClick={() =>
                void poser(avecVeille(VIDER[ouverte]!(recette), ouverte, false))
              }
              className="mesure h-[26px] shrink-0 border-t border-bord px-3 text-left text-[10px] text-texte-3 hover:text-ancien-signal"
            >
              Sans {TABLES.find((t) => t.cle === ouverte)?.nom} ›
            </button>
          )}
        </aside>

        {/* ── L'image, en grand ─────────────────────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-col">
          {/* `m-auto` sur la boîte plutôt que `justify-center` sur le cadre :
              un contenu centré par `justify-center` déborde des **deux** côtés
              et le début devient inatteignable au défilement. C'est le piège
              classique de la paire centrage + débordement, et il se voit dès le
              premier cran au-dessus de l'ajusté. */}
          <div
            ref={cadre}
            className="defile flex min-h-0 flex-1 overflow-auto p-6"
          >
            <div
              ref={boite}
              data-boite-image
              className="m-auto flex shrink-0 items-center justify-center gap-4"
              style={boiteCadre}
            >
            {/* **Le témoin à gauche, le travail à droite**, comme le côte à
                côte d'avant — le brut était déjà à gauche et le rendu à droite.
                On ne déplace pas une habitude pour rien : ce qui change est ce
                qu'on peut faire dans la moitié droite, pas où elle est. */}
            {temoin === "cote" && (
              <img
                src={api.rendu(
                  asset.identifiant,
                  asset.empreinte,
                  travail !== "brut",
                )}
                alt={`${asset.label}, témoin — ${travail === "brut" ? "le rendu" : "l'image d'origine"}`}
                className="damier h-full w-1/2 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            )}

            {/* **L'image de travail, cerclée de la lampe.** `--lumiere` est ce
                que le produit emploie déjà pour dire *choisi* — le calque
                actif, la vignette retenue, la teinte posée. Aucune couleur
                neuve, et l'anneau ne paraît que quand un témoin est là : seule,
                il n'y aurait rien à distinguer. */}
            <span
              className={[
                "relative flex items-center justify-center",
                temoin === "cote" ? "h-full w-1/2" : "h-full w-full",
                temoin === "aucun" ? "" : "ring-1 ring-lumiere",
              ].join(" ")}
            >
              {peint ? (
                // **La surface se peint, et elle est la seule.** Pas de
                // poignée, pas de rectangle, pas de cible : une cible de
                // retaille au milieu d'une surface qu'on peint est un piège à
                // clic, et ici toute la surface est peignable.
                <ToileDeLaMain
                  asset={asset}
                  avant={avant}
                  etat={etatMain}
                  onPassage={(trait) =>
                    void poser({
                      ...recette,
                      main: avecPassage(mainDe(recette), etatMain.actif, trait),
                    })
                  }
                />
              ) : ouverte === "detourage" && visee !== null ? (
                // **On vise sur le brut, et pas sur le rendu.** Le point est en
                // pixels de l'image d'origine — c'est ce qui le fait survivre
                // aux passes qui le précèdent —, et le rendu porte le recadrage
                // et la remise sur grille, qui déplacent tous les deux ce qu'on
                // montre. Un cercle posé sur un rendu recadré désignerait un
                // autre pixel que celui qu'on croit toucher. Même raison, même
                // choix que le rectangle de recadrage.
                <PipetteSurImage
                  asset={asset}
                  point={recette.passes[visee].point}
                  onPoint={(point) => {
                    void poser({
                      ...recette,
                      passes: recette.passes.map((p, i) =>
                        i === visee ? { ...p, point } : p,
                      ),
                    })
                    // **Le clic désarme.** Viser est un geste qui se termine ;
                    // une visée qui reste armée ferait du prochain regard sur
                    // l'image un déplacement du point, sans que rien l'ait
                    // demandé.
                    setViseeArmee(null)
                  }}
                />
              ) : ouverte === "detourage" && entourage !== null ? (
                // **On entoure sur le brut, exactement comme on y vise** (U12) :
                // la forme est en pixels de l'image d'origine, ce qui la fait
                // survivre aux passes qui la précèdent, et le rendu porte le
                // recadrage et la remise sur grille, qui déplacent tous les
                // deux ce qu'on montre.
                <TraceSurImage
                  asset={asset}
                  trace={recette.passes[entourage].trace}
                  onTrace={(trace) => {
                    void poser({
                      ...recette,
                      passes: recette.passes.map((p, i) =>
                        i === entourage ? { ...p, trace } : p,
                      ),
                    })
                    // Le tracé fini désarme, pour la raison du clic de la
                    // pipette.
                    setViseeArmee(null)
                  }}
                />
              ) : ouverte === "recadrage" ? (
                // **Le rectangle se pose sur l'image, jamais dans un champ.**
                // Le modèle le porte depuis T2 et aucun écran ne l'avait
                // montré : on ne dessine pas un cadrage en tapant quatre
                // nombres, on le dessine en regardant ce qu'il garde.
                <CadreDeRecadrage
                  asset={asset}
                  boite={
                    (recette.recadrage?.boite as
                      | [number, number, number, number]
                      | undefined) ?? null
                  }
                  obtenue={mesures?.recadrage?.obtenue ?? null}
                  onBoite={(boite) =>
                    void poser({
                      ...recette,
                      recadrage: { marge: recette.recadrage?.marge ?? 0, boite },
                    })
                  }
                />
              ) : (
                <img
                  src={api.rendu(
                    asset.identifiant,
                    asset.empreinte,
                    travail === "brut",
                  )}
                  alt={asset.label}
                  className="damier h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              )}

              {/* **Un calque de lecture, et il ne prend pas le pointeur.** Le
                  curseur le traverse, le geste tombe sur l'image de travail, et
                  le curseur d'opacité continue de dire ce qu'on voit. Une image
                  posée par-dessus qui intercepte les clics serait le défaut
                  d'hier déguisé. */}
              {temoin === "dessus" && (
                <img
                  src={api.rendu(
                    asset.identifiant,
                    asset.empreinte,
                    travail !== "brut",
                  )}
                  alt={`${asset.label}, témoin — ${travail === "brut" ? "le rendu" : "l'image d'origine"}`}
                  style={{ imageRendering: "pixelated", opacity: opacite / 100 }}
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                />
              )}
            </span>
            </div>
          </div>
          <Comparateur
            asset={asset}
            travail={travail}
            onTravail={setTravail}
            temoin={temoin}
            onTemoin={setTemoin}
            opacite={opacite}
            onOpacite={setOpacite}
            peint={peint}
            onAvant={setAvant}
            zoom={zoom}
            onZoom={setZoom}
            ajuste={ajuste}
          />
        </div>

        {/* ── Ses sœurs ─────────────────────────────────────────────────── */}
        <aside
          {...PANNEAU}
          className="flex min-h-0 flex-col border-l border-bord bg-fond-1"
        >
          <EnTetePanneau>Ses sœurs</EnTetePanneau>
          <div className="defile flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto p-2">
            {soeurs.map((soeur) => (
              <Soeur
                key={soeur.identifiant}
                asset={soeur}
                courante={soeur.identifiant === asset.identifiant}
                onChoisir={() => onSoeur(soeur.identifiant)}
              />
            ))}
            {soeurs.length === 0 && (
              <p className="mesure text-[10px] text-texte-3">
                cette image n'a pas de voisine
              </p>
            )}
          </div>
        </aside>
      </div>
      )}
    </div>
  )
}

// ── Promouvoir un détourage en défaut du projet (M7) ────────────────────────
//
// **Le geste inverse de l'étape des réglages, et c'est le sens naturel.**
// L'étape *Le détourage de départ* est la onzième des douze de l'univers : on la
// traverse en réglant son jeu, donc **avant d'avoir fabriqué la moindre image**,
// alors qu'on ne sait quel détourage convient qu'après en avoir vu quelques-unes.
// La réparation n'a pas été de déplacer l'étape — son rangement est juste, elle
// décide de ce qui arrive au retour — mais de laisser régler une image, puis de
// dire *garde ça* depuis l'image elle-même.
//
// **Une portée se choisit, elle ne se devine pas.** Le produit en connaît deux
// pour un détourage : la nature de l'image — venue seule, ou découpée d'une
// planche — et la famille de ce qu'elle montre. Les deux sont proposées, jamais
// l'une supposée : promouvoir dans la mauvaise portée se voit à la dixième image
// et pas à la première.

/** Ce qu'un défaut retient d'une passe posée sur une image.
 *
 *  **Le point de la pipette et le tracé n'en sont pas**, et c'est le domaine qui
 *  le décide : un défaut n'a pas d'image où viser. Les reconstruire ici serait
 *  une seconde vérité sur ce qu'est un détourage par défaut. */
function defautDeLaPasse(passe: Passe): DefautDetourage {
  return {
    moteur: passe.moteur,
    tolerance: passe.tolerance,
    seuil_alpha: passe.seuil_alpha,
    durcissement: passe.durcissement,
    modele: passe.modele,
  }
}

function PromouvoirLeDetourage({
  asset,
  recette,
  univers,
  onUnivers,
  onErreur,
}: {
  asset: Asset
  recette: Recette
  univers: Univers
  onUnivers?: (univers: Univers) => void
  onErreur: (raison: string) => void
}) {
  /** **La nature de l'image et sa famille viennent du serveur**, qui est le seul
   *  à les savoir : la famille se lit dans le barème du jeu, jamais sur l'image,
   *  et deux endroits qui la déduiraient finiraient par ranger un meuble dans
   *  les décors. C'est la même route que la fiche interroge, et rien n'en part
   *  de la machine. */
  const [impose, setImpose] = useState<Impose | null>(null)
  const [ouvert, setOuvert] = useState(false)
  const [pose, setPose] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    setImpose(null)
    setOuvert(false)
    setPose(null)
    void api
      .imposeSurAsset(asset.identifiant)
      .then((recu) => {
        if (vivant) setImpose(recu)
      })
      .catch(() => {
        if (vivant) setImpose(null)
      })
    return () => {
      vivant = false
    }
  }, [asset.identifiant])

  // **La première passe, et c'est structurel, pas arbitraire.** Un défaut ne
  // porte qu'une passe : c'est celle qui s'applique à une image que personne n'a
  // encore touchée, donc la première. Les suivantes corrigent *cette* image-là,
  // sur ce que la première a déjà retiré.
  const premiere = recette.passes[0] ?? null
  const famille = (impose?.detourage?.famille ?? "") as Famille | ""
  const nature = impose?.nature ?? ""

  if (!premiere || nature === "") return null

  const poser = async (quoi: "nature" | "famille") => {
    const defaut = defautDeLaPasse(premiere)
    try {
      const recu = await api.reglerUnivers(
        quoi === "nature"
          ? nature === "planche"
            ? { detourage_planche: defaut }
            : { detourage_image: defaut }
          : {
              // **Le dictionnaire entier repart**, pas seulement la case qu'on
              // change : le serveur lit ce champ comme la liste complète des
              // familles réglées, et n'envoyer que la nouvelle effacerait les
              // autres. C'est la convention des modèles par famille.
              detourages: {
                ...Object.fromEntries(
                  Object.entries(univers.detourages).map(([f, p]) => [
                    f,
                    defautDeLaPasse(p),
                  ]),
                ),
                [famille as Famille]: defaut,
              },
            },
      )
      onUnivers?.(recu.univers)
      setOuvert(false)
      setPose(
        quoi === "nature"
          ? NOM_DE_LA_NATURE[nature as Nature]
          : `tout ce que tu ranges dans ${NOM_FAMILLE[famille as Famille]}`,
      )
    } catch (erreur) {
      onErreur(erreur instanceof Refus ? erreur.message : "réglage refusé")
    }
  }

  const resume =
    `${MOTEUR[premiere.moteur]} · tolérance ${premiere.tolerance}` +
    ` · seuil ${premiere.seuil_alpha}` +
    ` · ${premiere.durcissement} px rongé${premiere.durcissement > 1 ? "s" : ""}`

  if (!ouvert)
    return (
      <div className="mt-2 flex flex-col gap-1 border-t border-bord pt-2">
        <button
          type="button"
          data-promouvoir-detourage
          onClick={() => {
            setPose(null)
            setOuvert(true)
          }}
          className="mesure self-start text-left text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          enregistrer ce réglage comme défaut du projet ›
        </button>
        {/* **Ce qui vient d'être posé se dit ici, et dit où le relire.** Un
            geste dont l'effet vit dans un autre écran doit nommer cet écran :
            sans quoi on ne sait ni si ça a marché, ni où aller le vérifier. */}
        {pose && (
          <p role="status" className="mesure text-[10px] leading-4 text-ancien-signal">
            c'est fait — {pose} partira désormais de ce détourage. Ça se relit
            dans Univers › réglages › Le détourage de départ.
          </p>
        )}
      </div>
    )

  return (
    <div
      data-portee-du-defaut
      className="mt-2 flex flex-col gap-1.5 border-t border-bord pt-2"
    >
      <Libelle>en faire un défaut du projet</Libelle>
      <p className="mesure text-[10px] leading-4 text-texte-2">{resume}</p>
      {/* **Deux portées, nommées par ce qu'elles couvrent** — jamais par le mot
          du dépôt. *Les images venues seules* se comprend ; *la nature* demande
          d'avoir lu ailleurs ce que le mot recouvre. */}
      <button
        type="button"
        onClick={() => void poser("nature")}
        className="mesure self-start text-left text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
      >
        pour {NOM_DE_LA_NATURE[nature as Nature]} ›
      </button>
      {famille && famille !== "tous" ? (
        <button
          type="button"
          onClick={() => void poser("famille")}
          className="mesure self-start text-left text-[10px] text-ancien-signal hover:text-ancien-signal-clair"
        >
          pour tout ce que tu ranges dans {NOM_FAMILLE[famille]} ›
        </button>
      ) : (
        /* **Sans famille, on ne propose pas une portée vide.** Une image dont le
           barème du jeu ne nommait pas la famille n'a pas de famille où
           promouvoir, et un bouton grisé demanderait de comprendre pourquoi. */
        <Raison texte="cette image n'a pas de famille — ce que tu fabriquais ne la nommait pas" />
      )}
      <Raison texte="aucune image déjà faite n'est retouchée : un défaut vaut pour ce qui arrivera" />
      {recette.passes.length > 1 && (
        <Raison
          texte={`la passe 1 seule — un défaut n'en porte qu'une, et les ${recette.passes.length - 1} suivantes corrigent cette image-ci`}
        />
      )}
      {(premiere.moteur === "couleur" || premiere.moteur === "trace") && (
        <Raison texte="ce que tu as visé dans l'image ne part pas avec — un défaut n'a pas d'image où viser" />
      )}
      <button
        type="button"
        onClick={() => setOuvert(false)}
        className="mesure self-start text-[10px] text-texte-3 hover:text-texte"
      >
        annuler
      </button>
    </div>
  )
}

/** Vider une place — **et une seule**. `null` là où il n'y a rien à vider :
 *  une fabrique n'a pas de couche, et son pied de colonne disparaît avec. */
const VIDER: Partial<Record<Table, (r: Recette) => Recette>> = {
  detourage: (r) => ({ ...r, passes: [] }),
  recadrage: (r) => ({ ...r, recadrage: null }),
  grille: (r) => ({ ...r, grille: null }),
  quantification: (r) => ({ ...r, quantification: null }),
  bords: (r) => ({ ...r, bords: null }),
  contours: (r) => ({ ...r, contours: null }),
  retournement: (r) => ({ ...r, retournement: null }),
  // **La pile entière, calques compris.** « Sans la main › » vide la table :
  // garder les calques vidés de leurs passages laisserait une pile qui ne fait
  // rien et que rien n'explique.
  main: (r) => ({ ...r, main: null }),
}

function Soeur({
  asset,
  courante,
  onChoisir,
}: {
  asset: Asset
  courante: boolean
  onChoisir: () => void
}) {
  const visee = useVisee(sujetAsset(asset))
  return (
    <button
      type="button"
      onClick={onChoisir}
      onPointerEnter={visee.entrer}
      onPointerLeave={visee.sortir}
      aria-pressed={courante}
      title={asset.label}
      className={[
        "rounded-[2px] border p-[2px] transition-colors duration-[80ms]",
        courante ? "border-lumiere" : "border-transparent hover:border-bord",
      ].join(" ")}
    >
      <img
        src={sujetAsset(asset).src}
        alt={asset.label}
        className="damier h-[44px] w-[44px] object-contain"
        style={{ imageRendering: "pixelated" }}
      />
    </button>
  )
}

