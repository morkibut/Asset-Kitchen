// CM3 — la marque au bout du champ, la proposition à côté, « Garder » ou Échap
// (`docs/PLAN-assistant.md` § CM3). `fetch` est doublé : aucune route réelle,
// aucun modèle. **Le flux est tenu ouvert par l'essai** — les morceaux arrivent
// quand il les pousse —, parce qu'Échap se presse pendant que ça écrit, pas après
// (règle 8octies : un essai qui attendrait la fin ne verrait pas l'appel coupé).
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { AvecCoupDeMain } from "./CoupDeMain"
import { nettoyer } from "../api-coup-de-main"

type Appel = { url: string; corps: unknown; signal?: AbortSignal | null }

/** Un flux qu'on remplit à la main, et dont on voit s'il a été coupé. */
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

const FIN = { genre: "fin", issue: "repondu", raison: null, consomme: 0.00002, unite: "USD", cout_usd: 0.00002, cout_inconnu: false }
const CE_QUI_PART = {
  morceaux: [
    { titre: "La consigne", texte: "Tu rends en anglais…" },
    { titre: "La fiche du produit", texte: "# Asset Kitchen — fiche produit" },
    { titre: "Le contexte", texte: "Champ : « Le motif »." },
    { titre: "Ton texte", texte: "———\ndalles de Brumeval\n———" },
  ],
  systeme: "…", message: "…",
  jamais: "Aucune image, aucune vignette, aucun chemin de fichier : du texte, et rien d'autre.",
}

function doublerFetch({ disponible = true, flux }: { disponible?: boolean; flux?: ReturnType<typeof fluxOuvert> } = {}) {
  const appels: Appel[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, corps: init?.body ? JSON.parse(String(init.body)) : null, signal: init?.signal })
    if (url === "/api/assist") return new Response(JSON.stringify({ disponible, raison: disponible ? null : "Il manque la clé OpenRouter.", modele: "OpenRouter:deepseek/deepseek-v4-flash" }))
    if (url === "/api/assist/ameliorer/preview") return new Response(JSON.stringify(CE_QUI_PART))
    if (url === "/api/assist/ameliorer") {
      if (!flux) throw new Error("aucun flux prévu")
      init?.signal?.addEventListener("abort", () => flux.couper(new DOMException("coupé", "AbortError")))
      return new Response(flux.flux, { headers: { "Content-Type": "application/x-ndjson" } })
    }
    throw new Error(`route inattendue : ${url}`)
  }))
  return appels
}

/** Les deux champs du tiroir des matières, chacun avec sa marque — et un bouton
 *  Générer qui compte ses clics : rien ne doit l'atteindre sans l'auteur. */
function Tiroir({ onGenerer = () => undefined }: { onGenerer?: () => void }) {
  const [pierre, setPierre] = useState("vieux granit")
  const [motif, setMotif] = useState("dalles de Brumeval, deux par deux")
  return <div>
    <AvecCoupDeMain champ="matiere" projet="jeu" texte={pierre} onGarder={setPierre}>
      <label>C’est fait de quoi ?<input value={pierre} onChange={(e) => setPierre(e.target.value)} /></label>
    </AvecCoupDeMain>
    <AvecCoupDeMain champ="motif" projet="jeu" texte={motif} onGarder={setMotif}>
      <label>Le motif<input value={motif} onChange={(e) => setMotif(e.target.value)} /></label>
    </AvecCoupDeMain>
    <button type="button" onClick={onGenerer}>Générer</button>
  </div>
}

const champ = (nom: string) => screen.getByLabelText(nom) as HTMLInputElement
const marques = () => screen.queryAllByRole("button", { name: "Proposer en anglais" })

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Le coup de main au bout d’un champ (CM3)", () => {
  it("sans clé, la marque n’apparaît pas, et rien d’autre ne le dit", async () => {
    const appels = doublerFetch({ disponible: false })
    render(<Tiroir />)
    await waitFor(() => expect(appels.filter((a) => a.url === "/api/assist")).toHaveLength(2))
    expect(marques()).toHaveLength(0)
    expect(screen.queryByText(/clé/)).toBeNull()
  })

  it("la proposition s’affiche à côté, le champ garde le texte de l’auteur, et « Garder » remplit ce champ-là seulement", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    const generer = vi.fn()
    render(<Tiroir onGenerer={generer} />)
    await waitFor(() => expect(marques()).toHaveLength(2))
    fireEvent.click(marques()[1]) // la marque du motif

    // Ce qui part : le texte du champ, le champ nommé, le jeu — et jamais une consigne.
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist/ameliorer")).toBe(true))
    const envoi = appels.find((a) => a.url === "/api/assist/ameliorer")!
    expect(envoi.corps).toEqual({ texte: "dalles de Brumeval, deux par deux", champ: "motif", projet: "jeu" })

    // La première syllabe s'affiche pendant que la suite n'existe pas encore.
    await act(async () => { flux.pousser({ genre: "texte", texte: "Brumeval slabs," }) })
    const proposition = await screen.findByRole("group", { name: "Proposition en anglais" })
    expect(proposition).toHaveTextContent("Brumeval slabs,")
    expect(screen.getByRole("button", { name: "Garder" })).toBeDisabled()
    // À côté, jamais à la place : le champ n'a pas bougé.
    expect(champ("Le motif").value).toBe("dalles de Brumeval, deux par deux")

    await act(async () => { flux.pousser({ genre: "texte", texte: " two by two" }); flux.pousser(FIN); flux.finir() })
    await waitFor(() => expect(screen.getByRole("button", { name: "Garder" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "Garder" }))

    expect(champ("Le motif").value).toBe("Brumeval slabs, two by two")
    // L'autre champ n'a pas bougé (TU12), la proposition est partie, et rien n'a généré.
    expect(champ("C’est fait de quoi ?").value).toBe("vieux granit")
    expect(screen.queryByRole("group", { name: "Proposition en anglais" })).toBeNull()
    expect(generer).not.toHaveBeenCalled()
    expect(appels.map((a) => a.url).filter((u) => u !== "/api/assist")).toEqual(["/api/assist/ameliorer"])
  })

  it("Échap pendant que ça écrit coupe l’appel et ne laisse aucune trace", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Tiroir />)
    await waitFor(() => expect(marques()).toHaveLength(2))
    fireEvent.click(marques()[0])
    await act(async () => { flux.pousser({ genre: "texte", texte: "old gra" }) })
    await screen.findByRole("group", { name: "Proposition en anglais" })

    // Le focus n'est nulle part en particulier : Échap vaut quand même.
    fireEvent.keyDown(document.body, { key: "Escape" })

    const envoi = appels.find((a) => a.url === "/api/assist/ameliorer")!
    expect(envoi.signal?.aborted).toBe(true)
    expect(screen.queryByRole("group", { name: "Proposition en anglais" })).toBeNull()
    expect(champ("C’est fait de quoi ?").value).toBe("vieux granit")
    // Ce qui arriverait encore ne ressuscite rien.
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByText(/old gra/)).toBeNull()
    // La marque revient : on peut redemander.
    expect(marques()).toHaveLength(2)
  })

  it("« Voir ce qui part » montre la consigne, la fiche, le contexte et le texte, tels que le serveur les compose", async () => {
    const flux = fluxOuvert()
    const appels = doublerFetch({ flux })
    render(<Tiroir />)
    await waitFor(() => expect(marques()).toHaveLength(2))
    fireEvent.click(marques()[1])
    await act(async () => { flux.pousser({ genre: "texte", texte: "slabs" }) })
    // Le champ change **après** l'envoi : ce qui est montré est ce qui est parti.
    fireEvent.change(champ("Le motif"), { target: { value: "autre chose" } })
    fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part" }))

    for (const m of CE_QUI_PART.morceaux) {
      expect(await screen.findByText(m.titre)).toBeInTheDocument()
      expect(screen.getByText((_, n) => n?.tagName === "PRE" && n.textContent === m.texte)).toBeInTheDocument()
    }
    expect(screen.getByText(/aucun chemin de fichier/)).toBeInTheDocument()
    const vu = appels.find((a) => a.url === "/api/assist/ameliorer/preview")!
    expect(vu.corps).toEqual({ texte: "dalles de Brumeval, deux par deux", champ: "motif", projet: "jeu" })
  })

  it("un appel qui revient sans réponse se tait : la proposition disparaît sans phrase d’erreur", async () => {
    const flux = fluxOuvert()
    doublerFetch({ flux })
    render(<Tiroir />)
    await waitFor(() => expect(marques()).toHaveLength(2))
    fireEvent.click(marques()[0])
    await act(async () => { flux.pousser({ genre: "texte", texte: "half" }); flux.pousser({ ...FIN, issue: "abandonne", raison: "délai dépassé" }); flux.finir() })
    await waitFor(() => expect(screen.queryByRole("group", { name: "Proposition en anglais" })).toBeNull())
    expect(screen.queryByText(/délai/)).toBeNull()
    expect(champ("C’est fait de quoi ?").value).toBe("vieux granit")
  })

  it("« Garder » met une ligne, sans les guillemets qu’un modèle ajoute parfois", () => {
    expect(nettoyer("  \"ancient stone paving,\n Tolkien\"  ")).toBe("ancient stone paving, Tolkien")
    expect(nettoyer("« dark Sylvebrune wood »")).toBe("dark Sylvebrune wood")
    expect(nettoyer("the \"old\" stone")).toBe("the \"old\" stone")
  })
})
