// L'écran Réglages — en T1 il n'existe que pour la clé.
//
// « C'est le seul préalable dur du produit » (`docs/PLAN.md`, T1). Les
// garde-fous de l'agent et les dossiers le rejoindront en T7 ; d'ici là, un
// écran d'une seule ligne vaut mieux qu'un écran à moitié vide.
//
// La clé se dépose une fois et n'est plus jamais redemandée. Elle n'est jamais
// relue par l'interface : le serveur n'en rend que les six derniers caractères.

import { useState } from "react"
import { api, type EtatCle } from "../api"
import { Bouton, Raison } from "./chassis"

export function EcranCle({
  etat,
  onDeposee,
  onFermer,
}: {
  etat: EtatCle
  onDeposee: () => void
  onFermer: () => void
}) {
  const [cle, setCle] = useState("")
  const [refus, setRefus] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  const deposer = async () => {
    setEnCours(true)
    setRefus(null)
    try {
      await api.deposerCle(cle.trim())
      setCle("")
      onDeposee()
      onFermer()
    } catch (erreur) {
      setRefus(erreur instanceof Error ? erreur.message : "dépôt refusé")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-start justify-center bg-fond-0/70 pt-[15vh]"
      onClick={onFermer}
    >
      <section
        onClick={(e) => e.stopPropagation()}
        className="w-[520px] rounded-[3px] border border-bord bg-fond-1 p-6"
      >
        <h2 className="font-serif text-[24px] leading-tight text-texte">Réglages</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed text-texte-2">
          La clé OpenRouter se dépose une fois. Elle est écrite dans{" "}
          <span className="mesure text-[11px] text-texte">.env</span>, qui n'est
          jamais versionné, et l'atelier ne la réaffiche plus jamais.
        </p>

        {etat.presente ? (
          <div className="mt-5 flex items-center gap-3 rounded-[2px] border border-bord bg-fond-2 px-3 py-2">
            <span className="mesure text-[11px] text-ok">clé présente</span>
            <span className="mesure text-[11px] text-texte-3">
              …{etat.apercu} · {etat.origine}
            </span>
          </div>
        ) : (
          <Raison texte={etat.raison} />
        )}

        <div className="mt-5 flex items-start gap-2">
          <input
            type="password"
            value={cle}
            autoFocus
            onChange={(e) => setCle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cle.trim().length >= 8 && deposer()}
            placeholder="sk-or-…"
            className="mesure h-8 flex-1 rounded-[2px] border border-bord-fort bg-fond-2 px-3 text-[11px] text-texte placeholder:text-texte-3"
          />
          <Bouton
            principal
            inactif={cle.trim().length < 8 || enCours}
            onClick={deposer}
            enfants={etat.presente ? "Remplacer" : "Déposer"}
          />
        </div>
        <Raison texte={refus} />

        <div className="mt-6 flex justify-end">
          <Bouton onClick={onFermer} enfants="Fermer" />
        </div>
      </section>
    </div>
  )
}
