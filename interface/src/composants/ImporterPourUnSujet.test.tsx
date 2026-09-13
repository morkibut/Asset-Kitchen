import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Personnage, type Pose, type Asset } from "../api"
import { ImporterPourUnSujet } from "./ImporterPourUnSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const image = { identifiant: "asset-1", projet: "jeu", generation: "g1", type_media: "image/png", largeur: 64, hauteur: 64 } as Asset
const pose: Pose = { identifiant: "marche", nom: "Marche", images: 8, consigne: "walk", ecartees: [], images_avant: 0 }
const personnage = { identifiant: "pelerin", projet: "jeu", nom: "Pèlerin", cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }], } as unknown as Personnage
const plan = [pose]
const monter = () => render(<ImporterPourUnSujet personnage={personnage} plan={plan} onFermer={vi.fn()} onChange={vi.fn()} onOuvrir={vi.fn()} />)
const fichier = () => new File(["png"], "pelerin.png", { type: "image/png" })

it("téléverse avant de classer et conserve l'image si le classement échoue", async () => {
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockRejectedValue(new Error("case indisponible"))
  const onChange = vi.fn()
  render(<ImporterPourUnSujet personnage={personnage} plan={plan} onFermer={vi.fn()} onChange={onChange} onOuvrir={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Images à importer"), { target: { files: [fichier()] } })
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("L’image est conservée dans la galerie"))
  expect(televerser).toHaveBeenCalledOnce()
  expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", null)
  expect(televerser.mock.invocationCallOrder[0]).toBeLessThan(designer.mock.invocationCallOrder[0])
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: /Ranger dans Pèlerin/ }))
  await waitFor(() => expect(designer).toHaveBeenCalledTimes(2))
  expect(televerser).toHaveBeenCalledOnce()
})

it("ne reclasse un doublon qu'après un clic explicite", async () => {
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: null, doublon: image })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  monter()
  fireEvent.change(screen.getByLabelText("Images à importer"), { target: { files: [fichier()] } })
  await waitFor(() => expect(screen.getByText("Cette image existe déjà. Son classement est conservé.")).toBeTruthy())
  expect(designer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: /Ranger dans Pèlerin/ }))
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", null))
  expect(televerser).toHaveBeenCalledOnce()
})

it("envoie tels quels le mouvement et la direction choisis", async () => {
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  const onChange = vi.fn()
  render(<ImporterPourUnSujet personnage={personnage} plan={plan} onFermer={vi.fn()} onChange={onChange} onOuvrir={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Ranger les images dans"), { target: { value: "marche" } })
  fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "sud" } })
  fireEvent.change(screen.getByLabelText("Images à importer"), { target: { files: [fichier()] } })
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", "sud"))
  expect(televerser).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledOnce()
})

it("arrive pointé sur la case d'où on l'a ouvert", () => {
  render(<ImporterPourUnSujet personnage={personnage} plan={plan} poseInitiale="marche" directionInitiale="sud" onFermer={vi.fn()} onChange={vi.fn()} onOuvrir={vi.fn()} />)
  expect(screen.getByLabelText("Ranger les images dans")).toHaveProperty("value", "marche")
  expect(screen.getByLabelText("Direction")).toHaveProperty("value", "sud")
})

it("reprend une image de la bibliothèque sans la téléverser une seconde fois", async () => {
  const televerser = vi.spyOn(api, "televerser")
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  vi.spyOn(api, "arbre").mockResolvedValue({ collections: [] } as never)
  vi.spyOn(api, "assets").mockResolvedValue({ assets: [{ ...image, label: "Vieux croquis" }], total: 1 } as never)
  const onChange = vi.fn()
  render(<ImporterPourUnSujet personnage={personnage} plan={plan} poseInitiale="marche" directionInitiale="sud" onFermer={vi.fn()} onChange={onChange} onOuvrir={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Reprendre une image de la bibliothèque" }))
  fireEvent.click(await screen.findByRole("button", { name: "Choisir Vieux croquis" }))
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", "sud"))
  expect(televerser).not.toHaveBeenCalled()
  expect(onChange).toHaveBeenCalledOnce()
  expect(screen.getByText("Image de la bibliothèque, rangée ici.")).toBeTruthy()
})

// **Décision retournée en `AU20`.** Cet essai vérifiait l'inverse : sans case
// visée, la bibliothèque était grisée — « reprendre une image, c'est la ranger
// dans une case ». Mais sans case visée, l'import ne rattachait alors *rien du
// tout*, et l'image quittait la fiche. Depuis, « aucun mouvement » range quand
// même l'image sur le sujet, et le geste est donc légitime dans les deux cas.
it("range sur le sujet même sans mouvement choisi, et la bibliothèque reste ouverte", async () => {
  const designer = vi.spyOn(api, "designer").mockResolvedValue({ ...image, personnage: "pelerin", pose: null } as never)
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null } as never)
  monter()
  fireEvent.change(screen.getByLabelText("Ranger les images dans"), { target: { value: "" } })
  expect(screen.getByRole("button", { name: "Reprendre une image de la bibliothèque" })).toHaveProperty("disabled", false)
  fireEvent.change(screen.getByLabelText("Images à importer"), {
    target: { files: [new File(["x"], "croquis.png", { type: "image/png" })] },
  })
  await waitFor(() => expect(televerser).toHaveBeenCalled())
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", null, null))
})
