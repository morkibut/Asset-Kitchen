// CM4 — la touche qui demande, là où l'on travaille (`docs/PLAN-assistant.md` § CM4).
// `fetch` est doublé : aucune route réelle, aucun modèle. Le flux est tenu ouvert par
// l'essai, comme `CoupDeMain.test.tsx` (CM3) — les morceaux arrivent quand il les
// pousse, pour pouvoir presser Échap pendant que ça écrit.
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { AvecDemande } from "./DemanderIci"

type Appel = { url: string; corps: unknown; signal?: AbortSignal | null }

function fluxOuvert() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const flux = new ReadableStream<Uint8Array>({ start(c) { ctrl = c } })
  const encodeur = new TextEncoder()
  return {
    flux,
    pousser: (m: object) => ctrl.enqueue(encodeur.encode(JSON.stringify(m) + "\n")),
    finir: () => ctrl.close(),
    couper: (e: unknown) => { try { ctrl.error(e) } catch { /* déjà fermé */ } },
  }
}

const FIN = { genre: "fin", issue: "repondu", raison: null, consomme: 0.00001, unite: "USD", cout_usd: 0.00001, cout_inconnu: false }
const CE_QUI_PART = {
  morceaux: [
    { titre: "La consigne", texte: "Tu réponds à une question…" },
    { titre: "La fiche du produit", texte: "# Asset Kitchen — fiche produit" },
    { titre: "Le contexte", texte: "Écran : l'atelier d'un jeu de tuiles." },
    { titre: "Ton texte", texte: "———\nà quoi sert le motif ?\n———" },
  ],
  systeme: "…", message: "…",
  jamais: "Aucune image, aucune vignette, aucun chemin de fichier : du texte, et rien d'autre.",
}

function doublerFetch({ disponible = true, flux }: { disponible?: boolean; flux?: ReturnType<typeof fluxOuvert> } = {}) {
  const appels: Appel[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, corps: init?.body ? JSON.parse(String(init.body)) : null, signal: init?.signal })
    if (url === "/api/assist") return new Response(JSON.stringify({ disponible, raison: disponible ? null : "Il manque la clé OpenRouter.", modele: "OpenRouter:deepseek/deepseek-v4-flash" }))
    if (url === "/api/assist/question/preview") return new Response(JSON.stringify(CE_QUI_PART))
    if (url === "/api/assist/question") {
      if (!flux) throw new Error("aucun flux prévu")
      init?.signal?.addEventListener("abort", () => flux.couper(new DOMException("coupé", "AbortError")))
      return new Response(flux.flux, { headers: { "Content-Type": "application/x-ndjson" } })
    }
    throw new Error(`route inattendue : ${url}`)
  }))
  return appels
}

/** Un champ de travail, comme le tiroir des matières : un bouton avant, un champ dans
 *  la zone enveloppée, un champ après (hors zone) — pour prouver que la touche ne
 *  s'ouvre que depuis sa propre zone. */
function Ecran() {
  return <div>
    <button type="button">Avant</button>
    <AvecDemande ecran="jeu-de-tuiles">
      <label>Le motif<input defaultValue="dalles de Brumeval" /></label>
    </AvecDemande>
    <label>Ailleurs<input defaultValue="hors zone" /></label>
  </div>
}

const ctrlSlash = () => fireEvent.keyDown(window, { key: "/", ctrlKey: true })
const ligneDeQuestion = () => screen.queryByRole("group", { name: "Demander" })

/** Pose le focus, puis presse Ctrl+/ jusqu'à ce que la ligne s'ouvre — la
 *  disponibilité (`GET /api/assist`) se lit au montage, de façon asynchrone, et
 *  presser une fois de trop avant qu'elle réponde ne fait qu'attendre un peu
 *  (`waitFor` rejoue le geste, il ne le fait pas deux fois pour de vrai : la ligne
 *  une fois ouverte reste ouverte). */
async function ouvrirLaLigne(motif: HTMLInputElement) {
  motif.focus()
  await waitFor(() => {
    ctrlSlash()
    expect(ligneDeQuestion()).not.toBeNull()
  })
  return screen.getByLabelText("Ta question") as HTMLInputElement
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("La touche qui demande, là où l'on travaille (CM4)", () => {
  it("indisponible : Ctrl+/ ne fait rien, rien ne s'affiche (décision 6)", async () => {
    const appels = doublerFetch({ disponible: false })
    render(<Ecran />)
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist")).toBe(true))
    screen.getByLabelText("Le motif").focus()
    ctrlSlash()
    expect(ligneDeQuestion()).toBeNull()
  })

  it("Ctrl+/ ouvre la ligne là où l'on travaille, sans rien déplacer autour", async () => {
    doublerFetch({})
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    const question = await ouvrirLaLigne(motif)

    expect(ligneDeQuestion()).toBeInTheDocument()
    // Rien à l'écran ne s'est déplacé : le champ garde sa valeur, et le reste de
    // l'écran est intact — la ligne est une superposition, pas une insertion.
    expect(motif.value).toBe("dalles de Brumeval")
    expect(screen.getByLabelText("Ailleurs")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Avant" })).toBeInTheDocument()
    // Le focus se pose dans la ligne, prêt à écrire — au clavier seul.
    await waitFor(() => expect(document.activeElement).toBe(question))
  })

  it("Ctrl+/ hors de la zone enveloppée n'ouvre rien : la touche ne vole aucun geste ailleurs", async () => {
    doublerFetch({})
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    // La preuve que la disponibilité est bien acquise à ce point : ouvrir depuis le
    // champ enveloppé marche, puis on referme pour la suite de l'essai.
    await ouvrirLaLigne(motif)
    fireEvent.keyDown(window, { key: "Escape" })
    expect(ligneDeQuestion()).toBeNull()

    // Depuis « ailleurs », hors de la zone, la même touche ne fait rien.
    screen.getByLabelText("Ailleurs").focus()
    ctrlSlash()
    expect(ligneDeQuestion()).toBeNull()
  })

  it("le geste entier au clavier seul : ouvrir, écrire, lire, fermer", async () => {
    const flux = fluxOuvert()
    doublerFetch({ flux })
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    const question = await ouvrirLaLigne(motif)
    await waitFor(() => expect(document.activeElement).toBe(question))

    fireEvent.change(question, { target: { value: "à quoi sert le motif ?" } })
    fireEvent.keyDown(question, { key: "Enter" })

    await act(async () => { flux.pousser({ genre: "texte", texte: "Il dit comment la matière est posée." }) })
    expect(await screen.findByText("Il dit comment la matière est posée.")).toBeInTheDocument()
    await act(async () => { flux.pousser(FIN); flux.finir() })

    // Fermer, au clavier — le focus revient exactement là où on l'avait laissé.
    fireEvent.keyDown(window, { key: "Escape" })
    expect(ligneDeQuestion()).toBeNull()
    expect(document.activeElement).toBe(motif)
    expect(motif.value).toBe("dalles de Brumeval")
  })

  it("Échap pendant que ça écrit coupe l'appel et ne laisse aucune trace", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    const question = await ouvrirLaLigne(motif)
    fireEvent.change(question, { target: { value: "à quoi sert le motif ?" } })
    fireEvent.keyDown(question, { key: "Enter" })
    await act(async () => { flux.pousser({ genre: "texte", texte: "Il di" }) })
    await screen.findByText("Il di")

    fireEvent.keyDown(window, { key: "Escape" })

    const envoi = appels.find((a) => a.url === "/api/assist/question")!
    expect(envoi.signal?.aborted).toBe(true)
    expect(ligneDeQuestion()).toBeNull()
    expect(document.activeElement).toBe(motif)
    // Ce qui arriverait encore ne ressuscite rien.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByText(/Il di/)).toBeNull()
  })

  it("une question hors sujet répond « je ne sais pas », annoncé sobrement", async () => {
    const flux = fluxOuvert()
    doublerFetch({ flux })
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    const question = await ouvrirLaLigne(motif)
    fireEvent.change(question, { target: { value: "quel temps fait-il ?" } })
    fireEvent.keyDown(question, { key: "Enter" })
    await act(async () => { flux.pousser({ genre: "texte", texte: "je ne sais pas" }); flux.pousser(FIN); flux.finir() })

    expect(await screen.findByText(/ne sait pas répondre/)).toBeInTheDocument()
    expect(screen.queryByText("je ne sais pas")).toBeNull()
  })

  it("« Voir ce qui part » montre la consigne, la fiche, le contexte et la question", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Ecran />)
    const motif = await screen.findByLabelText("Le motif") as HTMLInputElement
    const question = await ouvrirLaLigne(motif)
    fireEvent.change(question, { target: { value: "à quoi sert le motif ?" } })
    fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part" }))

    for (const m of CE_QUI_PART.morceaux) {
      expect(await screen.findByText(m.titre)).toBeInTheDocument()
    }
    const vu = appels.find((a) => a.url === "/api/assist/question/preview")!
    expect(vu.corps).toEqual({ texte: "à quoi sert le motif ?", ecran: "jeu-de-tuiles" })
  })
})
