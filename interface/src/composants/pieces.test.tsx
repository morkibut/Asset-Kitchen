// CM5 — expliquer ce qui bloque (`docs/PLAN-assistant.md` § CM5). `fetch` est
// doublé : aucune route réelle, aucun modèle. Comme `CoupDeMain.test.tsx`, le
// flux est tenu ouvert par l'essai pour presser Échap **pendant** qu'il écrit
// (règle 8octies).
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Raison } from "./pieces"

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
const RAISON = "plafond du mois atteint ($1,00) — il se relève dans Réglages › Consommations"
const CE_QUI_PART = {
  morceaux: [
    { titre: "La consigne", texte: "Un geste de cet atelier…" },
    { titre: "Le contexte", texte: "Écran : Relire avant l'envoi…" },
  ],
  systeme: "…", message: "…",
  jamais: "Aucune image, aucune vignette, aucun chemin de fichier : du texte, et rien d'autre.",
}

function doublerFetch({ disponible = true, flux }: { disponible?: boolean; flux?: ReturnType<typeof fluxOuvert> } = {}) {
  const appels: Appel[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, corps: init?.body ? JSON.parse(String(init.body)) : null, signal: init?.signal })
    if (url === "/api/assist") return new Response(JSON.stringify({ disponible, raison: disponible ? null : "plafond atteint", modele: "OpenRouter:deepseek/deepseek-v4-flash" }))
    if (url === "/api/assist/blocage/preview") return new Response(JSON.stringify(CE_QUI_PART))
    if (url === "/api/assist/blocage") {
      if (!flux) throw new Error("aucun flux prévu")
      init?.signal?.addEventListener("abort", () => flux.couper(new DOMException("coupé", "AbortError")))
      return new Response(flux.flux, { headers: { "Content-Type": "application/x-ndjson" } })
    }
    throw new Error(`route inattendue : ${url}`)
  }))
  return appels
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Raison — « pourquoi › » développe un blocage (CM5)", () => {
  it("sans `ecran`, aucune marque n’apparaît — la raison courte reste seule", async () => {
    doublerFetch()
    render(<Raison texte={RAISON} />)
    expect(await screen.findByText(RAISON)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "pourquoi ›" })).toBeNull()
  })

  it("indisponible, la marque ne paraît pas — mais la raison courte, si", async () => {
    doublerFetch({ disponible: false })
    render(<Raison texte={RAISON} ecran="envoi" champ="Envoyer" />)
    expect(await screen.findByText(RAISON)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("button", { name: "pourquoi ›" })).toBeNull())
  })

  it("la raison courte reste affichée telle quelle, l’explication arrive à côté", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Raison texte={RAISON} ecran="envoi" champ="Envoyer" />)
    const marque = await screen.findByRole("button", { name: "pourquoi ›" })
    fireEvent.click(marque)

    // Ce qui part : la raison courte (deux fois — `texte` et `blocage`), l'écran, le geste.
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist/blocage")).toBe(true))
    const envoi = appels.find((a) => a.url === "/api/assist/blocage")!
    expect(envoi.corps).toEqual({ texte: RAISON, ecran: "envoi", champ: "Envoyer", blocage: RAISON })

    await act(async () => { flux.pousser({ genre: "texte", texte: "Un envoi précédent a déjà " }) })
    // La raison courte n'a pas bougé — jamais remplacée.
    expect(screen.getByText(RAISON)).toBeInTheDocument()
    expect(await screen.findByText(/Un envoi précédent a déjà/)).toBeInTheDocument()

    await act(async () => { flux.pousser({ genre: "texte", texte: "consommé le plafond." }); flux.pousser(FIN); flux.finir() })
    await waitFor(() => expect(screen.getByText(/consommé le plafond\./)).toBeInTheDocument())
    // La raison courte est toujours là, mot pour mot.
    expect(screen.getByText(RAISON)).toBeInTheDocument()
  })

  it("Échap pendant que ça écrit coupe l’appel et efface l’explication, sans toucher la raison", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Raison texte={RAISON} ecran="envoi" />)
    fireEvent.click(await screen.findByRole("button", { name: "pourquoi ›" }))
    await act(async () => { flux.pousser({ genre: "texte", texte: "le plaf" }) })
    await screen.findByText(/le plaf/)

    fireEvent.keyDown(document.body, { key: "Escape" })

    const envoi = appels.find((a) => a.url === "/api/assist/blocage")!
    expect(envoi.signal?.aborted).toBe(true)
    expect(screen.queryByText(/le plaf/)).toBeNull()
    expect(screen.getByText(RAISON)).toBeInTheDocument()
    // La marque revient : on peut redemander.
    expect(await screen.findByRole("button", { name: "pourquoi ›" })).toBeInTheDocument()
  })

  it("une explication revenue « je ne sais pas » s’annonce sobrement, jamais recopiée telle quelle", async () => {
    const flux = fluxOuvert()
    doublerFetch({ flux })
    render(<Raison texte={RAISON} ecran="envoi" />)
    fireEvent.click(await screen.findByRole("button", { name: "pourquoi ›" }))
    await act(async () => { flux.pousser({ genre: "texte", texte: "je ne sais pas" }); flux.pousser(FIN); flux.finir() })
    expect(await screen.findByText("Le coup de main ne sait pas expliquer ce blocage-ci.")).toBeInTheDocument()
    expect(screen.queryByText("je ne sais pas")).toBeNull()
  })

  it("« Voir ce qui part » montre ce qui part, mot pour mot", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Raison texte={RAISON} ecran="envoi" champ="Envoyer" />)
    fireEvent.click(await screen.findByRole("button", { name: "pourquoi ›" }))
    await act(async () => { flux.pousser({ genre: "texte", texte: "…" }) })
    fireEvent.click(await screen.findByRole("button", { name: "Voir ce qui part" }))

    for (const m of CE_QUI_PART.morceaux) {
      expect(await screen.findByText(m.titre)).toBeInTheDocument()
      expect(screen.getByText((_, n) => n?.classList.contains("whitespace-pre-wrap") === true && n.textContent === m.texte)).toBeInTheDocument()
    }
    const vu = appels.find((a) => a.url === "/api/assist/blocage/preview")!
    expect(vu.corps).toEqual({ texte: RAISON, ecran: "envoi", champ: "Envoyer", blocage: RAISON })
  })
})
