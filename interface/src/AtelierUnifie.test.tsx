import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api, type Appel, type Generation, type GrilleDeFamille, type SujetDeLaGrille, type Personnage } from "./api"
import { EcranFamille } from "./composants/Famille"
import { Fabrications } from "./composants/Fabrications"
import { entrer, poser, racine, sortir } from "./lieux"
import { SourcesDuSujet } from "./composants/SourcesDuSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const vide = (): GrilleDeFamille => ({ personnages: [], groupes: [], filtres: { tous: 0, incomplets: 0, "sans-description": 0 }, total: 0 })
const sujet = (id: string, nom: string): SujetDeLaGrille => ({ identifiant: id, projet: "jeu", nom, description: "Un héros", type: "personnage", cree_le: 1, collections: [{ identifiant: "heros", nom: "Héros" }], vignette: { identifiant: `image-${id}`, empreinte: "v1" }, compte: { images: { pretes: 1, demandees: 1, a_fabriquer: 0, a_departager: 0 }, animations: { pretes: 1, demandees: 4, a_fabriquer: 3, a_departager: 0 }, complet: false, hors_plan: 0, detail: [] } })
// **La porte « Les sujets » et la grille d'une famille sont le même composant**
// depuis `RP7` (16 septembre 2026) : `BibliothequeDesAssets.tsx` a disparu, et
// `EcranFamille` monté sans famille montre les quatre d'un coup.
function monterBibliotheque() {
  const ouvrir = vi.fn()
  const organiser = vi.fn()
  render(
    <EcranFamille famille={null} jeu="jeu" pieces={[]} rafraichi={0}
      surGroupes={vi.fn()} surRange={vi.fn()} surReglages={vi.fn()} surErreur={vi.fn()}
      onOuvrir={ouvrir} onCree={vi.fn()} onPiece={vi.fn()} surFamille={organiser} onGalerie={vi.fn()} />,
  )
  // La liste nomme le type et les collections ; la grille, elle, ne montre que
  // la vignette et les deux comptes.
  fireEvent.click(screen.getByRole("tab", { name: "La liste" }))
  return { ouvrir, organiser }
}

describe("L’atelier unifié · bibliothèque et fabrications réelles", () => {
  it("garde chaque nouvelle racine quand on referme une livraison", () => {
    for (const rac of ["bibliotheque", "fabrications"] as const) {
      const pile = entrer(poser(rac), { genre: "sortie" })
      expect(racine(pile)).toBe(rac)
      expect(sortir(pile, "sortie")).toEqual([{ genre: rac }])
    }
  })

  it("cherche côté serveur, affiche les deux couvertures et ouvre la vraie fiche", async () => {
    const lister = vi.spyOn(api, "familleDeSujets").mockImplementation(async (famille, options) => famille === "personnages" && (!options?.recherche || options.recherche === "pèlerin") ? { ...vide(), personnages: [sujet("pelerin", "Le pèlerin")], total: 1 } : vide())
    const { ouvrir } = monterBibliotheque()
    const ligne = (await screen.findByText("Le pèlerin")).closest("[data-ligne-de-sujet]") as HTMLElement
    expect(ligne).toHaveTextContent("1 / 4")
    expect(ligne).toHaveTextContent("1 im.")
    expect(ligne).toHaveTextContent("Héros")
    fireEvent.click(ligne)
    expect(ouvrir).toHaveBeenCalledWith("pelerin")
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pèlerin" } })
    await waitFor(() => expect(lister).toHaveBeenCalledWith("personnages", expect.objectContaining({ recherche: "pèlerin", limite: 120 })))
    expect(lister).toHaveBeenCalledWith("objets", expect.objectContaining({ recherche: "pèlerin" }))
  })

  it("ne compte pas une page comme toute la famille et charge la suite", async () => {
    const lister = vi.spyOn(api, "familleDeSujets").mockImplementation(async (famille, options) => famille === "personnages" ? { ...vide(), personnages: (options?.limite ?? 0) >= 240 ? [sujet("a", "Alpha"), sujet("b", "Bêta")] : [sujet("a", "Alpha")], total: 2 } : vide())
    monterBibliotheque()
    await waitFor(() => expect(document.body.textContent).toMatch(/1 des 2 affichés/))
    fireEvent.click(screen.getByRole("button", { name: "Afficher davantage de sujets" }))
    expect(await screen.findByText("Bêta")).toBeVisible()
    expect(lister).toHaveBeenCalledWith("personnages", expect.objectContaining({ limite: 240 }))
    expect(screen.queryByRole("button", { name: "Afficher davantage de sujets" })).not.toBeInTheDocument()
  })

  it("une ancienne recherche retardée ne remplace pas la recherche courante", async () => {
    let finir!: (grille: GrilleDeFamille) => void
    vi.spyOn(api, "familleDeSujets").mockImplementation(async (famille, options) => {
      if (famille !== "personnages") return vide()
      if (!options?.recherche) return new Promise<GrilleDeFamille>((resolve) => { finir = resolve })
      return { ...vide(), personnages: [sujet("b", "Bêta")], total: 1 }
    })
    monterBibliotheque()
    await waitFor(() => expect(finir).toBeTypeOf("function"))
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "bêta" } })
    await screen.findByText("Bêta")
    finir({ ...vide(), personnages: [sujet("a", "Alpha")], total: 1 })
    await waitFor(() => expect(screen.queryByText("Alpha")).not.toBeInTheDocument())
  })

  it("retrouve un clip après fermeture et fusionne journal et chantier sans doublon", async () => {
    const appel: Appel = { identifiant: "clip-1", modele: "Local:video", prompt: "Le héros marche", cree_le: 123, cout_usd: 0, statut: "reussie", reussies: 1, rates: [] }
    vi.spyOn(api, "journal").mockResolvedValue({ projet: "jeu", appels: [appel], total_usd: 0, rates: 0, cout_rate_usd: 0 })
    const clip = { ...appel, projet: "jeu", demande: { prompt: appel.prompt }, clip: { fichier: "clip.mp4" } } as unknown as Generation
    const ouvrir = vi.fn()
    const props = { projet: "jeu", chantier: [clip], clips: [clip], personnages: [], onCreer: vi.fn(), onPreparer: vi.fn(), onGalerie: vi.fn(), onClip: ouvrir, onSujet: vi.fn(), onDepenses: vi.fn() }
    const { unmount } = render(<Fabrications {...props} />)
    await waitFor(() => expect(screen.queryByText("Lecture des fabrications…")).not.toBeInTheDocument())
    expect(screen.getAllByRole("article")).toHaveLength(1)
    unmount()
    render(<Fabrications {...props} chantier={[]} />)
    const bouton = await screen.findByRole("button", { name: "Ouvrir le montage du clip" })
    fireEvent.click(bouton)
    expect(ouvrir).toHaveBeenCalledWith("clip-1")
    expect(screen.getAllByRole("article")).toHaveLength(1)
  })

  it("prépare le bon mouvement et la bonne direction puis ouvre le fichier du clip", () => {
    const personnage = { identifiant: "hero", nom: "Le héros", ecartees: [], plan: [{ identifiant: "repos", nom: "Repos" }, { identifiant: "marche", nom: "Marche" }], cases: [{ pose: "repos", directions: [] }, { pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }, { identifiant: "ouest", nom: "Ouest" }] }] } as unknown as Personnage
    const clip = { identifiant: "video-conservee", personnage: "hero", modele: "Local:video", pose: "marche", direction: "ouest", statut: "reussie", demande: { prompt: "Le héros marche en place" }, parametres_resolus: { seed: 42 }, clip: { jete: false, secondes: 3, cadence: 12, images: 36, extraction_refus: null, resolution: "720p", proportions: "1:1" } } as unknown as Generation
    const animer = vi.fn(), montage = vi.fn()
    render(<SourcesDuSujet ongletInitial="clips" personnage={personnage} clips={[clip]} onAnimer={animer} onMontage={montage} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Mouvement" }), { target: { value: "marche" } })
    fireEvent.change(screen.getByRole("combobox", { name: "Direction" }), { target: { value: "ouest" } })
    fireEvent.click(screen.getByRole("button", { name: "Préparer un clip vidéo" }))
    expect(animer).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "marche" }), expect.objectContaining({ identifiant: "ouest" }))
    expect(screen.getByLabelText("Clip de Le héros · video-conservee")).toHaveAttribute("src", "/api/clips/video-conservee/video")
    fireEvent.click(screen.getByRole("button", { name: "Monter une animation" }))
    expect(montage).toHaveBeenCalledWith("video-conservee")
  })
  it("importe une vidéo dans le mouvement choisi, sans rien dépenser", async () => {
    const personnage = { identifiant: "hero", nom: "Le héros", ecartees: [], plan: [{ identifiant: "repos", nom: "Repos" }, { identifiant: "marche", nom: "Marche" }], cases: [{ pose: "repos", directions: [] }, { pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }] } as unknown as Personnage
    const entre = vi.spyOn(api, "importerClip").mockResolvedValue({ clip: { identifiant: "importe-1", clip: { images: 36, cadence: 12 } } as unknown as Generation, doublon: null })
    const relire = vi.fn()
    render(<SourcesDuSujet ongletInitial="clips" personnage={personnage} clips={[]} onAnimer={vi.fn()} onMontage={vi.fn()} onClipsChange={relire} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Mouvement" }), { target: { value: "marche" } })
    const fichier = new File([new Uint8Array([0, 1, 2])], "marche.mp4", { type: "video/mp4" })
    fireEvent.change(screen.getByLabelText("Vidéo à importer"), { target: { files: [fichier] } })
    await waitFor(() => expect(entre).toHaveBeenCalledWith(fichier, expect.objectContaining({ personnage: "hero", pose: "marche", direction: "sud" })))
    expect(await screen.findByText(/36 images tirées à 12 i\/s/)).toBeVisible()
    expect(relire).toHaveBeenCalled()
  })

  it("dit qu'une vidéo importée n'a rien coûté, et ne lui invente pas de paramètres", () => {
    const personnage = { identifiant: "hero", nom: "Le héros", ecartees: [], plan: [{ identifiant: "marche", nom: "Marche" }], cases: [{ pose: "marche", directions: [] }] } as unknown as Personnage
    const clip = { identifiant: "importe-1", personnage: "hero", modele: "video-importee", pose: "marche", statut: "reussie", demande: { prompt: "marche.mp4" }, parametres_resolus: {}, clip: { nature: "importe", jete: false, secondes: 3, cadence: 12, images: 36, extraction_refus: null } } as unknown as Generation
    render(<SourcesDuSujet ongletInitial="clips" personnage={personnage} clips={[clip]} onAnimer={vi.fn()} onMontage={vi.fn()} />)
    expect(screen.getByText("vidéo importée · aucune génération")).toBeVisible()
    expect(screen.queryByText("Demande et paramètres conservés")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Monter une animation" })).toBeEnabled()
  })
})
