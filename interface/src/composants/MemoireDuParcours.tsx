import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode, type SetStateAction } from "react"

const Contexte = createContext<Map<string, unknown> | null>(null)

/** La mémoire appartient à la session, et survit aux écrans qu’elle remplace. */
export function MemoireDuParcours({ children }: { children: ReactNode }) {
  const memoire = useRef(new Map<string, unknown>())
  return <Contexte.Provider value={memoire.current}>{children}</Contexte.Provider>
}

/** Préparer une destination avant de changer de sujet ne modifie pas celui
 * qu’on quitte. Les setters d’écran ne servent qu’à leur clé courante. */
export function useEcrireDansLeParcours() {
  const memoire = useContext(Contexte)
  return useCallback((cle: string, valeur: unknown) => { memoire?.set(cle, valeur) }, [memoire])
}

export function useEtatDuParcours<T>(cle: string, depart: T): [T, (suite: SetStateAction<T>) => void] {
  const memoire = useContext(Contexte)
  const lire = () => (memoire?.has(cle) ? memoire.get(cle) : depart) as T
  const [etat, setEtat] = useState(() => ({ cle, valeur: lire() }))
  const courant = useRef(etat)
  const valeur = etat.cle === cle ? etat.valeur : lire()
  courant.current = { cle, valeur }
  const modifier = useCallback((suite: SetStateAction<T>) => {
    const avant = courant.current.cle === cle ? courant.current.valeur : lire()
    const prochaine = typeof suite === "function" ? (suite as (avant: T) => T)(avant) : suite
    memoire?.set(cle, prochaine)
    courant.current = { cle, valeur: prochaine }
    setEtat(courant.current)
  // La valeur de départ est celle de cette clé ; le setter reste stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, memoire])
  return [valeur, modifier]
}

export function useScrollDuParcours(cle: string) {
  const memoire = useContext(Contexte)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const position = memoire?.get(cle) as { haut: number; gauche: number } | undefined
    if (ref.current && position) { ref.current.scrollTop = position.haut; ref.current.scrollLeft = position.gauche }
  }, [cle, memoire])
  return { ref, onScroll: (e: React.UIEvent<HTMLDivElement>) => memoire?.set(cle, { haut: e.currentTarget.scrollTop, gauche: e.currentTarget.scrollLeft }) }
}
