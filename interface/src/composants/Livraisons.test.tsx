// L'écran unique « Livrer au jeu » (`RV8`) : un bandeau (le dossier Godot du
// jeu, une fois), une portée et une nature à gauche, l'arbre de ce qui change
// au centre — les décisions `RP10` pour le paquet Godot, l'arbre B21 pour les
// fichiers. Plus d'onglet : les essais qui vérifiaient *Livrer dans Godot* et
// *Exporter des fichiers* comme deux écrans sont réunis ici.
import { afterEach, beforeEach, expect, test, vi, describe } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type ApercuLivraison, type Personnage, type ReglagesDeLaSortie } from "../api"
import { Livraisons } from "./Livraisons"

vi.mock("./Apercu", () => ({ BandeQuiTourne: () => <span>Aperçu animé</span> }))

const REGLAGES: ReglagesDeLaSortie = {
  dossier: "C:/jeu/assets/asset-kitchen/fichiers",
  racine: "C:/jeu",
  sous_dossier: "assets/asset-kitchen/fichiers",
  origine: "jeu",
  mention: "",
  rattacher: null,
  refus: "",
  lots: ["tout", "personnages", "objets", "decors", "interface", "animations"],
  rangements: ["a_plat", "en_dossiers"],
  collisions: ["remplacer", "numeroter", "arreter", "effacer"],
  moteurs: ["aucun", "godot", "unity", "phaser"],
  sujets: [
    { identifiant: "pelerin", nom: "Pèlerin" },
    { identifiant: "passeur", nom: "Passeur" },
  ],
  precedente: null,
}

const apercu: ApercuLivraison = {
  jeton: "choix-relu", projet: "jeu", personnage: "pelerin", revision: "revision-1",
  dossier: "C:/jeu", fichiers: [{ chemin: "pelerin.tscn", role: "scène", etat: "nouveau", empreinte: "abc", octets: 200 }],
  conflits: [], pret: true, scene: "res://pelerin.tscn", sprite_frames: "res://animations.tres", animations: [],
}

beforeEach(() => {
  vi.spyOn(api, "reglagesDeLaSortie").mockResolvedValue(REGLAGES)
  vi.spyOn(api, "production").mockResolvedValue({ personnages: [{
    identifiant: "pelerin", nom: "Pèlerin", famille: "personnages", cases: [{ bandes: [
      { identifiant: "marche-v1", nom: "Marche lente", pose: "marche", direction: "sud", compte: 8, cadence: 11, supprime: false },
      { identifiant: "marche-v2", nom: "Marche rapide", pose: "marche", direction: "sud", compte: 6, cadence: 15, supprime: false },
    ] }],
  }, {
    identifiant: "passeur", nom: "Passeur", famille: "personnages", cases: [],
  }] as unknown as Personnage[] } as Awaited<ReturnType<typeof api.production>>)
  vi.spyOn(api, "livraisonsGodot").mockResolvedValue({ livraisons: [] })
  vi.spyOn(api, "prevoirLivraison").mockResolvedValue(apercu)
  vi.spyOn(api, "livrerGodot").mockResolvedValue({ ...apercu, etat: "terminee" })
  vi.spyOn(api, "associerGodot").mockResolvedValue({ dossier: "C:/jeu", sous_dossier: "assets/asset-kitchen" })
  vi.spyOn(api, "reglerSousDossier").mockResolvedValue({ ...REGLAGES })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

// ── Un seul écran, sans onglet ──────────────────────────────────────────────

describe("un seul écran", () => {
  test("aucun onglet « Livrer dans Godot » ni « Exporter des fichiers »", async () => {
    render(<Livraisons projet="jeu" onFerme={() => {}} />)
    await screen.findByRole("heading", { name: "Livrer au jeu" })
    expect(screen.queryByRole("button", { name: "Livrer dans Godot" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Exporter des fichiers" })).toBeNull()
  })
})

// ── Le bandeau du haut ───────────────────────────────────────────────────────

describe("le bandeau du dossier Godot", () => {
  test("un jeu déjà rattaché montre son dossier une fois, avec « Changer »", async () => {
    render(<Livraisons projet="jeu" onFerme={() => {}} />)
    expect(await screen.findByText("C:/jeu")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Changer" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Rattacher" })).toBeNull()
  })

  test("sans jeu, « Rattacher » associe le dossier Godot et le sous-dossier des fichiers", async () => {
    vi.mocked(api.reglagesDeLaSortie).mockResolvedValue({
      ...REGLAGES, origine: "aucun", racine: "", dossier: "", rattacher: null,
      refus: "aucun dossier de jeu — rattache ton jeu Godot",
    })
    render(<Livraisons projet="jeu" onFerme={() => {}} />)
    expect(await screen.findByText("aucun dossier de jeu — rattache ton jeu Godot")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }))
    fireEvent.change(screen.getByPlaceholderText("C:\\Jeux\\Mon jeu"), { target: { value: "C:\\Jeux\\Mon jeu" } })
    fireEvent.click(screen.getByRole("button", { name: "Associer ce dossier" }))

    await waitFor(() => expect(api.associerGodot).toHaveBeenCalledWith("jeu", { dossier: "C:\\Jeux\\Mon jeu", sous_dossier: "assets/asset-kitchen" }))
    expect(api.reglerSousDossier).toHaveBeenCalledWith("assets/asset-kitchen/fichiers", "jeu")
  })

  test("un ancien dossier rattachable propose « Rattacher » en un clic", async () => {
    vi.mocked(api.reglagesDeLaSortie).mockResolvedValue({
      ...REGLAGES, origine: "ancien", racine: "D:/ancien", dossier: "D:/ancien",
      mention: "ancien dossier, pas rattaché au jeu Godot",
      rattacher: { dossier: "D:/ancien-jeu", sous_dossier: "assets" },
    })
    render(<Livraisons projet="jeu" onFerme={() => {}} />)
    expect(await screen.findByText(/ancien dossier, pas rattaché au jeu Godot/)).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Rattacher" }))
    // **Un clic, pas un formulaire** : le serveur a déjà proposé le dossier.
    expect(screen.queryByPlaceholderText("C:\\Jeux\\Mon jeu")).toBeNull()
    await waitFor(() => expect(api.associerGodot).toHaveBeenCalledWith("jeu", { dossier: "D:/ancien-jeu", sous_dossier: "assets/asset-kitchen" }))
    // Le sous-dossier des fichiers reprend celui que le serveur a proposé —
    // celui où l'ancienne sortie écrivait déjà, pas le défaut d'un jeu neuf.
    expect(api.reglerSousDossier).toHaveBeenCalledWith("assets", "jeu")
  })
})

// ── Le paquet Godot d'un sujet, et les décisions RP10 ───────────────────────

describe("le paquet Godot d'un sujet", () => {
  async function ouvrirLeSujet() {
    render(<Livraisons projet="jeu" filtre={{ genre: "sujet", sujet: "pelerin" }} onFerme={() => {}} />)
    await screen.findByRole("checkbox", { name: /Marche lente/ })
  }

  test("publie seulement l'instantané relu et invalide l'aperçu après changement de sélection", async () => {
    await ouvrirLeSujet()
    fireEvent.click(screen.getByRole("checkbox", { name: /Marche lente/ }))
    fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
    await screen.findByRole("button", { name: "Livrer ces versions dans Godot" })
    expect(api.livrerGodot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("checkbox", { name: /Marche rapide/ }))
    expect(screen.queryByRole("button", { name: "Livrer ces versions dans Godot" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Relire 2 animations à livrer" }))
    fireEvent.click(await screen.findByRole("button", { name: "Livrer ces versions dans Godot" }))
    await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "choix-relu"))
    expect(await screen.findByRole("status")).toHaveTextContent("res://pelerin.tscn")
  })

  test("un conflit non décidé dit ce qui reste à décider et interdit la publication", async () => {
    vi.mocked(api.prevoirLivraison).mockResolvedValue({
      ...apercu, pret: false,
      conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu.", decision: null }],
    })
    await ouvrirLeSujet()
    fireEvent.click(screen.getByRole("checkbox", { name: /Marche lente/ }))
    fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent("1 fichier à décider avant de livrer.")
    expect(screen.getByText("Fichier modifié dans le jeu.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Livrer ces versions dans Godot" })).toBeDisabled()
    expect(api.livrerGodot).not.toHaveBeenCalled()
  })

  test("décider ouvre la livraison, et le geste ne devine pas la décision", async () => {
    vi.mocked(api.prevoirLivraison).mockResolvedValue({
      ...apercu, pret: false,
      conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu.", decision: null }],
    })
    vi.spyOn(api, "deciderConflit").mockResolvedValue({
      ...apercu, pret: true,
      conflits: [{ chemin: "pelerin.tscn", raison: "Fichier modifié dans le jeu.", decision: "copier", voisin: "pelerin.copie-atelier.tscn" }],
    })
    await ouvrirLeSujet()
    fireEvent.click(screen.getByRole("checkbox", { name: /Marche lente/ }))
    fireEvent.click(screen.getByRole("button", { name: "Relire 1 animation à livrer" }))
    await screen.findByRole("alert")

    fireEvent.click(screen.getByRole("button", { name: "Copier à côté" }))
    await waitFor(() => expect(api.deciderConflit).toHaveBeenCalledWith("jeu", "choix-relu", "pelerin.tscn", "copier"))
    expect(await screen.findByText(/pelerin\.copie-atelier\.tscn/)).toBeTruthy()
    const livrer = screen.getByRole("button", { name: "Livrer ces versions dans Godot" })
    expect(livrer).not.toBeDisabled()
    fireEvent.click(livrer)
    await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "choix-relu"))
  })

  test("les versions se cochent une par une, et toutes d'un coup", async () => {
    await ouvrirLeSujet()
    fireEvent.click(screen.getByRole("button", { name: "Tout sélectionner" }))
    expect(screen.getByRole("checkbox", { name: /Marche lente/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Marche rapide/ })).toBeChecked()
    expect(screen.getByText("2 sur 2")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tout décocher" }))
    expect(screen.getByRole("checkbox", { name: /Marche lente/ })).not.toBeChecked()
  })

  test("un brouillon est mis de côté et l'écran demande sa case", async () => {
    vi.mocked(api.production).mockResolvedValue({ personnages: [{
      identifiant: "pelerin", nom: "Pèlerin", famille: "personnages", cases: [{ bandes: [
        { identifiant: "marche-v1", nom: "Marche lente", pose: "marche", direction: "sud", compte: 8, cadence: 11, supprime: false },
        { identifiant: "essai-1", nom: "Découpe pour voir", pose: "", direction: "", compte: 5, cadence: 12, supprime: false, brouillon: true },
      ] }],
    }] as unknown as Personnage[] } as Awaited<ReturnType<typeof api.production>>)
    render(<Livraisons projet="jeu" filtre={{ genre: "sujet", sujet: "pelerin" }} onFerme={() => {}} />)
    expect(await screen.findByRole("checkbox", { name: /Marche lente/ })).toBeTruthy()
    expect(screen.queryByRole("checkbox", { name: /Découpe pour voir/ })).toBeNull()
    expect(screen.getByRole("status", { name: "" })).toBeTruthy()
    expect(screen.getByText(/1 brouillon mis de côté : Découpe pour voir\./)).toBeTruthy()
  })
})

// ── Livrer un sujet depuis sa fiche ouvre l'écran filtré ────────────────────

describe("l'entrée filtrée sur un sujet", () => {
  test("le sujet du filtre est déjà choisi, sans qu'on ait à le sélectionner", async () => {
    render(<Livraisons projet="jeu" filtre={{ genre: "sujet", sujet: "passeur" }} onFerme={() => {}} />)
    const lequel = (await screen.findByRole("combobox", { name: "Lequel" })) as HTMLSelectElement
    expect(lequel.value).toBe("passeur")
  })
})

// ── Tout le jeu, en paquets Godot ───────────────────────────────────────────

describe("tout le jeu, en paquets Godot", () => {
  test("un paquet par sujet, et chacun a son propre bouton de livraison", async () => {
    vi.spyOn(api, "prevoirLivraisonsDuJeu").mockResolvedValue({
      paquets: [
        { ...apercu, jeton: "jeton-pelerin", personnage: "pelerin", nom: "Pèlerin" },
        { ...apercu, jeton: "jeton-passeur", personnage: "passeur", nom: "Passeur" },
      ],
      ecartes: [{ personnage: "le-fantome", nom: "Le fantôme", raison: "Aucune animation livrable." }],
    })
    render(<Livraisons projet="jeu" onFerme={() => {}} />)
    fireEvent.click(await screen.findByRole("radio", { name: "Tout le jeu" }))
    await screen.findByText("Pèlerin")
    expect(screen.getByText("Passeur")).toBeTruthy()
    expect(screen.getByText(/Le fantôme.*Aucune animation livrable\./)).toBeTruthy()
    expect(api.prevoirLivraisonsDuJeu).toHaveBeenCalledWith("jeu", undefined)

    fireEvent.click(screen.getAllByRole("button", { name: "Livrer ces versions dans Godot" })[0])
    await waitFor(() => expect(api.livrerGodot).toHaveBeenCalledWith("jeu", "jeton-pelerin"))
  })
})

// ── Rien ne déborde à 1280 px : `essais/atelier_jetable_rv8.py` ─────────────
