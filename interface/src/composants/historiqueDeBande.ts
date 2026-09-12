import { useCallback, useEffect, useRef, useState } from "react"
import type { Prise, Recette } from "../api"

export type EtatDeBande = {
  prises: Prise[]
  chutier: Prise[]
  recette: Recette | null
  cadence: number
  sens: "boucle" | "aller-retour"
}

/** L'historique porte les gestes, pas la lecture, le zoom ni les aperçus
 * asynchrones. Une restauration ne s'enregistre pas comme un nouveau geste. */
export function useHistoriqueDeBande(identifiant: string, pret: boolean, etat: EtatDeBande, restaurer: (etat: EtatDeBande) => void) {
  const registre = useRef<{ id: string; etats: EtatDeBande[]; curseur: number }>({ id: identifiant, etats: [], curseur: -1 })
  const [version, actualiser] = useState(0)
  const texte = JSON.stringify(etat)
  useEffect(() => {
    if (!pret) return
    if (registre.current.id !== identifiant) registre.current = { id: identifiant, etats: [], curseur: -1 }
    const courant = registre.current
    if (JSON.stringify(courant.etats[courant.curseur]) === texte) return
    courant.etats = [...courant.etats.slice(0, courant.curseur + 1), JSON.parse(texte) as EtatDeBande].slice(-80)
    courant.curseur = courant.etats.length - 1
    actualiser((n) => n + 1)
  }, [identifiant, pret, texte])
  const parcourir = useCallback((delta: number) => {
    const courant = registre.current
    const suivant = courant.curseur + delta
    if (suivant < 0 || suivant >= courant.etats.length) return
    courant.curseur = suivant
    restaurer(courant.etats[suivant])
    actualiser((n) => n + 1)
  }, [restaurer])
  void version
  return {
    peutDefaire: registre.current.curseur > 0,
    peutRefaire: registre.current.curseur < registre.current.etats.length - 1,
    defaire: () => parcourir(-1), refaire: () => parcourir(1),
  }
}
