import { useEffect, useRef, useState } from "react"
import { adresseDuBrouillon as adresse, declarerLeBrouillon, ouLonEst, retirerLeBrouillon } from "../brouillons"

type Brouillon<T> = { version: 1; reference: string; etat: T; modifie: number }

/** Un brouillon reste séparé du résultat enregistré ; la reprise est explicite.
 *
 *  **C'est aussi la porte unique de l'index** (`RP16`) : un écran qui donne son
 *  nom (`ecran`) et de quoi il s'agit (`quoi`) entre au tiroir des brouillons,
 *  sans rien changer à ce qu'il garde. Un écran qui ne les donne pas garde son
 *  brouillon et n'y entre pas — ce qui reste vrai plutôt que faux. */
export function useBrouillonLocal<T>({ cle, pret, reference, etat, appliquer, signature = JSON.stringify, ecran, quoi }: {
  cle: string; pret: boolean; reference: T; etat: T; appliquer: (etat: T) => void | Promise<void>
  signature?: (etat: T) => string
  /** L'écran qui laisse ce brouillon — *La retouche*, *Le montage*… */
  ecran?: string
  /** De quoi il s'agit, en une ligne : le sujet, le mouvement, le nom. */
  quoi?: string
}) {
  const [lecture, setLecture] = useState<{ cle: string; candidat: Brouillon<T> | null; decide: boolean } | null>(null)
  const [erreur, setErreur] = useState("")
  const [conserve, setConserve] = useState(false)
  const [enReprise, setEnReprise] = useState(false)
  const ignore = useRef<string | null>(null)
  const contenu = JSON.stringify(etat)
  const original = signature(reference)
  const identique = signature(etat) === original
  useEffect(() => {
    if (!pret) return
    try {
      const texte = localStorage.getItem(adresse(cle))
      const lu = texte ? JSON.parse(texte) as Brouillon<T> : null
      const candidat = lu?.version === 1 && lu.etat && typeof lu.reference === "string" ? lu : null
      setLecture({ cle, candidat, decide: !candidat })
      setConserve(Boolean(candidat)); setErreur(""); ignore.current = null
    } catch { setLecture({ cle, candidat: null, decide: true }); setErreur("Le brouillon ne peut pas être relu sur cet ordinateur.") }
  }, [cle, pret])
  useEffect(() => {
    if (!pret || lecture?.cle !== cle || !lecture.decide || ignore.current === contenu) return
    try {
      if (identique) { localStorage.removeItem(adresse(cle)); retirerLeBrouillon(cle); setConserve(false) }
      else {
        const modifie = Date.now()
        localStorage.setItem(adresse(cle), JSON.stringify({ version: 1, reference: original, etat: JSON.parse(contenu), modifie }))
        // L'index s'écrit **après** le brouillon : une ligne sans brouillon
        // derrière elle serait un tiroir qui ment.
        if (ecran) declarerLeBrouillon({ cle, ecran, quoi: quoi ?? "", modifie, retour: ouLonEst() })
        setConserve(true)
      }
      setErreur("")
    } catch { setErreur("Le brouillon ne peut pas être conservé. Enregistre ton travail avant de quitter cet écran.") }
  }, [cle, pret, contenu, original, identique, lecture, ecran, quoi])
  const candidat = lecture?.cle === cle && !lecture.decide ? lecture.candidat : null
  const effacer = () => {
    try { localStorage.removeItem(adresse(cle)); setErreur("") } catch { setErreur("Le brouillon ne peut pas être retiré de cet ordinateur.") }
    retirerLeBrouillon(cle)
    ignore.current = contenu; setConserve(false); setLecture({ cle, candidat: null, decide: true })
  }
  return {
    candidat, conflit: Boolean(candidat && candidat.reference !== original), conserve, erreur, enReprise,
    reprendre: () => {
      if (!candidat || enReprise) return
      const fini = () => { setLecture({ cle, candidat: null, decide: true }); setEnReprise(false); setErreur("") }
      const refus = () => { setErreur("Les sources de ce brouillon ne peuvent pas être relues. Le brouillon reste conservé ; réessayez ou abandonnez-le."); setEnReprise(false) }
      try {
        const suite = appliquer(candidat.etat)
        if (suite) { setEnReprise(true); void suite.then(fini).catch(refus) }
        else fini()
      } catch { refus() }
    },
    effacer,
  }
}

export function AvisBrouillon({ brouillon }: { brouillon: ReturnType<typeof useBrouillonLocal<unknown>> }) {
  return <>{brouillon.erreur && <p role="alert" className="rounded-7 border border-trait-echec bg-fond-echec p-[8px] text-[12px] text-echec">{brouillon.erreur}</p>}
  {brouillon.candidat ? <div role="status" className="flex shrink-0 flex-col gap-[8px] rounded-7 border border-trait-attention bg-fond-attention p-[8px] text-[12px]">
    <p>Un brouillon du {new Date(brouillon.candidat.modifie).toLocaleString("fr-FR")} attend ici.</p>
    {brouillon.conflit && <p>La version enregistrée a changé depuis. Reprendre restaure tes réglages pour les vérifier avant d’enregistrer.</p>}
    <div className="flex flex-wrap gap-[8px]"><button type="button" disabled={brouillon.enReprise} onClick={brouillon.reprendre} className="rounded-5 border border-contour bg-carte p-[4px]">{brouillon.enReprise ? "Reprise…" : "Reprendre le brouillon"}</button><button type="button" disabled={brouillon.enReprise} onClick={brouillon.effacer}>Abandonner le brouillon</button></div>
  </div> : brouillon.conserve ? <p role="status" className="text-[11px] text-encre-3">Brouillon conservé sur cet ordinateur.</p> : null}</>
}
