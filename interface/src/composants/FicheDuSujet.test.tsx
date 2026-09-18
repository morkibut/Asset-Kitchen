import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type Personnage } from "../api"
import { FicheDuSujet } from "./FicheDuSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("le type d'objet et l'ambiance se règlent dans la fiche du sujet", async () => {
  const pelerin = { identifiant: "pelerin", nom: "Le pèlerin", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [{ nom: "coffre", poses: ["ferme", "ouvert"] }] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [{ identifiant: "brume", nom: "Brume" }] } as never)
  const regler = vi.spyOn(api, "reglerPersonnage").mockImplementation(async (_id, champs) => ({ personnage: { ...pelerin, ...champs } }) as never)
  const onPersonnage = vi.fn()
  render(<FicheDuSujet personnage={pelerin} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={onPersonnage} onErreur={vi.fn()} onImages={vi.fn()} onObjectif={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  const type = screen.getByLabelText("Type d'objet")
  await screen.findByRole("option", { name: "coffre — 2 poses" })
  fireEvent.change(type, { target: { value: "coffre" } })
  await waitFor(() => expect(regler).toHaveBeenCalledWith("pelerin", { type: "coffre" }))
  fireEvent.change(await screen.findByLabelText("Son ambiance"), { target: { value: "brume" } })
  await waitFor(() => expect(regler).toHaveBeenCalledWith("pelerin", { ambiance: "brume" }))
  expect(onPersonnage).toHaveBeenCalled()
})
