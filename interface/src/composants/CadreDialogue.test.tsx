/** Le cadre commun de toutes les fenêtres posées en `<dialog>` (vingt
 *  écrans, dont « Préparer une fabrication ») — **un seul essai ici couvre
 *  Échap pour tous ses appelants** (`RV15`), plutôt que d'ajouter un
 *  écouteur et un essai par fenêtre : c'est le cadre qui porte le geste, pas
 *  chacune de ses vingt portes. */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test, vi } from "vitest"
import { CadreDialogue } from "./CadreDialogue"

describe("CadreDialogue", () => {
  test("Échap referme la fenêtre, par l'événement natif « cancel » du dialogue", () => {
    const onFermer = vi.fn()
    render(
      <CadreDialogue titre="Une fenêtre" onFermer={onFermer} enfants={<p>Son contenu</p>}>
      </CadreDialogue>,
    )
    const dialogue = screen.getByRole("dialog", { name: "Une fenêtre" })
    fireEvent(dialogue, new Event("cancel", { cancelable: true }))
    expect(onFermer).toHaveBeenCalledTimes(1)
  })

  test("format « preparation » : Échap referme aussi « Préparer une fabrication »", () => {
    // **Le format ne change rien au geste** — seule la largeur du cadre en
    // dépend (`CadreDialogue.tsx`) ; l'événement `cancel` est porté par le
    // même `<dialog>` natif dans les deux cas.
    const onFermer = vi.fn()
    render(
      <CadreDialogue titre="Préparer une fabrication" onFermer={onFermer} format="preparation" enfants={<p>Son contenu</p>}>
      </CadreDialogue>,
    )
    const dialogue = screen.getByRole("dialog", { name: "Préparer une fabrication" })
    fireEvent(dialogue, new Event("cancel", { cancelable: true }))
    expect(onFermer).toHaveBeenCalledTimes(1)
  })
})
