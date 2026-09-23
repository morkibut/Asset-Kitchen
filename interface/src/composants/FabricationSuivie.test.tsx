import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Personnage } from "../api"
import { travaux, type Serie, type Travail } from "../api-travaux"
import { brouillonsLaissesEnPlan } from "../brouillons"
import { FabricationSuivie } from "./FabricationSuivie"

const personnage = { identifiant: "pelerin", nom: "Pèlerin", type: "personnage", ecartees: [], plan: [{ identifiant: "marche", nom: "Marche" }], cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }] } as unknown as Personnage
const t = { identifiant: "travail-relu", projet: "jeu", cle: "cle-premiere", acteur: "auteur", etat: "prepare", etape: "reference", cree_le: 123,
  demande: { cle: "cle-premiere", personnage: "pelerin", pose: "marche", direction: "sud", modele_image: "Images:modele", prompt_image: "Une référence", modele_video: "Video:modele", prompt_video: "Il marche", secondes: 5, resolution: "480p", proportions: "1:1", nombre_images: 8, cadence: 11, sens: "boucle" },
  objectif: { largeur: 64, hauteur: 64 }, reference_asset: null, clip: null, bandes: [], references: [{ nom: "style", url: "/reference-figee.png", asset: "style", empreinte: "fixe" }],
  envoi_image: { prompt: "Le vrai texte composé avec l’univers", options: {}, proportions: "1:1" },
  annonce: { image_usd: .2, video: { montant: .3 }, reservation_usd: .5, appels: 2, video_locale: false, limite: "Estimation avant envoi" }, consommations: [], prochaine_action: "demarrer",
} as unknown as Travail

beforeEach(() => {
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [{ identifiant: "Images:modele", nom: "Image test", options: {}, refus: null }] } as Awaited<ReturnType<typeof api.modeles>>)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "Video:modele", nom: "Vidéo test", grise: null, prix: { montant: .3 }, durees: [5, 10], resolutions: ["480p", "720p"], proportions: ["1:1", "16:9"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  vi.spyOn(travaux, "preparer").mockImplementation(async (_p, d) => ({ ...t, identifiant: "nouvelle-relecture", demande: d }))
  vi.spyOn(travaux, "demarrer").mockResolvedValue({ ...t, etat: "en_cours" })
  vi.spyOn(travaux, "reprendre").mockResolvedValue({ ...t, etat: "en_cours" })
  vi.spyOn(travaux, "lire").mockResolvedValue({ ...t, etat: "termine" })
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockRejectedValue(new Error("non mocké dans cet essai"))
  // **RV19** : par défaut, aucune case n'a d'image — chaque essai qui s'y
  // intéresse précise sa propre réponse.
  vi.spyOn(api, "imageDeDepart").mockResolvedValue({ cases: [] })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

test("la relecture montre le texte composé et les octets figés sans lancer d’appel", () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={t} onClip={() => {}} onFermer={() => {}} />)
  expect(screen.getByText("Le vrai texte composé avec l’univers")).toBeTruthy()
  expect(screen.getByAltText("Référence exacte envoyée pour créer l’image")).toHaveAttribute("src", "/reference-figee.png")
  expect(screen.getByText("1 clip · 5 s · 480p · 1:1")).toBeTruthy()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("modifier le texte ou les références demande une nouvelle relecture avec une nouvelle clé", async () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={t} onClip={() => {}} onFermer={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Modifier le texte et les images" }))
  const texte = screen.getByLabelText("Texte complet de l’image, édité pour cet envoi")
  expect(texte).toHaveValue("Le vrai texte composé avec l’univers")
  fireEvent.change(texte, { target: { value: "Une correction précise" } })
  fireEvent.click(screen.getByRole("button", { name: "Retirer de cet envoi" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Relire avant l’envoi" })).toBeEnabled())
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await waitFor(() => expect(travaux.preparer).toHaveBeenCalledOnce())
  const [projet, demande] = vi.mocked(travaux.preparer).mock.calls[0]
  expect(projet).toBe("jeu")
  expect(demande.cle).not.toBe(t.cle)
  expect(demande.prompt_image).toBe("Une correction précise")
  expect(demande.repris_image).toBe(true)
  expect(demande.references_image_ecartees).toEqual(["style"])
  expect(travaux.demarrer).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole("button", { name: /Lancer ·/ }))
  await waitFor(() => expect(travaux.demarrer).toHaveBeenCalledWith("jeu", "nouvelle-relecture"))
})

test("la reprise d’un travail agent conserve son identifiant sans préparer de nouvelle génération", async () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={{ ...t, acteur: "agent", etat: "a_reprendre" }} onClip={() => {}} onFermer={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Reprendre ce travail" }))
  await waitFor(() => expect(travaux.reprendre).toHaveBeenCalledWith("jeu", "travail-relu"))
  expect(travaux.preparer).not.toHaveBeenCalled()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("le profil vidéo choisi et les réglages du brouillon reviennent sans préparer ni lancer d’appel", async () => {
  const props = { projet: "jeu", personnages: [personnage], modeleInitial: "Video:modele", onClip() {}, onFermer() {} }
  const vue = render(<FabricationSuivie {...props} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  expect(screen.getByLabelText("Fournisseur et modèle")).toHaveValue("Video:modele")
  fireEvent.change(screen.getByLabelText("Mouvement"), { target: { value: "marche" } })
  fireEvent.change(screen.getByLabelText("Décrire l’animation"), { target: { value: "Tourne sur place avec son casque rouge" } })
  fireEvent.change(screen.getByLabelText("Durée du clip"), { target: { value: "10" } })
  fireEvent.change(screen.getByLabelText("Paramètres vidéo JSON"), { target: { value: '{"seed":83}' } })
  await screen.findByText("Brouillon conservé sur cet ordinateur.")
  // **Et le tiroir le voit** (`RP16`) : l'écran se déclare, avec de quoi le
  // reconnaître sans l'ouvrir.
  expect(brouillonsLaissesEnPlan()[0]).toMatchObject({ ecran: "Une animation", quoi: "Pèlerin · Marche · Sud" })
  vue.unmount()
  render(<FabricationSuivie {...props} />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le brouillon" }))
  expect(screen.getByLabelText("Décrire l’animation")).toHaveValue("Tourne sur place avec son casque rouge")
  expect(screen.getByLabelText("Durée du clip")).toHaveValue("10")
  expect(screen.getByLabelText("Paramètres vidéo JSON")).toHaveValue('{"seed":83}')
  expect(travaux.preparer).not.toHaveBeenCalled()
  expect(travaux.demarrer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await waitFor(() => expect(travaux.preparer).toHaveBeenCalledOnce())
  expect(vi.mocked(travaux.preparer).mock.calls[0][1]).toMatchObject({ modele_video: "Video:modele", secondes: 10, options_video: { seed: 83 } })
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("un profil vidéo disparu reste nommé avec sa raison et bloque la relecture", async () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} modeleInitial="ComfyUI:profil-disparu" onClip={() => {}} onFermer={() => {}} />)
  expect(await screen.findByText(/il n’est plus proposé par le catalogue/)).toBeTruthy()
  expect(screen.getByLabelText("Fournisseur et modèle")).toHaveValue("ComfyUI:profil-disparu")
  expect(screen.getByRole("button", { name: "Relire avant l’envoi" })).toBeDisabled()
})

test("la fabrication ouverte depuis une cible garde le personnage, le mouvement et sa cadence", async () => {
  const cible = { ...personnage, identifiant: "sentinelle", nom: "Sentinelle", objectif: { sorties: [{ nature: "animation" as const, pose: "marche", direction: "sud", quantite: 1 }], largeur: 64, hauteur: 64, cadence: 11, boucle: true, repere: { x: 29, y: 64 } } }
  render(<FabricationSuivie projet="jeu" personnages={[personnage, cible]} cibleInitiale={{ personnage: "sentinelle", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  expect(screen.getByLabelText("Sujet")).toHaveValue("sentinelle")
  expect(screen.getByLabelText("Mouvement")).toHaveValue("marche")
  expect(screen.getByLabelText("Direction")).toHaveValue("sud")
  expect(screen.getByLabelText("Cadence (images/s)")).toHaveValue(11)
  expect(travaux.preparer).not.toHaveBeenCalled()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("une bande obtenue à la main mène à l’écran de la sortie sans relancer d’appel", async () => {
  const sortie = vi.fn()
  const fini = { ...t, etat: "termine", etape: "termine", clip: "clip-1", bandes: ["bande-1"], reference_asset: "image-1" } as unknown as Travail
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={fini} onClip={() => {}} onLivraisons={sortie} onFermer={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Livrer dans le jeu" }))
  expect(sortie).toHaveBeenCalledOnce()
  expect(travaux.preparer).not.toHaveBeenCalled()
  expect(travaux.demarrer).not.toHaveBeenCalled()
})

test("sans écran de sortie branché, aucune porte de livraison n’est promise", () => {
  const fini = { ...t, etat: "termine", etape: "termine", clip: "clip-1", bandes: ["bande-1"] } as unknown as Travail
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={fini} onClip={() => {}} onFermer={() => {}} />)
  expect(screen.queryByRole("button", { name: /Livrer dans le jeu/ })).toBeNull()
})

// ── « La carte graphique prévient avant de lancer » (RV2) ─────────────────

test("un modèle local montre la mémoire libre et avertit sous le besoin mesuré, sans bloquer", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "maison/wan-2.2-i2v-14b-pixel", nom: "Wan 2.2 image→vidéo (pixel)", grise: null, de_la_maison: true, prix: { montant: 0 }, durees: [1, 2, 3], resolutions: ["480p"], proportions: ["1:1"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  vi.spyOn(api, "etatDuMoteur").mockResolvedValue({
    allume: true, grise: null, manquants: [], go_a_telecharger: 0, greffon_absent: false,
    carte: "cuda:0 NVIDIA GeForce RTX 3080 Laptop GPU", memoire_libre_go: 0.9, besoin_go: 6, occupe: false, phrase: "",
  })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} modeleInitial="maison/wan-2.2-i2v-14b-pixel" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Wan 2.2/ })
  expect(await screen.findByText(/Mémoire libre : 0,9 Go/)).toBeTruthy()
  expect(screen.getByText(/environ 6 Go.*ferme les autres calculs/)).toBeTruthy()
  // Jamais l'identifiant technique du pilote.
  expect(screen.queryByText(/cuda:0/)).toBeNull()
})

test("un modèle payant ne regarde jamais la carte graphique", async () => {
  const espionEtat = vi.spyOn(api, "etatDuMoteur")
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} modeleInitial="Video:modele" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  expect(screen.queryByText(/Mémoire libre/)).toBeNull()
  expect(espionEtat).not.toHaveBeenCalled()
})

test("ComfyUI déjà occupé par un autre calcul se dit avant le lancement, sans bloquer", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "maison/wan-2.2-i2v-14b-pixel", nom: "Wan 2.2 image→vidéo (pixel)", grise: null, de_la_maison: true, prix: { montant: 0 }, durees: [1, 2, 3], resolutions: ["480p"], proportions: ["1:1"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  vi.spyOn(api, "etatDuMoteur").mockResolvedValue({
    allume: true, grise: null, manquants: [], go_a_telecharger: 0, greffon_absent: false,
    carte: "cuda:0 NVIDIA GeForce RTX 3080 Laptop GPU", memoire_libre_go: 6.7, besoin_go: 6, occupe: true, phrase: "",
  })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} modeleInitial="maison/wan-2.2-i2v-14b-pixel" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Wan 2.2/ })
  expect(await screen.findByText(/ComfyUI est déjà occupé par un autre calcul/)).toBeTruthy()
})

// ── RV5 : la fenêtre reçoit le meilleur du formulaire A ───────────────────

const mouvementFlotte = { identifiant: "flotte", nom: "Il flotte", texte: "it floats", cadence: 8, directions: [], livre: true, masque: false }

// SC3 — déplacé et réécrit depuis `ClipCatalogue.test.tsx` le 22 septembre
// 2026 (RV6) : « le serveur seul compose » vaut ici comme sur l'ancien écran
// « Faire une vidéo » — la fenêtre affiche exactement ce que
// `mouvementDeLaPose` a rendu, jamais un recollage de la phrase de direction
// et du texte du mouvement pris isolément (E14 : le texte relu est celui qui
// part).
// **22 septembre 2026** : le style de la fiche est proposé, jamais coché
// d'office — Mara au fusil gardait son fusil jusque dans son repos.
test("aucun style n’est coché d’office ; en cocher un recompose le texte au serveur, avec lui", async () => {
  const mouvementAttaque = { identifiant: "attaque", nom: "attaque", texte: "attack, winding up", cadence: 14, directions: [], livre: true, masque: false }
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [mouvementAttaque], masques: [] })
  const baton = { identifiant: "baton", nom: "bâton", tient: "a staff", textes: { attaque: "a horizontal swing with the wooden staff" }, livre: true, masque: false }
  const compose = vi.spyOn(api, "mouvementDeLaPose").mockImplementation(async (_pose, _projet, _direction, _personnage, _mouvement, style) => ({
    pose: "marche", mouvement: mouvementAttaque, origine: "mouvement" as const,
    direction: "Seen from the front.",
    geste: style ? baton.textes.attaque : mouvementAttaque.texte,
    texte: `Seen from the front. ${style ? baton.textes.attaque : mouvementAttaque.texte}`,
    style: style ? baton : null,
    styles_proposes: [{ style: baton, origine: "choisi" as const, piece: null }],
  }))
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await waitFor(() => expect(screen.getByLabelText("Geste")).toHaveValue("attaque"))
  expect(screen.getByRole("radio", { name: "Aucun" })).toBeChecked()
  fireEvent.click(screen.getByText("Voir le texte anglais envoyé"))
  expect(screen.getByText("Seen from the front. attack, winding up")).toBeTruthy()

  fireEvent.click(screen.getByRole("radio", { name: "bâton" }))
  await waitFor(() => expect(compose).toHaveBeenLastCalledWith("marche", "jeu", "sud", "pelerin", "attaque", "baton"))
  expect(await screen.findByText("Seen from the front. a horizontal swing with the wooden staff")).toBeTruthy()
})

test("un mouvement choisi remplit le texte depuis la bibliothèque, avec son nom en français et le texte anglais repliable", async () => {
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [mouvementFlotte], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockResolvedValue({
    pose: "marche", mouvement: mouvementFlotte, texte: "Facing south. it floats", direction: "Facing south.",
    geste: "it floats", origine: "mouvement", style: null, styles_proposes: [],
  })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: "Il flotte" })
  await waitFor(() => expect(screen.getByLabelText("Geste")).toHaveValue("flotte"))
  expect(screen.queryByLabelText("Décrire l’animation")).toBeNull()
  fireEvent.click(screen.getByText("Voir le texte anglais envoyé"))
  expect(screen.getByText("Facing south. it floats")).toBeTruthy()
})

test("corriger le geste puis « Garder pour le jeu » écrit le texte dans la bibliothèque des mouvements", async () => {
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [mouvementFlotte], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockResolvedValue({
    pose: "marche", mouvement: mouvementFlotte, texte: "Facing south. it floats", direction: "Facing south.",
    geste: "it floats", origine: "mouvement", style: null, styles_proposes: [],
  })
  const regler = vi.spyOn(api, "reglerMouvement").mockResolvedValue({ mouvements: [mouvementFlotte], masques: [] })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await waitFor(() => expect(screen.getByLabelText("Geste")).toHaveValue("flotte"))
  fireEvent.click(screen.getByText("corriger le geste ›"))
  fireEvent.change(screen.getByLabelText("Corriger le geste pour cet appel"), { target: { value: "it drifts gently" } })
  fireEvent.click(screen.getByRole("button", { name: "Garder pour le jeu" }))
  await waitFor(() => expect(regler).toHaveBeenCalledWith("flotte", { texte: "it drifts gently" }, "jeu"))
})

// ── RV19 : l'image de départ se voit avant de choisir ───────────────────────

test("« corriger le geste » ouvre le champ déjà rempli du geste actuel, modifiable", async () => {
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [mouvementFlotte], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockResolvedValue({
    pose: "marche", mouvement: mouvementFlotte, texte: "Facing south. it floats", direction: "Facing south.",
    geste: "it floats", origine: "mouvement", style: null, styles_proposes: [],
  })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await waitFor(() => expect(screen.getByLabelText("Geste")).toHaveValue("flotte"))
  fireEvent.click(screen.getByText("corriger le geste ›"))
  // **Rempli, pas grisé** : le champ porte déjà le geste actuel, prêt à modifier.
  expect(screen.getByLabelText("Corriger le geste pour cet appel")).toHaveValue("it floats")
  // Retrouver exactement ce texte n'est pas une correction : rien ne part en plus.
  expect(screen.queryByText("remettre le texte du mouvement")).toBeNull()
})

test("une case sans image le dit, et propose le modèle recommandé, présélectionné", async () => {
  vi.spyOn(api, "imageDeDepart").mockResolvedValue({
    cases: [{ direction: "sud", asset: null, origine: "aucune", raison: "« Pèlerin » n’a encore aucune image." }],
  })
  vi.spyOn(api, "modeles").mockResolvedValue({
    modeles: [
      { identifiant: "Local:qwen21-rapide", nom: "Qwen rapide", fournisseur: "Local", locale: true, options: {}, refus: null },
      { identifiant: "Images:payant", nom: "Modèle payant", fournisseur: "Images", options: {}, refus: null },
    ],
  } as Awaited<ReturnType<typeof api.modeles>>)
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  expect(await screen.findByText("aucune image pour Sud")).toBeTruthy()
  const recommande = await screen.findByRole("radio", { name: /Qwen rapide.*recommandé/ })
  await waitFor(() => expect(recommande).toBeChecked())
  expect(screen.getByLabelText("Description de l’image à créer")).toBeTruthy()
})

test("quand chaque case a déjà son image, la liste des modèles disparaît et laisse une phrase", async () => {
  vi.spyOn(api, "imageDeDepart").mockResolvedValue({
    cases: [{ direction: "sud", asset: { identifiant: "portrait-1", label: "Portrait" } as Awaited<ReturnType<typeof api.imageDeDepart>>["cases"][number]["asset"], origine: "portrait", raison: "le portrait de Pèlerin" }],
  })
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  expect(await screen.findByAltText("Image de départ proposée — Sud")).toHaveAttribute("src", expect.stringContaining("portrait-1"))
  expect(screen.getByText("Chaque case ci-dessus a déjà son image de départ.")).toBeTruthy()
  expect(screen.queryByText(/Modèle pour créer/)).toBeNull()
})

test("un geste hérité d’un style se garde sur le style, pas sur le mouvement", async () => {
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [mouvementFlotte], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockResolvedValue({
    pose: "marche", mouvement: mouvementFlotte, texte: "Facing south. it strides on the water", direction: "Facing south.",
    geste: "it strides on the water", origine: "mouvement",
    style: { identifiant: "baton", nom: "Bâton", tient: "", textes: {}, livre: true, masque: false }, styles_proposes: [],
  })
  const reglerStyle = vi.spyOn(api, "reglerStyle").mockResolvedValue({ styles: [], masques: [] })
  const reglerMouvement = vi.spyOn(api, "reglerMouvement")
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} onClip={() => {}} onFermer={() => {}} />)
  await waitFor(() => expect(screen.getByLabelText("Geste")).toHaveValue("flotte"))
  fireEvent.click(screen.getByText("corriger le geste ›"))
  fireEvent.change(screen.getByLabelText("Corriger le geste pour cet appel"), { target: { value: "it glides across the water" } })
  fireEvent.click(screen.getByRole("button", { name: "Garder pour le jeu" }))
  await waitFor(() => expect(reglerStyle).toHaveBeenCalledWith("baton", { textes: { flotte: "it glides across the water" } }, "jeu"))
  expect(reglerMouvement).not.toHaveBeenCalled()
})

test("le nombre de clips par case se choisit parmi 1, 2, 4 et 8", () => {
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} onClip={() => {}} onFermer={() => {}} />)
  const select = screen.getByLabelText("Nombre de clips") as HTMLSelectElement
  expect([...select.options].map((o) => o.value)).toEqual(["1", "2", "4", "8"])
})

test("la durée proposée suit le modèle choisi, et reste une durée qu’il accepte", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "Video:modele", nom: "Vidéo test", grise: null, prix: { montant: .3 }, durees: [2, 3], duree_par_defaut: 3, resolutions: ["480p"], proportions: ["1:1"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} modeleInitial="Video:modele" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  await waitFor(() => expect(screen.getByLabelText("Durée du clip")).toHaveValue("3"))
})

test("le bouton porte le temps attendu quand le clip est local", () => {
  const local = { ...t, annonce: { ...t.annonce, video_locale: true,
    temps_local: { secondes: 420, secondes_suivant: 60, premier: true, images: 1, mesure: "essai", nature: "video" } } } as unknown as Travail
  render(<FabricationSuivie projet="jeu" personnages={[personnage]} initiale={local} onClip={() => {}} onFermer={() => {}} />)
  expect(screen.getByRole("button", { name: "Lancer · ≈ 7 min" })).toBeTruthy()
})

// **RV6** (repris d'`App.test.tsx`, bloc A11 — « un lot n'additionne pas la
// même attente ») : un lot local ne multiplie pas le temps du premier clip
// par le nombre de clips. La formule (`temps_s = premier +
// (N−1)×secondes_suivant`) est du serveur (`preparer_serie`) ; la fenêtre
// affiche `annonce_serie.temps_s` tel quel, jamais un calcul refait ici.
test("un lot local affiche le temps du serveur, jamais le premier multiplié par le nombre de clips", async () => {
  const deuxDirections = { ...personnage, cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }, { identifiant: "est", nom: "Est" }] }] } as unknown as Personnage
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "maison/wan-2.2-i2v-14b-pixel", nom: "Wan 2.2 image→vidéo (pixel)", grise: null, de_la_maison: true, prix: { montant: 0 }, durees: [1, 2, 3], resolutions: ["480p"], proportions: ["1:1"] }] } as Awaited<ReturnType<typeof api.modelesVideo>>)
  const serieLocale: Serie = {
    serie: { cle: "cle-serie-locale", identifiant: "id-serie-locale", total: 2 },
    travaux: [
      { ...t, identifiant: "t-sud", demande: { ...t.demande, direction: "sud" }, etat: "prepare" },
      { ...t, identifiant: "t-est", demande: { ...t.demande, direction: "est" }, etat: "prepare" },
    ] as unknown as Travail[],
    // 129 s pour le premier, 80 s pour le suivant = 209 s — pas 258 s (2×129).
    annonce_serie: { reservation_usd: 0, temps_s: 209, appels: 2, locale: true },
  }
  vi.spyOn(travaux, "preparerSerie").mockResolvedValue(serieLocale)
  render(<FabricationSuivie projet="jeu" personnages={[deuxDirections]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} modeleInitial="maison/wan-2.2-i2v-14b-pixel" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Wan 2.2/ })
  fireEvent.click(screen.getByLabelText("Est"))
  fireEvent.change(screen.getByLabelText("Décrire l’animation"), { target: { value: "Il marche" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  expect(await screen.findByRole("button", { name: "Lancer · ≈ 3 min" })).toBeTruthy()
})

test("plusieurs directions cochées préparent une série, lancée d’un geste, relue avec un en-tête commun et des cases repliables", async () => {
  const deuxDirections = { ...personnage, cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }, { identifiant: "est", nom: "Est" }] }] } as unknown as Personnage
  const serieReponse: Serie = {
    serie: { cle: "cle-serie", identifiant: "id-serie", total: 2 },
    travaux: [
      { ...t, identifiant: "t-sud", demande: { ...t.demande, direction: "sud", prompt_video: "Facing south. Il marche" }, etat: "prepare" },
      { ...t, identifiant: "t-est", demande: { ...t.demande, direction: "est", prompt_video: "Facing east. Il marche" }, etat: "prepare" },
    ] as unknown as Travail[],
    annonce_serie: { reservation_usd: 1, temps_s: null, appels: 2, locale: false },
  }
  const preparerSerie = vi.spyOn(travaux, "preparerSerie").mockResolvedValue(serieReponse)
  const demarrerSerie = vi.spyOn(travaux, "demarrerSerie").mockResolvedValue({
    ...serieReponse, travaux: serieReponse.travaux.map((v) => ({ ...v, etat: "en_cours" }) as Travail),
  })
  render(<FabricationSuivie projet="jeu" personnages={[deuxDirections]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} modeleInitial="Video:modele" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  fireEvent.click(screen.getByLabelText("Est"))
  fireEvent.change(screen.getByLabelText("Décrire l’animation"), { target: { value: "Il marche" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await waitFor(() => expect(preparerSerie).toHaveBeenCalledOnce())
  const [projetAppele, , cases, nombre] = vi.mocked(travaux.preparerSerie).mock.calls[0]
  expect(projetAppele).toBe("jeu")
  expect(cases).toEqual([{ pose: "marche", direction: "sud" }, { pose: "marche", direction: "est" }])
  expect(nombre).toBe(1)
  expect(await screen.findByText("2 clips")).toBeTruthy()
  fireEvent.click(screen.getByText("Sud"))
  expect(screen.getByText("Facing south. Il marche")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: /Lancer 2 clips/ }))
  await waitFor(() => expect(demarrerSerie).toHaveBeenCalledWith("jeu", "cle-serie"))
})

// **RV6** : « Tout animer » arme des cases de poses différentes — une série
// n'est plus bornée à la pose du champ « Mouvement ». Le serveur
// (`preparer_serie`) les acceptait déjà telles quelles ; c'est la fenêtre qui
// les réduisait à une seule pose jusqu'ici.
test("« Tout animer » arme des cases de poses différentes dans la même série", async () => {
  const deuxPoses = {
    ...personnage,
    plan: [{ identifiant: "marche", nom: "Marche" }, { identifiant: "repos", nom: "Repos" }],
    cases: [
      { pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }, { identifiant: "est", nom: "Est" }] },
      { pose: "repos", directions: [{ identifiant: "nord", nom: "Nord" }, { identifiant: "ouest", nom: "Ouest" }] },
    ],
  } as unknown as Personnage
  const serieReponse: Serie = {
    serie: { cle: "cle-serie-multi", identifiant: "id-serie-multi", total: 4 },
    travaux: [
      { ...t, identifiant: "t-marche-sud", demande: { ...t.demande, pose: "marche", direction: "sud" }, etat: "prepare" },
      { ...t, identifiant: "t-marche-est", demande: { ...t.demande, pose: "marche", direction: "est" }, etat: "prepare" },
      { ...t, identifiant: "t-repos-nord", demande: { ...t.demande, pose: "repos", direction: "nord" }, etat: "prepare" },
      { ...t, identifiant: "t-repos-ouest", demande: { ...t.demande, pose: "repos", direction: "ouest" }, etat: "prepare" },
    ] as unknown as Travail[],
    annonce_serie: { reservation_usd: 2, temps_s: null, appels: 4, locale: false },
  }
  const preparerSerie = vi.spyOn(travaux, "preparerSerie").mockResolvedValue(serieReponse)
  render(<FabricationSuivie projet="jeu" personnages={[deuxPoses]} cibleInitiale={{
    personnage: "pelerin", pose: "marche", direction: "sud",
    cases: [{ pose: "marche", direction: "est" }, { pose: "repos", direction: "nord" }, { pose: "repos", direction: "ouest" }],
  }} modeleInitial="Video:modele" onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  fireEvent.change(screen.getByLabelText("Décrire l’animation"), { target: { value: "Il marche" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))
  await waitFor(() => expect(preparerSerie).toHaveBeenCalledOnce())
  const [, , cases, nombre] = vi.mocked(travaux.preparerSerie).mock.calls[0]
  expect(cases).toHaveLength(4)
  expect(cases).toEqual(expect.arrayContaining([
    { pose: "marche", direction: "sud" },
    { pose: "marche", direction: "est" },
    { pose: "repos", direction: "nord" },
    { pose: "repos", direction: "ouest" },
  ]))
  expect(nombre).toBe(1)
  expect(await screen.findByText("4 clips")).toBeTruthy()
})

// **RV7 — retours de l'auteur au test de RV6 (23 septembre 2026)** : la
// relecture d'une série égale celle d'un clip seul, case par case ; après
// « Lancer », chaque case dit son étape et son temps, puis sa vignette ou
// « ratée », sans rien déplier ; et le pied dit qu'on peut fermer.
test("une série montre ce qui part par case, puis l'étape, le temps, la vignette ou « ratée », et qu'on peut fermer", async () => {
  const deuxDirections = { ...personnage, cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }, { identifiant: "est", nom: "Est" }] }] } as unknown as Personnage
  const depart = { entree_video: { url: "/depart-sud.png", empreinte: "e" }, references: [] }
  const serieReponse: Serie = {
    serie: { cle: "cle-rv7", identifiant: "id-rv7", total: 2 },
    travaux: [
      { ...t, identifiant: "t-sud", demande: { ...t.demande, direction: "sud" }, etat: "prepare", ...depart },
      { ...t, identifiant: "t-est", demande: { ...t.demande, direction: "est" }, etat: "prepare" },
    ] as unknown as Travail[],
    annonce_serie: { reservation_usd: 1, temps_s: null, appels: 2, locale: false },
  }
  vi.spyOn(travaux, "preparerSerie").mockResolvedValue(serieReponse)
  const lance = Date.now() / 1000 - 80
  vi.spyOn(travaux, "demarrerSerie").mockResolvedValue({
    ...serieReponse, travaux: serieReponse.travaux.map((v) => ({ ...v, etat: "en_cours", phase: "video", lance_le: lance, attendu_s: 180 }) as Travail),
  })
  vi.spyOn(travaux, "lire").mockImplementation(async (_p, id) => (id === "t-sud"
    ? { ...serieReponse.travaux[0], etat: "termine", clip: "t-sud-video", bandes: ["t-sud-bande"] }
    : { ...serieReponse.travaux[1], etat: "a_verifier", controle: "noire", raison: "la vidéo est revenue noire" }) as Travail)
  const onFermer = vi.fn()
  const onBande = vi.fn()
  render(<FabricationSuivie projet="jeu" personnages={[deuxDirections]} cibleInitiale={{ personnage: "pelerin", pose: "marche", direction: "sud" }} modeleInitial="Video:modele" onClip={() => {}} onBande={onBande} onFermer={onFermer} />)
  await screen.findByRole("option", { name: /Vidéo test/ })
  fireEvent.click(screen.getByLabelText("Est"))
  fireEvent.change(screen.getByLabelText("Décrire l’animation"), { target: { value: "Il marche" } })
  fireEvent.click(screen.getByRole("button", { name: "Relire avant l’envoi" }))

  // Avant de lancer : l'image de départ de la case sud, et les références que
  // la case est enverra pour créer la sienne.
  expect(await screen.findByAltText("Image de départ envoyée à la vidéo")).toHaveAttribute("src", "/depart-sud.png")
  expect(screen.getByText("image de départ à créer")).toBeTruthy()
  expect(screen.getByAltText("Référence envoyée")).toHaveAttribute("src", "/reference-figee.png")
  expect(screen.queryByRole("button", { name: "Fermer, ça continue" })).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: /Lancer 2 clips/ }))
  // Lancé : l'étape et le temps écoulé sur le temps attendu, sans déplier.
  expect(await screen.findAllByText(/^Vidéo · 1 min 2\d \/ ≈ 3 min$/)).toHaveLength(2)
  expect(screen.getByText(/Tu peux fermer cette fenêtre : la fabrication continue/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Fermer, ça continue" }))
  expect(onFermer).toHaveBeenCalledOnce()

  // Relu deux secondes plus tard : sud est arrivée, est a raté.
  expect(await screen.findByText("Arrivée", {}, { timeout: 3000 })).toBeTruthy()
  expect(screen.getByText("Ratée")).toBeTruthy()
  expect(screen.getByText("la vidéo est revenue noire")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir Sud" }))
  expect(onBande).toHaveBeenCalledWith("t-sud-bande")
  // « Relancer » rouvre la préparation, remplie ; rien ne part.
  fireEvent.click(screen.getByRole("button", { name: "Relancer" }))
  expect(await screen.findByRole("button", { name: "Relire avant l’envoi" })).toBeTruthy()
  expect(travaux.demarrerSerie).toHaveBeenCalledOnce()
})
