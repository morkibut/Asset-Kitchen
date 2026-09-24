// CM7 — partout où il y a un champ de prompt (`docs/PLAN-assistant.md` § CM7,
// décision 10). Deux choses à vérifier, qu'aucun essai existant ne couvre :
//
// 1. **Le champ partagé** (`ChampPrompt.tsx`) porte la marque par lui-même,
//    sur ses deux textes — donc tout écran qui le monte l'a sans y toucher.
//    C'est ici le même doublage de `fetch` que `CoupDeMain.test.tsx`.
// 2. **Chaque écran qui décrit une image, un clip ou un son sans passer par
//    `ChampPrompt`** pose la marque à la main, avec le bon champ de `CHAMPS` ;
//    et un champ qui n'est pas un prompt (nom, description de fiche…) ne la
//    reçoit pas. Monter ces gros écrans coûterait un décor entier par champ ;
//    on lit leur source, comme `essais/essai_imports.py` lit celle du carnet —
//    la même vérité, sans le décor.
import fs from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ChampPrompt } from "./ChampPrompt"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function doublerFetchDisponible() {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/assist") return new Response(JSON.stringify({ disponible: true, raison: null, modele: "OpenRouter:deepseek/deepseek-v4-flash" }))
    throw new Error(`route inattendue : ${url}`)
  }))
}

const PROPS_CHAMP_PROMPT = {
  prompt: "un mur de pierre grise", onPrompt: vi.fn(),
  promptNegatif: "flou, basse résolution", onPromptNegatif: vi.fn(),
  repris: false, onRendre: vi.fn(), refus: null,
  onGenerer: vi.fn(), variations: 1,
}

describe("le champ partagé porte la marque par lui-même", () => {
  it("sur le prompt", async () => {
    doublerFetchDisponible()
    render(<ChampPrompt {...PROPS_CHAMP_PROMPT} />)
    expect(await screen.findByLabelText("Proposer en anglais")).toBeInTheDocument()
  })

  it("sur le prompt négatif, une fois le repli ouvert", async () => {
    doublerFetchDisponible()
    render(<ChampPrompt {...PROPS_CHAMP_PROMPT} />)
    await screen.findByLabelText("Proposer en anglais") // attend que la marque du prompt paraisse
    fireEvent.click(screen.getByText(/prompt négatif/))
    // `findAllByLabelText` s'arrête dès qu'il en trouve un : ici il en faut
    // deux, donc on attend explicitement que le second, propre au champ
    // négatif qui vient de se monter, ait fini sa propre requête d'état.
    await waitFor(() => expect(screen.getAllByLabelText("Proposer en anglais")).toHaveLength(2))
  })
})

// ── Les écrans qui ne passent pas par `ChampPrompt` ─────────────────────────
//
// Un champ, son fichier, le texte qui l'identifie dans la source, et le champ
// de `CHAMPS` attendu juste avant lui. La liste **est** le recensement demandé
// par CM7 — l'ajout d'un champ de prompt sans y passer se voit ici.
const RACINE = path.resolve(__dirname, "..")
const lire = (fichier: string) => fs.readFileSync(path.join(RACINE, fichier), "utf-8")

const CHAMPS_HORS_CHAMP_PROMPT: { fichier: string; pres: string; champ: string }[] = [
  { fichier: "composants/BarreQuiPaie.tsx", pres: "preparation-image-prompt", champ: "prompt_image" },
  { fichier: "composants/FabricationAudio.tsx", pres: "Ce qu’on doit entendre", champ: "prompt_son" },
  { fichier: "composants/FabricationVideoLibre.tsx", pres: "Description de l’image", champ: "prompt_image" },
  { fichier: "composants/FabricationVideoLibre.tsx", pres: "Éviter dans l’image", champ: "prompt_negatif" },
  { fichier: "composants/FabricationVideoLibre.tsx", pres: "Mouvement et consignes pour la vidéo", champ: "prompt_video" },
  { fichier: "composants/FabricationSuivie.tsx", pres: "Décrire l’animation", champ: "prompt_video" },
  { fichier: "composants/WorkflowsLocaux.tsx", pres: "L’image à fabriquer", champ: "prompt_image" },
  { fichier: "composants/WorkflowsLocaux.tsx", pres: "Ce qu’il faut éviter", champ: "prompt_negatif" },
]

describe("les champs de prompt qui posent la marque à la main portent le bon champ de CHAMPS", () => {
  const sources = new Map<string, string>()
  const source = (fichier: string) => {
    if (!sources.has(fichier)) sources.set(fichier, lire(fichier))
    return sources.get(fichier)!
  }

  for (const { fichier, pres, champ } of CHAMPS_HORS_CHAMP_PROMPT) {
    it(`${fichier} · « ${pres} » → champ="${champ}"`, () => {
      const texte = source(fichier)
      // Le libellé, puis — avant le prochain libellé — un `AvecCoupDeMain`
      // portant ce champ-là : la marque est bien posée sur *ce* texte-ci, pas
      // sur un autre champ du même fichier.
      const debut = texte.indexOf(pres)
      expect(debut, `« ${pres} » introuvable dans ${fichier}`).toBeGreaterThanOrEqual(0)
      const alentour = texte.slice(Math.max(0, debut - 400), debut + 400)
      expect(alentour).toContain("AvecCoupDeMain")
      expect(alentour).toContain(`champ="${champ}"`)
    })
  }

  it("chacun de ces fichiers importe AvecCoupDeMain", () => {
    for (const fichier of new Set(CHAMPS_HORS_CHAMP_PROMPT.map((c) => c.fichier)))
      expect(source(fichier)).toContain('from "./CoupDeMain"')
  })
})

describe("ce qui n'est pas un champ de prompt ne porte pas la marque", () => {
  it("« Description créative » de CreerUnAsset.tsx : une fiche, pas un envoi — le fichier n'importe même pas le coup de main", () => {
    const texte = lire("composants/CreerUnAsset.tsx")
    expect(texte).toContain("Description créative")
    expect(texte).toContain("Aucune génération n’est lancée à cette étape")
    expect(texte).not.toContain("AvecCoupDeMain")
  })

  it("« Paroles » de FabricationAudio.tsx : un texte à chanter, jamais traduit — resté hors de l'enveloppe posée juste au-dessus", () => {
    const texte = lire("composants/FabricationAudio.tsx")
    const debut = texte.indexOf("aria-label=\"Paroles\"")
    expect(debut).toBeGreaterThanOrEqual(0)
    // La ligne des paroles elle-même ne porte pas la marque — seule la ligne
    // « Ce qu'on doit entendre », juste avant, la porte (essai ci-dessus).
    expect(texte.slice(debut, debut + 200)).not.toContain("AvecCoupDeMain")
  })
})
