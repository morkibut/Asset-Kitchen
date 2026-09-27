// MO3 · « Faire une vidéo libre » et « 4. Le clip » proposent la même liste.
//
// Les deux écrans lisaient déjà `GET /clips/models`, mais l'un écrivait
// l'identifiant brut et l'autre le fournisseur et le nom : deux noms pour un
// même moteur. L'essai monte les deux écrans sur **la même réponse doublée** et
// compare ce qu'ils montrent, ligne pour ligne et groupe pour groupe — pas
// seulement la présence d'un nom attendu.

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { api, type ModeleVideo, type Personnage } from "../api"
import { workflows } from "../api-workflows"
import { ChoixModeleVideo } from "./ChoixModeleVideo"
import { FabricationSuivie } from "./FabricationSuivie"
import { FabricationVideoLibre } from "./FabricationVideoLibre"

const base = {
  resolutions: ["480p"], proportions: ["1:1"], images_par_seconde: 0, duree_conseillee: 0, raison_de_la_duree: "",
  images_par_duree: {}, mesure: "", options: {}, attente: null, grise: null,
}
const wan: ModeleVideo = { ...base, identifiant: "maison/wan", nom: "Wan 2.2 pixel", fournisseur: "Maison", durees: [1, 1.5], de_la_maison: true,
  source: "maison", capacites: { image_de_depart: "obligatoire", image_de_fin: true, durees: [1, 1.5] }, etat: { code: "pret", raison: null },
  prix: { montant: 0, nature: "certain", releve_le: null, formule: "gratuit" } }
const importe: ModeleVideo = { ...base, identifiant: "ComfyUI:flf@v1", nom: "Première et dernière image", fournisseur: "ComfyUI", durees: [1.5], de_la_maison: true,
  source: "workflow", capacites: { image_de_depart: "obligatoire", image_de_fin: true, durees: [1.5] }, etat: { code: "pret", raison: null },
  prix: { montant: 0, nature: "certain", releve_le: null, formule: "gratuit" } }
const seedance: ModeleVideo = { ...base, identifiant: "OpenRouter:bytedance/seedance-2.0-mini", nom: "Seedance 2.0 Mini", fournisseur: "OpenRouter", durees: [5], de_la_maison: false,
  source: "en_ligne", capacites: { image_de_depart: "obligatoire", image_de_fin: false, durees: [5] }, etat: { code: "pret", raison: null },
  prix: { montant: 0.3, nature: "estimation", releve_le: null, formule: "5 s" }, grise: "ne fait pas de clip de 1,5 s — seulement 5 s" }
const LISTE = [wan, importe, seedance]

const personnage = { identifiant: "pelerin", nom: "Pèlerin", type: "personnage", ecartees: [], plan: [{ identifiant: "marche", nom: "Marche" }], cases: [{ pose: "marche", directions: [{ identifiant: "sud", nom: "Sud" }] }] } as unknown as Personnage

beforeEach(() => {
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: LISTE } as never)
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [], habitues: { gratuits: [], payants: [] } } as never)
  vi.spyOn(api, "etatDuMoteur").mockRejectedValue(new Error("hors de cet essai"))
  vi.spyOn(api, "mouvements").mockResolvedValue({ mouvements: [], masques: [] })
  vi.spyOn(api, "mouvementDeLaPose").mockRejectedValue(new Error("hors de cet essai"))
  vi.spyOn(api, "imageDeDepart").mockResolvedValue({ cases: [] })
  vi.spyOn(workflows, "lister").mockResolvedValue({ profils: [] } as never)
})
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks() })

/** Ce que le `<select>` du modèle montre : ses groupes, et dans chacun ses lignes. */
function ceQuiSeLit() {
  const select = screen.getByLabelText("Fournisseur et modèle") as HTMLSelectElement
  return [...select.querySelectorAll("optgroup")].map((g) => ({
    groupe: g.label,
    lignes: [...g.querySelectorAll("option")].map((o) => ({ texte: o.textContent, grise: o.disabled })),
  }))
}

test("les deux écrans qui font une vidéo montrent la même liste, mêmes noms et mêmes groupes", async () => {
  render(<FabricationVideoLibre projet="jeu" onClip={vi.fn()} />)
  await screen.findByRole("option", { name: /Seedance 2.0 Mini/ })
  const libre = ceQuiSeLit()
  cleanup()

  render(<FabricationSuivie projet="jeu" personnages={[personnage]} onClip={() => {}} onFermer={() => {}} />)
  await screen.findByRole("option", { name: /Seedance 2.0 Mini/ })
  const clip = ceQuiSeLit()

  expect(libre).toEqual(clip)
  expect(libre).toEqual([
    { groupe: "Sur cette machine", lignes: [
      { texte: "Maison · Wan 2.2 pixel · local", grise: false },
      { texte: "ComfyUI · Première et dernière image · local", grise: false },
    ] },
    { groupe: "En ligne", lignes: [
      { texte: "OpenRouter · Seedance 2.0 Mini — ne fait pas de clip de 1,5 s — seulement 5 s", grise: true },
    ] },
  ])
})

test("un modèle gardé dans la demande mais sorti du catalogue le dit, au lieu de laisser la ligne vide", () => {
  const onChange = vi.fn()
  render(<label>Fournisseur et modèle<ChoixModeleVideo modeles={LISTE} valeur="ComfyUI:disparu@v1" onChange={onChange} vide="Choisir…" absent="modèle indisponible" /></label>)
  const select = screen.getByLabelText("Fournisseur et modèle")
  expect(select).toHaveValue("ComfyUI:disparu@v1")
  expect(screen.getByRole("option", { name: "modèle indisponible" })).toBeDisabled()
  fireEvent.change(select, { target: { value: importe.identifiant } })
  expect(onChange).toHaveBeenCalledWith(importe.identifiant)
})

test("sans source déclarée (un serveur d'avant MO3), le groupe se déduit de la carte de la maison", () => {
  const ancien = { ...wan, source: undefined }
  render(<label>Fournisseur et modèle<ChoixModeleVideo modeles={[ancien, { ...seedance, source: undefined }]} valeur="" onChange={() => {}} vide="Choisir…" /></label>)
  expect(ceQuiSeLit().map((g) => g.groupe)).toEqual(["Sur cette machine", "En ligne"])
})
