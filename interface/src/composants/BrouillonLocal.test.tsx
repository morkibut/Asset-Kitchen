import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { AvisBrouillon, useBrouillonLocal } from "./BrouillonLocal"

afterEach(() => { cleanup(); localStorage.clear() })

function Editeur({ cle = "jeu:montage", reference = "départ" }: { cle?: string; reference?: string }) {
  const [texte, setTexte] = useState(reference)
  const brouillon = useBrouillonLocal({ cle, pret: true, reference: { texte: reference }, etat: { texte }, appliquer: (recu) => setTexte(recu.texte) })
  return <><input aria-label="Le prompt" value={texte} onChange={(e) => setTexte(e.target.value)} /><AvisBrouillon brouillon={brouillon} /><button onClick={brouillon.effacer}>Enregistrement réussi</button></>
}

test("rouvrir conserve les réglages de départ jusqu’à une reprise explicite et signale une référence changée", () => {
  const vue = render(<Editeur />)
  fireEvent.change(screen.getByLabelText("Le prompt"), { target: { value: "un sac rouge" } })
  expect(screen.getByText("Brouillon conservé sur cet ordinateur.")).toBeTruthy()
  vue.unmount()
  render(<Editeur reference="nouvelle version enregistrée" />)
  expect((screen.getByLabelText("Le prompt") as HTMLInputElement).value).toBe("nouvelle version enregistrée")
  expect(screen.getByText(/La version enregistrée a changé/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Reprendre le brouillon" }))
  expect((screen.getByLabelText("Le prompt") as HTMLInputElement).value).toBe("un sac rouge")
  fireEvent.click(screen.getByRole("button", { name: "Enregistrement réussi" }))
  expect(localStorage.length).toBe(0)
})

test("les jeux sont séparés et abandonner un brouillon ne remplace pas la version enregistrée", () => {
  const vue = render(<Editeur />)
  fireEvent.change(screen.getByLabelText("Le prompt"), { target: { value: "un casque" } })
  vue.unmount()
  const autre = render(<Editeur cle="autre-jeu:montage" />)
  expect(screen.queryByRole("button", { name: "Reprendre le brouillon" })).toBeNull()
  autre.unmount()
  render(<Editeur />)
  fireEvent.click(screen.getByRole("button", { name: "Abandonner le brouillon" }))
  expect((screen.getByLabelText("Le prompt") as HTMLInputElement).value).toBe("départ")
  expect(localStorage.length).toBe(0)
})
