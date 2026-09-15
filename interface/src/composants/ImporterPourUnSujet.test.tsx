// L'écran d'import d'une fiche — **un seul**, depuis `RP5`.
//
// Les six premiers essais sont ceux d'avant la fusion : **la preuve n'a pas
// bougé, seul le montage a bougé.** Ce qui a changé dans l'écran, c'est le
// moment où la case se choisit — jamais avant le fichier —, donc les essais qui
// choisissaient une case d'abord la choisissent maintenant après, ou arrivent
// d'une rangée vide qui la porte déjà.
//
// Les six derniers tiennent la règle neuve : *demandé, déduit, inconnu.*

import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Personnage, type Pose, type Asset } from "../api"
import { ImporterPourUnSujet } from "./ImporterPourUnSujet"

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const image = { identifiant: "asset-1", projet: "jeu", generation: "g1", type_media: "image/png", largeur: 64, hauteur: 64 } as Asset
const pose: Pose = { identifiant: "marche", nom: "Marche", images: 8, consigne: "walk", ecartees: [], images_avant: 0 }
const personnage = { identifiant: "pelerin", projet: "jeu", nom: "Pèlerin", cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }], } as unknown as Personnage
const plan = [pose]
const fichier = () => new File(["png"], "pelerin.png", { type: "image/png" })

/** Une seule case détectée : c'est une image, pas une planche. C'est le cas
 *  ordinaire, et il est doublé par défaut pour que chaque essai n'ait à dire
 *  que ce qui le concerne. */
function uneSeuleCase() {
  return vi.spyOn(api, "decoupeProposee").mockResolvedValue({ boites: [{ x: 0, y: 0, l: 64, h: 64 }] } as never)
}

function monter(sa: { pose?: string; direction?: string; rappels?: Partial<Record<"onChange" | "onDecouper" | "onMonter" | "onOuvrir", () => void>> } = {}) {
  const rappels = { onChange: vi.fn(), onDecouper: vi.fn(), onMonter: vi.fn(), onOuvrir: vi.fn(), ...sa.rappels }
  render(<ImporterPourUnSujet personnage={personnage} plan={plan} poseInitiale={sa.pose} directionInitiale={sa.direction}
    onFermer={vi.fn()} onChange={rappels.onChange} onOuvrir={rappels.onOuvrir}
    onDecouper={rappels.onDecouper} onMonter={rappels.onMonter} />)
  return rappels
}

const deposer = (...fichiers: File[]) =>
  fireEvent.change(screen.getByLabelText("Fichiers à importer"), { target: { files: fichiers } })

// ── Les six d'avant la fusion ───────────────────────────────────────────────

it("téléverse avant de classer et conserve l'image si le classement échoue", async () => {
  uneSeuleCase()
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockRejectedValue(new Error("case indisponible"))
  const { onChange } = monter({ pose: "marche" })
  deposer(fichier())
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
  uneSeuleCase()
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: null, doublon: image })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  monter({ pose: "marche" })
  deposer(fichier())
  await waitFor(() => expect(screen.getByText("Cette image existe déjà. Son classement est conservé.")).toBeTruthy())
  expect(designer).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: /Ranger dans Pèlerin/ }))
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", null))
  expect(televerser).toHaveBeenCalledOnce()
})

// **Montage adapté, preuve intacte** : la case ne se choisit plus avant le
// fichier, donc elle se choisit après — et ce qui est choisi part tel quel.
it("envoie tels quels le mouvement et la direction choisis", async () => {
  uneSeuleCase()
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  const { onChange } = monter()
  deposer(fichier())
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", null, null))
  fireEvent.change(screen.getByLabelText("Ranger les images dans"), { target: { value: "marche" } })
  fireEvent.change(screen.getByLabelText("Direction"), { target: { value: "sud" } })
  fireEvent.click(screen.getByRole("button", { name: /Ranger dans Pèlerin/ }))
  await waitFor(() => expect(designer).toHaveBeenLastCalledWith("asset-1", "pelerin", "marche", "sud"))
  expect(televerser).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenCalledTimes(2)
})

it("arrive pointé sur la case d'où on l'a ouvert", () => {
  monter({ pose: "marche", direction: "sud" })
  expect(screen.getByLabelText("Ranger les images dans")).toHaveProperty("value", "marche")
  expect(screen.getByLabelText("Direction")).toHaveProperty("value", "sud")
})

it("reprend une image de la bibliothèque sans la téléverser une seconde fois", async () => {
  const televerser = vi.spyOn(api, "televerser")
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  vi.spyOn(api, "arbre").mockResolvedValue({ collections: [] } as never)
  vi.spyOn(api, "assets").mockResolvedValue({ assets: [{ ...image, label: "Vieux croquis" }], total: 1 } as never)
  const { onChange } = monter({ pose: "marche", direction: "sud" })
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
  uneSeuleCase()
  const designer = vi.spyOn(api, "designer").mockResolvedValue({ ...image, personnage: "pelerin", pose: null } as never)
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null } as never)
  monter()
  expect(screen.getByRole("button", { name: "Reprendre une image de la bibliothèque" })).toHaveProperty("disabled", false)
  deposer(new File(["x"], "croquis.png", { type: "image/png" }))
  await waitFor(() => expect(televerser).toHaveBeenCalled())
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", null, null))
})

// ── La règle : demandé, déduit, inconnu ─────────────────────────────────────

it("ne demande rien avant de savoir ce qu'on donne", async () => {
  uneSeuleCase()
  vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  vi.spyOn(api, "designer").mockResolvedValue(image)
  monter()
  expect(screen.queryByLabelText("Ranger les images dans")).toBeNull()
  expect(screen.queryByLabelText("Direction")).toBeNull()
  deposer(fichier())
  // Et le choix paraît après, pour ce qui vient d'entrer sans case.
  expect(await screen.findByLabelText("Ranger les images dans")).toBeTruthy()
})

it("déduit la case du clic : entré par une rangée vide, on ne la redemande pas", async () => {
  uneSeuleCase()
  vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  monter({ pose: "marche", direction: "sud" })
  deposer(fichier())
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", "marche", "sud"))
  expect(designer).toHaveBeenCalledOnce()
  expect(screen.getByText("Image importée et rangée.")).toBeTruthy()
})

// **Le nom d'un fichier ne déduit rien**, et c'est le cœur de la règle : une
// case est prise dès qu'une image la porte, donc une case devinée de travers
// cache ce qui manque. Sans case, l'image se voit dans « Pas encore rangé ».
it("ne devine jamais la case d'après le nom du fichier", async () => {
  uneSeuleCase()
  vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  monter()
  deposer(new File(["png"], "marche_sud_01.png", { type: "image/png" }))
  await waitFor(() => expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", null, null))
  expect(screen.getByText("Image importée, rangée sur Pèlerin · Pas encore rangé.")).toBeTruthy()
})

it("une vidéo devient un clip, ouvre le montage, et ne prend pas la case visée", async () => {
  const importerClip = vi.spyOn(api, "importerClip").mockResolvedValue({ clip: { identifiant: "clip-1", clip: { images: 24 } }, doublon: null } as never)
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  const televerser = vi.spyOn(api, "televerser")
  const { onMonter } = monter({ pose: "marche", direction: "sud" })
  deposer(new File(["mp4"], "marche.mp4", { type: "video/mp4" }))
  await waitFor(() => expect(onMonter).toHaveBeenCalledWith("clip-1"))
  expect(importerClip).toHaveBeenCalledWith(expect.anything(), { nom: "marche.mp4", personnage: "pelerin" })
  expect(designer).not.toHaveBeenCalled()
  expect(televerser).not.toHaveBeenCalled()
  expect(screen.getByText(/ne prend pas de case/)).toBeTruthy()
})

it("une planche ouvre la découpe et ne prend pas la case visée", async () => {
  vi.spyOn(api, "decoupeProposee").mockResolvedValue({ boites: [{ x: 0, y: 0, l: 32, h: 32 }, { x: 32, y: 0, l: 32, h: 32 }] } as never)
  vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  const designer = vi.spyOn(api, "designer").mockResolvedValue(image)
  const { onDecouper } = monter({ pose: "marche", direction: "sud" })
  deposer(new File(["png"], "planche.png", { type: "image/png" }))
  await waitFor(() => expect(onDecouper).toHaveBeenCalledWith("asset-1"))
  expect(designer).toHaveBeenCalledWith("asset-1", "pelerin", null, null)
  expect(screen.getByText(/2 cases détectées/)).toBeTruthy()
})

// **Un lot entre en entier.** Partir au montage au premier fichier
// abandonnerait les suivants ; le bouton reste sur la ligne, donc rien n'est
// perdu — seul l'enchaînement est retenu.
it("accepte plusieurs fichiers d'un coup, et n'enchaîne pas au milieu d'un lot", async () => {
  uneSeuleCase()
  const televerser = vi.spyOn(api, "televerser").mockResolvedValue({ asset: image, doublon: null })
  vi.spyOn(api, "designer").mockResolvedValue(image)
  vi.spyOn(api, "importerClip").mockResolvedValue({ clip: { identifiant: "clip-1", clip: { images: 12 } }, doublon: null } as never)
  const { onMonter } = monter()
  deposer(new File(["png"], "un.png", { type: "image/png" }), new File(["mp4"], "deux.mp4", { type: "video/mp4" }))
  await waitFor(() => expect(screen.getByText("deux.mp4")).toBeTruthy())
  expect(televerser).toHaveBeenCalledOnce()
  expect(screen.getByText("un.png")).toBeTruthy()
  expect(onMonter).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir le montage" }))
  expect(onMonter).toHaveBeenCalledWith("clip-1")
})
