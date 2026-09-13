// AU19 · La seconde sortie de l'atelier de découpe : en faire une animation.
//
// Ce qui est vérifié ici est **le geste**, pas le découpage : les mêmes
// rectangles partent, et ce qui revient mène à l'atelier de l'animation.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, type Asset, type Bande } from "../api"
import { EcranDecoupe } from "./Decoupe"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

const feuille = () => ({ identifiant: "feuille", label: "Marche", empreinte: "e", largeur: 96, hauteur: 48, recette: RECETTE_VIDE } as Asset)
const BOITES = [[0, 0, 23, 23], [24, 0, 47, 23], [0, 24, 23, 47], [24, 24, 47, 47]]

function poser(onAnimer?: (bandes: Bande[]) => void) {
  vi.spyOn(api, "decoupeProposee").mockResolvedValue({ boites: BOITES } as never)
  vi.spyOn(api, "directions").mockResolvedValue({ directions: [
    { identifiant: "sud", nom: "Sud" }, { identifiant: "nord", nom: "Nord" },
  ] } as never)
  const animer = vi.spyOn(api, "animerUneFeuille").mockResolvedValue({
    clip: { identifiant: "clip" }, bandes: [{ identifiant: "bande" }],
  } as never)
  render(<EcranDecoupe
    sujet={{ famille: "planche", planche: feuille(), onDecoupe: vi.fn(), onAnimer }}
    onFermer={vi.fn()} onFente={vi.fn()} />)
  return animer
}

test("les rectangles dessinés partent en animation, et mènent à son atelier", async () => {
  const ouvrir = vi.fn()
  const animer = poser(ouvrir)
  fireEvent.click(await screen.findByRole("button", { name: "En faire une animation de 4 images" }))
  await waitFor(() => expect(animer).toHaveBeenCalledOnce())
  // **Les rectangles de l'écran, dans leur ordre** : c'est celui que l'auteur a
  // sous les yeux, numéroté au pied de chaque rectangle.
  expect(animer.mock.calls[0][1]).toEqual(BOITES)
  expect(animer.mock.calls[0][2]).toMatchObject({ nom: "Marche", directions: null })
  expect(ouvrir).toHaveBeenCalledWith([{ identifiant: "bande" }])
})

test("sans seconde sortie, l'écran ne propose que de découper en images", async () => {
  poser(undefined)
  await screen.findByRole("button", { name: "Relire 4 sorties" })
  expect(screen.queryByRole("button", { name: /En faire une animation/ })).toBeNull()
})

test("une ligne par direction n'est proposée que quand la grille en a autant que le jeu", async () => {
  const animer = poser(vi.fn())
  // En détection automatique, rien ne dit que les rectangles sont des lignes.
  await screen.findByRole("button", { name: /En faire une animation/ })
  expect(screen.queryByRole("button", { name: /une animation par ligne/ })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: "grille fixe" }))
  const parLigne = await screen.findByRole("button", { name: /une animation par ligne/ })
  // Les noms du jeu, montrés dans l'ordre où ils seront lus.
  expect(parLigne).toHaveTextContent("Sud, Nord")
  fireEvent.click(parLigne)
  fireEvent.click(screen.getByRole("button", { name: "En faire 2 animations" }))
  await waitFor(() => expect(animer).toHaveBeenCalledOnce())
  expect(animer.mock.calls[0][2]).toMatchObject({ directions: ["sud", "nord"] })
})
