import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
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
  render(<FicheDuSujet personnage={pelerin} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={onPersonnage} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  const type = screen.getByLabelText("Type d'objet")
  await screen.findByRole("option", { name: "coffre — 2 poses" })
  fireEvent.change(type, { target: { value: "coffre" } })
  await waitFor(() => expect(regler).toHaveBeenCalledWith("pelerin", { type: "coffre" }))
  fireEvent.change(await screen.findByLabelText("Son ambiance"), { target: { value: "brume" } })
  await waitFor(() => expect(regler).toHaveBeenCalledWith("pelerin", { ambiance: "brume" }))
  expect(onPersonnage).toHaveBeenCalled()
})

// **Retirer le sujet vit dans « Modifier la fiche »** (16 septembre 2026 ;
// RV10 a retiré l'ancien écran « Ses cases » où ce geste vivait avant, sous
// le nom « Supprimer »). Ses images restent, marquées « personnage supprimé ».
test("la fiche retire le sujet du jeu, après confirmation", async () => {
  const pelerin = { identifiant: "pelerin", nom: "Le pèlerin", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  const confirmer = vi.spyOn(window, "confirm").mockReturnValue(true)
  const supprimer = vi.spyOn(api, "supprimerPersonnage").mockResolvedValue({ personnage: pelerin } as never)
  const onPersonnage = vi.fn()
  render(<FicheDuSujet personnage={pelerin} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={onPersonnage} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  fireEvent.click(screen.getByText("Rangement et retrait du jeu"))
  fireEvent.click(screen.getByRole("button", { name: "Le retirer du jeu" }))
  expect(confirmer).toHaveBeenCalled()
  await waitFor(() => expect(supprimer).toHaveBeenCalledWith("pelerin"))
  expect(onPersonnage).toHaveBeenCalledWith(expect.objectContaining({ supprime: true }))
})

test("un refus de confirmation ne retire rien", async () => {
  const pelerin = { identifiant: "pelerin", nom: "Le pèlerin", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  vi.spyOn(window, "confirm").mockReturnValue(false)
  const supprimer = vi.spyOn(api, "supprimerPersonnage")
  render(<FicheDuSujet personnage={pelerin} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  fireEvent.click(screen.getByText("Rangement et retrait du jeu"))
  fireEvent.click(screen.getByRole("button", { name: "Le retirer du jeu" }))
  expect(supprimer).not.toHaveBeenCalled()
})

// **RV10** — la fiche lit `objectif.avancement`, le même compte que la carte
// du Codex (`Famille.test.tsx`, « Le passeur », 5/12 images · 2/6
// animations) et l'objectif (`ObjectifDuSujet.test.tsx`) : mêmes chiffres,
// jamais un second calcul.
test("la fiche affiche le même compte d'avancement que le Codex et l'objectif", async () => {
  const passeur = { identifiant: "passeur", nom: "Le passeur", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockResolvedValue({
    personnage: "passeur", origine: "explicite",
    objectif: { sorties: [], largeur: 96, hauteur: 128, cadence: 8, boucle: false, repere: { x: 0, y: 0 } },
    couverture: { images: { demande: 12, produit: 5, retenu: 5, manquant: 7, a_retenir: 0 }, animations: { demande: 6, produit: 2, retenu: 2, manquant: 4, a_retenir: 0 }, cases: [] },
    avancement: {
      images: { pretes: 5, demandees: 12, a_fabriquer: 7, a_departager: 0 },
      animations: { pretes: 2, demandees: 6, a_fabriquer: 4, a_departager: 0 },
      complet: false, hors_plan: 0,
    },
  } as never)
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  render(<FicheDuSujet personnage={passeur} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} />)
  expect(await screen.findByText(/Prêtes pour le jeu/)).toHaveTextContent(
    "Prêtes pour le jeu : 2 animations sur 6 · 5 images fixes sur 12",
  )
})

// ── Son style de combat (SC4, 18 septembre 2026) ────────────────────────────

// ── Une matière n'est plus un sujet (rangement, D4) ─────────────────────────

const NATURES_AVEC_MATIERE = [
  { nom: "coffre", poses: ["ferme", "ouvert"], capacites: { directions: false, anime: true, sons: true, matiere: false } },
  { nom: "matière", poses: [], capacites: { directions: false, anime: false, sons: false, matiere: true } },
]

async function ouvrirLaFicheDeType(type: string) {
  const chose = { identifiant: "pavage", nom: "Pavage", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type, ambiance: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: NATURES_AVEC_MATIERE } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  render(<FicheDuSujet personnage={chose} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  await screen.findByRole("option", { name: "coffre — 2 poses" })
}

test("le choix du type ne propose plus « matière » pour un sujet", async () => {
  await ouvrirLaFicheDeType("")
  expect(screen.queryByRole("option", { name: /^matière/ })).toBeNull()
})

test("un ancien sujet de nature « matière » la garde affichée", async () => {
  await ouvrirLaFicheDeType("matière")
  expect(screen.getByRole("option", { name: /^matière/ })).toBeInTheDocument()
  expect((screen.getByLabelText("Type d'objet") as HTMLSelectElement).value).toBe("matière")
})

test("la fiche coche plusieurs styles de combat, et dit celui qu'une pièce apporte", async () => {
  const champy = { identifiant: "champy", nom: "Champy", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "personnages" } as unknown as Personnage
  const FUSIL = { ...BATON, identifiant: "fusil", nom: "fusil" }
  const DAGUES = { ...BATON, identifiant: "dagues", nom: "deux dagues" }
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  vi.spyOn(api, "styles").mockResolvedValue({ styles: [BATON, FUSIL, DAGUES], masques: [] })
  // Le fusil est choisi ; le bâton vient de la pièce qu'il porte en calque
  // (SC2) — la fiche le dit avec le nom de la pièce.
  vi.spyOn(api, "styleDuPersonnage").mockResolvedValue({
    personnage: "champy",
    styles: [
      { style: FUSIL, origine: "choisi", piece: null },
      { style: BATON, origine: "piece", piece: { identifiant: "baton-1", nom: "Bâton de chêne" } },
    ],
  } as StyleDuPersonnage)
  const choisir = vi.spyOn(api, "choisirStylesDuPersonnage").mockResolvedValue({
    personnage: "champy",
    styles: [
      { style: FUSIL, origine: "choisi", piece: null },
      { style: DAGUES, origine: "choisi", piece: null },
      { style: BATON, origine: "piece", piece: { identifiant: "baton-1", nom: "Bâton de chêne" } },
    ],
  } as StyleDuPersonnage)

  render(<FicheDuSujet personnage={champy} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))

  expect(await screen.findByText("(celui du Bâton de chêne)")).toBeTruthy()
  expect(screen.getByRole("checkbox", { name: "fusil" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: /bâton/ })).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: "deux dagues" }))
  await waitFor(() => expect(choisir).toHaveBeenCalledWith("champy", ["fusil", "dagues"], "marais"))
  await waitFor(() => expect(screen.getByRole("checkbox", { name: "deux dagues" })).toBeChecked())
})

test("un décor n'a rien à choisir : aucun style de combat sur sa fiche", async () => {
  const tonneau = { identifiant: "tonneau", nom: "Tonneau", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "decors" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  const styles = vi.spyOn(api, "styles")

  render(<FicheDuSujet personnage={tonneau} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={vi.fn()} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  await screen.findByLabelText("Description du sujet")

  expect(screen.queryByLabelText("Son style de combat")).not.toBeInTheDocument()
  expect(styles).not.toHaveBeenCalled()
})

// ── La recette de ses images (RS6, 18 septembre 2026) ───────────────────────

test("la recette de ses images se choisit parmi les recettes nommées, et se retire", async () => {
  const champy = { identifiant: "champy", nom: "Champy", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "decors", recette: "" } as unknown as Personnage
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [] } as never)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: { "champy 01": {}, "arbres": {} } } as never)
  const poser = vi.spyOn(api, "poserRecetteDuSujet").mockImplementation(async (_id, recette) => ({ personnage: { ...champy, recette: recette ?? "" } }) as never)
  const onPersonnage = vi.fn()

  const { rerender } = render(<FicheDuSujet personnage={champy} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={onPersonnage} onErreur={vi.fn()} onImages={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))

  const select = screen.getByRole("combobox", { name: "Recette de ses images" })
  expect(screen.getByText(/Recette de ses images :/)).toBeTruthy()
  expect((select as HTMLSelectElement).value).toBe("")
  expect(screen.getByRole("option", { name: "aucune (celle du jeu)" })).toBeTruthy()
  await screen.findByRole("option", { name: "champy 01" })

  fireEvent.change(select, { target: { value: "champy 01" } })
  await waitFor(() => expect(poser).toHaveBeenCalledWith("champy", "champy 01", "marais"))
  expect(onPersonnage).toHaveBeenCalledWith(expect.objectContaining({ recette: "champy 01" }))

  // Le parent rend le sujet tel que le serveur l'a écrit : le choix se lit.
  rerender(<FicheDuSujet personnage={{ ...champy, recette: "champy 01" }} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={onPersonnage} onErreur={vi.fn()} onImages={vi.fn()} />)
  expect((screen.getByRole("combobox", { name: "Recette de ses images" }) as HTMLSelectElement).value).toBe("champy 01")

  // « aucune » retire le choix : `null`, pas une chaîne vide.
  fireEvent.change(screen.getByRole("combobox", { name: "Recette de ses images" }), { target: { value: "" } })
  await waitFor(() => expect(poser).toHaveBeenLastCalledWith("champy", null, "marais"))
})

// ── La palette de ses images (TS12, 23 septembre 2026) ───────────────────────

const BRAISES = { identifiant: "braises", nom: "Braises", rendue: ["#aa2211", "#ffcc88", "#221111"] }
const VIDE = { identifiant: "vide", nom: "Vide", rendue: [] }

function monterLaFicheQuiSeRelit(depart: Personnage) {
  // **Le parent garde le sujet que le serveur rend**, comme `PageDuSujet` :
  // c'est ce qui fait qu'une fiche refermée puis rouverte relit la valeur
  // gardée, et non l'état local du dialogue (`AGENTS.md`, 8septies).
  function Parent() {
    const [personnage, setPersonnage] = useState(depart)
    return <FicheDuSujet personnage={personnage} plan={[]} collections={[]} groupes={[]} onRange={vi.fn()} onPersonnage={(p) => setPersonnage(p)} onErreur={vi.fn()} onImages={vi.fn()} />
  }
  return render(<Parent />)
}

function doublerLaFiche() {
  vi.spyOn(api, "objectifPersonnage").mockRejectedValue(new Error("hors sujet"))
  vi.spyOn(api, "habillage").mockResolvedValue(null as never)
  vi.spyOn(api, "referencesDeLaChose").mockResolvedValue(null as never)
  vi.spyOn(api, "posesDesTypes").mockResolvedValue({ types: [] } as never)
  vi.spyOn(api, "coteAmbiances").mockResolvedValue({ ambiances: [], palettes: [BRAISES, VIDE] } as never)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
}

test("la palette par défaut se choisit, se garde, et se relit en rouvrant la fiche", async () => {
  const mara = { identifiant: "mara", nom: "Mara", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "decors", palette: "" } as unknown as Personnage
  doublerLaFiche()
  const poser = vi.spyOn(api, "poserPaletteDuSujet").mockImplementation(async (_id, palette) => ({ personnage: { ...mara, palette: palette ?? "", palette_supprimee: "" } }) as never)
  monterLaFicheQuiSeRelit(mara)

  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  const select = screen.getByRole("combobox", { name: "Palette par défaut" }) as HTMLSelectElement
  expect(select.value).toBe("")
  await screen.findByRole("option", { name: "Braises — 3 couleurs" })
  // Une palette sans couleur est proposée grisée, jamais retirée.
  expect((screen.getByRole("option", { name: "Vide — aucune couleur" }) as HTMLOptionElement).disabled).toBe(true)

  fireEvent.change(select, { target: { value: "braises" } })
  await waitFor(() => expect(poser).toHaveBeenCalledWith("mara", "braises", "marais"))

  // **Refermée, puis rouverte** : la valeur qui n'est pas celle du défaut se relit.
  fireEvent.click(screen.getAllByRole("button", { name: "Fermer" })[0])
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Palette par défaut" })).toBeNull())
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  await screen.findByRole("option", { name: "Braises — 3 couleurs" })
  expect((screen.getByRole("combobox", { name: "Palette par défaut" }) as HTMLSelectElement).value).toBe("braises")
  // Et ses pastilles se montrent sous le choix.
  expect(document.querySelectorAll("[data-pastille-du-sujet]")).toHaveLength(3)

  // « aucune » retire le choix : `null`, pas une chaîne vide.
  fireEvent.change(screen.getByRole("combobox", { name: "Palette par défaut" }), { target: { value: "" } })
  await waitFor(() => expect(poser).toHaveBeenLastCalledWith("mara", null, "marais"))
})

test("une palette supprimée se dit sur la fiche, et le sujet est retombé sur aucune", async () => {
  const mara = { identifiant: "mara", nom: "Mara", projet: "marais", description: "", cases: [], plan: [], ecartees: [], type: "", ambiance: "", famille: "decors", palette: "", palette_supprimee: "Cendres" } as unknown as Personnage
  doublerLaFiche()
  monterLaFicheQuiSeRelit(mara)
  fireEvent.click(screen.getByRole("button", { name: "Modifier la fiche" }))
  expect((screen.getByRole("combobox", { name: "Palette par défaut" }) as HTMLSelectElement).value).toBe("")
  expect(document.querySelector("[data-palette-supprimee]")?.textContent).toContain("La palette « Cendres » a été supprimée")
})
