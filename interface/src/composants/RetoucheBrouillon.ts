import { useEffect, useRef, useState } from "react"
import { api, RECETTE_VIDE, type Asset, type Recette } from "../api"
import { useBrouillonLocal } from "./BrouillonLocal"

type Etat = { recette: Recette; reinitialiser: boolean }
type Apercu = Awaited<ReturnType<typeof api.apercuRecette>>
const identique = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Le serveur ne reçoit que des aperçus avant Enregistrer. Une réponse lente
 * ne peut ni déplacer le curseur ni remplacer le dernier rendu demandé. */
export function useRetoucheBrouillon(asset: Asset, onErreur: (texte: string) => void, actif = true) {
  const initial = (): Etat => ({ recette: asset.recette, reinitialiser: false })
  const [etat, setEtat] = useState<Etat>(initial)
  const [reference, setReference] = useState<Etat>(initial)
  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [enVol, setEnVol] = useState<{ depuis: number; attendue: number } | null>(null)
  const [enregistre, setEnregistre] = useState(false)
  const sauveEnCours = useRef(false)
  const [valide, setValide] = useState(true)
  const [annonce, setAnnonce] = useState<string[] | null>(null)
  const courant = useRef(etat)
  const differee = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ticket = useRef(0)
  const vivant = useRef(true)
  const id = useRef(asset.identifiant)
  const histoire = useRef<{ etats: Etat[]; rang: number }>({ etats: [initial()], rang: 0 })
  const [revision, setRevision] = useState(0)
  useEffect(() => { vivant.current = true; return () => { vivant.current = false; ticket.current += 1; if (differee.current) clearTimeout(differee.current) } }, [])
  useEffect(() => {
    id.current = asset.identifiant; ticket.current += 1
    if (differee.current) clearTimeout(differee.current)
    const depart = { recette: asset.recette, reinitialiser: false }
    courant.current = depart; setEtat(depart); setReference(depart); setApercu(null); setEnVol(null); setValide(true); setAnnonce(null)
    histoire.current = { etats: [depart], rang: 0 }; setRevision((v) => v + 1)
    // Une arrivée SSE ne remplace jamais un brouillon en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.identifiant])
  const retenir = (suite: Etat) => {
    const h = histoire.current
    if (identique(h.etats[h.rang], suite)) return
    h.etats = [...h.etats.slice(0, h.rang + 1), structuredClone(suite)].slice(-80)
    h.rang = h.etats.length - 1; setRevision((v) => v + 1)
  }
  const montrer = async (suite: Etat, options: { voyageuse?: boolean; nom?: string } = {}, retenirGeste = true) => {
    if (!actif) return
    if (differee.current) clearTimeout(differee.current)
    const tour = ++ticket.current
    const pour = asset.identifiant
    courant.current = suite; setEtat(suite); setValide(false); setEnVol({ depuis: Date.now() / 1000, attendue: 0.2 })
    if (retenirGeste) retenir(suite)
    try {
      const recu = await api.apercuRecette(pour, suite.recette, { ...options, reinitialiser: suite.reinitialiser })
      if (!vivant.current || tour !== ticket.current || id.current !== pour) return
      const normalisee = { ...suite, recette: recu.recette }
      courant.current = normalisee; setEtat(normalisee); setApercu(recu); setValide(true); setAnnonce(recu.laisse)
      if (retenirGeste) histoire.current.etats[histoire.current.rang] = structuredClone(normalisee)
    } catch (e) {
      if (vivant.current && tour === ticket.current && id.current === pour) onErreur(e instanceof Error ? e.message : "L’aperçu n’a pas pu être calculé. Le brouillon est conservé.")
    } finally { if (vivant.current && tour === ticket.current && id.current === pour) setEnVol(null) }
  }
  const brouillon = useBrouillonLocal({ cle: `retouche-explicite:${asset.projet ?? ""}:${asset.identifiant}`, pret: actif, reference, etat, appliquer: (suite) => montrer(suite) })
  const poser = (recette: Recette) => montrer({ ...courant.current, recette })
  const regler = (recette: Recette) => {
    ticket.current += 1; courant.current = { ...courant.current, recette }; setEtat(courant.current); setValide(false); setEnVol(null)
    if (differee.current) clearTimeout(differee.current)
    differee.current = setTimeout(() => { void montrer(courant.current) }, 180)
  }
  const parcourir = (delta: number) => {
    const h = histoire.current, rang = h.rang + delta
    if (rang < 0 || rang >= h.etats.length) return
    h.rang = rang; setRevision((v) => v + 1); void montrer(h.etats[rang], {}, false)
  }
  const enregistrer = async () => {
    if (sauveEnCours.current || enVol || !valide) return false
    const suite = courant.current, pour = asset.identifiant
    sauveEnCours.current = true; setEnregistre(true)
    try {
      const recu = await api.poserRecette(pour, suite.recette, suite.reinitialiser)
      if (!vivant.current || id.current !== pour) return true
      const gardee = { recette: recu.recette, reinitialiser: false }
      setReference(gardee)
      // Une retouche commencée pendant l’écriture reste un nouveau brouillon.
      if (!identique(courant.current, suite)) return false
      courant.current = gardee; setEtat(gardee); brouillon.effacer()
      return true
    } catch (e) { if (vivant.current) onErreur(e instanceof Error ? e.message : "L’enregistrement a échoué. Le brouillon est conservé."); return false }
    finally { sauveEnCours.current = false; if (vivant.current) setEnregistre(false) }
  }
  void revision
  return {
    recette: etat.recette, setRecette: regler, regler, poser, enVol, apercu, annonce,
    revenirAuBrut: () => montrer({ recette: RECETTE_VIDE, reinitialiser: true }),
    coller: (recette: Recette) => montrer({ ...courant.current, recette }, { voyageuse: true }),
    appliquer: (nom: string) => montrer(courant.current, { nom }),
    brouillon, enregistre, enregistrer, valide, modifie: !identique(etat, reference),
    peutDefaire: histoire.current.rang > 0, peutRefaire: histoire.current.rang < histoire.current.etats.length - 1,
    defaire: () => parcourir(-1), refaire: () => parcourir(1),
    abandonner: () => { if (differee.current) clearTimeout(differee.current); brouillon.effacer(); courant.current = reference; setEtat(reference); setApercu(null); setValide(true); ticket.current += 1; setEnVol(null); histoire.current = { etats: [reference], rang: 0 }; setRevision((v) => v + 1) },
  }
}
