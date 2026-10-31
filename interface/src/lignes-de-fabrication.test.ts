// Le rendu enregistré qui faisait planter la Galerie (31 octobre 2026).
//
// « Enregistrer sous… », dans l'atelier d'animation, écrit une génération de
// modèle `rendu-enregistre` dont la demande porte un `nom` et **pas de
// `prompt`** (`atelier/services/enregistrer_sous.py`, et le commentaire de
// `Generation.demande.nom` dans `api.ts`). Depuis le 27 septembre 2026, la
// liste des fabrications relit le texte de l'auteur dans `demande.prompt` pour
// chaque génération du flux : un seul rendu enregistré dans le jeu ouvert, et
// `texteDeLAuteur(undefined)` levait — l'écran entier tombait en blanc, la
// Galerie avec lui, puisque le pied du carnet monte ce même crochet.

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { api, type Generation } from "./api"
import { travaux } from "./api-travaux"
import { fileLocale } from "./api-file-locale"
import { useLignesDeFabrication } from "./lignes-de-fabrication"

function generation(champs: Partial<Generation> & { demande: Generation["demande"] }): Generation {
  return {
    identifiant: "g1", modele: "rendu-enregistre", projet: "la-foret-magique",
    cree_le: 1_790_000_000, cout_usd: 0, statut: "reussie", reussies: 1,
    ...champs,
  } as unknown as Generation
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, "modeles").mockResolvedValue({ modeles: [] } as never)
  vi.spyOn(api, "modelesVideo").mockResolvedValue({ modeles: [] } as never)
  vi.spyOn(api, "journal").mockResolvedValue({ appels: [] } as never)
  vi.spyOn(travaux, "lister").mockResolvedValue([])
  vi.spyOn(fileLocale, "lire").mockResolvedValue({ etapes: [] } as never)
})

describe("useLignesDeFabrication", () => {
  test("un rendu enregistré, sans prompt, prend son nom au lieu de faire tomber l'écran", async () => {
    const rendu = generation({ demande: { nom: "Champy saute", bande: "b1" } as unknown as Generation["demande"] })
    const { result } = renderHook(() =>
      useLignesDeFabrication({ projet: "la-foret-magique", personnages: [], chantier: [rendu], clips: [] }),
    )
    await waitFor(() => expect(result.current.lignes).toHaveLength(1))
    expect(result.current.lignes[0].titre).toBe("Champy saute")
  })

  test("une génération ordinaire garde le texte de l'auteur, tiré du texte composé", async () => {
    const appel = generation({
      modele: "pollinations:flux",
      demande: { prompt: "CONTEXT\n\nsprite\n\nREQUEST\n\nMara qui court" } as unknown as Generation["demande"],
    })
    const { result } = renderHook(() =>
      useLignesDeFabrication({ projet: "la-foret-magique", personnages: [], chantier: [appel], clips: [] }),
    )
    await waitFor(() => expect(result.current.lignes).toHaveLength(1))
    expect(result.current.lignes[0].titre).toBe("Mara qui court")
  })
})
