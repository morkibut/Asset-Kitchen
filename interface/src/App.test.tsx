// Le seul test qui traverse l'écran.
//
// Il existe pour une raison précise, et elle est écrite dans `AGENTS.md`
// § Pièges connus : **deux chemins amènent la même génération à l'écran, et ils
// se croisent.** La réponse du POST et l'annonce du flux portent le même objet,
// et le serveur publie *avant* que le POST ne soit revenu. Le défaut qui en est
// sorti — chaque génération lancée depuis l'onglet en double — n'a été vu ni par
// les quarante-cinq tests du serveur, qui ne montent pas d'écran, ni par un
// rechargement, qui remplace la liste par celle du serveur. Il a fallu une
// séance faite au navigateur.
//
// Ce fichier reproduit **l'ordre réel** : on publie, puis on répond. Sans cet
// ordre-là, le test passerait avec le code fautif.
//
// Ni réseau ni serveur : `fetch` et `EventSource` sont doublés ici, comme
// `tests/conftest.py` double le fournisseur côté Python. Aucun centime.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { App } from "./App"
import type { Etat, EtatCatalogue, Generation } from "./api"

// ── Le double du flux ────────────────────────────────────────────────────────
//
// `EventSource` n'existe pas hors navigateur. Celui-ci ne fait que ce dont le
// test a besoin : retenir les écoutes, et laisser le test décider *quand* un
// fait arrive. C'est ce contrôle du moment qui rend le croisement reproductible.

class FluxDouble {
  static ouverts: FluxDouble[] = []
  ecoutes = new Map<string, ((m: MessageEvent<string>) => void)[]>()
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  fermé = false

  constructor(public url: string) {
    FluxDouble.ouverts.push(this)
  }

  addEventListener(genre: string, ecoute: (m: MessageEvent<string>) => void) {
    const liste = this.ecoutes.get(genre) ?? []
    liste.push(ecoute)
    this.ecoutes.set(genre, liste)
  }

  close() {
    this.fermé = true
  }

  /** Ce que l'atelier annonce. */
  emettre(genre: string, charge: unknown) {
    for (const ecoute of this.ecoutes.get(genre) ?? [])
      ecoute({ data: JSON.stringify(charge) } as MessageEvent<string>)
  }
}

// ── Ce que le serveur répond ─────────────────────────────────────────────────

const MODELE = {
  identifiant: "essai/modele",
  nom: "Essai : Modèle",
  references_max: 4,
  proportions: ["1:1", "3:2", "2:3", "16:9"],
  resolutions: [],
  variations_max: 4,
  options: {},
  refus: null,
}

const CATALOGUE: EtatCatalogue = {
  recu_le: 1_787_800_000,
  repli: false,
  raison: null,
  defaut: { modele: MODELE.identifiant, options: {} },
  modeles: [MODELE],
}

const ETAT: Etat = {
  cle: { presente: true, origine: "fichier", apercu: "abcdef", raison: null },
  catalogue: { modeles: 1, recu_le: CATALOGUE.recu_le, repli: false, raison: null },
  couts: { total_usd: 0 },
  traitement: {
    moteurs: [{ nom: "bord", raison: null }],
    quantification: { raison: "aucune palette" },
    recettes: [],
  },
  generations: [],
  assets: [],
}

const generation = (identifiant: string, variations: number, statut: Generation["statut"]): Generation => ({
  identifiant,
  modele: MODELE.identifiant,
  demande: {
    prompt: "un tonneau",
    prompt_negatif: "",
    proportions: "1:1",
    resolution: null,
    variations,
    references: 0,
    options: {},
  },
  parametres_resolus: {},
  ecartees: [],
  emplacements: Array.from({ length: variations }, (_, rang) => ({
    rang,
    statut,
    cout_usd: 0,
    duree_s: 0,
    resultat: null,
    raison: null,
    demarre_le: null,
    duree_attendue_s: 12,
  })),
  cree_le: 1_787_800_100,
  projet: null,
  statut,
  cout_usd: 0,
  reussies: 0,
})

/** Le flux publie **avant** que le POST ne réponde — l'ordre du vrai serveur,
 *  qui enregistre, annonce, puis rend la main. */
function serveurDouble(aPublier: () => Generation) {
  return vi.fn(async (chemin: string, init?: RequestInit) => {
    const url = String(chemin)
    const rendre = (charge: unknown) =>
      ({ ok: true, status: 200, json: async () => charge }) as Response

    if (url.startsWith("/api/models")) return rendre(CATALOGUE)
    if (url === "/api/generations" && init?.method === "POST") {
      const g = aPublier()
      FluxDouble.ouverts.at(-1)?.emettre("generation", g)
      return rendre(g)
    }
    return rendre({})
  })
}

const tuiles = () => screen.queryAllByRole("button", { name: "Ouvrir la fiche" })

describe("l'écran de l'atelier", () => {
  beforeEach(() => {
    FluxDouble.ouverts = []
    vi.stubGlobal("EventSource", FluxDouble)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test("une génération annoncée par le flux **et** rendue par le POST n'apparaît qu'une fois", async () => {
    const lancee = generation("aaaa1111", 2, "en_cours")
    vi.stubGlobal("fetch", serveurDouble(() => lancee))

    render(<App />)
    await waitFor(() => expect(FluxDouble.ouverts.length).toBe(1))
    FluxDouble.ouverts[0].emettre("etat", ETAT)

    const champ = await screen.findByPlaceholderText("Décris ce que tu veux fabriquer.")
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    fireEvent.click(screen.getByRole("button", { name: /^Générer/ }))

    // Deux emplacements, donc deux tuiles — jamais quatre.
    await waitFor(() => expect(tuiles()).toHaveLength(2))

    // Et les faits qui suivent ne rajoutent rien : ils remplacent.
    FluxDouble.ouverts[0].emettre("generation", generation("aaaa1111", 2, "reussie"))
    await waitFor(() => expect(tuiles()).toHaveLength(2))
  })

  test("le message d'état fait autorité sur la liste, il ne s'y ajoute pas", async () => {
    vi.stubGlobal("fetch", serveurDouble(() => generation("bbbb2222", 1, "en_cours")))

    render(<App />)
    await waitFor(() => expect(FluxDouble.ouverts.length).toBe(1))

    const deja = generation("cccc3333", 1, "reussie")
    FluxDouble.ouverts[0].emettre("etat", { ...ETAT, generations: [deja] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))

    // Un rebranchement renvoie le même état : toujours une seule tuile.
    FluxDouble.ouverts[0].emettre("etat", { ...ETAT, generations: [deja] })
    await waitFor(() => expect(tuiles()).toHaveLength(1))
  })

  test("sans prompt, générer est inactif et dit pourquoi", async () => {
    vi.stubGlobal("fetch", serveurDouble(() => generation("dddd4444", 1, "en_cours")))

    render(<App />)
    await waitFor(() => expect(FluxDouble.ouverts.length).toBe(1))
    FluxDouble.ouverts[0].emettre("etat", ETAT)

    const bouton = await screen.findByRole("button", { name: /^Générer/ })
    expect(bouton).toBeDisabled()
    expect(screen.getByText("aucun prompt")).toBeTruthy()
  })
})
