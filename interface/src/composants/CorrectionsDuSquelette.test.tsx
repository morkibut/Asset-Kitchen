import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"
import { CorrectionsDuSquelette } from "./CorrectionsDuSquelette"
import { sources3d, type Corrections3D } from "../api-3d"

vi.mock("../api-3d", () => ({ sources3d: { corrections: vi.fn(), poserCorrections: vi.fn(), rig: (_id: string, animation: string, revision: number) => `/rig?animation=${animation}&r=${revision}` } }))
vi.mock("./ApercuModele3D", () => ({ default: ({ url }: { url: string }) => <img alt="Aperçu du rig enregistré" src={url} /> }))
const initial: Corrections3D = { adresse: "http://127.0.0.1:8498", os: [{ cle: "main", libelle: "Main gauche", aide: "Côté gauche du personnage", axes: [{ nom: "vrille", libelle: "Vrille", aide: "Oriente la paume" }, { nom: "flexion", libelle: "Flexion", aide: "Plie la main" }] }], bornes: { minimum: -180, maximum: 180, defaut: 0, pas: 1, unite: "degrés" }, corrections: { main: { vrille: 17 } }, modifie_le: 1 }
let enregistre: Corrections3D
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); localStorage.clear(); enregistre = structuredClone(initial)
  vi.mocked(sources3d.corrections).mockImplementation(async () => structuredClone(enregistre))
  vi.mocked(sources3d.poserCorrections).mockImplementation(async (_id, corrections) => {
    enregistre = { ...enregistre, corrections, modifie_le: 2, apercus_refaits: ["rig_anime"] }
    return structuredClone(enregistre)
  })
})

test("une correction non enregistrée se reprend sans appel ; sauvegarde puis réouverture relisent les valeurs", async () => {
  const bloque = vi.fn()
  let ecran = render(<CorrectionsDuSquelette personnage="hero" animation="Marche" onBloquer={bloque} />)
  expect(await screen.findByLabelText("Vrille du squelette")).toHaveValue(17)
  fireEvent.change(screen.getByLabelText("Vrille du squelette — curseur"), { target: { value: "-43" } })
  fireEvent.change(screen.getByLabelText("Flexion du squelette"), { target: { value: "27" } })
  await waitFor(() => expect(bloque).toHaveBeenLastCalledWith(true))
  ecran.unmount()
  ecran = render(<CorrectionsDuSquelette personnage="hero" animation="Marche" />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le brouillon" }))
  expect(screen.getByLabelText("Vrille du squelette")).toHaveValue(-43)
  expect(sources3d.poserCorrections).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer les corrections" }))
  await waitFor(() => expect(sources3d.poserCorrections).toHaveBeenCalledWith("hero", { main: { flexion: 27, vrille: -43 } }, "Marche"))
  await screen.findByText("Corrections enregistrées pour les prochains rendus.")
  fireEvent.click(screen.getByRole("button", { name: "Voir le squelette animé" }))
  expect(await screen.findByAltText("Aperçu du rig enregistré")).toHaveAttribute("src", "/rig?animation=Marche&r=1")
  ecran.unmount()
  render(<CorrectionsDuSquelette personnage="hero" animation="Marche" />)
  expect(await screen.findByLabelText("Vrille du squelette")).toHaveValue(-43)
  expect(screen.getByLabelText("Flexion du squelette")).toHaveValue(27)
  expect(screen.queryByRole("button", { name: "Reprendre le brouillon" })).not.toBeInTheDocument()
})

test("une erreur garde le réglage édité ; la remise à zéro reste réversible avant sauvegarde", async () => {
  vi.mocked(sources3d.poserCorrections).mockRejectedValue(new Error("Une étape utilise ce personnage."))
  render(<CorrectionsDuSquelette personnage="hero" animation="Marche" />)
  await screen.findByLabelText("Vrille du squelette")
  fireEvent.change(screen.getByLabelText("Vrille du squelette"), { target: { value: "61" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer les corrections" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Une étape utilise ce personnage.")
  expect(screen.getByLabelText("Vrille du squelette")).toHaveValue(61)
  fireEvent.click(screen.getByRole("button", { name: "Remettre tout à zéro" }))
  expect(screen.getByLabelText("Vrille du squelette")).toHaveValue(0)
  fireEvent.click(screen.getByRole("button", { name: "Annuler les changements" }))
  expect(screen.getByLabelText("Vrille du squelette")).toHaveValue(17)
  expect(sources3d.poserCorrections).toHaveBeenCalledTimes(1)
})
