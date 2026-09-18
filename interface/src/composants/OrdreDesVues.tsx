// L'ordre des vues de la planche d'un sujet (RS8, 18 septembre 2026).
//
// **Pourquoi c'est là** : une planche refaite revient coupée en ses vues (RS7),
// et chaque morceau doit tomber dans sa direction. La direction vient de la
// position sur la planche, jamais d'un modèle qui regarde l'image : l'auteur dit
// une fois pour toutes « la première vue est sud, la deuxième est est… », et la
// découpe à l'arrivée range la n-ième image dans la n-ième direction
// (`docs/PLAN-references-du-sujet.md`, décision 8).
//
// **Un brouillon, puis un bouton** plutôt qu'un enregistrement à chaque choix :
// échanger deux vues passe par un instant où la même direction est nommée deux
// fois, et le serveur refuse les doublons.

import { useEffect, useState } from "react"
import { api, type Direction, type ReferenceDeLaChose } from "../api"

export function OrdreDesVues({
  personnage,
  planche,
  directions,
}: {
  /** L'identifiant du sujet. */
  personnage: string
  /** La ligne de sa référence rangée en planche. */
  planche: ReferenceDeLaChose
  /** Les directions que ce sujet tient — ce qu'une vue peut montrer. */
  directions: readonly Direction[]
}) {
  const [enregistre, setEnregistre] = useState<string[]>(planche.ordre_des_vues ?? [])
  const [brouillon, setBrouillon] = useState<string[]>(planche.ordre_des_vues ?? [])
  // Le nombre de vues que la découpe trouverait sur la planche — la même
  // détection que la découpe à l'arrivée. `null` tant qu'on ne le sait pas.
  const [zones, setZones] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const dit = (planche.ordre_des_vues ?? []).join(",")
  useEffect(() => {
    const lu = dit ? dit.split(",") : []
    setEnregistre(lu)
    setBrouillon(lu)
    setErreur(null)
  }, [planche.reference, dit])

  useEffect(() => {
    let vivant = true
    setZones(null)
    api
      .decoupeProposee(planche.reference)
      .then((p) => {
        if (!vivant) return
        const compte = p.boites.length
        setZones(compte)
        // **Rien de dit encore : une place par vue trouvée**, vides.
        if (compte > 0) setBrouillon((b) => (b.length === 0 ? Array(compte).fill("") : b))
      })
      .catch(() => vivant && setZones(null))
    return () => {
      vivant = false
    }
  }, [planche.reference])

  const choisir = (rang: number, direction: string) =>
    setBrouillon((b) => b.map((d, i) => (i === rang ? direction : d)))

  const envoyer = async (ordre: string[] | null) => {
    setEnCours(true)
    setErreur(null)
    try {
      const rendu = await api.poserOrdreDesVues(personnage, planche.reference, ordre)
      const ligne = rendu.references.lignes.find((l) => l.reference === planche.reference)
      const lu = ligne?.ordre_des_vues ?? []
      setEnregistre(lu)
      setBrouillon(lu.length > 0 ? lu : Array(zones ?? 0).fill(""))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "ordre refusé")
    } finally {
      setEnCours(false)
    }
  }

  const complet = brouillon.length > 0 && brouillon.every(Boolean)
  const change = brouillon.join(",") !== enregistre.join(",")

  return (
    <div data-ordre-des-vues className="flex flex-col gap-[8px] border-t border-trait pt-[8px]">
      <span className="text-[12px] text-encre-2">
        Ordre des vues, de gauche à droite puis de haut en bas :
      </span>
      <ol className="flex flex-wrap items-center gap-[8px]">
        {brouillon.map((direction, rang) => (
          <li key={rang} className="flex items-center gap-[4px]">
            <span className="mesure text-[12px] text-encre-3">{rang + 1}</span>
            <select
              aria-label={`Vue ${rang + 1}`}
              value={direction}
              onChange={(e) => choisir(rang, e.target.value)}
              className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12.5px]"
            >
              <option value="">—</option>
              {directions.map((d) => (
                <option key={d.identifiant} value={d.identifiant}>
                  {d.nom}
                </option>
              ))}
            </select>
          </li>
        ))}
        <li className="flex items-center gap-[4px]">
          <button
            type="button"
            onClick={() => setBrouillon((b) => [...b, ""])}
            className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-3 hover:border-encre-3"
          >
            + une vue
          </button>
          {brouillon.length > 0 && (
            <button
              type="button"
              onClick={() => setBrouillon((b) => b.slice(0, -1))}
              className="h-[30px] rounded-7 border border-contour bg-carte px-[8px] text-[12px] text-encre-3 hover:border-encre-3"
            >
              − une vue
            </button>
          )}
        </li>
      </ol>

      {zones !== null && zones > 0 && zones !== brouillon.length && (
        <p className="text-[11.5px] text-encre-3">
          La planche montre <span className="mesure">{zones}</span> vues : sans autant de
          directions, les images découpées arrivent sans direction.
        </p>
      )}
      {enregistre.length === 0 && (
        <p className="text-[11px] text-encre-4">
          Pas d'ordre enregistré : les images découpées arrivent sans direction.
        </p>
      )}

      <div className="flex items-center gap-[8px]">
        <button
          type="button"
          disabled={!complet || !change || enCours}
          onClick={() => void envoyer(brouillon)}
          className="h-[30px] rounded-7 border border-contour bg-papier-cote px-[8px] text-[12.5px] text-encre-controle hover:border-encre-3 disabled:text-eteint"
        >
          Enregistrer l'ordre
        </button>
        {enregistre.length > 0 && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => void envoyer(null)}
            className="h-[30px] rounded-7 px-[8px] text-[12px] text-encre-3 hover:text-encre"
          >
            Effacer
          </button>
        )}
      </div>
      {erreur && <p className="text-[11.5px] text-echec">{erreur}</p>}
    </div>
  )
}
