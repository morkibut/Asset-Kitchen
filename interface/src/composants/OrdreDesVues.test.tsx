// L'ordre des vues de la planche (RS8, 18 septembre 2026).
//
// **Ce que l'écran promet** : une petite liste par vue trouvée sur la planche,
// l'ordre ne part qu'entier, et l'effacer se fait d'un clic. Que le serveur le
// garde, le refuse et le lise à la découpe se vérifie dans `tests/test_rs8.py`.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type Direction, type ReferenceDeLaChose, type ReferencesDeLaChose } from "../api"
import { OrdreDesVues } from "./OrdreDesVues"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const direction = (identifiant: string, nom: string): Direction =>
  ({ identifiant, nom, consigne: "" }) as Direction

const DIRECTIONS = [
  direction("sud", "sud"),
  direction("nord", "nord"),
  direction("est", "est"),
  direction("ouest", "ouest"),
]

const ligne = (ordre?: string[]): ReferenceDeLaChose => ({
  reference: "planche-0",
  genre: "asset",
  provenance: "image promue",
  detail: "",
  ecartee: false,
  montre: null,
  usage: "planche",
  usage_nom: "planche",
  ...(ordre ? { ordre_des_vues: ordre } : {}),
})

function zones(n: number) {
  return vi.spyOn(api, "decoupeProposee").mockResolvedValue({
    asset: "planche-0", label: "", largeur: 64, hauteur: 64, mode: "auto",
    boites: Array.from({ length: n }, (_, i) => [i * 10, 0, i * 10 + 5, 5]),
    raison: null, duree_ms: 1,
  } as unknown as Awaited<ReturnType<typeof api.decoupeProposee>>)
}

function rendu(ordre: string[] | null) {
  return {
    personnage: {} as never,
    references: { personnage: "champy", lignes: [ligne(ordre ?? [])], propositions: [], disponibles: 1 } as ReferencesDeLaChose,
  }
}

test("une liste par vue trouvée sur la planche, et l'ordre ne part qu'entier", async () => {
  zones(4)
  const poser = vi.spyOn(api, "poserOrdreDesVues").mockResolvedValue(rendu(["sud", "est", "nord", "ouest"]))
  render(<OrdreDesVues personnage="champy" planche={ligne()} directions={DIRECTIONS} />)

  expect(screen.getByText(/Ordre des vues, de gauche à droite puis de haut en bas/)).toBeTruthy()
  await waitFor(() => expect(screen.getAllByRole("combobox")).toHaveLength(4))
  expect(screen.getByText(/arrivent sans direction/)).toBeTruthy()

  const enregistrer = screen.getByRole("button", { name: "Enregistrer l'ordre" }) as HTMLButtonElement
  expect(enregistrer.disabled).toBe(true)
  const ordre = ["sud", "est", "nord", "ouest"]
  ordre.forEach((d, i) =>
    fireEvent.change(screen.getByLabelText(`Vue ${i + 1}`), { target: { value: d } }),
  )
  expect(enregistrer.disabled).toBe(false)
  fireEvent.click(enregistrer)

  await waitFor(() => expect(poser).toHaveBeenCalledWith("champy", "planche-0", ordre))
  await waitFor(() => expect(screen.getByRole("button", { name: "Effacer" })).toBeTruthy())
})

test("un ordre enregistré se relit, et s'efface", async () => {
  zones(4)
  const poser = vi.spyOn(api, "poserOrdreDesVues").mockResolvedValue(rendu(null))
  render(
    <OrdreDesVues
      personnage="champy"
      planche={ligne(["sud", "est", "nord", "ouest"])}
      directions={DIRECTIONS}
    />,
  )
  expect((screen.getByLabelText("Vue 2") as HTMLSelectElement).value).toBe("est")

  fireEvent.click(screen.getByRole("button", { name: "Effacer" }))
  await waitFor(() => expect(poser).toHaveBeenCalledWith("champy", "planche-0", null))
  await waitFor(() => expect(screen.queryByRole("button", { name: "Effacer" })).toBeNull())
})

test("un compte qui ne tombe pas juste se dit, et le refus du serveur s'affiche", async () => {
  zones(4)
  vi.spyOn(api, "poserOrdreDesVues").mockRejectedValue(new Error("la direction « sud » est nommée deux fois"))
  render(<OrdreDesVues personnage="champy" planche={ligne(["sud", "sud"])} directions={DIRECTIONS} />)

  await waitFor(() => expect(screen.getByText(/La planche montre/)).toBeTruthy())
  fireEvent.click(screen.getByRole("button", { name: "+ une vue" }))
  fireEvent.change(screen.getByLabelText("Vue 3"), { target: { value: "est" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer l'ordre" }))
  await waitFor(() => expect(screen.getByText(/nommée deux fois/)).toBeTruthy())
})
