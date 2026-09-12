import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Le dialogue natif rend le reste de l’atelier inerte et rend le focus à
 * sa porte en se fermant. L’écran dessous reste monté avec ses réglages. */
export function CadreDialogue({ titre, onFermer, enfants }: {
  titre: string; onFermer: () => void; enfants: ReactNode
}) {
  const cadre = useRef<HTMLDialogElement>(null)
  const fermer = useRef(onFermer)
  fermer.current = onFermer
  useEffect(() => {
    const d = cadre.current
    if (!d) return
    d.showModal()
    return () => { d.close() }
  }, [])
  return createPortal(<dialog ref={cadre} aria-label={titre} onCancel={(e) => { e.preventDefault(); e.stopPropagation(); fermer.current() }} className="m-auto h-full max-h-full w-full max-w-full border-0 bg-papier p-0 text-encre open:flex open:flex-col">{enfants}</dialog>, document.body)
}
