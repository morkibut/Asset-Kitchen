// PX4 — « la marge avant d'animer ». `demandeDeRelance` reprend un travail
// raté mot pour mot (RV1 → RV6, E14) : elle ne doit pas faire exception pour
// `part_sujet` et retomber en silence sur le défaut du produit (AGENTS
// 8septies). La marge vient du clip d'origine (`Generation.demande`), qui la
// garde depuis PX4 ; absente sur un clip d'avant cette tranche, elle se lit
// à 80 % — ce qu'il a réellement envoyé.

import { describe, expect, test } from "vitest"

import type { Generation } from "./api"
import { demandeDeRelance } from "./fabrication"

function clip(surplus: Record<string, unknown> & { demande: Record<string, unknown> }): Generation {
  return {
    identifiant: "clip-1",
    modele: "maison/wan-2.2-i2v-14b-pixel",
    personnage: "pelerin",
    pose: "marche",
    direction: "sud",
    clip: { secondes: 1.5, resolution: "480p", proportions: "1:1" },
    ...surplus,
  } as unknown as Generation
}

describe("demandeDeRelance — la marge du clip d'origine, pas le défaut du produit", () => {
  test("un clip gardé à 60 % relance une demande à 60 %", () => {
    const source = clip({ demande: { prompt: "marche", part_sujet: 0.60 } })
    expect(demandeDeRelance(source, null).part_sujet).toBe(0.60)
  })

  test("PX5 — une boucle relancée reste une boucle", () => {
    const source = clip({ demande: { prompt: "marche", image_de_fin: "depart" } })
    expect(demandeDeRelance(source, null).image_de_fin).toBe("depart")
    const autre = clip({ demande: { prompt: "marche", image_de_fin: "asset-fin" } })
    expect(demandeDeRelance(autre, null).image_de_fin).toBe("asset-fin")
  })

  test("PX5 — un clip d'avant, sans la clé, relance une fin libre", () => {
    const source = clip({ demande: { prompt: "marche" } })
    expect(demandeDeRelance(source, null).image_de_fin).toBeNull()
  })

  test("un clip d'avant PX4, sans la clé, relance une demande à 80 %", () => {
    const source = clip({ demande: { prompt: "marche" } })
    expect(demandeDeRelance(source, null).part_sujet).toBe(0.80)
  })
})
