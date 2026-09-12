import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { AtelierSon } from "./AtelierSon"
import { sons, type Son } from "../api-sons"

const son: Son = {
  identifiant: "son1", projet: "jeu", nom: "Épée", revision: 2, revision_courante: 2,
  etat: "prete", pret: true, raison: "", jugement: "retenue", source: { nom: "source.wav", empreinte: "sha", octets: 64000, mesures: { duree: 2, taux: 16000, canaux: 2, echantillons: 32000, crete_db: -4, rms_db: -6, silencieux: false, ecretes: 0 } },
  provenance: { nature: "import" }, recette: { debut: .2, fin: 1.2, rogner_silence: false, seuil_silence_db: -45, marge_silence_ms: 10, fondu_entree_ms: 17, fondu_sortie_ms: 21, normaliser: true, cible_db: -3, gain_db: -2, taux: 22050, boucle: true, boucle_debut: .1, boucle_fin: .8 },
  mesures: { duree: 1, taux: 22050, canaux: 2, echantillons: 22050, crete_db: -5, rms_db: -6, silencieux: false, ecretes: 0, boucle: { active: true, debut: 2205, fin: 17640, ecart_raccord: 0 } },
  versions: [{ revision: 2, nom: "Épée", pret: true, jugement: "retenue", mesures: null }, { revision: 1, nom: "Épée", pret: true, jugement: "a-juger", mesures: null }],
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function monter(valeur = son) {
  vi.spyOn(sons, "lister").mockResolvedValue([valeur])
  vi.spyOn(sons, "lire").mockResolvedValue(valeur)
  vi.spyOn(sons, "onde").mockResolvedValue({ duree: 1, taux: 22050, canaux: 2, canaux_ondes: [{ minimum: [-.2, -.3], maximum: [.3, .2] }, { minimum: [-.3, -.2], maximum: [.2, .3] }] })
  return render(<AtelierSon projet="jeu" identifiantInitial="son1" />)
}

test("réouvrir un son retrouve ses vrais réglages, sa stéréo et le WAV de cette version", async () => {
  monter()
  expect(await screen.findByLabelText("Fondu d’entrée (ms)")).toHaveProperty("value", "17")
  expect(screen.getByLabelText("Fondu de sortie (ms)")).toHaveProperty("value", "21")
  expect(screen.getByLabelText("Jugement du son")).toHaveProperty("value", "retenue")
  expect(screen.getByLabelText("Fréquence de sortie")).toHaveProperty("value", "22050")
  expect(await screen.findByRole("img", { name: "Forme d’onde · canal 2" })).toBeTruthy()
  expect(document.querySelector("audio")?.getAttribute("src")).toContain("revision=2")
  fireEvent.click(screen.getByLabelText("Écouter la source"))
  await waitFor(() => expect(document.querySelector("audio")?.getAttribute("src")).toContain("brut=true"))
})

test("modifier un son bloque la livraison jusqu’à la nouvelle version conservée", async () => {
  monter()
  const regler = vi.spyOn(sons, "regler").mockResolvedValue({ ...son, revision: 3, revision_courante: 3, recette: { ...son.recette, gain_db: -4 } })
  await screen.findByLabelText("Fondu d’entrée (ms)")
  fireEvent.change(screen.getByLabelText("Gain (dB) · curseur"), { target: { value: "-4" } })
  expect(screen.getByRole("button", { name: "Relire la livraison Godot" })).toHaveProperty("disabled", true)
  expect(regler).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Conserver une version" }))
  await waitFor(() => expect(regler).toHaveBeenCalledWith(son, expect.objectContaining({ gain_db: -4, fondu_entree_ms: 17 }), "Épée"))
  await waitFor(() => expect(document.querySelector("audio")?.getAttribute("src")).toContain("revision=3"))
})

test("un retour illisible reste visible avec sa source, sans livraison disponible", async () => {
  monter({ ...son, pret: false, etat: "a_verifier", raison: "Fichier audio illisible", mesures: null })
  expect(await screen.findByText("Fichier audio illisible")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Relire la livraison Godot" })).toHaveProperty("disabled", true)
  fireEvent.click(screen.getByText("Source et provenance"))
  expect(screen.getByRole("link", { name: "Télécharger la source intacte" }).getAttribute("href")).toContain("/sounds/son1/source")
})
