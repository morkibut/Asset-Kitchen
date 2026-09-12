import type { Univers } from "../api"
import { useEtatMain, type EtatMain } from "../recette"
import { useEtatDuParcours } from "./MemoireDuParcours"

/** Le pinceau et le calque choisi appartiennent à la session, pas au rendu. */
export function useMainDuParcours(cle: string, univers: Univers): EtatMain {
  const depart = useEtatMain(univers)
  const [actif, choisir] = useEtatDuParcours(`${cle}:calque`, depart.actif)
  const [sens, setSens] = useEtatDuParcours(`${cle}:sens`, depart.sens)
  const [diametre, setDiametre] = useEtatDuParcours(`${cle}:diametre`, depart.diametre)
  const [couleur, setCouleur] = useEtatDuParcours(`${cle}:couleur`, depart.couleur)
  return { actif, choisir, sens, setSens, diametre, setDiametre, couleur, setCouleur }
}
