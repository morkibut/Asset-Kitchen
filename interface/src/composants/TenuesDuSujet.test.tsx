import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { api, type Personnage, type VestiaireDuJeu } from "../api"
import { tenues, type Tenue } from "../api-tenues"
import { TenuesDuSujet } from "./TenuesDuSujet"

const personnage = { identifiant: "pelerin", projet: "marais", nom: "Pèlerin", plan: [{ identifiant: "marche", nom: "Marche" }], cases: [{ pose: "marche", images: [], bandes: [{ identifiant: "bande", pose: "marche", direction: "sud", nom: "Pas lent", compte: 3, cadence: 3, case_largeur: 48, case_hauteur: 48, favori: true, sens: "boucle" }] }] } as unknown as Personnage
const vestiaire = { pieces: [{ piece: { identifiant: "casque", nom: "Casque" }, emplois: [{ identifiant: "emploi", genre: "porte", porteur: "pelerin" }] }] } as unknown as VestiaireDuJeu
const emploi = { piece: "casque", emploi: "emploi", nom: "Casque", actif: true, priorite: 7 }
const t: Tenue = { identifiant: "tenue", projet: "marais", personnage: "pelerin", nom: "Voyage de nuit", revision: 2, revisions: [1, 2], cree_le: 12, modifie_le: 15, pivot: { x: 11, y: 43 },
  demande: { nom: "Voyage de nuit", resultats: [{ nature: "animation", identifiant: "bande", boucle: false }], emplois: [emploi] }, emplois: [emploi],
  sorties: [{ cle: "animation:bande", nature: "animation", resultat: "bande", titre: "Pas lent", pose: "marche", direction: "sud", cadence: 3, sens: "boucle", boucle: false, ordre: [0, 1, 2], frames: [0, 1, 2].map(i => ({ cle: "hash-" + i, cible: { nature: "frame", resultat: "bande", prise: "prise-" + i }, base: { cadre: { largeur: 48, hauteur: 48 }, repere: { x: 11, y: 43 } }, calques: [{ piece: "casque", emploi: "emploi", variante: "calque-" + i, revision: 4, raison: "" }] })) }], couverture: { images: 3, prete: true, toutes_couches_pretes: true, difficultes: [] } }

beforeEach(() => {
  vi.spyOn(tenues, "lister").mockResolvedValue([t])
  vi.spyOn(tenues, "creer").mockImplementation(async (_p, _c, demande) => ({ ...t, demande, nom: demande.nom, emplois: demande.emplois }))
  vi.spyOn(tenues, "regler").mockImplementation(async (ancienne, demande) => ({ ...ancienne, demande, revision: ancienne.revision + 1, emplois: demande.emplois, nom: demande.nom }))
  vi.spyOn(tenues, "lire").mockImplementation(async (_p, _c, _id, r) => ({ ...t, revision: r ?? 2 }))
  vi.spyOn(tenues, "restaurer").mockResolvedValue({ ...t, revision: 3, revisions: [1, 2, 3] })
  vi.spyOn(api, "livrerGodot").mockResolvedValue({} as never)
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["image"], { type: "image/png" }), { status: 200 })))
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:tenue")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

test("créer une tenue choisit une vraie version sans fabrication ni livraison implicite", async () => {
  render(<TenuesDuSujet personnage={personnage} vestiaire={vestiaire} />)
  fireEvent.click(screen.getByRole("button", { name: "Composer une tenue" }))
  fireEvent.change(screen.getByLabelText("Nom de la tenue"), { target: { value: "Départ" } })
  fireEvent.change(screen.getByLabelText("Version animation:marche:sud"), { target: { value: "bande" } })
  fireEvent.click(screen.getByRole("button", { name: "Conserver la tenue" }))
  await waitFor(() => expect(tenues.creer).toHaveBeenCalledOnce())
  expect(vi.mocked(tenues.creer).mock.calls[0]).toEqual(["marais", "pelerin", expect.objectContaining({ nom: "Départ", resultats: [{ nature: "animation", identifiant: "bande", boucle: true }], emplois: [expect.objectContaining({ piece: "casque", emploi: "emploi" })] })])
  expect(api.livrerGodot).not.toHaveBeenCalled()
})

test("retirer une pièce pendant la lecture prépare la combinaison nue et exige de la conserver avant livraison", async () => {
  render(<TenuesDuSujet personnage={personnage} vestiaire={vestiaire} />)
  fireEvent.click(await screen.findByRole("button", { name: /Voyage de nuit/ }))
  await screen.findByAltText(/Tenue Voyage de nuit, frame/)
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("checkbox", { name: "Casque" }))
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => new URL(String(url), "http://localhost").searchParams.get("actifs") === "[]")).toBe(true))
  expect(screen.getByRole("button", { name: "Relire les couches pour Godot" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Priorité de Casque"), { target: { value: "-3" } })
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => new URL(String(url), "http://localhost").searchParams.get("priorites") === '{"casque":-3}')).toBe(true))
  fireEvent.click(screen.getByRole("button", { name: "Conserver la tenue" }))
  await waitFor(() => expect(tenues.regler).toHaveBeenCalledWith(t, expect.objectContaining({ emplois: [{ ...emploi, actif: false, priorite: -3 }], pivot: { x: 11, y: 43 } })))
})

test("une correction revient au calque de l’occurrence affichée", async () => {
  const ouvrir = vi.fn()
  render(<TenuesDuSujet personnage={personnage} vestiaire={vestiaire} onEmploi={ouvrir} />)
  fireEvent.click(await screen.findByRole("button", { name: /Voyage de nuit/ }))
  await screen.findByAltText(/Tenue Voyage de nuit, frame/)
  fireEvent.change(screen.getByRole("slider", { name: "Frame de la tenue" }), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("button", { name: "Corriger" }))
  expect(ouvrir).toHaveBeenCalledWith("casque", "emploi", { nature: "frame", resultat: "bande", prise: "prise-2" }, "calque-2")
})

test("une ancienne révision se relit sans remplacer la courante puis se restaure explicitement", async () => {
  render(<TenuesDuSujet personnage={personnage} vestiaire={vestiaire} />)
  fireEvent.click(await screen.findByRole("button", { name: /Voyage de nuit/ }))
  fireEvent.change(screen.getByLabelText("Révision de la tenue"), { target: { value: "1" } })
  fireEvent.click(await screen.findByRole("button", { name: "Restaurer cette révision comme tenue courante" }))
  await waitFor(() => expect(tenues.restaurer).toHaveBeenCalledWith(expect.objectContaining({ revision: 1, revisions: [1, 2] })))
  expect(api.livrerGodot).not.toHaveBeenCalled()
})
