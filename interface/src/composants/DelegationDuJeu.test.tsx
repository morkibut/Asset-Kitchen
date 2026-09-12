import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Modele, type ModeleVideo } from "../api"
import { travaux, type CadreDelegation, type Travail } from "../api-travaux"
import { DelegationDuJeu } from "./DelegationDuJeu"

const initial: CadreDelegation = {
  autoriser_local: true, autoriser_payant: false, modeles_image: ["ancien:reference"], modeles_video: [],
  plafond_appels: 20, plafond_usd: 0, livraison_provisoire: false, origine: "garde-fous-existants",
}
beforeEach(() => {
  vi.spyOn(travaux, "cadre").mockResolvedValue(structuredClone(initial))
  vi.spyOn(travaux, "lister").mockResolvedValue([])
  vi.spyOn(travaux, "reglerCadre").mockImplementation(async (_projet, cadre) => ({ ...cadre, origine: "explicite" }))
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [{ identifiant: "images:reference", references_max: 3, unite: "usd", refus: null } as Modele] } as Awaited<ReturnType<typeof api.modeles>>)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ identifiant: "local:animation", de_la_maison: true, grise: null } as ModeleVideo] } as Awaited<ReturnType<typeof api.modelesVideo>>)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("enregistre le cadre du jeu puis le relit à la réouverture sans perdre les modèles absents", async () => {
  const vue = render(<DelegationDuJeu projet="mon-jeu" onAtelier={() => {}} />)
  const absent = await screen.findByRole("checkbox", { name: /ancien:reference/ })
  expect(absent).toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", { name: /Autoriser les appels payants/ }))
  fireEvent.change(screen.getByRole("spinbutton", { name: "Budget total en dollars" }), { target: { value: "4.5" } })
  fireEvent.change(screen.getByRole("spinbutton", { name: "Nombre total d’appels autorisés" }), { target: { value: "7" } })
  fireEvent.click(screen.getByRole("checkbox", { name: /Permettre une livraison provisoire/ }))
  fireEvent.change(screen.getByRole("combobox", { name: "Clip vidéo" }), { target: { value: "selection" } })
  fireEvent.click(await screen.findByRole("checkbox", { name: /local:animation/ }))
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le cadre du jeu" }))
  await screen.findByRole("status")
  expect(travaux.reglerCadre).toHaveBeenCalledWith("mon-jeu", expect.objectContaining({
    autoriser_payant: true, plafond_appels: 7, plafond_usd: 4.5, livraison_provisoire: true,
    modeles_image: ["ancien:reference"], modeles_video: ["local:animation"],
  }))
  const sauve = { ...vi.mocked(travaux.reglerCadre).mock.calls[0][1], origine: "explicite" }
  vue.unmount()
  vi.mocked(travaux.cadre).mockResolvedValue(sauve)
  render(<DelegationDuJeu projet="mon-jeu" onAtelier={() => {}} />)
  expect(await screen.findByRole("spinbutton", { name: "Budget total en dollars" })).toHaveValue(4.5)
  expect(screen.getByRole("spinbutton", { name: "Nombre total d’appels autorisés" })).toHaveValue(7)
  expect(screen.getByRole("checkbox", { name: /local:animation/ })).toBeChecked()
  expect(screen.getByRole("button", { name: "Enregistrer le cadre du jeu" })).toBeDisabled()
})

test("retirer le dernier modèle ne transforme jamais la sélection en autorisation universelle", async () => {
  render(<DelegationDuJeu projet="jeu" onAtelier={() => {}} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: /ancien:reference/ }))
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le cadre du jeu" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Choisissez au moins un modèle")
  expect(travaux.reglerCadre).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole("combobox", { name: "Image de référence" }), { target: { value: "tous" } })
  fireEvent.click(screen.getByRole("button", { name: "Enregistrer le cadre du jeu" }))
  await waitFor(() => expect(travaux.reglerCadre).toHaveBeenCalledWith("jeu", expect.objectContaining({ modeles_image: [] })))
})

test("montre les vrais travaux agent et garde l’accès aux anciens réglages sans toucher au cadre", async () => {
  const agent = { identifiant: "demande-agent", acteur: "agent", etat: "externe_inconnu", raison: "Réponse externe perdue.",
    demande: { personnage: "pelerin", pose: "marche", direction: "ouest", modele_video: "video:moteur" },
    consommations: [{ cout_usd: 0.2 }], bandes: [], annonce: {} } as unknown as Travail
  vi.mocked(travaux.lister).mockResolvedValue([agent, { ...agent, acteur: "auteur", identifiant: "demande-humaine", demande: { ...agent.demande, personnage: "fait-à-la-main" } }])
  const ouvrir = vi.fn(), ancien = vi.fn()
  render(<DelegationDuJeu projet="jeu" onAtelier={ancien} onTravail={ouvrir} />)
  expect(await screen.findByText("Réponse externe perdue.")).toBeInTheDocument()
  expect(screen.queryByText(/fait-à-la-main/)).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir la demande" }))
  expect(ouvrir).toHaveBeenCalledWith(agent)
  fireEvent.click(screen.getByRole("button", { name: "Clés et anciens garde-fous de séance" }))
  expect(ancien).toHaveBeenCalledOnce()
  expect(travaux.reglerCadre).not.toHaveBeenCalled()
})

test("un échec de lecture ne présente aucun faux cadre enregistrable", async () => {
  vi.mocked(travaux.cadre).mockRejectedValueOnce(new Error("hors ligne"))
  render(<DelegationDuJeu projet="jeu" onAtelier={() => {}} />)
  await screen.findByRole("alert")
  expect(screen.queryByRole("button", { name: "Enregistrer le cadre du jeu" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
  expect(await screen.findByRole("spinbutton", { name: "Nombre total d’appels autorisés" })).toHaveValue(20)
})
