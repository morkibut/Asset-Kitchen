import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { FabricationAudio } from "./FabricationAudio"
import { SuiviDesTravaux, TravailConserve } from "./FabricationSuivie"
import { travauxAudio, type TravailAudio } from "../api-travaux-audio"
import { travaux } from "../api-travaux"
import { workflows, type ProfilWorkflow } from "../api-workflows"
import { ecoute, seriesSon, texteSon, type Annonce, type Composition } from "../api-series-son"
import { sfxr } from "../api-sfxr"
import { partitionSon } from "../api-partition-son"
import { serie, tirageRendu } from "../son-essais"

vi.mock("../api-travaux-audio", () => ({ travauxAudio: { preparer: vi.fn(), lire: vi.fn(), lancer: vi.fn() } }))
vi.mock("../api-workflows", () => ({ workflows: { lister: vi.fn() } }))
vi.mock("../api-series-son", () => ({
  texteSon: { composer: vi.fn(), moteurs: vi.fn() },
  seriesSon: { annoncer: vi.fn(), preparer: vi.fn(), demarrer: vi.fn(), lire: vi.fn(), reprendre: vi.fn(), garder: vi.fn(), lister: vi.fn() },
  jeuxDeVariantes: { lire: vi.fn(), renommer: vi.fn(), lister: vi.fn(), creer: vi.fn(), ajouter: vi.fn(), retirer: vi.fn() },
  ecoute: { onde: vi.fn(), adresse: (p: string, id: string, r: number) => `/api/projects/${p}/sounds/${id}/preview.wav?revision=${r}&brut=false` },
}))
vi.mock("../api-partition-son", () => ({ partitionSon: { ecrire: vi.fn(), lire: vi.fn() } }))
vi.mock("../api-sfxr", async (original) => ({ ...(await original<typeof import("../api-sfxr")>()), sfxr: { departs: vi.fn(), fabriquer: vi.fn(), variantes: vi.fn() } }))

const profil: ProfilWorkflow = {
  identifiant: "sa3-small-sfx", nom: "Stable Audio 3 Small-SFX", nature: "audio", version: "1", modele: "ComfyUI:sa3-small-sfx@1",
  cree_le: 1000, description: "", graphe: {}, liaisons: { prompt: [], secondes: [], graine: [] },
  parametres: {}, formats: [], durees: [], cadence: 0, references_min: 0, references_max: 0, sortie: { noeud: "5", champ: "audio" },
}
const t: TravailAudio = {
  nature: "audio", identifiant: "conserve", projet: "jeu", cle: "cle", acteur: "auteur", etat: "prepare", etape: "relecture", cree_le: 1000,
  demande: { cle: "cle", modele: profil.modele, prompt: "Une lame quitte le cuir.", prompt_negatif: "Sans voix", nom: "Épée divine", secondes: 2.5, options: { seed: 357 } },
  snapshot_audio: { prompt: "Une lame quitte le cuir.", prompt_negatif: "Sans voix", secondes: 2.5, options: { seed: 357 } },
  son: null, reference_asset: null, clip: null, bandes: [], references: [], consommations: [], prochaine_action: "demarrer",
  annonce: { appels: 1, reservation_usd: 0, limite: "Calcul local. Le temps demandé est celui du son.", mesures: [] },
}
const compo = (prompt: string, o: Partial<Composition> = {}): Composition => ({
  famille: "bruitage", moteur: "sa3-small-sfx", gabarit: "sa3-bruitage", compose: true, modele: profil.modele, relu: false,
  texte: `TrackType: SFX. ${prompt}, medieval fantasy, one-shot, close-mic'd, dry, no reverb, isolated.`,
  morceaux: [{ texte: "TrackType: SFX.", source: "gabarit" }, { texte: prompt, source: "description" }, { texte: "medieval fantasy", source: "univers" }, { texte: "one-shot, close-mic'd, dry, no reverb, isolated", source: "gabarit" }],
  texte_negatif: "", morceaux_negatif: [], secondes: 1, source_secondes: "demande", mesures: null, parametres: {},
  langue: { non_anglais: /[éèà]/.test(prompt), indices: [] }, ...o,
})
const annonce = (temps: number | null): Annonce => ({ nombre: 8, famille: "bruitage", modele: profil.modele, graine_par_tirage: true, annonce: { temps_s: temps, mesures: 3, cout_usd: 0, phrase: "" }, composition: null })

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear()
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined) as unknown as HTMLMediaElement["play"]
  HTMLMediaElement.prototype.pause = vi.fn()
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil] })
  vi.mocked(texteSon.moteurs).mockResolvedValue({ familles: {
    bruitage: { famille: "bruitage", modele: profil.modele, moteur: "sa3-small-sfx", possibles: ["sa3-small-sfx", "sa-open-1", "sa3-medium"] },
    musique: { famille: "musique", modele: null, moteur: null, raison: "Aucun moteur installé pour « musique » : ace-step-15-turbo, sa3-medium.", possibles: ["ace-step-15-turbo", "sa3-medium"] },
  } as never })
  // Comme ACE-Step et YuE2 : la relecture dit quels réglages de musique le moteur reçoit.
  const recus = { musique: ["paroles", "tempo", "tonalite", "mesure"], jingle: ["paroles", "tempo", "tonalite", "mesure"], chanson: ["paroles", "tempo"] } as const
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => compo(d.prompt, { reglages_recus: [...(recus[d.famille as keyof typeof recus] ?? [])] }))
  vi.mocked(seriesSon.annoncer).mockResolvedValue(annonce(42))
  vi.mocked(seriesSon.lister).mockResolvedValue([])
  vi.mocked(ecoute.onde).mockResolvedValue({ duree: 1, taux: 44100, canaux: 1, canaux_ondes: [{ minimum: [-0.5], maximum: [0.5] }] })
  vi.mocked(travauxAudio.lire).mockResolvedValue(t)
  vi.mocked(travauxAudio.lancer).mockResolvedValue({ ...t, etat: "termine", son: "son-recu" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const lancer = (nom: RegExp | string) => screen.findByRole("button", { name: nom })

test("une phrase, la relecture de ce qui part, et le bouton porte le temps annoncé", async () => {
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  const bouton = screen.getByRole("button", { name: /^Lancer 8 tirages/ })
  expect(bouton).toBeDisabled()
  expect(screen.getByText("Écris d’abord ce qu’on doit entendre.")).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Une épée sort du fourreau" } })
  const pret = await lancer("Lancer 8 tirages · environ 45 s")
  expect(pret).toBeEnabled()
  expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "bruitage", prompt: "Une épée sort du fourreau", secondes: 1 })
  expect(seriesSon.annoncer).toHaveBeenLastCalledWith("jeu", { famille: "bruitage", prompt: "Une épée sort du fourreau", secondes: 1, nombre: 8 })
  // Écrit en français : l'écran le dit, rien n'est traduit.
  expect(screen.getByText("Le moteur comprend l’anglais. Ce texte part tel quel, sans traduction.")).toBeInTheDocument()
  expect(screen.queryByLabelText("Texte composé")).toBeNull()

  fireEvent.click(screen.getByRole("button", { name: /^Relire avant l’envoi/ }))
  const relu = screen.getByLabelText("Texte composé")
  expect(within(relu).getByText("Une épée sort du fourreau")).toHaveClass("text-encre")
  expect(within(relu).getByText("medieval fantasy")).toHaveClass("text-encre-4")
  expect(within(relu).getByText("TrackType: SFX.")).toHaveClass("text-encre-4")
})

test("le texte relu à la main part tel quel ; lancer prépare puis démarre la série, qui arrive dans la grille", async () => {
  vi.mocked(seriesSon.preparer).mockImplementation(async (_p, d) => serie(Array.from({ length: d.nombre }, (_, i) => ({ rang: i + 1, travail: `t${i}`, graine: i, etat: "prepare" as const, raison: "", prochaine_action: "demarrer", son: null })), { etat: "preparee" }))
  vi.mocked(seriesSon.demarrer).mockResolvedValue(serie([tirageRendu(1), tirageRendu(2), tirageRendu(3), tirageRendu(4)]))
  vi.mocked(seriesSon.annoncer).mockImplementation(async (_p, d) => ({ ...annonce(d.nombre * 5), nombre: d.nombre }))
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Sword leaves a leather sheath" } })
  fireEvent.click(screen.getByRole("button", { name: /^Réglages/ }))
  fireEvent.click(within(screen.getByRole("group", { name: "Tirages" })).getByRole("button", { name: "4" }))
  fireEvent.click(within(screen.getByRole("group", { name: "Durée" })).getByRole("button", { name: "2 s" }))
  expect(screen.getByRole("button", { name: /^Réglages/ })).toHaveTextContent("2 s · 4 tirages")
  expect(await within(screen.getByRole("combobox", { name: "Fournisseur et modèle" })).findByRole("option", { name: /Stable Audio Open 1\.0 — pas installé sur cette machine/ })).toBeDisabled()

  fireEvent.click(screen.getByRole("button", { name: /^Relire avant l’envoi/ }))
  fireEvent.click(await screen.findByRole("button", { name: "Éditer ce texte ›" }))
  const manuel = screen.getByLabelText("Texte qui part")
  expect(manuel).toHaveValue(compo("Sword leaves a leather sheath").texte)
  fireEvent.change(manuel, { target: { value: "TrackType: SFX. Sword leaves a leather sheath, slow." } })
  expect(screen.getByRole("button", { name: /modifié à la main/ })).toBeInTheDocument()
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", expect.objectContaining({ texte_relu: "TrackType: SFX. Sword leaves a leather sheath, slow." })))

  const bouton = await lancer("Lancer 4 tirages · environ 20 s")
  bouton.focus()
  fireEvent.click(bouton)
  // Le bouton rend le focus : Espace écoutera un tirage, il ne relancera pas une série.
  expect(document.activeElement).not.toBe(bouton)
  await screen.findByRole("region", { name: "Série 1" })
  expect(seriesSon.preparer).toHaveBeenCalledWith("jeu", expect.objectContaining({ famille: "bruitage", prompt: "Sword leaves a leather sheath", secondes: 2, nombre: 4, texte_relu: "TrackType: SFX. Sword leaves a leather sheath, slow.", cle: expect.any(String) }))
  expect(seriesSon.demarrer).toHaveBeenCalledWith("jeu", "serie1")
  expect(await screen.findByRole("button", { name: "Écouter le tirage 4" })).toBeInTheDocument()
})

test("ce qui sera refusé n’est pas proposé : une erreur de relecture grise le bouton avec sa raison", async () => {
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => compo(d.prompt, { erreur: "Ce profil accepte une durée de 1 à 10 secondes ; la durée demandée est 30 s." }))
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Door creak" } })
  expect(await screen.findByText("Ce profil accepte une durée de 1 à 10 secondes ; la durée demandée est 30 s.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /^Lancer 8 tirages/ })).toBeDisabled()
  expect(seriesSon.annoncer).not.toHaveBeenCalled()
})

test("un moteur absent grise le lancement avec sa raison", async () => {
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => compo(d.prompt, { famille: "musique", modele: null, raison: "Le moteur « ace-step-15-turbo » n'est pas installé : installez les méthodes sonores." }))
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Musique" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Calm forest path at dawn" } })
  expect(await screen.findByText("Le moteur « ace-step-15-turbo » n'est pas installé : installez les méthodes sonores.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /^Lancer 4 tirages/ })).toBeDisabled()
})

test("la musique se règle en tempo, tonalité, mesure et nombre de mesures ; la durée se calcule", async () => {
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Musique" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Exploration, calm forest path" } })
  fireEvent.change(screen.getByLabelText("Tempo"), { target: { value: "120" } })
  fireEvent.change(screen.getByLabelText("Tonalité"), { target: { value: "D minor" } })
  fireEvent.change(screen.getByLabelText("Mesure"), { target: { value: "3" } })
  fireEvent.change(screen.getByLabelText("Nombre de mesures"), { target: { value: "8" } })
  expect(screen.getByText("12 s")).toBeInTheDocument()
  expect(screen.getByRole("option", { name: "ré mineur" })).toBeInTheDocument()
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "musique", prompt: "Exploration, calm forest path", mesures: 8, mesure: 3, tempo: 120, tonalite: "D minor" }))
})

test("une musique de bande originale : usage, structure, réglages du compositeur, graine et alerte de nappe", async () => {
  // Relevé « Univers musical » (10 octobre 2026) : tout ce qui faisait une nappe était figé ou caché.
  const ace: ProfilWorkflow = { ...profil, identifiant: "ace-step-15-turbo", nom: "ACE-Step 1.5 turbo", modele: "ComfyUI:ace@1",
    parametres: { langue: { genre: "choix", valeurs: ["en"], defaut: "en" }, compositeur: { genre: "booleen", defaut: true, nom: "Compositeur (1.7b)" },
      temperature: { genre: "intervalle", minimum: 0.1, maximum: 1.5, defaut: 0.85, nom: "Température" } } }
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [ace] })
  vi.mocked(texteSon.moteurs).mockResolvedValue({ familles: { musique: { famille: "musique", modele: ace.modele, moteur: "ace-step-15-turbo", possibles: ["ace-step-15-turbo"] } } as never })
  const usages = { titre: { nom: "Écran titre", description: "epic fantasy orchestral main theme", structure: "[Intro]\n[Chorus]", tempo: 78, mesure: 4, mesures: 40 } }
  ;(texteSon as unknown as { gabarits: () => Promise<unknown> }).gabarits = vi.fn().mockResolvedValue({ usages })
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => compo(d.prompt, { famille: "musique", reglages_recus: ["paroles", "tempo", "tonalite", "mesure"],
    parametres: { paroles: { valeur: d.paroles ?? "[Intro]\n[Chorus]", source: d.paroles ? "demande" : "usage" } },
    alertes: /drones/.test(d.prompt) ? ["Ces mots demandent une nappe plutôt qu'une musique : « drones »."] : [] }))
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Musique" }))
  fireEvent.click(within(screen.getByRole("group", { name: "Usage" })).getByRole("button", { name: "Écran titre" }))
  fireEvent.click(await screen.findByRole("button", { name: "Texte d’exemple" }))
  expect(screen.getByLabelText("Ce qu’on doit entendre")).toHaveValue("epic fantasy orchestral main theme")
  // L'usage donne ses 40 mesures ; elles ne partent pas, le serveur les tient de l'usage.
  expect(screen.getByLabelText("Nombre de mesures")).toHaveValue(40)
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "musique", prompt: "epic fantasy orchestral main theme", usage: "titre" }))
  expect(await screen.findByLabelText("Structure du morceau")).toHaveValue("[Intro]\n[Chorus]")
  fireEvent.change(screen.getByLabelText("Structure du morceau"), { target: { value: "[Intro]\n[Verse]\n[Chorus]" } })
  fireEvent.click(screen.getByLabelText("Compositeur (1.7b)"))
  expect(screen.getByText(/six fois plus rapide/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Température"), { target: { value: "1.1" } })
  fireEvent.change(screen.getByLabelText("Graine de départ"), { target: { value: "1000" } })
  await waitFor(() => expect(seriesSon.annoncer).toHaveBeenLastCalledWith("jeu", { famille: "musique", prompt: "epic fantasy orchestral main theme", usage: "titre",
    paroles: "[Intro]\n[Verse]\n[Chorus]", graine: 1000, options: { compositeur: false, temperature: 1.1 }, nombre: 4 }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "dark drones" } })
  expect(await screen.findByText(/demandent une nappe/)).toBeInTheDocument()
})

test("un moteur qui ne reçoit pas la mesure : elle ne part pas, se grise avec sa raison, et la boucle est celle du serveur", async () => {
  const medium: ProfilWorkflow = { ...profil, identifiant: "sa3-medium", nom: "Stable Audio 3 Medium", modele: "ComfyUI:sa3-medium@1" }
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil, medium] })
  vi.mocked(texteSon.moteurs).mockResolvedValue({ familles: {
    musique: { famille: "musique", modele: medium.modele, moteur: "sa3-medium", possibles: ["ace-step-15-turbo", "sa3-medium"] },
  } as never })
  // Stable Audio 3 : tempo et tonalité partent dans le texte ; une mesure envoyée serait refusée.
  vi.mocked(texteSon.composer).mockImplementation(async (_p, d) => {
    if (d.mesure != null || d.paroles != null) throw new Error("Le moteur ne reçoit pas de réglage « mesure » pour cette famille.")
    return compo(d.prompt, { famille: "musique", reglages_recus: ["tempo", "tonalite"], secondes: 18, source_secondes: "mesures", mesures: { demandees: 8, marge: 1, total: 9, source: "demande" } })
  })
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Musique" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Exploration, calm forest path" } })
  fireEvent.change(screen.getByLabelText("Tempo"), { target: { value: "120" } })
  fireEvent.change(screen.getByLabelText("Nombre de mesures"), { target: { value: "8" } })
  expect(await screen.findByText("Stable Audio 3 Medium ne reçoit pas de mesure : la boucle se compte en 4/4.")).toBeInTheDocument()
  expect(screen.getByLabelText("Mesure")).toBeDisabled()
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "musique", prompt: "Exploration, calm forest path", mesures: 8, tempo: 120 }))
  expect(await lancer("Lancer 4 tirages · environ 45 s")).toBeEnabled()
  // 18 s demandées pour 8 mesures et une de marge : la boucle en fait 16.
  expect(screen.getByText("16 s")).toBeInTheDocument()
})

test("un moteur installé mais incomplet se grise avec le fichier qui manque, jamais un nom de nœud", async () => {
  const open: ProfilWorkflow = { ...profil, identifiant: "sa-open-1", nom: "Stable Audio Open 1.0", modele: "ComfyUI:sa-open-1@1",
    diagnostic: { disponible: false, problemes: ["CheckpointLoaderSimple : stable-audio-open-1.0.safetensors introuvable"], noeuds: [], observe_le: 1, adresse: "",
      manque: [{ nom: "le modèle Stable Audio Open 1.0 (secours des bruitages)", fichier: "stable-audio-open-1.0.safetensors", dossier: "checkpoints", source: "" }] } }
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil, open] })
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: /^Réglages/ }))
  const liste = await screen.findByRole("combobox", { name: "Fournisseur et modèle" })
  await waitFor(() => expect(within(liste).getByRole("option", { name: "Cette machine · Stable Audio Open 1.0 — il manque le modèle Stable Audio Open 1.0 (secours des bruitages)" })).toBeDisabled())
  expect(within(liste).getByRole("option", { name: "Cette machine · Stable Audio 3 Medium — pas installé sur cette machine — voir Réglages › Moteurs" })).toBeDisabled()
  expect(liste).not.toHaveTextContent("CheckpointLoaderSimple")
})

test("chanson et jingle : deux familles derrière une puce ; la voix est à venir", async () => {
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  expect(screen.getByRole("button", { name: "Voix · à venir" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Chanson et jingle" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Victory fanfare" } })
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "jingle", prompt: "Victory fanfare", secondes: 4 }))
  fireEvent.click(screen.getByRole("button", { name: "Chanson" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Tavern song, male voice" } })
  fireEvent.change(screen.getByLabelText("Paroles"), { target: { value: "[Verse]\nPour the ale" } })
  await waitFor(() => expect(texteSon.composer).toHaveBeenLastCalledWith("jeu", { famille: "chanson", prompt: "Tavern song, male voice", paroles: "[Verse]\nPour the ale" }))
})

test("jouer la partition repart avec le style et les paroles qui l’ont écrite, et l’écran les montre", async () => {
  const yue2: ProfilWorkflow = { ...profil, identifiant: "yue2-partition-jouee", nom: "YuE2 — jouer la partition", modele: "ComfyUI:yue2-partition-jouee@1" }
  vi.mocked(workflows.lister).mockResolvedValue({ profils: [profil, yue2] })
  vi.mocked(partitionSon.ecrire).mockResolvedValue({ identifiant: "p1", projet: "jeu", prompt: "Tavern song", cree_le: 1,
    texte_compose: "Style écrit, 92 BPM", paroles: "", partition: "X:1\nK:C\nC|",
    pour_jouer: { famille: "chanson", modele: yue2.modele, prompt: "Tavern song", texte_relu: "Style écrit, 92 BPM", paroles: "", partition: "X:1\nK:C\nC|" } })
  vi.mocked(travauxAudio.preparer).mockResolvedValue(t)
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Chanson et jingle" }))
  fireEvent.click(screen.getByRole("button", { name: "Chanson" }))
  fireEvent.change(screen.getByLabelText("Ce qu’on doit entendre"), { target: { value: "Tavern song" } })
  fireEvent.change(screen.getByLabelText("Paroles"), { target: { value: "" } })
  const ecrire =await screen.findByRole("button", { name: "Écrire la partition" })
  await waitFor(() => expect(ecrire).toBeEnabled())
  fireEvent.click(ecrire)
  // Des paroles vides partent quand même : c'est ce que l'écran montre.
  await waitFor(() => expect(partitionSon.ecrire).toHaveBeenCalledWith("jeu", { prompt: "Tavern song", paroles: "" }))
  const ecrit = await screen.findByLabelText("Ce qui a écrit la partition")
  expect(within(ecrit).getByText("Style écrit, 92 BPM")).toBeInTheDocument()
  expect(within(ecrit).getByText("aucune")).toBeInTheDocument()
  // Des paroles retapées après coup ne partent pas avec cette partition.
  fireEvent.change(screen.getByLabelText("Paroles"), { target: { value: "[Verse]\nautre chose" } })
  fireEvent.click(screen.getByRole("button", { name: "Jouer cette partition" }))
  await waitFor(() => expect(travauxAudio.preparer).toHaveBeenCalled())
  expect(vi.mocked(travauxAudio.preparer).mock.calls[0][1]).toMatchObject({ famille: "chanson", modele: yue2.modele,
    prompt: "Tavern song", texte_relu: "Style écrit, 92 BPM", paroles: "", partition: "X:1\nK:C\nC|" })
})

test("interface et rétro : pas de phrase, des départs sfxr", async () => {
  vi.mocked(sfxr.departs).mockResolvedValue(["clic", "jump"])
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Interface et rétro" }))
  expect(await screen.findByRole("button", { name: "Saut" })).toBeInTheDocument()
  expect(screen.queryByLabelText("Ce qu’on doit entendre")).toBeNull()
  expect(screen.getByRole("button", { name: "Tirer 8 variantes" })).toBeEnabled()
})

test("rouvert depuis le suivi, un tirage montre sa série ; « Reprendre » la reprend", async () => {
  const tirage: TravailAudio = { ...t, identifiant: "t2", etat: "a_reprendre", serie: { identifiant: "serie1", rang: 2 }, demande: { ...t.demande, nom: "Sword" } }
  vi.spyOn(travaux, "lireSuivi").mockResolvedValue(tirage)
  vi.mocked(travauxAudio.lire).mockResolvedValue(tirage)
  const arrete = { rang: 2, travail: "t2", graine: 1, etat: "a_reprendre" as const, raison: "L’atelier s’est arrêté.", prochaine_action: "reprendre", son: null }
  vi.mocked(seriesSon.lire).mockResolvedValue(serie([tirageRendu(1), arrete], { etat: "a_reprendre" }))
  vi.mocked(seriesSon.reprendre).mockResolvedValue(serie([tirageRendu(1), tirageRendu(2)]))
  render(<TravailConserve projet="jeu" identifiant="t2" personnages={[]} onClip={vi.fn()} onBande={vi.fn()} onFermer={vi.fn()} onSon={vi.fn()} />)
  expect(await screen.findByRole("region", { name: "Série · Sword" })).toBeInTheDocument()
  expect(seriesSon.lire).toHaveBeenCalledWith("jeu", "serie1")
  fireEvent.click(await screen.findByRole("button", { name: "Reprendre" }))
  expect(await screen.findByRole("button", { name: "Écouter le tirage 2" })).toBeInTheDocument()
  expect(seriesSon.reprendre).toHaveBeenCalledWith("jeu", "serie1")
  expect(travauxAudio.lancer).not.toHaveBeenCalled()
})

test("une fabrication rouverte suit le travail sonore conservé et un son invalide reste accessible", async () => {
  vi.mocked(travauxAudio.lire).mockResolvedValue({ ...t, etat: "a_verifier", son: "a-verifier", raison: "Le fichier est silencieux." })
  vi.spyOn(travaux, "lireSuivi").mockResolvedValue({ ...t, etat: "a_verifier", son: "a-verifier" })
  const onSon = vi.fn()
  render(<TravailConserve projet="jeu" identifiant="conserve" personnages={[]} onClip={vi.fn()} onBande={vi.fn()} onFermer={vi.fn()} onSon={onSon} />)
  await screen.findByText("Le fichier est silencieux.")
  expect(screen.queryByRole("button", { name: "Reprendre le suivi sonore" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Écouter et retoucher le son reçu" }))
  expect(onSon).toHaveBeenCalledWith("a-verifier")
  expect(travauxAudio.lire).toHaveBeenCalledWith("jeu", "conserve")
  expect(travauxAudio.preparer).not.toHaveBeenCalled(); expect(travauxAudio.lancer).not.toHaveBeenCalled()
})

test("le journal ouvre un travail audio sans lui demander de personnage ou de paramètres vidéo", async () => {
  const recu: TravailAudio = { ...t, etat: "termine", son: "son-recu" }
  vi.spyOn(travaux, "lister").mockResolvedValue([recu])
  vi.mocked(travauxAudio.lire).mockResolvedValue(recu)
  const onSon = vi.fn()
  render(<SuiviDesTravaux projet="jeu" personnages={[]} onClip={vi.fn()} onSon={onSon} />)
  fireEvent.click(await screen.findByRole("button", { name: /Son · Épée divine/ }))
  fireEvent.click(await screen.findByRole("button", { name: "Écouter et retoucher le son reçu" }))
  expect(onSon).toHaveBeenCalledWith("son-recu")
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

test("après un rechargement, « Un son » retrouve ses séries récentes et les rouvre (SN6)", async () => {
  const ancienne = serie([tirageRendu(1)], { identifiant: "ancienne", nom: "Rain on a tin roof" })
  const duSujet = serie([tirageRendu(1)], { identifiant: "du-sujet", emplacement: { sujet: "heros", cle: "pas", nom_sujet: "Le héros", nom: "Pas", famille: "bruitage" } })
  vi.mocked(seriesSon.lister).mockResolvedValue([duSujet, ancienne])
  vi.mocked(seriesSon.lire).mockResolvedValue(ancienne)
  render(<FabricationAudio projet="jeu" onFermer={vi.fn()} />)
  // Celles d'un emplacement restent sur la fiche du sujet.
  const precedentes = await screen.findByText("Séries précédentes · 1")
  fireEvent.click(precedentes)
  expect(screen.getByText("· Rain on a tin roof", { exact: false })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Rouvrir" }))
  await waitFor(() => expect(seriesSon.lire).toHaveBeenCalledWith("jeu", "ancienne"))
  expect(await screen.findByRole("region", { name: "Série 1" })).toBeInTheDocument()
})
