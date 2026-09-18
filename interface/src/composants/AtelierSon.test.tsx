import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, test, vi } from "vitest"
import { AtelierSon } from "./AtelierSon"
import { livraisonSon } from "../api-livraison-son"
import { sons, type Son } from "../api-sons"

const recetteDeBase = {
  debut: .2, fin: 1.2, rogner_silence: false, seuil_silence_db: -45, marge_silence_ms: 10,
  fondu_entree_ms: 17, fondu_sortie_ms: 21, normaliser: true, cible_db: -3, gain_db: -2, taux: 22050,
  boucle: true, boucle_debut: .1, boucle_fin: .8, boucle_zero: false, boucle_fondu_ms: 0,
  mono: false, cible_lufs: null, hauteur_demi_tons: 0, hauteur_garde_duree: false,
}
const son: Son = {
  identifiant: "son1", projet: "jeu", nom: "Épée", revision: 2, revision_courante: 2,
  etat: "prete", pret: true, raison: "", jugement: "retenue",
  source: { nom: "source.wav", empreinte: "sha", octets: 64000, mesures: { duree: 2, taux: 16000, canaux: 2, echantillons: 32000, crete_db: -4, rms_db: -6, silencieux: false, ecretes: 0 } },
  provenance: { nature: "import" }, recette: recetteDeBase,
  famille: "bruitage", avertissements: [], recette_proposee: null,
  mesures: { duree: 1, taux: 22050, canaux: 2, echantillons: 22050, crete_db: -5, rms_db: -6, silencieux: false, ecretes: 0, boucle: { active: true, debut: 2205, fin: 17640, ecart_raccord: 0, verdict: "raccord net" } },
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
  expect(await screen.findByRole("img", { name: "Forme d’onde · canal 2" })).toBeTruthy()
  expect(document.querySelector("audio[src*='preview.wav']")?.getAttribute("src")).toContain("revision=2")
  fireEvent.click(screen.getByLabelText("Écouter la source"))
  await waitFor(() => expect(document.querySelector("audio[src*='preview.wav']")?.getAttribute("src")).toContain("brut=true"))
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
  await waitFor(() => expect(document.querySelector("audio[src*='preview.wav']")?.getAttribute("src")).toContain("revision=3"))
})

test("un retour illisible reste visible avec sa source, sans livraison disponible", async () => {
  monter({ ...son, pret: false, etat: "a_verifier", raison: "Fichier audio illisible", mesures: null })
  expect(await screen.findByText("Fichier audio illisible")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Relire la livraison Godot" })).toHaveProperty("disabled", true)
  fireEvent.click(screen.getByText("Source et provenance"))
  expect(screen.getByRole("link", { name: "Télécharger la source intacte" }).getAttribute("href")).toContain("/sounds/son1/source")
})

test("les avertissements s’affichent sans bloquer, et un son saturé se livre quand même", async () => {
  monter({ ...son, avertissements: ["Le rendu sature. Baissez le gain ou le niveau cible pour l'éviter."] })
  expect(await screen.findByText(/Le rendu sature/)).toBeTruthy()
  expect(screen.getByRole("button", { name: "Relire la livraison Godot" })).toHaveProperty("disabled", false)
})

test("un son sans famille propose de la poser, et le dit clairement", async () => {
  const classer = vi.spyOn(sons, "classer").mockResolvedValue({ ...son, famille: "ambiance" })
  monter({ ...son, famille: null })
  expect(await screen.findByText(/sans famille, ce son se livre à l’ancienne/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Poser une famille" }))
  fireEvent.click(screen.getByRole("button", { name: "Ambiance" }))
  await waitFor(() => expect(classer).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "son1" }), "ambiance"))
})

test("appliquer les réglages de la famille rappelle la route de classement", async () => {
  const classer = vi.spyOn(sons, "classer").mockResolvedValue(son)
  monter({ ...son, recette_proposee: { ...recetteDeBase, mono: true } })
  fireEvent.click(await screen.findByRole("button", { name: "Appliquer les réglages de la famille" }))
  await waitFor(() => expect(classer).toHaveBeenCalledWith(expect.objectContaining({ identifiant: "son1" }), "bruitage", true))
})

test("le niveau perçu (LUFS) ne s’affiche que pour les familles qui l’utilisent", async () => {
  monter({ ...son, famille: "bruitage", mesures: { ...son.mesures!, lufs: -20 } })
  await screen.findByLabelText("Fondu d’entrée (ms)")
  expect(screen.queryByText(/LUFS/)).toBeNull()
  cleanup()
  monter({ ...son, famille: "ambiance", mesures: { ...son.mesures!, lufs: -20 } })
  await screen.findByLabelText("Fondu d’entrée (ms)")
  expect(screen.getByText(/−20.0 LUFS|-20.0 LUFS/)).toBeTruthy()
})

test("écouter le raccord joue loop-splice.wav en boucle", async () => {
  monter()
  await screen.findByLabelText("Fondu d’entrée (ms)")
  const bouton = screen.getByRole("button", { name: "▶ Écouter le raccord" })
  const audio = document.querySelector("audio[src*='loop-splice.wav']") as HTMLAudioElement
  expect(audio).toBeTruthy()
  expect(audio.loop).toBe(true)
  const jouer = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
  fireEvent.click(bouton)
  expect(jouer).toHaveBeenCalled()
  expect(await screen.findByRole("button", { name: "■ Arrêter" })).toBeTruthy()
})

test("relire la livraison Godot ouvre l’aperçu réutilisable, avec credits.json visible et les .import repliés", async () => {
  monter()
  vi.spyOn(livraisonSon, "deSon").mockResolvedValue({
    jeton: "jeton-1", projet: "jeu", personnage: null, revision: "2", dossier: "marais/sons",
    fichiers: [
      { chemin: "sfx_epee.wav", role: "audio", etat: "nouveau", empreinte: "a", octets: 100 },
      { chemin: "sfx_epee.wav.import", role: "import", etat: "nouveau", empreinte: "b", octets: 10 },
      { chemin: "credits.json", role: "credits", etat: "nouveau", empreinte: "c", octets: 20 },
    ],
    pret: true, conflits: [], scene: "son.tscn", sprite_frames: null, animations: [],
  })
  await screen.findByLabelText("Fondu d’entrée (ms)")
  fireEvent.click(screen.getByRole("button", { name: "Relire la livraison Godot" }))
  expect(await screen.findByText("sfx_epee.wav · nouveau")).toBeTruthy()
  expect(screen.getByText(/credits.json · d’où vient chaque son/)).toBeTruthy()
  expect(screen.getByText("sfx_epee.wav.import")).not.toBeVisible()
  fireEvent.click(screen.getByText(/Tous les fichiers · 3/))
  expect(screen.getByText("sfx_epee.wav.import")).toBeTruthy()
})
