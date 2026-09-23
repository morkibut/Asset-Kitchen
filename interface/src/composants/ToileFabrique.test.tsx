// Fabriquer sur la toile — la barre, l'appel qui part, et les images posées au
// retour. `fetch` est doublé : aucun appel ne sort, aucun centime ne part.
//
// La barre et le crochet sont montés dans un banc minimal plutôt que dans la
// toile entière : jsdom ne met rien en page (tout rectangle y vaut zéro), et ce
// qui compte ici est ce qui part au serveur et ce qui revient poser, pas où.

import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { Carte, Modele } from "../api"
import {
  annonce,
  BarreDeFabrication,
  modeleParDefaut,
  referencesDeLaToile,
  useFabricationSurToile,
} from "./ToileFabrique"

const modele = (identifiant: string, sur: Partial<Modele> = {}): Modele => ({
  identifiant,
  nom: identifiant.split(":")[1] ?? identifiant,
  fournisseur: identifiant.split(":")[0] ?? "",
  chez_lui: identifiant,
  references_max: 4,
  proportions: ["1:1", "16:9"],
  resolutions: [],
  variations_max: 4,
  options: {},
  refus: null,
  repli: false,
  recu_le: 0,
  unite: "usd",
  ...sur,
})

const PAYANT = modele("OpenRouter:openai/gpt-image-2")
const QWEN = modele("ComfyUI:qwen21-rapide@3", {
  locale: true,
  unite: "seconde",
  ...({ temps: { secondes: 12, mesures: 3, vitesse: null } } as object),
})
const GRISE = modele("ComfyUI:qwen21-rapide@2", { refus: "workflow absent" })

const carte = (identifiant: string, sur: Partial<Carte> = {}): Carte => ({
  identifiant,
  projet: "marais",
  genre: "image",
  texte: "",
  statut: "prete",
  raison: null,
  source: "",
  cree_le: 1,
  groupe: "",
  note: "",
  taille: 1,
  position: [0, 0],
  largeur_libre: null,
  teinte: "",
  officiel: false,
  famille: "tous",
  empreinte: "cafe",
  largeur: 512,
  hauteur: 512,
  type_media: "image/png",
  octets: 1,
  montrable: true,
  artwork: false,
  en_reserve: false,
  ...sur,
})

type Appel = { url: string; methode: string; corps: unknown }

/** Le serveur doublé : un catalogue, une génération qui revient aussitôt
 *  réussie avec autant d'emplacements qu'on en a demandé, et la pose. */
function serveur() {
  const appels: Appel[] = []
  let variations = 1
  const reponse = (corps: unknown, statut = 200) =>
    Promise.resolve(
      new Response(JSON.stringify(corps), {
        status: statut,
        headers: { "Content-Type": "application/json" },
      }),
    )
  const generation = (statut: string) => ({
    identifiant: "gen1",
    modele: "",
    projet: "marais",
    emplacements: Array.from({ length: variations }, (_, rang) => ({ rang, statut, raison: null })),
  })
  const fetchDouble = vi.fn((entree: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entree)
    const methode = init?.method ?? "GET"
    const corps = init?.body ? JSON.parse(String(init.body)) : null
    appels.push({ url, methode, corps })
    if (url.startsWith("/api/models"))
      return reponse({ modeles: [PAYANT, GRISE, QWEN], couts: { [PAYANT.identifiant]: 0.04 } })
    if (url === "/api/generations" && methode === "POST") {
      variations = (corps as { variations: number }).variations
      return reponse(generation("en_cours"), 202)
    }
    if (url === "/api/generations/gen1") return reponse(generation("reussie"))
    if (url.includes("/board/assets/")) return reponse({ carte: {}, deja_presente: false })
    return reponse({}, 404)
  })
  return { fetchDouble, appels }
}

function Banc({ references = [] as Carte[] }) {
  const fabrication = useFabricationSurToile(() => {})
  const champ = useRef<HTMLInputElement>(null)
  return (
    <>
      <BarreDeFabrication
        references={references}
        onOublierReferences={() => {}}
        champ={champ}
        onLancer={(demande) =>
          void fabrication.lancer({
            ...demande,
            places: Array.from({ length: demande.variations }, (_, i) => ({ x: 100 * i, y: 7 })),
          })
        }
      />
      <ul>
        {fabrication.fantomes.map((f) => (
          <li key={f.cle} data-testid="fantome">
            {f.raison}
          </li>
        ))}
      </ul>
    </>
  )
}

beforeEach(() => {
  try {
    window.localStorage.clear()
  } catch {
    // rien
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("les règles de la barre, sans écran", () => {
  test("le défaut est le premier Qwen rapide disponible, jamais un grisé", () => {
    expect(modeleParDefaut([PAYANT, GRISE, QWEN])).toBe(QWEN.identifiant)
    expect(modeleParDefaut([PAYANT, GRISE])).toBe(PAYANT.identifiant)
    expect(modeleParDefaut([GRISE])).toBeNull()
  })

  test("un payant annonce son prix multiplié, un local un temps qui ne l'est pas", () => {
    expect(annonce(PAYANT, { [PAYANT.identifiant]: 0.04 }, 3)).toBe("$0,1200")
    expect(annonce(PAYANT, {}, 3)).toBe("Coût inconnu")
    expect(annonce(QWEN, {}, 3)).toBe("≈ 12 secondes par image")
  })

  test("la sélection part en référence, et seules les images arrivées", () => {
    const cartes = [
      carte("a"),
      carte("b"),
      carte("note", { genre: "texte" }),
      carte("attente", { statut: "attente" }),
    ]
    expect(referencesDeLaToile(cartes, ["a", "note", "attente"], null, null).map((c) => c.identifiant)).toEqual(["a"])
    expect(referencesDeLaToile(cartes, [], "b", null).map((c) => c.identifiant)).toEqual(["b"])
    expect(referencesDeLaToile(cartes, ["a"], null, "b").map((c) => c.identifiant)).toEqual(["b", "a"])
  })
})

describe("la barre de fabrication", () => {
  test("Qwen rapide est choisi d'emblée, et le grisé dit sa raison", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))
    const grise = [...liste.options].find((o) => o.value === GRISE.identifiant)!
    expect(grise.disabled).toBe(true)
    expect(grise.title).toBe("workflow absent")
    // Le bouton porte l'annonce — un temps, pour un local.
    expect(screen.getByRole("button", { name: /Fabriquer · ≈ 12 secondes par image/ })).toBeTruthy()
  })

  test("deux versions : le corps part avec variations=2 et le modèle, et deux cartes sont posées au retour", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    fireEvent.click(screen.getByRole("button", { name: "2" }))
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "  un héron dans la brume  " } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.methode === "POST")).toHaveLength(1),
    )
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.variations).toBe(2)
    expect(corps.modele).toBe(QWEN.identifiant)
    expect(corps.prompt).toBe("un héron dans la brume")
    expect(corps.references).toEqual([])

    // Au retour, chaque emplacement est posé à la place de son fantôme, et le
    // fantôme s'en va.
    await waitFor(() =>
      expect(appels.filter((a) => a.url.includes("/board/assets/"))).toHaveLength(2),
    )
    const poses = appels.filter((a) => a.url.includes("/board/assets/"))
    expect(poses.map((a) => a.url)).toEqual([
      "/api/projects/marais/board/assets/gen1-0",
      "/api/projects/marais/board/assets/gen1-1",
    ])
    expect(poses.map((a) => a.corps)).toEqual([{ position: [0, 7] }, { position: [100, 7] }])
    await waitFor(() => expect(screen.queryAllByTestId("fantome")).toHaveLength(0))
  })

  test("une carte choisie part en image à modifier, venue de la toile", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const refs = referencesDeLaToile([carte("heron")], [], "heron", null)
    render(<Banc references={refs} />)
    expect(await screen.findByText("à partir de 1 image")).toBeTruthy()
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))
    // Le catalogue est demandé pour une référence : c'est lui qui grise.
    expect(appels.some((a) => a.url.startsWith("/api/models") && a.url.includes("references=1"))).toBe(true)

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "le même, sous la pluie" } })
    fireEvent.click(screen.getByRole("button", { name: /^Fabriquer ·/ }))

    await waitFor(() => expect(appels.some((a) => a.url === "/api/generations")).toBe(true))
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.references).toEqual([{ asset: "heron", role: "edition", origine: "carte" }])
  })

  test("un emplacement qui échoue garde son fantôme, avec sa raison, et rien n'est posé", async () => {
    const { fetchDouble, appels } = serveur()
    const base = fetchDouble.getMockImplementation()!
    fetchDouble.mockImplementation((entree, init) =>
      String(entree) === "/api/generations/gen1"
        ? Promise.resolve(
            new Response(
              JSON.stringify({
                identifiant: "gen1",
                projet: "marais",
                emplacements: [{ rang: 0, statut: "echouee", raison: "crédit épuisé" }],
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          )
        : base(entree, init),
    )
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    expect(await screen.findByText("crédit épuisé")).toBeTruthy()
    expect(appels.some((a) => a.url.includes("/board/assets/"))).toBe(false)
  })

  test("le modèle et le nombre choisis sont retenus d'une fois sur l'autre", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const { unmount } = render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))
    fireEvent.change(liste, { target: { value: PAYANT.identifiant } })
    fireEvent.click(screen.getByRole("button", { name: "3" }))
    unmount()

    render(<Banc />)
    const relue = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(relue.value).toBe(PAYANT.identifiant))
    expect(screen.getByRole("button", { name: "3" }).getAttribute("aria-pressed")).toBe("true")
    expect(screen.getByRole("button", { name: /Fabriquer 3 · \$0,1200/ })).toBeTruthy()
  })
})
