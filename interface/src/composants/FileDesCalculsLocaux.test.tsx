import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { fileLocale, type EtapeLocale } from "../api-file-locale"
import { FileDesCalculsLocaux } from "./FileDesCalculsLocaux"

const etape = (champs: Partial<EtapeLocale>): EtapeLocale => ({ identifiant: "etape", cle: "cle", projet: "jeu", acteur: "auteur", nature: "video", moteur: "local", modele: "Comfy:video", etat: "en_attente", travail_externe: null, raison: "En attente de son tour.", soumission_engagee: false, cree_le: 123, demarre_le: null, termine_le: null, duree_s: null, temperature: "inconnue", ...champs })
beforeEach(() => {
  vi.spyOn(fileLocale, "lire").mockResolvedValue({ etapes: [], regle: "Une étape à la fois.", mesures: [] })
  vi.spyOn(fileLocale, "moteurs").mockResolvedValue({ moteurs: [{ identifiant: "local", nom: "ComfyUI", etat: "inconnu", raison: "Moteur non joignable.", travaux: [], observe_le: 123, annulation_ciblee: false }] })
  vi.spyOn(fileLocale, "reprendre").mockResolvedValue(etape({ etat: "en_cours" }))
  vi.spyOn(fileLocale, "annuler").mockResolvedValue(etape({ etat: "annule" }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

test("ouvrir le suivi n’envoie aucun calcul et garde le diagnostic inconnu", async () => {
  render(<FileDesCalculsLocaux projet="jeu" />)
  expect(await screen.findByText(/État inconnu/)).toBeTruthy()
  expect(screen.getByText(/Moteur non joignable/)).toBeTruthy()
  expect(fileLocale.reprendre).not.toHaveBeenCalled()
  expect(fileLocale.annuler).not.toHaveBeenCalled()
})

test("une reprise vise l’identifiant conservé et une acceptation inconnue n’offre pas de renvoi", async () => {
  vi.mocked(fileLocale.lire).mockResolvedValue({ etapes: [etape({ identifiant: "ancien", etat: "a_reprendre", travail_externe: "job-42", soumission_engagee: true }), etape({ identifiant: "inconnu", etat: "externe_inconnu", modele: "Comfy:image", soumission_engagee: true })], regle: "Une étape à la fois.", mesures: [] })
  render(<FileDesCalculsLocaux projet="jeu" />)
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre le suivi" }))
  await waitFor(() => expect(fileLocale.reprendre).toHaveBeenCalledExactlyOnceWith("ancien"))
  expect(screen.queryByRole("button", { name: "Annuler cette attente" })).toBeNull()
  const ligne = screen.getByText(/Envoi à vérifier/).closest("li")!
  expect(within(ligne).queryByRole("button")).toBeNull()
})

test("annuler ne concerne que l’attente sélectionnée", async () => {
  vi.mocked(fileLocale.lire).mockResolvedValue({ etapes: [etape({ identifiant: "attente" }), etape({ identifiant: "envoi", etat: "en_cours", soumission_engagee: true })], regle: "Une étape à la fois.", mesures: [] })
  render(<FileDesCalculsLocaux projet="jeu" />)
  fireEvent.click(await screen.findByRole("button", { name: "Annuler cette attente" }))
  await waitFor(() => expect(fileLocale.annuler).toHaveBeenCalledExactlyOnceWith("attente"))
})

test("historique et autres jeux restent consultables sans confondre durée et chargement", async () => {
  vi.mocked(fileLocale.lire).mockResolvedValue({ etapes: [etape({ projet: "autre", modele: "Comfy:3D", etat: "termine", duree_s: 81 })], regle: "Une étape à la fois.", mesures: [] })
  render(<FileDesCalculsLocaux projet="jeu" />)
  await screen.findByText(/Aucun calcul local/)
  expect(screen.queryByText(/Temps mesuré/)).toBeNull()
  fireEvent.click(screen.getByRole("checkbox", { name: "Tous les jeux" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Afficher les calculs terminés" }))
  expect(screen.getByText(/Temps mesuré : 1 min 21 s · chargement non connu/)).toBeTruthy()
})
