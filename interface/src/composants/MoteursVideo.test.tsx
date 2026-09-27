// MO3 · La section « Vidéo » de la page « Moteurs » — `fetch` doublé.
//
// Les trois sources (Wan, un workflow importé, OpenRouter) dans la même carte,
// lues sur la forme commune du catalogue : capacités, état, et le bouton ou la
// phrase qui convient. Ce que la carte montre ne dépend pas de la demande : un
// moteur grisé pour une durée reste « Installé ».

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, type ModeleVideo } from "../api"
import { SectionMoteursVideo } from "./MoteursVideo"

const base = {
  resolutions: ["480p"], proportions: ["1:1"], images_par_seconde: 0, duree_conseillee: 0, raison_de_la_duree: "",
  images_par_duree: {}, mesure: "", options: {}, attente: null, grise: null,
}
const wan: ModeleVideo = { ...base, identifiant: "maison/wan", nom: "Wan 2.2 pixel", fournisseur: "Maison", durees: [1, 1.5, 2, 3], de_la_maison: true,
  source: "maison", capacites: { image_de_depart: "obligatoire", image_de_fin: true, durees: [1, 1.5, 2, 3] },
  cout: { unite: "temps", libelle: "gratuit" }, etat: { code: "a_installer", raison: "il manque 26 Go de modèles" },
  prix: { montant: 0, nature: "certain", releve_le: null, formule: "gratuit" } }
const finit: ModeleVideo = { ...base, identifiant: "ComfyUI:flf@v1", nom: "Première et dernière image", fournisseur: "ComfyUI", durees: [5], de_la_maison: true,
  source: "workflow", capacites: { image_de_depart: "obligatoire", image_de_fin: true, durees: [5] },
  cout: { unite: "temps", libelle: "Gratuit — workflow local" }, etat: { code: "pret", raison: null },
  prix: { montant: 0, nature: "certain", releve_le: null, formule: "gratuit" } }
const libre: ModeleVideo = { ...finit, identifiant: "ComfyUI:libre@v1", nom: "Image vers vidéo", capacites: { image_de_depart: "obligatoire", image_de_fin: false, durees: [5] } }
const seedance: ModeleVideo = { ...base, identifiant: "OpenRouter:bytedance/seedance-2.0-mini", nom: "Seedance 2.0 Mini", fournisseur: "OpenRouter", durees: [5, 10], de_la_maison: false,
  source: "en_ligne", capacites: { image_de_depart: "obligatoire", image_de_fin: true, durees: [5, 10] },
  cout: { unite: "usd", libelle: "video_seconds_480p" }, etat: { code: "cle_manquante", raison: "aucune clé OpenRouter" },
  prix: { montant: 0.3, nature: "estimation", releve_le: null, formule: "5 s" }, grise: "aucune clé OpenRouter" }

beforeEach(() => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [wan, finit, libre, seedance] } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const carte = async (nom: string) => (await screen.findByText(nom)).closest("article")!

test("les trois sources entrent sur la page, chacune avec ce qu'elle sait faire", async () => {
  render(<SectionMoteursVideo />)
  screen.getByRole("heading", { name: "Vidéo" })
  const cWan = await carte("Wan 2.2 pixel")
  expect(cWan).toHaveTextContent("Animer une image")
  expect(cWan).toHaveTextContent("Finir sur une image")
  expect(cWan).toHaveTextContent("1 s, 1,5 s, 2 s, 3 s")
  expect(cWan).toHaveTextContent("Sur cette machine")
  // Un workflow importé qui relie une image de fin le dit ; l'autre non.
  const cFinit = await carte("Première et dernière image")
  expect(cFinit).toHaveTextContent("Workflow importé, sur cette machine")
  expect(cFinit).toHaveTextContent("Finir sur une image")
  expect(cFinit).toHaveTextContent("Installé")
  const cLibre = await carte("Image vers vidéo")
  expect(cLibre).toHaveTextContent("Animer une image")
  expect(cLibre).not.toHaveTextContent("Finir sur une image")
  const cSeedance = await carte("Seedance 2.0 Mini")
  expect(cSeedance).toHaveTextContent("En ligne")
  expect(cSeedance).toHaveTextContent("payant")
})

test("chaque état a son badge et le geste qui convient — l'installation pour Wan, la clé pour le payant", async () => {
  const onInstallation = vi.fn()
  render(<SectionMoteursVideo onInstallation={onInstallation} />)
  const cWan = await carte("Wan 2.2 pixel")
  expect(cWan).toHaveTextContent("À installer")
  expect(cWan).toHaveTextContent("il manque 26 Go de modèles")
  fireEvent.click(within(cWan).getByRole("button", { name: "Ouvrir l’installation" }))
  expect(onInstallation).toHaveBeenCalledOnce()
  const cSeedance = await carte("Seedance 2.0 Mini")
  expect(cSeedance).toHaveTextContent("Clé manquante")
  expect(cSeedance).toHaveTextContent("aucune clé OpenRouter")
  expect(cSeedance).toHaveTextContent("Les fournisseurs")
  expect(within(cSeedance).queryByRole("button")).toBeNull()
  // Un moteur prêt n'a rien à faire ici.
  expect(within(await carte("Première et dernière image")).queryByRole("button")).toBeNull()
})

test("le grisé d'une demande ne rend pas un moteur indisponible sur la page", async () => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [{ ...finit, grise: "ne fait pas de clip de 1,5 s — seulement 5 s" }] } as never)
  render(<SectionMoteursVideo />)
  const c = await carte("Première et dernière image")
  expect(c).toHaveTextContent("Installé")
  expect(c).not.toHaveTextContent("ne fait pas de clip")
})

test("une liste illisible se dit, sans casser le reste de la page", async () => {
  vi.spyOn(api, "modelesVideo").mockRejectedValue(new Error("l'atelier ne répond pas"))
  render(<SectionMoteursVideo />)
  expect(await screen.findByText(/La liste des moteurs vidéo n’a pas pu être lue : l'atelier ne répond pas/)).toBeInTheDocument()
})
