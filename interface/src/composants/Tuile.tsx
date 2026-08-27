// La tuile — l'objet central du produit.
//
// « L'emplacement » (`docs/DESIGN.md`) : au moment où la génération part,
// N tuiles paraissent **à leur taille définitive**, jauge en pied de zone image
// et compteur en mono. La tuile devient l'image, ou devient l'échec. La grille
// ne se recompose jamais entre le départ et l'arrivée — l'œil reste où il est,
// et l'échec atterrit à l'endroit précis où le succès serait arrivé.
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

const PASTILLES: Partial<Record<Emplacement["statut"], string>> = {
  interrompue: "interrompu",
}

export function Tuile({
  generation,
  emplacement,
  asset,
  ouverte,
  onRelancer,
  onOuvrir,
}: {
  generation: Generation
  emplacement: Emplacement
  /** L'asset né de cet emplacement. Absent tant que l'image n'est pas arrivée. */
  asset?: Asset
  ouverte: boolean
  onRelancer: (rang: number) => void
  onOuvrir: (identifiant: string) => void
}) {
  const enCours =
    emplacement.statut === "en_cours" || emplacement.statut === "en_attente"
  const rate =
    emplacement.statut === "echouee" || emplacement.statut === "interrompue"

  // **La tuile montre ce que l'asset est devenu**, pas ce que le fournisseur a
  // rendu : dès qu'une recette existe, c'est le rendu qui s'affiche. Juger sur
  // le brut alors qu'on a détouré et remis sur grille ferait juger autre chose
  // que ce qui partira dans le jeu.
  const source = asset?.traite
    ? api.rendu(asset.identifiant, asset.empreinte)
    : api.image(generation.identifiant, emplacement.rang)

  return (
    <figure
      className={[
        "arrivee flex flex-col border",
        rate ? "border-echec/45 bg-echec/5" : "border-bord bg-fond-2",
        // L'anneau du sélectionné — « la lampe de la table », `docs/DESIGN.md`
        // § La tuile. Aucune couleur de plus dans la grille.
        ouverte ? "shadow-[0_0_0_2px_var(--color-lumiere)]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={!asset}
        onClick={() => asset && onOuvrir(asset.identifiant)}
        aria-label="Ouvrir la fiche"
        className="relative aspect-square w-full cursor-pointer overflow-hidden disabled:cursor-default"
      >
        {emplacement.resultat && (
          <img
            src={source}
            alt={generation.demande.prompt.slice(0, 80)}
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
        {/* Une pastille pour un état **subi** — `docs/DESIGN.md` § La tuile.
            « réglé » en fait partie : c'est ce que le système constate d'un
            asset dont la recette a été touchée à la main, et c'est ce que T4
            relira pour le sauter lors d'un changement de palette. */}
        {(PASTILLES[emplacement.statut] || asset?.epingle) && (
          <span className="mesure absolute top-1.5 left-1.5 bg-fond-0/82 px-1 py-px text-[8.5px] text-epingle">
            {PASTILLES[emplacement.statut] ?? "réglé"}
          </span>
        )}
      </button>

      <figcaption className="flex min-h-[38px] flex-col justify-center gap-[3px] border-t border-bord px-2 py-1.5">
        <span className="truncate text-[11.5px] text-texte">
          {generation.demande.prompt}
        </span>
        {rate ? (
          <button
            type="button"
            onClick={() => onRelancer(emplacement.rang)}
            className="mesure self-start text-[9.5px] text-signal hover:text-signal-clair"
          >
            Relancer
          </button>
        ) : (
          <Mesures
            generation={generation}
            emplacement={emplacement}
            asset={asset}
          />
        )}
      </figcaption>
    </figure>
  )
}

/** Une tuile porte au maximum un nom et trois mesures. Au-delà, c'est la fiche
 *  qui prend le relais — c'est la règle qui empêche la grille de se charger. */
function Mesures({
  generation,
  emplacement,
  asset,
}: {
  generation: Generation
  emplacement: Emplacement
  asset?: Asset
}) {
  const resultat = emplacement.resultat
  return (
    <div className="mesure flex items-center gap-1.5 text-[9.5px] text-texte-3">
      {resultat ? (
        <>
          {/* Les dimensions **du rendu** quand il y en a un : c'est l'image
              qu'on regarde, donc c'est elle qu'on mesure. */}
          <span>
            {asset?.traite
              ? `${asset.rendu_largeur}×${asset.rendu_hauteur}`
              : `${resultat.largeur}×${resultat.hauteur}`}
          </span>
          <span aria-hidden>·</span>
          <span>{dollars(emplacement.cout_usd)}</span>
          <a
            href={
              asset
                ? api.telechargementAsset(asset.identifiant)
                : api.telechargement(generation.identifiant, emplacement.rang)
            }
            download
            className="ml-auto text-signal hover:text-signal-clair"
          >
            PNG ↓
          </a>
        </>
      ) : (
        <span>en attente</span>
      )}
    </div>
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
