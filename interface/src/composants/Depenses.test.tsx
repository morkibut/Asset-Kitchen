// CM6 — le compteur du coup de main et son plafond, dans l'écran des dépenses.
//
// `fetch` n'est pas touché : les deux appels de l'écran sont doublés sur `api`.
// Ce que l'essai regarde : le compteur se lit à côté du reste, le plafond se
// pose et **le compteur rendu par le serveur remplace l'ancien** (8septies —
// l'écran relit ce que le serveur a gardé, pas ce qu'il vient d'envoyer), et le
// plafond atteint se dit en toutes lettres, sans fenêtre.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, type CompteurCoupDeMain, type Depenses } from "../api"
import { EcranDepenses } from "./Depenses"

afterEach(cleanup)

const COMPTEUR: CompteurCoupDeMain = {
  atteint: false,
  plafond_usd: 1,
  pese_usd: 0.0123,
  cout_usd: 0.0101,
  en_vol_usd: 0,
  reste_usd: 0.9877,
  appels: 7,
  inconnus: 1,
}

function depenses(compteur?: CompteurCoupDeMain): Depenses {
  return {
    total_usd: 0.5,
    sans_projet_usd: 0,
    par_projet: [],
    par_modele: [],
    par_unite: [],
    appels: [],
    rafales: [],
    coup_de_main: compteur,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, "clipsEnSouffrance").mockResolvedValue({ clips: [] } as never)
})

const monter = () =>
  render(<EcranDepenses projetCourant={null} onErreur={vi.fn()} onFermer={vi.fn()} />)

test("le compteur du mois se lit à côté du reste des dépenses", async () => {
  vi.spyOn(api, "depenses").mockResolvedValue(depenses(COMPTEUR))
  monter()
  const bloc = await waitFor(() => {
    const trouve = document.querySelector("[data-coup-de-main-du-mois]")
    expect(trouve).not.toBeNull()
    return trouve as HTMLElement
  })
  expect(bloc.textContent).toContain("Le coup de main · ce mois-ci")
  expect(bloc.textContent).toContain("$0,0123")
  expect(bloc.textContent).toContain("1 appel coupé avant d'avoir un prix")
  expect(screen.getByLabelText("plafond du mois")).toHaveValue("1,00")
})

test("le plafond se pose, et l'écran garde ce que le serveur rend", async () => {
  vi.spyOn(api, "depenses").mockResolvedValue(depenses(COMPTEUR))
  const regler = vi
    .spyOn(api, "reglerPlafondCoupDeMain")
    .mockResolvedValue({ ...COMPTEUR, plafond_usd: 2.5, reste_usd: 2.4877 })
  monter()
  const champ = await screen.findByLabelText("plafond du mois")

  // Rien à poser tant que rien n'a changé.
  expect(screen.queryByRole("button", { name: "Poser" })).toBeNull()
  fireEvent.change(champ, { target: { value: "2,5" } })
  fireEvent.click(screen.getByRole("button", { name: "Poser" }))

  await waitFor(() => expect(regler).toHaveBeenCalledWith(2.5))
  await waitFor(() => expect(champ).toHaveValue("2,50"))
  expect(screen.queryByRole("button", { name: "Poser" })).toBeNull()
})

test("un montant qui n'en est pas un ne part pas", async () => {
  vi.spyOn(api, "depenses").mockResolvedValue(depenses(COMPTEUR))
  const regler = vi.spyOn(api, "reglerPlafondCoupDeMain")
  monter()
  const champ = await screen.findByLabelText("plafond du mois")
  fireEvent.change(champ, { target: { value: "beaucoup" } })
  expect(champ).toHaveAttribute("aria-invalid", "true")
  expect(screen.queryByRole("button", { name: "Poser" })).toBeNull()
  fireEvent.submit(champ.closest("form")!)
  expect(regler).not.toHaveBeenCalled()
})

test("plafond atteint : l'écran le dit, sans fenêtre", async () => {
  vi.spyOn(api, "depenses").mockResolvedValue(
    depenses({ ...COMPTEUR, atteint: true, pese_usd: 1, reste_usd: 0, inconnus: 0 }),
  )
  monter()
  await screen.findByText(/plafond atteint : le coup de main se tait/)
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("un serveur d'avant CM6 ne montre pas le bloc", async () => {
  vi.spyOn(api, "depenses").mockResolvedValue(depenses(undefined))
  monter()
  await screen.findByText("Par modèle")
  expect(document.querySelector("[data-coup-de-main-du-mois]")).toBeNull()
})
