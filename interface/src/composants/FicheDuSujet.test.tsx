import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, type Personnage, type StyleDeCombat, type StyleDuPersonnage } from "../api"
import { FicheDuSujet } from "./FicheDuSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const BATON: StyleDeCombat = {
  identifiant: "baton",
  nom: "bâton à deux mains",
  tient: "a long wooden staff held in both hands",
  textes: { attaque: "a two-handed staff strike, staying in place" },
  livre: true,
  masque: false,
}

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

// ── Son style de combat (SC4, 18 septembre 2026) ────────────────────────────

test("la fiche dit d'où vient le style de combat, et un choix l'écrit", async () => {
  const champy = { identifiant: "champy", nom: "Champy", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "personnages" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  vi.spyOn(api, "styles").mockResolvedValue({ styles: [BATON], masques: [] })
  // **Hérité de la pièce qu'il porte en calque** (SC2) — la fiche le dit en
  // clair, avec le nom de la pièce, pas seulement son identifiant.
  vi.spyOn(api, "styleDuPersonnage").mockResolvedValue({
    personnage: "champy",
    style: BATON,
    origine: "piece",
    piece: { identifiant: "baton-1", nom: "Bâton de chêne" },
  } as StyleDuPersonnage)
  const choisir = vi.spyOn(api, "choisirStyleDuPersonnage").mockResolvedValue({
    personnage: "champy",
    style: BATON,
    origine: "choisi",
    piece: null,
  } as StyleDuPersonnage)

  render(<FicheDuSujet personnage={champy} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} onObjectif={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))

  expect(await screen.findByText("celui du Bâton de chêne")).toBeTruthy()
  const select = screen.getByRole("combobox", { name: "Son style de combat" })
  fireEvent.change(select, { target: { value: "baton" } })
  await waitFor(() => expect(choisir).toHaveBeenCalledWith("champy", "baton", "marais"))
  expect(await screen.findByText("choisi")).toBeTruthy()
})

test("un décor n'a rien à choisir : aucun style de combat sur sa fiche", async () => {
  const tonneau = { identifiant: "tonneau", nom: "Tonneau", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "decors" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  const styles = vi.spyOn(api, "styles")

  render(<FicheDuSujet personnage={tonneau} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} onObjectif={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  await screen.findByLabelText("Description du sujet")

  expect(screen.queryByLabelText("Son style de combat")).not.toBeInTheDocument()
  expect(styles).not.toHaveBeenCalled()
})
