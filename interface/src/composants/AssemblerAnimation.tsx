// RP21 · Le chemin inverse — une sélection d'images fixes devient une
// animation.
//
// **La même grille, le même geste de sélection** (US-31) : la galerie porte
// déjà une sélection multiple pour organiser et réutiliser — celle-ci lui
// ajoute un troisième usage, à côté de « ranger » et « exporter ». Rien de
// neuf n'est inventé ici, et c'est voulu.
//
// **Aucun rectangle à dessiner.** Les images existent déjà, chacune en
// bibliothèque ; ce geste ne fait que les ranger côte à côte, dans l'ordre où
// la sélection les tenait, et les confier à l'atelier de montage qui sait
// déjà tailler une bande.

import { useEffect, useState } from "react"
import { api, Refus, type Asset, type Bande, type Direction, type Personnage, type Pose } from "../api"

/** Pourquoi cette sélection ne peut pas devenir une animation, ou rien.
 *
 *  **Vérifiée ici comme au serveur** (`ServicePlancheAnimee.assembler`) : le
 *  client dit pourquoi avant de proposer le geste, le serveur refuse quand
 *  même si on le contourne — deux bouts d'une seule règle, jamais deux règles.
 */
export function raisonAssemblage(images: Asset[], compteSelection: number): string | null {
  if (compteSelection === 0) return null
  if (images.length !== compteSelection) {
    return "cette sélection contient autre chose que des images fixes"
  }
  const sujets = new Set(
    images.map((image) => image.personnage).filter((p): p is string => Boolean(p)),
  )
  if (sujets.size > 1) {
    return "cette sélection mélange plusieurs sujets — choisis des images d'un seul personnage"
  }
  return null
}

/** Ce que la sélection porte déjà en commun — le sujet, la pose et la
 *  direction se préremplissent quand toutes les images s'accordent, comme le
 *  serveur le referait de son côté si on les laissait vides. */
function valeurCommune(images: Asset[], lire: (image: Asset) => string | null): string {
  const valeurs = new Set(images.map(lire).filter((v): v is string => Boolean(v)))
  return valeurs.size === 1 ? [...valeurs][0] : ""
}

export function FenetreAssembler({
  images,
  personnages,
  plan,
  onFermer,
  onFait,
}: {
  /** Les images de la sélection, dans l'ordre où elle les tenait — c'est cet
   *  ordre-là qui devient celui des frames. */
  images: Asset[]
  personnages: Personnage[]
  plan: Pose[]
  onFermer: () => void
  /** La bande qui vient de naître — l'appelant ouvre son atelier. */
  onFait: (bandes: Bande[]) => void
}) {
  const [sujetVise, setSujetVise] = useState(() => valeurCommune(images, (i) => i.personnage))
  const [poseVisee, setPoseVisee] = useState(() => valeurCommune(images, (i) => i.pose))
  // **La direction se préremplit comme le sujet et la pose** : les images de
  // la sélection portent déjà la leur, et le serveur ferait le même calcul si
  // on les laissait vides (`ServicePlancheAnimee.assembler`). Il n'y a ici
  // aucune ligne à répartir comme en `AU19` — une bande, une direction — donc
  // le champ se choisit directement plutôt que de se déduire d'un partage.
  const [directionVisee, setDirectionVisee] = useState(() => valeurCommune(images, (i) => i.direction))
  const [directionsDuJeu, setDirectionsDuJeu] = useState<Direction[]>([])
  const [enCours, setEnCours] = useState(false)
  const [refus, setRefus] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    void api
      .directions()
      .then((lues) => vivant && setDirectionsDuJeu(lues.directions))
      .catch(() => undefined)
    return () => {
      vivant = false
    }
  }, [])

  const confirmer = async () => {
    setEnCours(true)
    setRefus(null)
    try {
      const fait = await api.assemblerAnimation(
        images.map((image) => image.identifiant),
        {
          personnage: sujetVise,
          // **La chaîne vide dit « aucun »** — la même convention que la
          // découpe d'une planche (`AU20`) : sans sujet, aucune pose n'a de
          // sens à envoyer.
          pose: sujetVise ? poseVisee : "",
          direction: directionVisee,
        },
      )
      onFait(fait.bandes)
    } catch (erreur) {
      setRefus(erreur instanceof Refus ? erreur.message : "l'assemblage a été refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-papier/85" onMouseDown={onFermer} role="presentation">
      <div
        role="dialog"
        aria-label="En faire une animation"
        className="volet mx-auto mt-[9%] flex max-h-[80vh] w-[380px] max-w-full flex-col overflow-hidden rounded-10 border border-contour bg-carte"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-baseline gap-[14px] border-b border-trait px-[22px] py-[14px]">
          <h1 className="font-serif text-[25px] leading-none text-encre">En faire une animation</h1>
        </header>
        <div className="defile flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[22px]">
          <p className="text-[12px] text-encre-2">
            {images.length} image{images.length > 1 ? "s" : ""}, dans l'ordre de la
            sélection. Elles restent en bibliothèque.
          </p>
          <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
            Animation de
            <select
              value={sujetVise}
              onChange={(e) => setSujetVise(e.target.value)}
              className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
            >
              <option value="">Personne — elle ira dans la galerie du jeu</option>
              {personnages.map((p) => (
                <option key={p.identifiant} value={p.identifiant}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
          {sujetVise && (
            <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
              Mouvement
              <select
                value={poseVisee}
                onChange={(e) => setPoseVisee(e.target.value)}
                className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
              >
                <option value="">À ranger plus tard — elle attendra sur la fiche</option>
                {plan.map((p) => (
                  <option key={p.identifiant} value={p.identifiant}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-[4px] text-[11px] text-encre-2">
            Direction
            <select
              value={directionVisee}
              onChange={(e) => setDirectionVisee(e.target.value)}
              className="h-[30px] rounded-7 border border-trait bg-carte px-[8px] text-[12px] text-encre"
            >
              <option value="">Aucune — les images n'en disent pas plus</option>
              {directionsDuJeu.map((d) => (
                <option key={d.identifiant} value={d.identifiant}>
                  {d.nom}
                </option>
              ))}
            </select>
          </label>
          {refus && <p className="text-[11px] text-echec">{refus}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-[8px] border-t border-trait p-[8px]">
          <button
            type="button"
            onClick={onFermer}
            className="h-[34px] rounded-7 border border-trait px-[14px] text-[13px] text-encre transition-colors duration-120 hover:bg-papier"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => void confirmer()}
            className="ml-auto h-[34px] rounded-7 bg-signal px-[14px] text-[13px] text-encre-sur-signal transition-colors duration-120 hover:opacity-90 disabled:bg-carte disabled:text-eteint"
          >
            {enCours ? "…" : "Créer l'animation"}
          </button>
        </div>
      </div>
    </div>
  )
}
