// Les tables — l'endroit où l'on retouche.
//
// **Ce que ça remplace.** Cinq blocs repliés dans une colonne de 380 px, à côté
// d'une image de 380 px de large, sous le bouton qui paie. On y réglait un
// détourage en regardant une vignette, et quatre réglages que le modèle porte
// depuis T2 n'avaient jamais eu d'écran du tout.
//
// **La barre de tables** montre les sept places de la recette **dans l'ordre où
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
  type Asset,
  type EtatTraitement,
  type Place,
  type Recette,
  type TachesDeLAsset,
  type Trait,
  type Univers,
} from "../api"
import { sujetAsset, useVisee } from "./Apercu"
import { EnTetePanneau, Raison, rectangleDeLImage, Segments } from "./chassis"
import { PANNEAU } from "./Infobulle"
import { EcranSuperposition } from "./Superposition"
import {
  avecPassage,
  mainDe,
  OPACITE,
  PanneauBords,
  PanneauContours,
  PanneauDetourage,
  PanneauGrille,
  PanneauMain,
  PanneauQuantification,
  PanneauRecadrage,
  passagesDe,
  rayonDe,
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
  | "main"
  | "decoupage"
  | "superposition"

/** Les sept places, puis le trait, puis les deux fabriques.
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
function valeur(table: Table, recette: Recette): string | null {
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
    case "bords":
      return recette.bords && recette.bords.aire_min > 0
        ? RESUME.bords(recette.bords)
        : null
    case "contours":
      return recette.contours ? RESUME.contours(recette.contours) : null
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
function indisponible(
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
 *  La barre compte neuf tables, la recette sept places : les deux fabriques
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
        etat === "posee" ? "bg-signal" : "border border-texte-3",
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
          className="mesure h-[26px] flex-1 rounded-[2px] border border-bord text-[10px] text-texte-2 hover:text-signal"
        >
          Copier les réglages
        </button>
        <button
          type="button"
          onClick={onColler}
          disabled={!aCopier}
          className="mesure h-[26px] flex-1 rounded-[2px] border border-bord text-[10px] text-texte-2 hover:text-signal disabled:cursor-not-allowed disabled:text-texte-3 disabled:hover:text-texte-3"
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
          className="mesure h-[26px] shrink-0 rounded-[2px] border border-bord px-2 text-[10px] text-texte-2 hover:text-signal disabled:cursor-not-allowed disabled:text-texte-3 disabled:hover:text-texte-3"
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
                className="mesure shrink-0 text-[10px] text-texte-3 hover:text-signal"
              >
                appliquer
              </button>
              <button
                type="button"
                onClick={() => onOublier(enregistree)}
                aria-label={`oublier « ${enregistree} »`}
                className="mesure shrink-0 text-[10px] text-texte-3 hover:text-echec"
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
    // Mesuré au navigateur en tenant E5 : à sept places qui portent chacune
    // leur valeur, la bande demande 1 323 px pour 1 280 offerts, et une bande
    // qui s'épaissirait mentirait sur la liste fermée des cinq hauteurs.
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
          // Trouvé au navigateur en tenant E5 — dès que la sixième et la
          // septième places portent une valeur, `modèle · 28` et
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
            {/* Le trait qui sépare les sept places des deux fabriques. Il ne
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
                  className="flex h-[24px] shrink-0 items-center pl-2 pr-1.5 hover:text-signal"
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
                      eteinte ? "text-texte-3 line-through" : "text-signal"
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
        className="mesure flex h-[24px] shrink-0 items-center gap-1.5 whitespace-nowrap px-2 pr-4 text-[10px] text-texte-3 transition-colors duration-[80ms] hover:text-echec"
      >
        <span aria-hidden>×</span> tout défaire
      </button>
    </div>
  )
}

// ── Le comparateur ──────────────────────────────────────────────────────────

type Mode = "rendu" | "brut" | "cote" | "superpose"

const MODES: Record<Mode, string> = {
  rendu: "rendu",
  brut: "brut",
  cote: "côte à côte",
  superpose: "superposé",
}

/**
 * Sous l'image, sur toutes les tables.
 *
 * **Le mode se dit toujours** — écrit en clair à côté des segments dès que ce
 * n'est pas *rendu*. Un mode durable qu'on oublie est le danger que l'appui
 * *Avant ›* de C4 évitait ; le dire est ce qui autorise à le rendre durable.
 */
function Comparateur({
  asset,
  mode,
  onMode,
  opacite,
  onOpacite,
  peint,
  onAvant,
  zoom,
  onZoom,
  ajuste,
}: {
  asset: Asset
  mode: Mode
  onMode: (mode: Mode) => void
  opacite: number
  onOpacite: (opacite: number) => void
  /** La table ouverte se peint-elle ? **C'est la seule contrainte que le
   *  comparateur reçoive** : les trois autres vues se lisent alors en
   *  maintenant *Avant ›*, qui rend exactement ce qu'elles retiraient. */
  peint?: boolean
  onAvant?: (tenu: boolean) => void
  /** Le cran d'agrandissement choisi, ou `ajusté`. */
  zoom: ZoomTable
  onZoom: (zoom: ZoomTable) => void
  /** Ce que `ajusté` vaut en ce moment — il se dit à côté du contrôle, parce
   *  qu'un mot qui cache un nombre laisse deviner ce qu'on regarde. */
  ajuste: number
}) {
  return (
    <div className="mesure flex h-[38px] shrink-0 items-center gap-3 border-t border-bord bg-fond-1 px-4 text-[10px]">
      <span className="whitespace-nowrap text-texte-3">
        {asset.largeur}×{asset.hauteur} · {asset.type_media}
      </span>
      {/* **Un seul groupe de quatre, et non deux de deux.** La maquette les
          dessine sur deux rangées, ce qui est de la mise en page ; en faire
          deux contrôles obligerait le second à montrer une valeur choisie
          quand le mode est *rendu* — c'est-à-dire à dire faux. Les quatre
          modes s'excluent, donc ils sont un choix. */}
      <Segments
        valeurs={["brut", "rendu", "cote", "superpose"] as const}
        valeur={mode}
        libelles={MODES}
        indisponibles={peint ? (["brut", "cote", "superpose"] as const) : []}
        onChange={(v) => onMode(v as Mode)}
      />
      {/* **La bande fait 38 px, et elle ne grandit pas.** Mesuré au navigateur
          en tenant E5 : la phrase qui expliquait le grisé la faisait passer sur
          trois lignes, repliait les segments avec elle et poussait le bouton
          hors de l'écran. **Elle est descendue dans le panneau**, qui a la
          place d'une phrase ; ici il ne reste que le geste.

          **Sa dernière maison.** L'appui récupère exactement ce que la
          contrainte retire, et c'est pour ça qu'elle est payable. */}
      {peint && (
        <button
          type="button"
          onPointerDown={() => onAvant?.(true)}
          onPointerUp={() => onAvant?.(false)}
          onPointerLeave={() => onAvant?.(false)}
          className="mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border border-bord-fort px-2 text-[10px] text-texte-2 hover:text-signal"
        >
          Avant ›
        </button>
      )}
      {mode === "superpose" && (
        <input
          type="range"
          min={0}
          max={100}
          value={opacite}
          aria-label="Opacité du brut par-dessus le rendu"
          onChange={(e) => onOpacite(Number(e.target.value))}
          className="w-[104px]"
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
      {/* **Le PNG de l'état courant, depuis n'importe quelle table** (U2). Ce
          qu'on a sous les yeux, quelle que soit la table ouverte et quel que
          soit le mode — le brut quand on regarde le brut, le rendu sinon. Il
          n'existait qu'un seul endroit pour télécharger une image, la tuile de
          la galerie, et on ne l'atteignait pas depuis ici. */}
      <a
        href={api.telechargementAsset(asset.identifiant, mode === "brut")}
        download={`${asset.label || asset.identifiant}${mode === "brut" ? "-brut" : ""}.png`}
        title={
          mode === "brut"
            ? "Télécharger le PNG de l'image d'origine"
            : "Télécharger le PNG de l'état courant"
        }
        className="mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border border-bord-fort px-2 leading-[22px] text-texte-2 hover:text-signal"
      >
        PNG ↓{mode === "brut" ? " brut" : ""}
      </a>
      {/* Le mode se dit dès que ce n'est pas le rendu. */}
      {mode !== "rendu" && (
        <span className="ml-auto text-epingle">on regarde : {MODES[mode]}</span>
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
        className="h-[24px] w-[24px] rounded-[2px] border border-bord-fort text-texte-2 hover:text-signal disabled:cursor-not-allowed disabled:text-texte-3"
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
        className="h-[24px] w-[24px] rounded-[2px] border border-bord-fort text-texte-2 hover:text-signal disabled:cursor-not-allowed disabled:text-texte-3"
      >
        +
      </button>
      <button
        type="button"
        title="Un pixel d'image pour un pixel d'écran"
        onClick={() => onZoom(100)}
        className={`mesure h-[24px] shrink-0 whitespace-nowrap rounded-[2px] border px-2 text-[10px] ${
          zoom === 100
            ? "border-signal bg-signal-sourd text-signal"
            : "border-bord-fort text-texte-2 hover:text-signal"
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
            ? "border-signal bg-signal-sourd text-signal"
            : "border-bord-fort text-texte-2 hover:text-signal"
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
  const [mode, setMode] = useState<Mode>("rendu")
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

  /** **Une table qui se peint force le rendu.** Le cas qui a tranché est *côte
   *  à côte* : deux images à l'écran, et la main n'aurait pas su sur laquelle
   *  elle écrit. Un outil dont la cible est ambiguë détruit une fois sur deux
   *  — et l'appui *Avant ›* récupère exactement ce qu'on retire ici, ce qui est
   *  la raison pour laquelle il pouvait disparaître partout ailleurs. */
  const peint = ouverte === "main"
  useEffect(() => {
    if (peint) setMode("rendu")
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

  useLayoutEffect(mesurerCadre, [mesurerCadre, ouverte, mode, dehors, asset.identifiant])
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
    mode === "brut" ||
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
      dispo.largeur > 0 ? dispo.largeur / (largeurVue * (mode === "cote" ? 2 : 1)) : 1,
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
        largeurVue * facteur * (mode === "cote" ? 2 : 1) + (mode === "cote" ? 16 : 0),
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
                  className="text-signal underline-offset-2 hover:underline"
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
              className="mesure shrink-0 border-b border-bord bg-fond-2 px-3 py-2 text-[10px] text-signal"
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
              className="mesure h-[26px] shrink-0 border-t border-bord px-3 text-left text-[10px] text-texte-3 hover:text-signal"
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
            {peint ? (
              // **La surface se peint, et elle est la seule.** Pas de poignée,
              // pas de rectangle, pas de cible : une cible de retaille au
              // milieu d'une surface qu'on peint est un piège à clic, et ici
              // toute la surface est peignable.
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
            ) : (mode === "rendu" || mode === "brut") &&
              ouverte === "detourage" &&
              visee !== null ? (
              // **On vise sur le brut, et pas sur le rendu.** Le point est en
              // pixels de l'image d'origine — c'est ce qui le fait survivre aux
              // passes qui le précèdent —, et le rendu porte le recadrage et la
              // remise sur grille, qui déplacent tous les deux ce qu'on montre.
              // Un cercle posé sur un rendu recadré désignerait un autre pixel
              // que celui qu'on croit toucher. Même raison, même choix que le
              // rectangle de recadrage.
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
                  // **Le clic désarme.** Viser est un geste qui se termine ; une
                  // visée qui reste armée ferait du prochain regard sur l'image
                  // un déplacement du point, sans que rien l'ait demandé.
                  setViseeArmee(null)
                }}
              />
            ) : (mode === "rendu" || mode === "brut") &&
              ouverte === "detourage" &&
              entourage !== null ? (
              // **On entoure sur le brut, exactement comme on y vise** (U12) :
              // la forme est en pixels de l'image d'origine, ce qui la fait
              // survivre aux passes qui la précèdent, et le rendu porte le
              // recadrage et la remise sur grille, qui déplacent tous les deux
              // ce qu'on montre.
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
                  // Le tracé fini désarme, pour la raison du clic de la pipette.
                  setViseeArmee(null)
                }}
              />
            ) : (mode === "rendu" || mode === "brut") && ouverte === "recadrage" ? (
              // **Le rectangle se pose sur l'image, jamais dans un champ.** Le
              // modèle le porte depuis T2 et aucun écran ne l'avait montré : on
              // ne dessine pas un cadrage en tapant quatre nombres, on le
              // dessine en regardant ce qu'il garde.
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
            ) : mode === "rendu" || mode === "brut" ? (
              <img
                src={api.rendu(asset.identifiant, asset.empreinte, mode === "brut")}
                alt={asset.label}
                className="damier h-full w-full object-contain"
                style={{ imageRendering: "pixelated" }}
              />
            ) : null}
            {mode === "cote" && (
              <>
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte, true)}
                  alt={`${asset.label}, brut`}
                  className="damier h-full w-1/2 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte)}
                  alt={`${asset.label}, rendu`}
                  className="damier h-full w-1/2 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </>
            )}
            {mode === "superpose" && (
              <span className="relative flex h-full w-full">
                {/* Le rendu dessous, le brut par-dessus : c'est ce qu'on
                    compare — ce que la recette a retiré. */}
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte)}
                  alt={`${asset.label}, rendu`}
                  className="damier h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
                <img
                  src={api.rendu(asset.identifiant, asset.empreinte, true)}
                  alt={`${asset.label}, brut`}
                  style={{ imageRendering: "pixelated", opacity: opacite / 100 }}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </span>
            )}
            </div>
          </div>
          <Comparateur
            asset={asset}
            mode={mode}
            onMode={setMode}
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

/** Vider une place — **et une seule**. `null` là où il n'y a rien à vider :
 *  une fabrique n'a pas de couche, et son pied de colonne disparaît avec. */
const VIDER: Partial<Record<Table, (r: Recette) => Recette>> = {
  detourage: (r) => ({ ...r, passes: [] }),
  recadrage: (r) => ({ ...r, recadrage: null }),
  grille: (r) => ({ ...r, grille: null }),
  quantification: (r) => ({ ...r, quantification: null }),
  bords: (r) => ({ ...r, bords: null }),
  contours: (r) => ({ ...r, contours: null }),
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


// ── La surface où la main écrit ─────────────────────────────────────────────

/**
 * L'image en grand, et le passage qu'on y trace.
 *
 * **Les coordonnées sont celles de l'image rendue**, coins inclus — c'est sur
 * elle que la septième place s'applique, et c'est elle qui part dans le jeu.
 * Le cadre *est* l'image, mis à l'échelle par calcul : une boîte qui ment
 * décale ce qu'on pose dessus, et c'est la leçon du cadre de la Découpe.
 *
 * **Le trait se dessine à la largeur et à la couleur qu'il aura.** Sur un
 * calque de dessin, la couleur choisie ; sur l'opacité, `--signal` dans les
 * deux sens — garder et ôter sont deux gestes ordinaires, et `--echec`
 * voudrait dire *ça détruit*, ce qu'une gomme ne fait pas.
 *
 * **Le curseur est le carré exact que le prochain passage couvrira** (U11). Il
 * était un cercle qui suivait le pointeur ; il est désormais calé sur le pixel
 * visé, à la taille qu'il aura vraiment — c'est la moitié du réglage, et sans
 * lui le curseur de diamètre serait un nombre abstrait. La forme suit celle du
 * pinceau, qui est carrée parce qu'on peint des pixels.
 */
function ToileDeLaMain({
  asset,
  avant,
  etat,
  onPassage,
}: {
  asset: Asset
  avant: boolean
  etat: ReturnType<typeof useEtatMain>
  onPassage: (trait: Trait) => void
}) {
  const [trace, setTrace] = useState<[number, number][] | null>(null)
  /** Le pixel visé — **et non la place du pointeur** (U11). Le curseur est le
   *  carré que le prochain passage couvrira, donc il se cale sur la grille de
   *  l'image ; le suivre au pixel d'écran près le décalerait d'un demi-pixel
   *  d'image dès que le zoom dépasse cent pour cent. */
  const [vise, setVise] = useState<[number, number] | null>(null)
  const cadre = useRef<HTMLDivElement | null>(null)

  // Les dimensions du **rendu** : c'est lui que la main touche. Une recette
  // vide n'en a pas — le rendu *est* le brut, et ce sont ses dimensions.
  const largeur = asset.rendu_largeur || asset.largeur
  const hauteur = asset.rendu_hauteur || asset.hauteur

  const surLOpacite = etat.actif === OPACITE
  const teinte = surLOpacite ? "var(--signal)" : etat.couleur

  /** Le point sous le pointeur, en pixels de l'image rendue.
   *
   *  **Il se lit dans le rectangle de l'image, pas dans celui de la surface**
   *  (U11). C'est le défaut que la seconde séance a relevé — *le trait tombe à
   *  quelques pixels de l'endroit visé, vers la gauche* —, et le mécanisme est
   *  le même que celui trouvé dans la table de recadrage : la surface est
   *  dimensionnée d'après les mesures que l'atelier garde de l'image rendue,
   *  l'image est posée dedans en *tenant dans le cadre*, donc centrée avec des
   *  bandes vides de chaque côté dès que les deux proportions diffèrent d'un
   *  cheveu. Un recadrage change précisément les proportions du rendu : c'est
   *  lui qui ouvrait l'écart, et l'auteur avait raison de le soupçonner. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, largeur, hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * largeur
    const y = ((evenement.clientY - image.top) / image.height) * hauteur
    return [
      Math.max(0, Math.min(largeur - 1, Math.floor(x))),
      Math.max(0, Math.min(hauteur - 1, Math.floor(y))),
    ]
  }

  const terminer = () => {
    if (!trace) return
    setTrace(null)
    onPassage({
      garde: etat.sens,
      rayon: rayonDe(etat.diametre),
      points: trace,
      couleur: surLOpacite ? "" : etat.couleur,
    })
  }

  return (
    <div
      ref={cadre}
      data-toile-main
      style={{ aspectRatio: `${largeur} / ${hauteur}` }}
      className="relative h-full w-full cursor-none"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        setTrace([point(evenement)])
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        const [x, y] = point(evenement)
        setVise([x, y])
        if (!trace) return
        const dernier = trace[trace.length - 1]
        // **Un point par pixel, pas un par événement.** Un pointeur envoie ce
        // qu'il peut ; garder les doublons gonflerait la recette sans rien
        // ajouter au tracé, que le serveur relie de toute façon.
        if (dernier[0] === x && dernier[1] === y) return
        setTrace([...trace, [x, y]])
      }}
      onPointerUp={terminer}
      onPointerLeave={() => {
        setVise(null)
        terminer()
      }}
    >
      <img
        src={
          avant
            ? api.avant(asset.identifiant, asset.empreinte)
            : api.rendu(asset.identifiant, asset.empreinte)
        }
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />

      {/* Le passage en cours, à sa vraie largeur : elle vaut (2 × rayon + 1)
          pixels d'image, mise à l'échelle du cadre. Zoomer l'épaissit ; c'est
          voulu, puisqu'elle mesure l'image et non le châssis. */}
      {trace && trace.length > 0 && (
        <svg
          aria-hidden
          viewBox={`0 0 ${largeur} ${hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {/* **Bouts et joints carrés** (U11), parce que le pinceau l'est. Un
              bout carré déborde d'une demi-largeur au-delà du dernier point,
              ce qui est exactement ce qu'un carré posé sur ce point couvre. */}
          <polyline
            points={trace.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
            fill="none"
            stroke={etat.sens ? teinte : "var(--signal)"}
            strokeOpacity={etat.sens ? 1 : 0.45}
            strokeWidth={etat.diametre}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
      )}

      {/* Le curseur : **le carré exact que le prochain passage couvrira**
          (U11). Il est calé sur la grille de l'image et non sur le pointeur —
          c'est ce qui en fait une promesse plutôt qu'une indication —, et il
          fait `2 × rayon + 1` pixels d'image, la largeur que le serveur peint.
          Il ne suit pas le zoom du châssis : il mesure l'image, donc il
          grandit avec elle. */}
      {vise && (
        <span
          aria-hidden
          data-curseur-main
          style={{
            left: `${((vise[0] - rayonDe(etat.diametre)) / largeur) * 100}%`,
            top: `${((vise[1] - rayonDe(etat.diametre)) / hauteur) * 100}%`,
            width: `${((2 * rayonDe(etat.diametre) + 1) / largeur) * 100}%`,
            height: `${((2 * rayonDe(etat.diametre) + 1) / hauteur) * 100}%`,
          }}
          className="pointer-events-none absolute border border-signal bg-signal/[.18]"
        />
      )}
    </div>
  )
}

// ── La pipette, posée sur l'image ───────────────────────────────────────────

/**
 * L'image, et le point qu'on y désigne.
 *
 * **Un cercle, et rien d'autre.** Pas de tracé, pas de rectangle, pas de
 * poignée : cette table ne se peint pas. Le cercle suit le pointeur avec le
 * pixel visé marqué en son centre, et il ne paraît que pendant qu'on vise —
 * sinon le pointeur est celui du produit, et une pipette permanente ferait de
 * chaque regard sur l'image un risque de clic.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, comme le rectangle
 * de recadrage : une seule convention dans tout le produit.
 */
function PipetteSurImage({
  asset,
  point,
  onPoint,
}: {
  asset: Asset
  /** Le point déjà posé sur cette passe, marqué en creux — on vise à nouveau
   *  en voyant d'où l'on part. */
  point: [number, number] | null
  onPoint: (point: [number, number]) => void
}) {
  const [survol, setSurvol] = useState<{ x: number; y: number } | null>(null)

  /** Le pixel sous le pointeur. **Un plancher, pas un arrondi** : on désigne le
   *  pixel qu'on survole, et un arrondi ferait basculer la visée sur le voisin
   *  dès qu'on dépasse sa moitié — le rectangle de recadrage arrondit, lui,
   *  parce qu'il pose un coin et non un pixel. */
  const pixel = (evenement: React.MouseEvent<HTMLDivElement>) => {
    // **Dans le rectangle de l'image, pas dans celui de la surface** (U11) —
    // la troisième des trois surfaces qui reçoivent un geste, et le même
    // calcul pour les trois.
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return {
      x: Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      y: Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    }
  }

  /** Le centre d'un pixel, en pour cent du cadre — pas son coin. Un cercle posé
   *  sur le coin est décalé d'un demi-pixel, ce qui se voit dès que l'image est
   *  petite et affichée grande. */
  const centre = (x: number, y: number) => ({
    left: `${((x + 0.5) / asset.largeur) * 100}%`,
    top: `${((y + 0.5) / asset.hauteur) * 100}%`,
  })

  return (
    <div
      data-pipette
      style={{ aspectRatio: `${asset.largeur} / ${asset.hauteur}` }}
      className="relative h-full w-full cursor-crosshair"
      onPointerMove={(evenement) => setSurvol(pixel(evenement))}
      onPointerLeave={() => setSurvol(null)}
      onClick={(evenement) => {
        const { x, y } = pixel(evenement)
        onPoint([x, y])
      }}
    >
      <img
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {point && (
        <span
          aria-hidden
          style={{ ...centre(point[0], point[1]), width: 9, height: 9 }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-lumiere"
        />
      )}
      {survol && (
        <span
          aria-hidden
          style={{ ...centre(survol.x, survol.y), width: 15, height: 15 }}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-lumiere"
        >
          <span className="absolute left-1/2 top-1/2 h-px w-px -translate-x-1/2 -translate-y-1/2 bg-lumiere" />
        </span>
      )}
    </div>
  )
}

// ── La sélection magique, entourée sur l'image (U12) ────────────────────────

/**
 * L'image, et la forme qu'on entoure à main levée autour du sujet.
 *
 * **On trace gros, l'atelier ajuste au bord.** Le trait qu'on fait ne devient
 * jamais le contour du sprite : il borne la recherche, et c'est le serveur qui
 * va chercher le bord du sujet à l'intérieur. C'est pour ça qu'on peut trembler.
 *
 * **La forme se ferme d'elle-même**, et le trait de fermeture se voit pendant
 * qu'on trace : le geste est *entourer*, pas *dessiner une ligne*, et montrer la
 * corde qui manque évite de croire qu'on a laissé un trou.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, comme le point de
 * la pipette et le rectangle de recadrage : une seule convention dans tout le
 * produit, et c'est ce qui fait survivre le tracé aux passes qui le précèdent.
 */
function TraceSurImage({
  asset,
  trace,
  onTrace,
}: {
  asset: Asset
  /** La forme déjà posée sur cette passe, montrée en creux — on entoure à
   *  nouveau en voyant ce qu'on remplace. */
  trace: [number, number][]
  onTrace: (trace: [number, number][]) => void
}) {
  const [encours, setEncours] = useState<[number, number][] | null>(null)

  const point = (evenement: React.PointerEvent<HTMLDivElement>): [number, number] => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return [
      Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    ]
  }

  const terminer = () => {
    if (!encours) return
    setEncours(null)
    // **Moins de trois points n'entoure rien**, et un clic isolé n'est pas un
    // geste raté : c'est un geste qu'on n'a pas fait. On ne pose donc rien
    // plutôt que de poser une forme vide qui n'effacerait rien en silence.
    if (encours.length >= 3) onTrace(encours)
  }

  const montree = encours ?? trace

  return (
    <div
      data-trace
      style={{ aspectRatio: `${asset.largeur} / ${asset.hauteur}` }}
      className="relative h-full w-full cursor-crosshair"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        setEncours([point(evenement)])
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        if (!encours) return
        const [x, y] = point(evenement)
        const dernier = encours[encours.length - 1]
        // **Un point tous les deux pixels, pas un par événement.** Un pointeur
        // envoie ce qu'il peut ; garder les doublons gonflerait la recette sans
        // rien ajouter à une forme que le serveur remplit de toute façon.
        if (Math.abs(dernier[0] - x) < 2 && Math.abs(dernier[1] - y) < 2) return
        setEncours([...encours, [x, y]])
      }}
      onPointerUp={terminer}
      onPointerLeave={terminer}
    >
      {/* **On entoure sur le brut, et pas sur le rendu**, pour la raison exacte
          de la pipette : la forme est en pixels de l'image d'origine, et le
          rendu porte le recadrage et la remise sur grille, qui déplacent tous
          les deux ce qu'on montre. */}
      <img
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {montree.length > 1 && (
        <svg
          aria-hidden
          viewBox={`0 0 ${asset.largeur} ${asset.hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon
            points={montree.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(" ")}
            fill="var(--signal)"
            fillOpacity={0.14}
            stroke="var(--lumiere)"
            strokeWidth={1}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  )
}

// ── Le rectangle de recadrage, posé sur l'image ─────────────────────────────

/**
 * L'image, et le rectangle qu'on y glisse.
 *
 * **Le cadre *est* l'image**, mis à l'échelle par calcul : c'est la leçon du
 * cadre de la Découpe, qui dessine des rectangles depuis T5 — une boîte qui ment
 * décale ce qu'on pose dessus, et ici c'est le rectangle qui tomberait à côté.
 *
 * Les coordonnées vont dans les pixels de l'image **brute**, coins inclus : une
 * seule convention de rectangle dans tout le produit, celle du serveur. Le
 * recadrage s'applique avant la remise sur grille, donc c'est bien le brut qu'il
 * découpe.
 */
function CadreDeRecadrage({
  asset,
  boite,
  onBoite,
  obtenue,
}: {
  asset: Asset
  boite: [number, number, number, number] | null
  onBoite: (boite: [number, number, number, number] | null) => void
  /** **Le rectangle réellement gardé, marge comprise** (U2) — mesuré par le
   *  serveur, jamais recalculé ici. La marge s'ajoute à la boîte tracée, ce qui
   *  est le comportement voulu mais que rien ne montrait : on dessinait un
   *  rectangle et le rendu en gardait un autre, sans qu'aucun des deux ne soit
   *  faux. Les deux sont désormais à l'écran ensemble, le second en pointillé. */
  obtenue: [number, number, number, number] | null
}) {
  const [trace, setTrace] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  )

  /** Le point sous le pointeur, en pixels de l'image brute.
   *
   *  **Il se lit dans le rectangle de l'image, pas dans celui de la surface**
   *  (U2, U11). L'image est posée en *tenant dans le cadre* : dès que les deux
   *  proportions diffèrent d'un cheveu — un arrondi de zoom suffit —, elle est
   *  centrée avec des bandes vides de chaque côté, et mesurer la surface
   *  décalerait le tracé de la largeur de la bande. */
  const point = (evenement: React.PointerEvent<HTMLDivElement>) => {
    const surface = evenement.currentTarget.getBoundingClientRect()
    const image = rectangleDeLImage(surface, asset.largeur, asset.hauteur)
    const x = ((evenement.clientX - image.left) / image.width) * asset.largeur
    const y = ((evenement.clientY - image.top) / image.height) * asset.hauteur
    return {
      x: Math.max(0, Math.min(asset.largeur - 1, Math.floor(x))),
      y: Math.max(0, Math.min(asset.hauteur - 1, Math.floor(y))),
    }
  }

  const dessine = trace ?? (boite ? { x0: boite[0], y0: boite[1], x1: boite[2], y1: boite[3] } : null)
  /** La place d'un rectangle d'image dans la surface, en pour cent. Une seule
   *  arithmétique pour les deux rectangles : ils doivent se superposer
   *  exactement quand la marge est nulle. */
  const place = (x0: number, y0: number, x1: number, y1: number) => ({
    left: `${(Math.min(x0, x1) / asset.largeur) * 100}%`,
    top: `${(Math.min(y0, y1) / asset.hauteur) * 100}%`,
    width: `${((Math.abs(x1 - x0) + 1) / asset.largeur) * 100}%`,
    height: `${((Math.abs(y1 - y0) + 1) / asset.hauteur) * 100}%`,
  })

  return (
    <div
      data-cadre-recadrage
      className="relative h-full w-full"
      onPointerDown={(evenement) => {
        if (evenement.button !== 0) return
        const { x, y } = point(evenement)
        setTrace({ x0: x, y0: y, x1: x, y1: y })
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
      }}
      onPointerMove={(evenement) => {
        if (!trace) return
        const { x, y } = point(evenement)
        setTrace({ ...trace, x1: x, y1: y })
      }}
      onPointerUp={() => {
        if (!trace) return
        const x0 = Math.min(trace.x0, trace.x1)
        const y0 = Math.min(trace.y0, trace.y1)
        const x1 = Math.max(trace.x0, trace.x1)
        const y1 = Math.max(trace.y0, trace.y1)
        setTrace(null)
        // **Un clic n'est pas un rectangle.** Sous trois pixels de côté, le
        // geste était un clic : il retire le rectangle au lieu d'en poser un
        // d'un pixel, que personne ne voulait.
        if (x1 - x0 < 3 || y1 - y0 < 3) onBoite(null)
        else onBoite([x0, y0, x1, y1])
      }}
    >
      <img
        src={api.rendu(asset.identifiant, asset.empreinte, true)}
        alt={asset.label}
        draggable={false}
        className="damier h-full w-full object-contain select-none"
        style={{ imageRendering: "pixelated" }}
      />
      {/* **Ce qui est jeté est assombri, pas masqué** — c'est le but : on voit
          qu'on le coupe. Un masque plein montrerait un joli cadrage et
          cacherait ce qu'on est en train de perdre. Quatre bandes plutôt qu'une
          découpe : la même arithmétique que le rectangle, prise à l'envers. */}
      {obtenue && (
        <span aria-hidden className="pointer-events-none absolute inset-0">
          <span
            className="absolute left-0 right-0 top-0 bg-fond-0/55"
            style={{ height: `${(obtenue[1] / asset.hauteur) * 100}%` }}
          />
          <span
            className="absolute bottom-0 left-0 right-0 bg-fond-0/55"
            style={{
              height: `${((asset.hauteur - 1 - obtenue[3]) / asset.hauteur) * 100}%`,
            }}
          />
          <span
            className="absolute left-0 bg-fond-0/55"
            style={{
              top: `${(obtenue[1] / asset.hauteur) * 100}%`,
              height: `${((obtenue[3] - obtenue[1] + 1) / asset.hauteur) * 100}%`,
              width: `${(obtenue[0] / asset.largeur) * 100}%`,
            }}
          />
          <span
            className="absolute right-0 bg-fond-0/55"
            style={{
              top: `${(obtenue[1] / asset.hauteur) * 100}%`,
              height: `${((obtenue[3] - obtenue[1] + 1) / asset.hauteur) * 100}%`,
              width: `${((asset.largeur - 1 - obtenue[2]) / asset.largeur) * 100}%`,
            }}
          />
        </span>
      )}
      {/* **Le rectangle obtenu, en pointillé** — celui que le rendu montre. Il
          se dessine sous le rectangle tracé, pour que le second reste net quand
          les deux coïncident. */}
      {obtenue && (
        <span
          aria-hidden
          data-boite-obtenue
          style={place(obtenue[0], obtenue[1], obtenue[2], obtenue[3])}
          className="pointer-events-none absolute border border-dashed border-bord-fort"
        />
      )}
      {dessine && (
        <span
          aria-hidden
          data-boite-tracee
          style={place(dessine.x0, dessine.y0, dessine.x1, dessine.y1)}
          className="pointer-events-none absolute border border-lumiere bg-lumiere/10"
        />
      )}
    </div>
  )
}
