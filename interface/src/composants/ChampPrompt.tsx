// Le champ de prompt — 62 px au minimum, 13,5 px, le seul endroit du produit
// où le texte est plus gros que le châssis.
//
// « L'atelier s'ouvre sur un champ de prompt actif, sans écran à traverser »
// (`docs/PLAN.md`, T1). Le prompt négatif est replié : on l'écrit rarement, on
// le lit encore moins.

import { useEffect, useRef, useState } from "react"
import { Bouton, Raison } from "./chassis"

export function ChampPrompt({
  prompt,
  onPrompt,
  promptNegatif,
  onPromptNegatif,
  refus,
  ouAller,
  onAller,
  onGenerer,
  variations,
}: {
  prompt: string
  onPrompt: (v: string) => void
  promptNegatif: string
  onPromptNegatif: (v: string) => void
  refus: string | null
  ouAller?: string
  onAller?: () => void
  onGenerer: () => void
  variations: number
}) {
  const [negatifOuvert, setNegatifOuvert] = useState(false)
  const champ = useRef<HTMLTextAreaElement>(null)

  useEffect(() => champ.current?.focus(), [])

  const toucheGenerer = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !refus) {
      e.preventDefault()
      onGenerer()
    }
  }

  return (
    <div className="flex flex-col gap-2 border-b border-bord bg-fond-1 p-4">
      <textarea
        ref={champ}
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        onKeyDown={toucheGenerer}
        rows={2}
        placeholder="Décris ce que tu veux fabriquer."
        className="min-h-[62px] resize-y rounded-[3px] border border-bord-fort bg-fond-2 px-3 py-2 text-[13.5px] leading-relaxed text-texte placeholder:text-texte-3"
      />

      {negatifOuvert && (
        <textarea
          value={promptNegatif}
          onChange={(e) => onPromptNegatif(e.target.value)}
          onKeyDown={toucheGenerer}
          rows={1}
          placeholder="Ce que tu ne veux pas."
          className="min-h-[32px] resize-y rounded-[3px] border border-bord bg-fond-2 px-3 py-2 text-[12.5px] text-texte-2 placeholder:text-texte-3"
        />
      )}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setNegatifOuvert((o) => !o)}
          className="mesure h-8 text-[10px] text-texte-3 hover:text-texte-2"
        >
          {negatifOuvert ? "− " : "+ "}prompt négatif
          {promptNegatif && !negatifOuvert ? " ·" : ""}
        </button>

        <div className="ml-auto flex flex-col items-end">
          <Bouton principal inactif={refus !== null} onClick={onGenerer} enfants={
            variations > 1 ? `Générer ${variations} variations` : "Générer"
          } />
          <Raison texte={refus} ouAller={ouAller} onAller={onAller} />
          {!refus && (
            <p className="mesure mt-1 text-[10px] text-texte-3">Ctrl + Entrée</p>
          )}
        </div>
      </div>
    </div>
  )
}
