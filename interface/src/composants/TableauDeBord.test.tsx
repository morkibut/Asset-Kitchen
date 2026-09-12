import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"

import { api, type BilanDuJeu } from "../api"
import { TableauDeBord } from "./TableauDeBord"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const bilan: BilanDuJeu = {
  familles: [],
  manques: [{
    quantite: 2,
    nature: "image",
    phrase: "« Le pèlerin » : 2 images fixes à produire — repos vers sud (1), marche vers nord (1).",
    famille: "personnages",
    sujet: "pelerin",
    cout_usd: 0,
    cout_connu: false,
    cibles: [
      { pose: "repos", direction: "sud", quantite: 1 },
      { pose: "marche", direction: "nord", quantite: 1 },
    ],
  }],
  lot: { images: 2, animations: 0, feuilles: 1, cout_usd: 0, cout_connu: false },
}

function monter(surplus: Partial<Parameters<typeof TableauDeBord>[0]> = {}) {
  const rappels = { surLeSujet: vi.fn(), surLaFamille: vi.fn(), surDemanderUneImage: vi.fn(), surAllerDecouper: vi.fn() }
  render(
    <TableauDeBord
      jeu="Le jeu"
      images={0}
      depense={0}
      generations={null}
      familles={[]}
      feuilleEnAttente={null}
      {...rappels}
      {...surplus}
    />,
  )
  return rappels
}

it("garde un coût inconnu distinct de zéro et mène du manque à son sujet", async () => {
  vi.spyOn(api, "bilanDuJeu").mockResolvedValue(bilan)
  const rappels = monter()

  const ligne = await screen.findByRole("button", { name: /Ouvrir « Le pèlerin »/ })
  expect(ligne).toHaveTextContent("à estimer")
  expect(ligne).toHaveTextContent("repos vers sud")
  fireEvent.click(ligne)
  expect(rappels.surLeSujet).toHaveBeenCalledWith("pelerin")
})

it("dit que la lecture échoue et peut la relancer sans inventer un bilan vide", async () => {
  const lire = vi.spyOn(api, "bilanDuJeu")
    .mockRejectedValueOnce(new Error("serveur indisponible"))
    .mockResolvedValueOnce(bilan)
  monter()

  expect(await screen.findByRole("alert")).toHaveTextContent("serveur indisponible")
  expect(screen.queryByText("rien ne manque, à ce qu'on a compté")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Relancer la lecture" }))
  await screen.findByRole("button", { name: /Ouvrir « Le pèlerin »/ })
  expect(lire).toHaveBeenCalledTimes(2)
})
