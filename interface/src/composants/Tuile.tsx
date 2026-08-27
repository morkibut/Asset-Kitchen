// La tuile — l'objet central du produit.
//
// « L'emplacement » (`docs/DESIGN.md`) : au moment où la génération part,
// N tuiles paraissent **à leur taille définitive**, jauge en pied de zone image
// et compteur en mono. La tuile devient l'image, ou devient l'échec. La grille
// ne se recompose jamais entre le départ et l'arrivée — l'œil reste où il est,
// et l'échec atterrit à l'endroit précis où le succès serait arrivé.
//
// **Depuis T3, la grille est faite d'assets** — c'est la bibliothèque, et c'est
// la seule grille du produit (US-31). Un emplacement qui n'a pas encore donné
// son asset y tient quand même sa place, et il la tient sous **la même clé**
// (`<génération>-<rang>`, qui est précisément l'identifiant que l'asset
// portera) : l'image ne se glisse donc pas à côté de son attente, elle la
// remplace. C'est ce qui rend vraie, sans machinerie, la phrase du design.
//
// Rayon 0, aucune ombre : le bord de la tuile et le bord du sprite sont la même
// sorte de ligne, et la grille se lit comme une planche contact.

import { useEffect, useState } from "react"
import {
  api,
  dollars,
  secondes,
  type Asset,
  type Emplacement,
  type Generation,
} from "../api"

/**
 * Ce que la grille itère. Un asset, ou un emplacement qui l'attend encore.
 *
 * `cle` est la même dans les deux cas, et c'est tout le mécanisme :
 * `<génération>-<rang>`, l'identifiant que l'asset porte à sa naissance.
 * `date` et `rang` sont l'ordre — la date du **lot**, jamais celle de
 * l'arrivée, sans quoi les variations d'un même lot glisseraient les unes par
 * rapport aux autres pendant qu'on les regarde.
 */
export type Entree =
  | { cle: string; date: number; rang: number; sorte: "asset"; asset: Asset }
  | {
      cle: string
      date: number
      rang: number
      sorte: "emplacement"
      generation: Generation
      emplacement: Emplacement
    }

export function Tuile({
  entree,
  selectionnee,
  onOuvrir,
  onRelancer,
}: {
  entree: Entree
  selectionnee: boolean
  onOuvrir: (identifiant: string, evenement: React.MouseEvent) => void
  onRelancer: (generation: string, rang: number) => void
}) {
  const asset = entree.sorte === "asset" ? entree.asset : null
  const emplacement = entree.sorte === "emplacement" ? entree.emplacement : null
  const lot = entree.sorte === "emplacement" ? entree.generation : null
  const rate =
    emplacement !== null &&
    (emplacement.statut === "echouee" || emplacement.statut === "interrompue")
  const enCours =
    emplacement !== null &&
    (emplacement.statut === "en_cours" || emplacement.statut === "en_attente")

  const titre =
    entree.sorte === "asset" ? entree.asset.label : entree.generation.demande.prompt

  // **La tuile montre ce que l'asset est devenu**, pas ce que le fournisseur a
  // rendu : dès qu'une recette existe, c'est le rendu qui s'affiche. Juger sur
  // le brut alors qu'on a détouré et remis sur grille ferait juger autre chose
  // que ce qui partira dans le jeu.
  const source = asset
    ? asset.traite
      ? api.rendu(asset.identifiant, asset.empreinte)
      : api.image(asset.generation, asset.rang)
    : null

  return (
    <figure
      className={[
        "arrivee relative flex flex-col border",
        rate ? "border-echec/45 bg-echec/5" : "border-bord bg-fond-2",
        // L'anneau du sélectionné — « la lampe de la table », `docs/DESIGN.md`
        // § La tuile. Aucune couleur de plus dans la grille.
        selectionnee ? "shadow-[0_0_0_2px_var(--color-lumiere)]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={!asset}
        onClick={(evenement) => asset && onOuvrir(asset.identifiant, evenement)}
        aria-label="Ouvrir la fiche"
        className="relative aspect-square w-full cursor-pointer overflow-hidden disabled:cursor-default"
      >
        {source && (
          <img
            src={source}
            alt={titre.slice(0, 80)}
            className="damier h-full w-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {enCours && (
          <Jauge
            demarreLe={emplacement.demarre_le}
            attendue={emplacement.duree_attendue_s}
          />
        )}
        {rate && <Raté raison={emplacement.raison} />}
        <Pastille asset={asset} emplacement={emplacement} />
        {/* « Coin plein haut-droit, `--signal`, 13 px — la seule marque
            visuelle, parce que c'est la seule que l'auteur pose lui-même »
            (`docs/DESIGN.md` § La tuile). Ce que le système constate est un
            mot ; ce que l'auteur pose est une forme. */}
        {asset?.favori && <CoinFavori />}
      </button>

      <figcaption className="flex min-h-[38px] flex-col justify-center gap-[3px] border-t border-bord px-2 py-1.5">
        <span className="truncate text-[11.5px] text-texte" title={titre}>
          {titre}
        </span>
        {rate && lot && emplacement ? (
          <button
            type="button"
            onClick={() => onRelancer(lot.identifiant, emplacement.rang)}
            className="mesure self-start text-[9.5px] text-signal hover:text-signal-clair"
          >
            Relancer
          </button>
        ) : asset ? (
          <Mesures asset={asset} />
        ) : (
          <span className="mesure text-[9.5px] text-texte-3">en attente</span>
        )}
      </figcaption>
    </figure>
  )
}

/** Une tuile porte au maximum un nom et trois mesures. Au-delà, c'est la fiche
 *  qui prend le relais — c'est la règle qui empêche la grille de se charger. */
function Mesures({ asset }: { asset: Asset }) {
  return (
    <div className="mesure flex items-center gap-1.5 text-[9.5px] text-texte-3">
      {/* Les dimensions **du rendu** quand il y en a un : c'est l'image qu'on
          regarde, donc c'est elle qu'on mesure. */}
      <span>
        {asset.traite
          ? `${asset.rendu_largeur}×${asset.rendu_hauteur}`
          : `${asset.largeur}×${asset.hauteur}`}
      </span>
      <span aria-hidden>·</span>
      <span>{dollars(asset.cout_usd)}</span>
      <a
        href={api.telechargementAsset(asset.identifiant)}
        download
        onClick={(e) => e.stopPropagation()}
        className="ml-auto text-signal hover:text-signal-clair"
      >
        PNG ↓
      </a>
    </div>
  )
}

/**
 * Une pastille, et une seule — pour un état **subi**.
 *
 * `docs/DESIGN.md` § La tuile en donne la liste close : `réglé`, `agent`,
 * `parent supprimé`. « interrompu » lui appartient depuis T1, pour la même
 * raison : c'est ce que le système constate, jamais ce que l'auteur pose.
 *
 * L'ordre n'est pas arbitraire : une filiation cassée se lit avant un réglage,
 * parce qu'elle change ce qu'on peut encore comprendre de l'image.
 */
function Pastille({
  asset,
  emplacement,
}: {
  asset: Asset | null
  emplacement: Emplacement | null
}) {
  const mot =
    emplacement?.statut === "interrompue"
      ? "interrompu"
      : asset?.parent_supprime
        ? "parent supprimé"
        : asset?.epingle
          ? "réglé"
          : null
  if (!mot) return null
  return (
    <span className="mesure absolute top-1.5 left-1.5 bg-fond-0/82 px-1 py-px text-[8.5px] text-epingle">
      {mot}
    </span>
  )
}

function CoinFavori() {
  return (
    <span
      aria-label="favori"
      className="absolute top-0 right-0 h-0 w-0 border-t-[13px] border-l-[13px] border-t-signal border-l-transparent"
    />
  )
}

/**
 * La jauge **déterminée** de `docs/DESIGN.md` § Motion — « ça travaille, et
 * voilà où ça en est ». Le seul mouvement continu du produit.
 *
 * Aucun fournisseur d'image ne rend d'avancement entre le départ et l'arrivée :
 * il n'y a rien à relayer. Le serveur donne donc les deux seuls faits qui
 * existent — l'instant du départ, et la durée que **ce modèle-là** a mise en
 * médiane à ses derniers appels réussis — et la jauge se trace ici.
 *
 * Elle ne ment pas sur ce qu'elle sait : le compteur porte le temps écoulé
 * **et** l'attente, précédée d'un tilde. Quand l'appel dépasse son attente, ça
 * se lit tout seul — `00:31 / ~00:19` — et la barre continue d'avancer sans
 * jamais atteindre le bout, parce qu'elle ne sait pas quand ça finira.
 */
function Jauge({
  demarreLe,
  attendue,
}: {
  demarreLe: number | null
  attendue: number
}) {
  const [ecoule, setEcoule] = useState(() => depuis(demarreLe))

  useEffect(() => {
    setEcoule(depuis(demarreLe))
    const battement = setInterval(() => setEcoule(depuis(demarreLe)), 250)
    return () => clearInterval(battement)
  }, [demarreLe])

  // Pas encore parti : la tuile tient sa place, mais il n'y a rien à mesurer.
  const enAttente = demarreLe === null

  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-2">
      <span className="mesure text-[8.5px] text-texte-2">
        {enAttente ? "en file" : `${secondes(ecoule)} / ~${secondes(attendue)}`}
      </span>
      <span className="block h-[2px] w-full overflow-hidden bg-bord">
        <span
          className="block h-full bg-signal transition-[width] duration-[240ms] ease-linear"
          style={{ width: `${part(ecoule, attendue, enAttente) * 100}%` }}
        />
      </span>
    </div>
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

/** « Un raté affiche sa raison en clair à la place de l'image. » */
function Raté({ raison }: { raison: string | null }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3">
      <p className="text-center text-[11.5px] leading-snug text-echec">
        {raison ?? "échec sans raison connue"}
      </p>
    </div>
  )
}
