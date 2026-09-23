// RV20 · un texte envoyé se copie — le composant partagé (volet d'un clip,
// fiche d'une image, tiroir de relecture). Deux essais : la copie porte le
// texte entier, l'échec se dit au lieu d'échouer en silence.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { BoutonCopierTexte, TexteEnvoye } from "./TexteEnvoye"

afterEach(cleanup)

const LONG =
  "The character is seen from the side, facing left, walking at a steady " +
  "pace across a cobbled courtyard, cape trailing in the wind behind them."

test("le bouton copie le texte entier dans le presse-papiers, et le dit", async () => {
  const ecrit = vi.fn(() => Promise.resolve())
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: ecrit } })

  render(<TexteEnvoye texte={LONG} />)
  fireEvent.click(screen.getByRole("button", { name: "Copier" }))

  await screen.findByText("copié")
  expect(ecrit).toHaveBeenCalledWith(LONG)
})

test("une copie refusée par le navigateur le dit, au lieu d'échouer en silence", async () => {
  const ecrit = vi.fn(() => Promise.reject(new Error("refus")))
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: ecrit } })

  render(<BoutonCopierTexte texte={LONG} />)
  fireEvent.click(screen.getByRole("button", { name: "Copier" }))

  await screen.findByText("copie refusée par le navigateur")
})

test("sans presse-papiers du tout, le bouton dit l'échec sans tenter d'appel", async () => {
  vi.stubGlobal("navigator", { ...navigator, clipboard: undefined })

  render(<BoutonCopierTexte texte={LONG} />)
  fireEvent.click(screen.getByRole("button", { name: "Copier" }))

  await screen.findByText("copie refusée par le navigateur")
})

test("le texte coupé se déplie au clic, au lieu de n'exister qu'en bulle", () => {
  render(<TexteEnvoye texte={LONG} />)
  const bouton = screen.getByRole("button", { name: "déplier le texte" })
  expect(bouton.className).toContain("truncate")
  expect(bouton.getAttribute("title")).toBe(LONG)

  fireEvent.click(bouton)

  const ouvert = screen.getByRole("button", { name: "replier le texte" })
  expect(ouvert.className).not.toContain("truncate")
  expect(ouvert.getAttribute("title")).toBeNull()
  expect(ouvert.textContent).toBe(LONG)
})
