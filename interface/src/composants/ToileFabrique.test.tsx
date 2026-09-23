// Fabriquer sur la toile — la barre, l'appel qui part, et les images posées au
// retour. `fetch` est doublé : aucun appel ne sort, aucun centime ne part.
//
// La barre et le crochet sont montés dans un banc minimal plutôt que dans la
// toile entière : jsdom ne met rien en page (tout rectangle y vaut zéro), et ce
// qui compte ici est ce qui part au serveur et ce qui revient poser, pas où.

import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import type { Bout, Carte, Modele } from "../api"
import {
  annonce,
  BarreDeFabrication,
  EXEMPLES_DEVELOPPEMENT,
  modeleParDefaut,
  refusDeLaTaille,
  refusDesReferences,
  referencesPrises,
  tailleRetenue,
  useFabricationSurToile,
  type Developpement,
  type Reprise,
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
// **Un style local qui ne rend qu'une variation par appel** (TS9) — le cas
// exact du défaut de l'auteur : demander « 3 » à un modèle pareil doit
// lancer trois appels, jamais un seul borné en silence à une image.
const UNE_A_LA_FOIS = modele("ComfyUI:un-style-a-la-fois", {
  locale: true,
  variations_max: 1,
  unite: "seconde",
  ...({ temps: { secondes: 5, mesures: 1, vitesse: null } } as object),
})

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
    if (url.includes("/board/assets/")) {
      // L'identifiant posé se déduit de l'adresse (`gen1-0` → `carte-gen1-0`) —
      // de quoi vérifier, dans les essais TS10, quelle carte un lien désigne.
      const asset = url.split("/board/assets/")[1]
      return reponse({ carte: { identifiant: `carte-${asset}` }, deja_presente: false })
    }
    if (url === "/api/outgoing" && methode === "POST")
      return reponse({ texte: `[[${(corps as { prompt: string }).prompt}]]` })
    return reponse({}, 404)
  })
  return { fetchDouble, appels }
}

function Banc({
  references = [] as Carte[],
  reprise,
  developpement,
  origines,
  lier,
}: {
  references?: Carte[]
  reprise?: Reprise | null
  developpement?: Developpement | null
  /** TS10 — la carte à relier, transmise telle qu'une « Développer ce sujet »
   *  de `Toile.tsx` la calculerait au moment du clic sur Fabriquer. */
  origines?: string[]
  lier?: (de: Bout, vers: Bout) => void
}) {
  const fabrication = useFabricationSurToile(() => {}, lier)
  const champ = useRef<HTMLInputElement>(null)
  return (
    <>
      <BarreDeFabrication
        references={references}
        onRetirerReference={() => {}}
        champ={champ}
        reprise={reprise}
        developpement={developpement}
        onLancer={(demande) =>
          void fabrication.lancer({
            prompt: demande.prompt,
            modele: demande.modele,
            proportions: demande.proportions,
            taille: demande.taille,
            variations_max: demande.variations_max,
            references: demande.references,
            repris: demande.repris,
            places: Array.from({ length: demande.variations }, (_, i) => ({ x: 100 * i, y: 7 })),
            origines,
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

  test("un payant annonce le prix d'un appel multiplié par le nombre d'appels, un local un temps qui ne l'est pas (TS9)", () => {
    // Trois versions qu'un seul appel rend (appels=1) ne payent qu'une fois.
    expect(annonce(PAYANT, { [PAYANT.identifiant]: 0.04 }, 1)).toBe("$0,0400")
    // Cinq versions qu'il a fallu deux appels pour obtenir payent deux fois —
    // jamais cinq fois (point 8 : le prix suit les appels, pas les cases).
    expect(annonce(PAYANT, { [PAYANT.identifiant]: 0.04 }, 2)).toBe("$0,0800")
    expect(annonce(PAYANT, {}, 1)).toBe("Coût inconnu")
    expect(annonce(QWEN, {}, 3)).toBe("≈ 12 secondes par image")
  })

  test("seules les cartes prises partent, et seules les images arrivées (TS6)", () => {
    const cartes = [
      carte("a"),
      carte("b"),
      carte("note", { genre: "texte" }),
      carte("attente", { statut: "attente" }),
    ]
    // Prendre "note" ou "attente" ne fait rien paraître : une note n'a pas
    // d'image, une adresse en attente n'a pas encore la sienne.
    expect(referencesPrises(cartes, ["a", "note", "attente"]).map((c) => c.identifiant)).toEqual(["a"])
    // L'ordre de prise est celui qu'on relit — pas l'ordre des cartes.
    expect(referencesPrises(cartes, ["b", "a"]).map((c) => c.identifiant)).toEqual(["b", "a"])
    // Une carte prise deux fois ne paraît qu'une fois.
    expect(referencesPrises(cartes, ["a", "a"]).map((c) => c.identifiant)).toEqual(["a"])
    // Rien de pris, rien qui parte — la sélection de la toile n'entre plus en
    // ligne de compte ici (c'était l'ancien silence que l'auteur n'avait pas
    // compris).
    expect(referencesPrises(cartes, [])).toEqual([])
  })

  test("le plafond du modèle ne cède jamais devant ce qui est pris (point 4)", () => {
    const trois = modele("OpenRouter:trois-refs", { references_max: 3 })
    expect(refusDesReferences(trois, 2)).toBeNull()
    expect(refusDesReferences(trois, 3)).toBeNull()
    expect(refusDesReferences(trois, 4)).toBe(
      "trois-refs accepte au plus 3 images en référence, 4 sont prises",
    )
    // Un modèle gratuit qui n'accepte aucune image : le premier pris refuse déjà.
    const sansImage = modele("ComfyUI:texte-seul", { references_max: 0 })
    expect(refusDesReferences(sansImage, 1)).toBe(
      "texte-seul accepte au plus 0 image en référence, 1 sont prises",
    )
    expect(refusDesReferences(null, 5)).toBeNull()
  })

  test("le catalogue décide de la taille (TS4) : sans résolutions déclarées, rien n'est grisé", () => {
    expect(refusDeLaTaille(QWEN, "512")).toBeNull()
    expect(refusDeLaTaille(QWEN, "1024")).toBeNull()
    expect(refusDeLaTaille(null, "512")).toBeNull()
  })

  test("un modèle qui déclare ses résolutions grise celle qu'il ne rend pas", () => {
    const seul1024 = modele("OpenRouter:seul-1024", { resolutions: ["1024"] })
    expect(refusDeLaTaille(seul1024, "1024")).toBeNull()
    expect(refusDeLaTaille(seul1024, "512")).toBe("seul-1024 ne rend pas 512")
    // La taille retenue retombe sur celle qui tient, jamais sur un grisé.
    expect(tailleRetenue(seul1024, "512")).toBe("1024")
    expect(tailleRetenue(seul1024, "1024")).toBe("1024")
    expect(tailleRetenue(QWEN, "1024")).toBe("1024")
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
    const refs = referencesPrises([carte("heron")], ["heron"])
    render(<Banc references={refs} />)
    // La référence prise paraît en vignette, avec sa croix pour la retirer.
    expect(await screen.findByLabelText("1 image prise en référence")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retirer cette référence" })).toBeTruthy()
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
    // PAYANT rend 4 variations par appel (défaut de la fabrique d'essai) :
    // 3 versions tiennent dans un seul appel, donc un seul prix (TS9).
    expect(screen.getByRole("button", { name: /Fabriquer 3 · \$0,0400/ })).toBeTruthy()
  })

  test("l'image arrive brute, en 512 par défaut, et sans le style du jeu (TS4)", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un héron" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => expect(appels.some((a) => a.url === "/api/generations")).toBe(true))
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.brut).toBe(true)
    expect(corps.resolution).toBe("512")
    // Le texte tapé part seul par défaut — la case du style du jeu est décochée.
    expect(corps.repris).toBe(true)
  })

  test("1024 se choisit, se retient, et part dans la demande", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    fireEvent.click(screen.getByRole("button", { name: "1024" }))
    expect(screen.getByRole("button", { name: "1024" }).getAttribute("aria-pressed")).toBe("true")

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un héron" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => expect(appels.some((a) => a.url === "/api/generations")).toBe(true))
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.resolution).toBe("1024")
  })

  test("« avec le style du jeu » fait partir le texte composé, pas le texte repris", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    fireEvent.click(screen.getByLabelText("avec le style du jeu"))
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un héron" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => expect(appels.some((a) => a.url === "/api/generations")).toBe(true))
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.repris).toBe(false)
  })

  test("« Ce qui part » relit le texte exact, la taille et les références avant de cliquer", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const refs = referencesPrises([carte("heron")], ["heron"])
    render(<Banc references={refs} />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un héron" } })
    fireEvent.click(screen.getByRole("button", { name: /Ce qui part/ }))

    expect(await screen.findByText("[[un héron]]")).toBeTruthy()
    expect(screen.getByText(/512 px/)).toBeTruthy()
    expect(screen.getByText(/1 image jointe/)).toBeTruthy()
    // Un aperçu, jamais un appel qui paie.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  test("la croix d'une vignette ne retire que la sienne (TS6)", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const retirees: string[] = []
    function BancDeuxReferences() {
      const champ = useRef<HTMLInputElement>(null)
      return (
        <BarreDeFabrication
          references={referencesPrises([carte("heron"), carte("renard")], ["heron", "renard"])}
          onRetirerReference={(identifiant) => retirees.push(identifiant)}
          onLancer={() => {}}
          champ={champ}
        />
      )
    }
    render(<BancDeuxReferences />)
    await screen.findByLabelText("2 images prises en référence")
    const croix = screen.getAllByRole("button", { name: "Retirer cette référence" })
    expect(croix).toHaveLength(2)
    fireEvent.click(croix[1])
    expect(retirees).toEqual(["renard"])
  })

  test("trop de références prises refuse de partir, sans en écarter aucune (point 4)", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    // QWEN, choisi par défaut, accepte 4 références (le défaut de la fabrique
    // d'essai) : cinq prises dépassent son plafond.
    const cinq = ["a", "b", "c", "d", "e"].map((id) => carte(id))
    render(<Banc references={referencesPrises(cinq, cinq.map((c) => c.identifiant))} />)
    await waitFor(() =>
      expect((screen.getByLabelText("Modèle") as HTMLSelectElement).value).toBe(QWEN.identifiant),
    )
    expect(
      await screen.findByText(`${QWEN.nom} accepte au plus 4 images en référence, 5 sont prises`),
    ).toBeTruthy()
    const bouton = screen.getByRole("button", { name: "Trop de références pour ce modèle" })
    expect(bouton.hasAttribute("disabled")).toBe(true)

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un tonneau" } })
    fireEvent.keyDown(champ, { key: "Enter" })
    // Rien ne part : la barre refuse plutôt que de rogner la liste en silence.
    expect(appels.some((a) => a.url === "/api/generations")).toBe(false)
  })

  // TS5 — « Reprendre ce texte » : la phrase d'une carte revient dans la
  // barre, avec le modèle et la taille d'origine.

  test("« Reprendre ce texte » remet la phrase, le modèle et la taille dans la barre", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const { rerender } = render(<Banc reprise={null} />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    rerender(
      <Banc
        reprise={{
          cle: "reprise-1",
          texte: "un héron au bord de l'eau",
          modele: PAYANT.identifiant,
          resolution: "1024",
          repris: false,
        }}
      />,
    )

    await waitFor(() => expect(liste.value).toBe(PAYANT.identifiant))
    expect((screen.getByLabelText("Décris une image") as HTMLInputElement).value).toBe(
      "un héron au bord de l'eau",
    )
    expect(screen.getByRole("button", { name: "1024" }).getAttribute("aria-pressed")).toBe("true")
    // `repris: false` veut dire « avec le style du jeu » — la case le montre.
    expect((screen.getByLabelText("avec le style du jeu") as HTMLInputElement).checked).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: /^Fabriquer ·/ }))
    await waitFor(() => expect(appels.some((a) => a.url === "/api/generations")).toBe(true))
    const corps = appels.find((a) => a.url === "/api/generations")!.corps as Record<string, unknown>
    expect(corps.prompt).toBe("un héron au bord de l'eau")
    expect(corps.modele).toBe(PAYANT.identifiant)
    expect(corps.resolution).toBe("1024")
    expect(corps.repris).toBe(false)
  })

  test("reprendre deux fois la même carte de suite la remet à chaque fois — la clé change", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const uneReprise = (): Reprise => ({
      cle: crypto.randomUUID(),
      texte: "un héron",
      modele: QWEN.identifiant,
      resolution: "512",
      repris: true,
    })
    const { rerender } = render(<Banc reprise={uneReprise()} />)
    const champ = (await screen.findByLabelText("Décris une image")) as HTMLInputElement
    await waitFor(() => expect(champ.value).toBe("un héron"))

    // On corrige le texte à la main, comme le geste le promet...
    fireEvent.change(champ, { target: { value: "un héron corrigé" } })
    // ... et on reprend la même carte une seconde fois : la barre doit
    // revenir à la phrase d'origine, malgré une correction en cours.
    rerender(<Banc reprise={uneReprise()} />)
    await waitFor(() => expect(champ.value).toBe("un héron"))
  })

  // TS9 — le premier défaut vu au navigateur : « 3 » ne faisait qu'une image
  // avec un style local qui ne rend qu'une variation par appel, en silence.

  /** Le serveur doublé, mais **par lot** : chaque appel a son propre
   *  identifiant de génération (celui que le client envoie), pour ne pas
   *  confondre trois appels sous un seul « gen1 » comme `serveur()` le fait —
   *  ce que ce test doit justement distinguer. */
  function serveurParLot() {
    const appels: Appel[] = []
    const variationsParLot = new Map<string, number>()
    const reponse = (corps: unknown, statut = 200) =>
      Promise.resolve(
        new Response(JSON.stringify(corps), {
          status: statut,
          headers: { "Content-Type": "application/json" },
        }),
      )
    const emplacements = (lot: string, statut: string) =>
      Array.from({ length: variationsParLot.get(lot) ?? 1 }, (_, rang) => ({
        rang,
        statut,
        raison: null,
      }))
    const fetchDouble = vi.fn((entree: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entree)
      const methode = init?.method ?? "GET"
      const corps = init?.body ? JSON.parse(String(init.body)) : null
      appels.push({ url, methode, corps })
      if (url.startsWith("/api/models"))
        return reponse({ modeles: [UNE_A_LA_FOIS], couts: {} })
      if (url === "/api/generations" && methode === "POST") {
        const { identifiant: lot, variations } = corps as { identifiant: string; variations: number }
        variationsParLot.set(lot, variations)
        return reponse(
          { identifiant: lot, modele: "", projet: "marais", emplacements: emplacements(lot, "en_cours") },
          202,
        )
      }
      const lot = url.match(/^\/api\/generations\/([^/]+)$/)?.[1]
      if (lot)
        return reponse({ identifiant: lot, projet: "marais", emplacements: emplacements(lot, "reussie") })
      if (url.includes("/board/assets/")) return reponse({ carte: {}, deja_presente: false })
      return reponse({}, 404)
    })
    return { fetchDouble, appels }
  }

  test("3 versions avec un modèle qui n'en rend qu'une par appel lancent 3 appels et posent 3 images (TS9)", async () => {
    const { fetchDouble, appels } = serveurParLot()
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(UNE_A_LA_FOIS.identifiant))

    fireEvent.click(screen.getByRole("button", { name: "3" }))
    // Le bouton annonce le bon compte, jamais rogné en silence.
    expect(screen.getByRole("button", { name: /^Fabriquer 3 ·/ })).toBeTruthy()
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un renard" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    // **Trois appels, jamais un seul** — le cœur du défaut.
    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.methode === "POST")).toHaveLength(3),
    )
    const corps = appels
      .filter((a) => a.url === "/api/generations")
      .map((a) => a.corps as Record<string, unknown>)
    expect(corps.every((c) => c.variations === 1)).toBe(true)

    // Et les trois posent leur image — trois fantômes résolus, pas un.
    await waitFor(() =>
      expect(appels.filter((a) => a.url.includes("/board/assets/"))).toHaveLength(3),
    )
    await waitFor(() => expect(screen.queryAllByTestId("fantome")).toHaveLength(0))
  })

  test("un appel raté au milieu du lot garde son fantôme sans effacer les autres (TS9)", async () => {
    const { fetchDouble, appels } = serveurParLot()
    let comptePosts = 0
    const base = fetchDouble.getMockImplementation()!
    fetchDouble.mockImplementation((entree, init) => {
      const url = String(entree)
      const methode = init?.method ?? "GET"
      if (url === "/api/generations" && methode === "POST") {
        comptePosts += 1
        // Le deuxième appel échoue tout de suite, les deux autres partent
        // normalement — un échec isolé ne doit rien empêcher d'autre.
        if (comptePosts === 2) {
          const corps = init?.body ? JSON.parse(String(init.body)) : null
          appels.push({ url, methode, corps })
          return Promise.resolve(
            new Response(JSON.stringify({ raison: "crédit épuisé" }), {
              status: 402,
              headers: { "Content-Type": "application/json" },
            }),
          )
        }
      }
      return base(entree, init)
    })
    vi.stubGlobal("fetch", fetchDouble)
    render(<Banc />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(UNE_A_LA_FOIS.identifiant))

    fireEvent.click(screen.getByRole("button", { name: "3" }))
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un renard" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    // Les trois appels partent malgré l'échec du deuxième.
    await waitFor(() =>
      expect(appels.filter((a) => a.url === "/api/generations" && a.methode === "POST")).toHaveLength(3),
    )
    // Deux images se posent, un fantôme reste affiché avec sa raison.
    await waitFor(() =>
      expect(appels.filter((a) => a.url.includes("/board/assets/"))).toHaveLength(2),
    )
    await waitFor(() => expect(screen.queryAllByTestId("fantome")).toHaveLength(1))
  })

  // TS10 — « Développer ce sujet » : l'image part en référence d'édition, le
  // champ se vide avec un exemple grisé, et le résultat se relie à l'image
  // d'origine une fois posé.

  test("« Développer ce sujet » vide le champ, y met le curseur, et montre un exemple", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const { rerender } = render(<Banc developpement={null} />)
    const champ = (await screen.findByLabelText("Décris une image")) as HTMLInputElement
    fireEvent.change(champ, { target: { value: "un texte à moitié tapé" } })

    rerender(<Banc developpement={{ cle: "dev-1", exemple: "une variante plus sombre" }} />)

    await waitFor(() => expect(champ.value).toBe(""))
    expect(champ.placeholder).toBe("une variante plus sombre")
    expect(EXEMPLES_DEVELOPPEMENT).toContain(champ.placeholder)
    expect(document.activeElement).toBe(champ)
  })

  test("développer deux cartes de suite redéclenche l'effet — la clé change", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const { rerender } = render(
      <Banc developpement={{ cle: "dev-1", exemple: "la même de dos" }} />,
    )
    const champ = (await screen.findByLabelText("Décris une image")) as HTMLInputElement
    await waitFor(() => expect(champ.placeholder).toBe("la même de dos"))

    fireEvent.change(champ, { target: { value: "encore un brouillon" } })
    rerender(<Banc developpement={{ cle: "dev-2", exemple: "sans la cape" }} />)

    await waitFor(() => expect(champ.value).toBe(""))
    expect(champ.placeholder).toBe("sans la cape")
  })

  test("l'image posée se relie à sa carte d'origine (TS10)", async () => {
    const { fetchDouble, appels } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const liens: { de: Bout; vers: Bout }[] = []
    const refs = referencesPrises([carte("heron")], ["heron"])
    render(<Banc references={refs} origines={["heron"]} lier={(de, vers) => liens.push({ de, vers })} />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "le même, de dos" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() =>
      expect(appels.some((a) => a.url.includes("/board/assets/"))).toBe(true),
    )
    await waitFor(() => expect(liens).toHaveLength(1))
    expect(liens[0]).toEqual({
      de: { genre: "carte", valeur: "heron" },
      vers: { genre: "carte", valeur: "carte-gen1-0" },
    })
  })

  test("plusieurs versions développées se relient chacune à la même origine (TS10)", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const liens: { de: Bout; vers: Bout }[] = []
    const refs = referencesPrises([carte("heron")], ["heron"])
    render(<Banc references={refs} origines={["heron"]} lier={(de, vers) => liens.push({ de, vers })} />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    fireEvent.click(screen.getByRole("button", { name: "2" }))
    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "deux variantes" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => expect(liens).toHaveLength(2))
    expect(liens.every((l) => l.de.valeur === "heron")).toBe(true)
    expect(liens.map((l) => l.vers.valeur).sort()).toEqual(["carte-gen1-0", "carte-gen1-1"])
  })

  test("une fabrication ordinaire, sans origine, ne tire aucun lien", async () => {
    const { fetchDouble } = serveur()
    vi.stubGlobal("fetch", fetchDouble)
    const liens: unknown[] = []
    render(<Banc lier={(de, vers) => liens.push({ de, vers })} />)
    const liste = (await screen.findByLabelText("Modèle")) as HTMLSelectElement
    await waitFor(() => expect(liste.value).toBe(QWEN.identifiant))

    const champ = screen.getByLabelText("Décris une image")
    fireEvent.change(champ, { target: { value: "un héron" } })
    fireEvent.keyDown(champ, { key: "Enter" })

    await waitFor(() => expect(screen.queryAllByTestId("fantome")).toHaveLength(0))
    expect(liens).toHaveLength(0)
  })
})
