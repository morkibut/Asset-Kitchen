// L'écran où l'on choisit ce qu'on garde d'une planche (R6, US-367, US-368).
//
// **Il existe parce qu'un appel payé disparaissait.** Une planche qui rendait
// neuf sujets pour huit était refusée entière et se relançait au prix plein —
// quatre planches sur treize du banc d'animation, trente-et-un pour cent des
// appels perdus sur un geste dont c'est le régime normal. Et l'autre moitié du
// gâchis ne se voyait pas : quand un modèle redessine les traits du quadrillage,
// le compte tombe juste, et l'atelier faisait entrer des carrés dont les deux
// tiers sont du fond.
//
// **Rien ici ne dépense.** C'est la seule chose à savoir avant d'y toucher : la
// planche est arrivée, elle est payée, elle est sur le disque. Écarter un sujet
// ne rappelle personne — c'est la même image, recoupée autrement. Le seul geste
// qui coûterait serait de relancer, et il n'est pas sur cet écran.
//
// **Il ne montre pas de vignettes découpées par le serveur**, et c'est
// délibéré : au moment où il s'ouvre, aucune image n'est entrée en
// bibliothèque — c'est même tout l'enjeu. Il découpe donc lui-même, dans
// l'image de la planche, aux boîtes que l'arrivée a mesurées.
//
// **Porté au papier le 11 septembre 2026 (`D4`)**, sans planche connue — même
// dessin, même geste, seuls ses jetons et ses tailles passent au vocabulaire
// de `pieces.tsx` et aux listes fermées de `docs/DESIGN.md`.

import { useState } from "react"
import { api, type Generation, type MesuresLot } from "../api"
import { Bouton, Raison } from "./pieces"

export function EcranDepliage({
  generation,
  rang,
  onFini,
  onFermer,
  onErreur,
}: {
  generation: Generation
  /** L'emplacement qui porte la planche. Un lot n'en a qu'un, mais le dire ici
   *  évite de le redeviner — c'est le serveur qui range, pas l'écran. */
  rang: number
  /** La planche est dépliée : ses images sont entrées. */
  onFini: (rendue: Generation) => void
  onFermer: () => void
  onErreur: (erreur: unknown, defaut: string) => void
}) {
  const pliage = generation.pliage
  const [ecartees, setEcartees] = useState<number[]>([])
  const [enCours, setEnCours] = useState(false)

  if (!pliage) return null

  const mesures = pliage.mesures ?? []
  const demandees = pliage.nombre
  const gardees = mesures.length - ecartees.length
  const juste = gardees === demandees

  const basculer = (index: number) =>
    setEcartees((avant) =>
      avant.includes(index) ? avant.filter((i) => i !== index) : [...avant, index],
    )

  const valider = async () => {
    setEnCours(true)
    try {
      onFini(await api.deplierPlanche(generation.identifiant, rang, ecartees))
    } catch (erreur) {
      onErreur(erreur, "choix refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-papier">
      <header className="flex h-[34px] shrink-0 items-center gap-3 border-b border-trait bg-papier-cote px-4">
        <h2 className="text-[13px] text-encre">Ce que la planche a rendu</h2>
        <span className="mesure text-[10.5px] text-encre-4">
          {mesures.length} sujet{mesures.length > 1 ? "s" : ""} · {demandees} demandé
          {demandees > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onFermer}
          className="mesure ml-auto text-[10.5px] text-signal hover:opacity-70"
        >
          Revenir
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
        {/* **La phrase du serveur, pas une phrase d'écran.** Ce qui cloche a été
            mesuré côté produit, et le réécrire ici en ferait un second endroit
            qui décide de ce qu'on lit — celui-là même qui finit par contredire
            l'autre. */}
        <Phrase pliage={pliage} />

        <ul className="flex flex-wrap gap-2">
          {mesures.map((mesure, index) => (
            <Sujet
              key={index}
              mesure={mesure}
              numero={index + 1}
              planche={api.image(generation.identifiant, rang)}
              ecarte={ecartees.includes(index)}
              onBasculer={() => basculer(index)}
            />
          ))}
        </ul>
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-trait bg-papier-cote px-4 py-[14px]">
        <span className="mesure text-[10.5px] text-encre-2">
          {gardees} gardé{gardees > 1 ? "s" : ""} sur {mesures.length}
        </span>
        {!juste && (
          <Raison
            texte={
              gardees > demandees
                ? `il en reste ${gardees - demandees} de trop — ${demandees} cases à remplir`
                : `il en manque ${demandees - gardees} — ${demandees} cases à remplir`
            }
          />
        )}
        <span className="mesure ml-auto text-[10.5px] text-encre-4">
          rien ne repart chez le fournisseur
        </span>
        <Bouton
          principal
          inactif={!juste || enCours}
          onClick={() => void valider()}
          titre={
            juste
              ? undefined
              : "le compte doit tomber juste — une case, une image"
          }
          enfants={
            enCours ? "…" : `Garder ${demandees > 1 ? `ces ${demandees}` : "celui-là"}`
          }
        />
      </footer>
    </div>
  )
}

/** Ce que la planche a de travers, dit par le serveur.
 *
 *  **Deux défauts, jamais confondus** : un sujet en trop est une case à
 *  désigner, un carré plein est un morceau de grille que le modèle a dessiné.
 *  Les mettre dans la même phrase ferait chercher lequel des deux on a. */
function Phrase({ pliage }: { pliage: NonNullable<Generation["pliage"]> }) {
  const pleines = pliage.pleines ?? []
  return (
    <div className="flex flex-col gap-1.5 rounded-5 border border-trait bg-carte px-3 py-2.5">
      {pliage.surplus > 0 && (
        <p className="text-[12px] text-encre">
          <strong className="font-medium">
            {pliage.surplus} sujet{pliage.surplus > 1 ? "s" : ""} de trop
          </strong>{" "}
          — cliquez ceux que vous ne gardez pas. L'appel a été payé une fois, et
          il ne se rejoue pas.
        </p>
      )}
      {pleines.length > 0 && (
        <p className="text-[12px] text-encre">
          <strong className="font-medium">
            {pleines.length} sujet{pleines.length > 1 ? "s" : ""} remplit
            {pleines.length > 1 ? "ssent" : ""} presque toute{" "}
            {pleines.length > 1 ? "leur boîte" : "sa boîte"}
          </strong>{" "}
          — c'est le quadrillage que le modèle a redessiné, pas un personnage.
          Les garder ferait entrer du fond.
        </p>
      )}
      <Raison texte="rien n'est entré en bibliothèque tant que vous n'avez pas tranché" />
    </div>
  )
}

/** Un sujet de la planche, découpé à sa boîte, cliquable.
 *
 *  **Découpé par l'écran, dans l'image de la planche.** Le serveur n'a pas de
 *  vignette à servir — il n'a rien écrit, c'est le principe. La boîte que
 *  l'arrivée a mesurée suffit : on pose la planche en fond, agrandie du rapport
 *  qu'il faut, et décalée pour que la boîte tombe dans la case. */
function Sujet({
  mesure,
  numero,
  planche,
  ecarte,
  onBasculer,
}: {
  mesure: MesuresLot
  numero: number
  planche: string
  ecarte: boolean
  onBasculer: () => void
}) {
  const COTE = 104
  const boite = mesure.boite ?? [0, 0, 0, 0]
  const [x0, y0, x1, y1] = boite
  const largeur = Math.max(1, x1 - x0 + 1)
  const hauteur = Math.max(1, y1 - y0 + 1)
  // Le plus petit des deux rapports : c'est lui qui fait tenir la boîte entière
  // dans la case, sans jamais rogner un bras.
  const echelle = Math.min(COTE / largeur, COTE / hauteur)
  const pleine = mesure.pleine === true
  const remplissage = mesure.remplissage

  return (
    <li>
      <button
        type="button"
        onClick={onBasculer}
        aria-pressed={ecarte}
        // **Le nom dit lequel, `aria-pressed` dit son état.** Sans nom
        // explicite, le bouton s'appellerait « n° 1 55 % » — le chiffre du
        // remplissage entrerait dans son nom, et changerait avec lui.
        aria-label={`sujet n° ${numero}`}
        title={
          ecarte
            ? `sujet n° ${numero} — écarté, cliquez pour le reprendre`
            : `sujet n° ${numero} — cliquez pour l'écarter`
        }
        className={[
          "flex cursor-pointer flex-col overflow-hidden rounded-5 border transition-colors duration-120",
          ecarte
            ? "border-trait bg-carte opacity-40"
            : pleine
              ? "border-trait-attention bg-fond-attention"
              : "border-trait bg-carte hover:border-contour",
        ].join(" ")}
      >
        {/* **La planche entière, cadrée par la fenêtre.** Un `transform` plutôt
            qu'un `background-size` : celui-ci demanderait la taille de la
            planche, que le serveur n'envoie nulle part — et l'écran n'a aucune
            raison de la lui demander alors qu'il tient déjà la boîte. */}
        <span
          className="relative block overflow-hidden bg-pourtour"
          style={{ width: COTE, height: COTE }}
        >
          <img
            src={planche}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute top-0 left-0"
            style={{
              maxWidth: "none",
              transformOrigin: "0 0",
              // Lu de droite à gauche : on amène le coin de la boîte à
              // l'origine, on met à l'échelle, puis on recentre dans la case.
              transform: [
                `translate(${(COTE - largeur * echelle) / 2}px, ${(COTE - hauteur * echelle) / 2}px)`,
                `scale(${echelle})`,
                `translate(${-x0}px, ${-y0}px)`,
              ].join(" "),
              imageRendering: "pixelated",
            }}
          />
        </span>
        <span className="flex items-center gap-1.5 border-t border-trait px-1.5 py-1">
          <span className="mesure text-[10.5px] text-encre-2">n° {numero}</span>
          {remplissage !== undefined && (
            <span
              className={[
                "mesure ml-auto text-[10.5px]",
                pleine ? "text-encre-attention" : "text-encre-4",
              ].join(" ")}
              title={
                pleine
                  ? "presque toute la boîte est pleine — c'est une case, pas un personnage"
                  : "part de la boîte qui reste opaque, une fois le fond retiré"
              }
            >
              {Math.round(remplissage * 100)} %
            </span>
          )}
        </span>
      </button>
    </li>
  )
}
