import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { api, RECETTE_VIDE, UNIVERS_VIDE, type Asset, type AtelierDeBande, type Bande, type EtatTraitement } from "../api"
import { AIDE } from "../aide"
import { EcranAtelierDeBande, remonterLaBande } from "./AtelierDeBande"
import { EcranMontage } from "./Montage"

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const traitement = { moteurs: [], silhouettes: [], reductions: [], recettes: [], quantification: { raison: null, note: "" } } as unknown as EtatTraitement
function fixture(): AtelierDeBande {
  return {
    bande: {
      identifiant: "bande-main", nom: "marche", clip: "clip-source", prises: [0, 1, 2].map((numero) => ({ numero, clip: "", identifiant: `occurrence-${numero}`, dx: 3, dy: 0 })), chutier: [],
      recette: { ...RECETTE_VIDE }, cadence: 2, sens: "boucle", case_largeur: 32, case_hauteur: 32,
      cadre: { choix: "clip" }, melangee: false, secondes: 1.5,
    },
    planche: "data:image/png;base64,AAAA", images_par_clip: { "clip-source": 3 }, clips_voisins: [],
    cadre: { choix: "clip", a_jour: true }, ecarts: [], contact: { cote: 96, colonnes: 16 }, images_max: 64,
  } as unknown as AtelierDeBande
}

test("la Main touche la frame visible pendant la lecture, se défait et se retrouve après fermeture", async () => {
  let disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockImplementation(async () => structuredClone(disque))
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const garder = vi.spyOn(api, "corrigerLaBande").mockImplementation(async (_id, corps) => {
    disque = { ...disque, bande: { ...disque.bande, ...structuredClone(corps) } as Bande }
    return disque.bande
  })
  vi.stubGlobal("PointerEvent", MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  const props = { identifiant: "bande-main", univers: UNIVERS_VIDE, traitement, onFermer: vi.fn(), onErreur: vi.fn() }
  const vue = render(<EcranAtelierDeBande {...props} />)
  fireEvent.change(await screen.findByLabelText("Table de retouche"), { target: { value: "main" } })
  fireEvent.click(screen.getByRole("button", { name: /^ôter$/ }))
  await waitFor(() => expect(document.querySelector("[data-case-en-grand]")?.getAttribute("data-case-en-grand")).toBe("1"))
  const surface = document.querySelector("[data-toile-main]") as HTMLElement
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON() {} })
  fireEvent.pointerDown(surface, { button: 0, clientX: 125, clientY: 65, pointerId: 1 })
  fireEvent.pointerMove(surface, { clientX: 135, clientY: 65, pointerId: 1 })
  fireEvent.pointerUp(surface, { pointerId: 1 })
  expect(screen.getByRole("button", { name: "faire tourner l'animation" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: /^Défaire$/ }))
  expect((screen.getByRole("button", { name: "Enregistrer ›" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: /^Refaire$/ }))
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer ›" }))
  await waitFor(() => expect(garder).toHaveBeenCalledOnce())
  expect(disque.bande.prises[0].main_apres_placement).toBeUndefined()
  expect(disque.bande.prises[2].main_apres_placement).toBeUndefined()
  expect(disque.bande.prises[1].main_apres_placement?.opacite[0]).toMatchObject({ garde: false, points: [[12, 6], [13, 6]] })
  expect(disque.bande.prises[1].identifiant).toBe("occurrence-1")
  vue.unmount()
  render(<EcranAtelierDeBande {...props} />)
  fireEvent.change(await screen.findByLabelText("Table de retouche"), { target: { value: "main" } })
  fireEvent.click(document.querySelector('[data-image-de-la-bande="1"]')!)
  expect(await screen.findByText(/l'opacité · 1 passage/)).toBeTruthy()
  expect(props.onErreur).not.toHaveBeenCalled()
})

test("deux occurrences d’une même source gardent chacune leur retouche après réordre", () => {
  const bande = fixture().bande
  bande.prises = [{ numero: 4, clip: "", dx: 1, dy: 0, identifiant: "premiere" }, { numero: 4, clip: "", dx: 8, dy: 0, identifiant: "seconde" }]
  const remontee = remonterLaBande(bande, bande.clip, [4, 4], ["seconde", "premiere"])
  expect(remontee.prises.map((prise) => [prise.identifiant, prise.dx])).toEqual([["seconde", 8], ["premiere", 1]])
  expect(remontee.chutier).toEqual([])
})

test("un brouillon de frame se reprend après fermeture sans écrire la bande avant confirmation", async () => {
  const disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const garder = vi.spyOn(api, "corrigerLaBande").mockResolvedValue(disque.bande)
  const props = { identifiant: "bande-main", univers: UNIVERS_VIDE, traitement, onFermer: vi.fn(), onErreur: vi.fn() }
  const vue = render(<EcranAtelierDeBande {...props} />)
  await screen.findByLabelText("Table de retouche")
  fireEvent.click(screen.getByRole("button", { name: "arrêter l'animation" }))
  fireEvent.click(document.querySelector('[data-image-de-la-bande="2"]')!)
  ;(document.querySelector("[data-case-en-grand]") as HTMLElement).focus()
  fireEvent.keyDown(window, { key: "ArrowRight" })
  await screen.findByText("Brouillon conservé sur cet ordinateur.")
  expect(garder).not.toHaveBeenCalled()
  vue.unmount()
  render(<EcranAtelierDeBande {...props} />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le brouillon" }, { timeout: 3000 }))
  expect(garder).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer ›" }))
  await waitFor(() => expect(garder).toHaveBeenCalledOnce())
  expect(garder.mock.calls[0][1].prises?.map((p) => p.dx)).toEqual([3, 3, 4])
  expect(garder.mock.calls[0][1].prises?.[2].identifiant).toBe("occurrence-2")
})

test("découper le rendu d’une frame revient au montage sans perdre ses changements", async () => {
  const disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const asset = { identifiant: "frame-prelevee", empreinte: "abc", label: "Frame retouchée", largeur: 32, hauteur: 32, recette: RECETTE_VIDE } as Asset
  const prelever = vi.spyOn(api, "preleverFrameDeBande").mockResolvedValue({ asset, doublon: null })
  vi.spyOn(api, "decoupeProposee").mockResolvedValue({ boites: [[0, 0, 15, 31], [16, 0, 31, 31]] } as never)
  const decouper = vi.spyOn(api, "decouper").mockResolvedValue({ decoupes: [asset, asset] } as never)
  const garder = vi.spyOn(api, "corrigerLaBande").mockResolvedValue(disque.bande)
  render(<EcranAtelierDeBande identifiant="bande-main" univers={UNIVERS_VIDE} traitement={traitement} onFermer={vi.fn()} onErreur={vi.fn()} />)
  await screen.findByLabelText("Table de retouche")
  fireEvent.click(screen.getByRole("button", { name: "arrêter l'animation" }))
  // Un changement préalable doit encore attendre l’enregistrement au retour.
  ;(document.querySelector("[data-case-en-grand]") as HTMLElement).focus()
  fireEvent.keyDown(window, { key: "ArrowRight" })
  fireEvent.click(screen.getByRole("button", { name: "Découper cette frame" }))
  await screen.findByRole("button", { name: /Extraire 2/ })
  expect(prelever.mock.calls[0][2].prises[0].dx).toBe(4)
  expect(screen.getByLabelText("Zoom de la découpe")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: /Extraire 2/ }))
  fireEvent.click(await screen.findByRole("button", { name: "Créer ces résultats" }))
  await screen.findByText("2 images ajoutées à la bibliothèque.")
  expect(decouper).toHaveBeenCalledWith("frame-prelevee", [[0, 0, 15, 31], [16, 0, 31, 31]])
  expect(garder).not.toHaveBeenCalled()
  expect((screen.getByRole("button", { name: "Enregistrer ›" }) as HTMLButtonElement).disabled).toBe(false)
})

test("le montage réordonne par clavier et glissement, puis garde le classement explicite", async () => {
  const bande = { ...fixture().bande, personnage: "heros", projet: "jeu", pose: "marche", direction: null }
  bande.prises = [{ numero: 0, clip: "", dx: 1, dy: 0, identifiant: "premiere" }, { numero: 0, clip: "", dx: 8, dy: 0, identifiant: "seconde" }, { numero: 2, clip: "", dx: 0, dy: 0, identifiant: "troisieme" }]
  vi.spyOn(api, "ouvrirLeMontage").mockResolvedValue({
    clip: { identifiant: bande.clip, images: 3, personnage: "heros", pose: "marche", direction: null, mouvement: "marche", secondes: 1, montant_dit: "0 €" },
    bandes: [], propositions: [], contact: { cote: 96, colonnes: 16, lignes: 1 }, fenetre: null,
    prix: { clip: 0, bandes: 0, par_bande: 0, si_une_de_plus: 0 },
  } as never)
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [] } as never)
  vi.spyOn(api, "production").mockResolvedValue({ personnages: [
    { identifiant: "heros", nom: "Le héros", cases: [{ pose: "marche", directions: [] }], plan: [{ identifiant: "marche", nom: "Marche" }] },
    { identifiant: "nain", nom: "Le nain", cases: [{ pose: "repos", directions: [{ identifiant: "nord", nom: "Nord" }] }], plan: [{ identifiant: "repos", nom: "Repos" }] },
  ] } as never)
  const corriger = vi.spyOn(api, "corrigerLaBande").mockResolvedValue(bande)
  const classer = vi.spyOn(api, "affecterLaBande").mockResolvedValue(bande)
  const repris = vi.fn()
  render(<EcranMontage clip={bande.clip} reprise={{ bande, onRepris: repris }} onFermer={vi.fn()} onErreur={vi.fn()} />)
  await screen.findByLabelText("Personnage de l’animation")
  const boutons = () => document.querySelectorAll('[aria-label="Ordre des frames retenues"] button')
  fireEvent.keyDown(boutons()[1], { key: "ArrowLeft", altKey: true })
  const dataTransfer = { setData: vi.fn(), effectAllowed: "" }
  fireEvent.dragStart(boutons()[2], { dataTransfer })
  fireEvent.dragOver(boutons()[0], { dataTransfer })
  fireEvent.drop(boutons()[0], { dataTransfer })
  fireEvent.change(screen.getByLabelText("Personnage de l’animation"), { target: { value: "nain" } })
  fireEvent.change(screen.getByLabelText("Mouvement de l’animation"), { target: { value: "repos" } })
  fireEvent.change(screen.getByLabelText("Direction de l’animation"), { target: { value: "nord" } })
  fireEvent.click(screen.getByRole("button", { name: /Reprendre « marche »/ }))
  await waitFor(() => expect(repris).toHaveBeenCalledOnce())
  expect(corriger.mock.calls[0][1].prises?.map((prise) => [prise.identifiant, prise.dx])).toEqual([["troisieme", 0], ["seconde", 8], ["premiere", 1]])
  expect(classer).toHaveBeenCalledWith(bande.identifiant, "repos", "nord", "nain")
})

test("le montage retrouve son nom, sa vitesse et son ordre après fermeture sans fabriquer à la reprise", async () => {
  const disque = fixture().bande
  vi.spyOn(api, "ouvrirLeMontage").mockResolvedValue({
    clip: { identifiant: disque.clip, images: 3, personnage: null, pose: null, direction: null, mouvement: "marche", secondes: 1, montant_dit: "0 €" },
    bandes: [], propositions: [{ nom: "régulier", images: [0, 1, 2] }], contact: { cote: 96, colonnes: 16, lignes: 1 }, fenetre: null,
    prix: { clip: 0, bandes: 0, par_bande: 0, si_une_de_plus: 0 },
  } as never)
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [] } as never)
  vi.spyOn(api, "production").mockResolvedValue({ personnages: [] } as never)
  const garder = vi.spyOn(api, "garderLaBande").mockResolvedValue(disque)
  const props = { clip: disque.clip, onFermer: vi.fn(), onErreur: vi.fn() }
  const vue = render(<EcranMontage {...props} />)
  fireEvent.change(await screen.findByLabelText("Le nom de l'animation"), { target: { value: "Attaque lourde" } })
  fireEvent.change(screen.getByLabelText("Cadence, en chiffres"), { target: { value: "13" } })
  fireEvent.blur(screen.getByLabelText("Cadence, en chiffres"))
  const boutons = document.querySelectorAll('[aria-label="Ordre des frames retenues"] button')
  fireEvent.keyDown(boutons[2], { key: "ArrowLeft", altKey: true })
  await screen.findByText("Brouillon conservé sur cet ordinateur.")
  vue.unmount()
  render(<EcranMontage {...props} />)
  const reprendre = await screen.findByRole("button", { name: "Reprendre le brouillon" })
  expect((screen.getByLabelText("Le nom de l'animation") as HTMLInputElement).value).toBe("marche")
  expect(screen.queryByText(/La version enregistrée a changé/)).toBeNull()
  fireEvent.click(reprendre)
  expect(garder).not.toHaveBeenCalled()
  expect((screen.getByLabelText("Cadence, en chiffres") as HTMLInputElement).value).toBe("13 images / s")
  fireEvent.click(screen.getByRole("button", { name: /Garder « Attaque lourde »/ }))
  await waitFor(() => expect(garder).toHaveBeenCalledOnce())
  expect(garder.mock.calls[0][0]).toMatchObject({ nom: "Attaque lourde", cadence: 13, images: [0, 2, 1] })
})

// ── RP22 · une table se défait, se remet à zéro, et se voit avant d'enregistrer ──
//
// Quatre défauts trouvés à l'usage : un sens du retournement qui ne se
// décliquait jamais, aucune bascule ni remise à zéro dans l'atelier d'une
// animation, un aperçu qui ne semblait suivre le retournement qu'après avoir
// enregistré, et une section de la frame sans titre ni aide.

test("RP22 — un sens déjà choisi se déclique, et l'aperçu porte le retournement avant tout Enregistrer", async () => {
  const disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  const apercu = vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const garder = vi.spyOn(api, "corrigerLaBande")
  const props = { identifiant: "bande-main", univers: UNIVERS_VIDE, traitement, onFermer: vi.fn(), onErreur: vi.fn() }
  render(<EcranAtelierDeBande {...props} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))
  fireEvent.change(await screen.findByLabelText("Table de retouche"), { target: { value: "retournement" } })
  const bouton = await screen.findByRole("button", { name: "miroir gauche-droite" })

  // Rien n'est posé au départ : le cran ne se montre pas pressé pour une
  // place vide — la panne trouvée par l'auteur, qui l'empêchait de voir la
  // différence entre « rien » et « déjà choisi ».
  expect(bouton.getAttribute("aria-pressed")).toBe("false")

  fireEvent.click(bouton)
  expect(bouton.getAttribute("aria-pressed")).toBe("true")
  await waitFor(() => {
    const dernier = apercu.mock.calls.at(-1)?.[0] as { prises: { recette?: { retournement: unknown } | null }[] }
    expect(dernier.prises[0].recette?.retournement).toEqual({ sens: "gauche-droite" })
  })

  // Le second clic sur le même cran le retire : la recette n'en porte plus,
  // et l'aperçu suit — sans qu'on ait touché « Enregistrer ».
  fireEvent.click(bouton)
  expect(bouton.getAttribute("aria-pressed")).toBe("false")
  await waitFor(() => {
    const dernier = apercu.mock.calls.at(-1)?.[0] as { prises: { recette?: { retournement: unknown } | null }[] }
    expect(dernier.prises[0].recette?.retournement ?? null).toBeNull()
  })

  expect(garder).not.toHaveBeenCalled()
})

test("RP22 — l'atelier d'une animation endort, réveille et vide une table, et Défaire reprend les deux gestes", async () => {
  const disque = fixture()
  disque.bande.recette = { ...RECETTE_VIDE, retournement: { sens: "gauche-droite" } } as never
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const props = { identifiant: "bande-main", univers: UNIVERS_VIDE, traitement, onFermer: vi.fn(), onErreur: vi.fn() }
  render(<EcranAtelierDeBande {...props} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))
  fireEvent.change(await screen.findByLabelText("Table de retouche"), { target: { value: "retournement" } })
  await screen.findByRole("button", { name: "miroir gauche-droite" })

  // La bascule de l'établi, posée contre la même table.
  const endormir = screen.getByRole("button", { name: "L'endormir" })
  fireEvent.click(endormir)
  expect(await screen.findByRole("button", { name: "La réveiller" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Défaire" }))
  expect(await screen.findByRole("button", { name: "L'endormir" })).toBeTruthy()

  // Remettre à zéro vide la table sans l'éteindre : le sens ne reste plus
  // choisi, et un second Défaire le ramène.
  fireEvent.click(screen.getByRole("button", { name: "Remettre à zéro" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "miroir gauche-droite" }).getAttribute("aria-pressed")).toBe("false"),
  )
  fireEvent.click(screen.getByRole("button", { name: "Défaire" }))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "miroir gauche-droite" }).getAttribute("aria-pressed")).toBe("true"),
  )
})

test("RP22 — la section de la frame dit ses trois gestes, chacun avec son aide lue dans le recueil", async () => {
  const disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const props = { identifiant: "bande-main", univers: UNIVERS_VIDE, traitement, onFermer: vi.fn(), onErreur: vi.fn() }
  render(<EcranAtelierDeBande {...props} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))

  // Le titre dit ce que la section fait — plus de « Position, source et
  // pelure d'oignon », qui ne le disait pas. Elle vit dans l'onglet « Frame ».
  fireEvent.click(screen.getByRole("button", { name: "Frame" }))
  expect(await screen.findByText(/déplacer, remplacer, voir en transparence/)).toBeTruthy()

  for (const [libelle, cle] of [
    ["Déplacer", "bande.position"],
    ["Remplacer", "bande.remplacer"],
    ["Comparer", "bande.pelure"],
  ] as const) {
    const bouton = screen.getByRole("button", { name: libelle })
    fireEvent.click(bouton)
    const bulle = await screen.findByRole("tooltip")
    expect(bulle.textContent).toContain(AIDE[cle].quoi)
    fireEvent.click(bouton) // dépingle, pour ne pas gêner le bouton suivant
  }
})

test("l'onglet Recettes enregistre les réglages sous un nom", async () => {
  const disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const nommer = vi.spyOn(api, "nommerRecette").mockResolvedValue({ recettes: { "nain propre": RECETTE_VIDE }, laisse: [] })
  render(<EcranAtelierDeBande identifiant="bande-main" univers={UNIVERS_VIDE} traitement={traitement} onFermer={vi.fn()} onErreur={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))
  fireEvent.click(screen.getByRole("button", { name: "Recettes" }))
  expect(screen.getByText("Aucune recette enregistrée pour l'instant.")).toBeTruthy()
  fireEvent.change(screen.getByLabelText("le nom de la recette"), { target: { value: "nain propre" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }))
  await waitFor(() => expect(nommer).toHaveBeenCalledOnce())
  expect(nommer.mock.calls[0][0]).toBe("nain propre")
  expect(await screen.findByText(/« nain propre » enregistrée/)).toBeTruthy()
  // Elle paraît aussitôt dans la liste à appliquer.
  expect(screen.getByLabelText("appliquer une recette enregistrée aux images choisies")).toBeTruthy()
})

test("après Enregistrer, plus rien n'attend — même si le serveur réécrit la recette", async () => {
  let disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockImplementation(async () => structuredClone(disque))
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  vi.spyOn(api, "corrigerLaBande").mockImplementation(async (_id, corps) => {
    // Le serveur rend la recette dans un autre ordre de clés : même contenu,
    // autre écriture.
    const recette = Object.fromEntries(Object.entries(disque.bande.recette as object).reverse()) as Bande["recette"]
    disque = { ...disque, bande: { ...disque.bande, ...structuredClone(corps), recette } as Bande }
    return disque.bande
  })
  render(<EcranAtelierDeBande identifiant="bande-main" univers={UNIVERS_VIDE} traitement={traitement} onFermer={vi.fn()} onErreur={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))
  ;(document.querySelector("[data-case-en-grand]") as HTMLElement).focus()
  fireEvent.keyDown(window, { key: "ArrowRight" })
  expect(await screen.findByText(/des corrections attendent/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer ›" }))
  await waitFor(() => expect(screen.queryByText(/des corrections attendent/)).toBeNull())
  expect(screen.getByText(/Version enregistrée/)).toBeTruthy()
})

test("« ‹ Animations » ramène à la page du personnage de l'animation", async () => {
  const disque = fixture()
  ;(disque.bande as Bande).personnage = "nain"
  vi.spyOn(api, "ouvrirLaBande").mockResolvedValue(disque)
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const onFermer = vi.fn()
  const onVersLeSujet = vi.fn()
  render(<EcranAtelierDeBande identifiant="bande-main" univers={UNIVERS_VIDE} traitement={traitement} onFermer={onFermer} onErreur={vi.fn()} onVersLeSujet={onVersLeSujet} nomDuSujet={() => "Le nain"} />)
  const retour = await screen.findByRole("button", { name: "‹ Animations" })
  expect(retour.getAttribute("title")).toBe("Revenir aux animations de Le nain")
  fireEvent.click(retour)
  expect(onVersLeSujet).toHaveBeenCalledWith("nain")
  expect(onFermer).not.toHaveBeenCalled()
})

test("l'éditeur de pixels : clic gauche peint, clic droit efface, et Valider range tout dans la Main", async () => {
  let disque = fixture()
  vi.spyOn(api, "ouvrirLaBande").mockImplementation(async () => structuredClone(disque))
  vi.spyOn(api, "recettesNommees").mockResolvedValue({ recettes: {} } as never)
  vi.spyOn(api, "apercuDeBande").mockResolvedValue({ planche: disque.planche, ecarts_des_frames: [] } as never)
  const garder = vi.spyOn(api, "corrigerLaBande").mockImplementation(async (_id, corps) => {
    disque = { ...disque, bande: { ...disque.bande, ...structuredClone(corps) } as Bande }
    return disque.bande
  })
  vi.stubGlobal("PointerEvent", MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
  render(<EcranAtelierDeBande identifiant="bande-main" univers={{ ...UNIVERS_VIDE, palette: ["#ff0000", "#00ff00"] }} traitement={traitement} onFermer={vi.fn()} onErreur={vi.fn()} />)
  fireEvent.click(await screen.findByRole("button", { name: "arrêter l'animation" }))
  fireEvent.change(screen.getByLabelText("Table de retouche"), { target: { value: "main" } })
  fireEvent.click(await screen.findByRole("button", { name: /Éditer les pixels de la frame 1/ }))

  const toile = document.querySelector("[data-toile-editeur]") as HTMLCanvasElement
  vi.spyOn(toile, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON() {} })
  fireEvent.click(screen.getByRole("button", { name: "couleur #00ff00" }))
  // Clic gauche : un trait de trois pixels, en vert.
  fireEvent.pointerDown(toile, { button: 0, clientX: 15, clientY: 15, pointerId: 1 })
  fireEvent.pointerMove(toile, { clientX: 35, clientY: 15, pointerId: 1 })
  fireEvent.pointerUp(toile, { pointerId: 1 })
  // Clic droit : on efface un pixel.
  fireEvent.pointerDown(toile, { button: 2, clientX: 55, clientY: 55, pointerId: 2 })
  fireEvent.pointerUp(toile, { pointerId: 2 })
  expect(screen.getByText(/^2 modifications/)).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "Valider les modifications" }))
  await waitFor(() => expect(document.querySelector("[data-editeur-de-pixels]")).toBeNull())
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer ›" }))
  await waitFor(() => expect(garder).toHaveBeenCalledOnce())
  const main = garder.mock.calls[0][1].prises?.[0].main_apres_placement
  expect(main?.calques).toHaveLength(1)
  expect(main?.calques[0].passages.map((t) => [t.garde, t.couleur, t.points])).toEqual([
    [true, "#00ff00", [[1, 1], [3, 1]]],
    [false, "", [[5, 5]]],
  ])
  expect(main?.opacite.map((t) => [t.garde, t.points])).toEqual([[false, [[5, 5]]]])
})
