// La relecture croisée du coup de main (`docs/PLAN-assistant.md`, CM1 à CM7) — ce
// qui cassait **entre** les tranches, à l'écran. Chaque essai tombait avant son
// correctif (8octies) ; aucun ne met le produit au calme pour regarder : la
// proposition est ouverte **pendant** que la ligne de question s'ouvre (8octies).
//
// `fetch` est doublé : aucune route réelle, aucun modèle, aucun appel payé.
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { AvecCoupDeMain } from "./CoupDeMain"
import { DemanderIci } from "./DemanderIci"
import { Raison } from "./pieces"
import { relireDisponibilite } from "../coup-de-main-commun"

type Appel = { url: string; corps: unknown }

const FIN = { genre: "fin", issue: "repondu", raison: null, consomme: 0.00001, unite: "USD", cout_usd: 0.00001, cout_inconnu: false }
const CE_QUI_PART = {
  morceaux: [
    { titre: "La consigne", texte: "Un geste de cet atelier…" },
    { titre: "Le contexte", texte: "Écran : Relire avant l'envoi." },
  ],
  systeme: "…", message: "…",
  jamais: "Aucune image, aucune vignette, aucun chemin de fichier : du texte, et rien d'autre.",
}

function ndjson(...morceaux: object[]) {
  return new Response(morceaux.map((m) => JSON.stringify(m)).join("\n") + "\n", { headers: { "Content-Type": "application/x-ndjson" } })
}

function doublerFetch(etat: { disponible: boolean }) {
  const appels: Appel[] = []
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    appels.push({ url, corps: init?.body ? JSON.parse(String(init.body)) : null })
    if (url === "/api/assist") return new Response(JSON.stringify({ disponible: etat.disponible, raison: etat.disponible ? null : "plafond du mois atteint", modele: "OpenRouter:deepseek/deepseek-v4-flash" }))
    if (url === "/api/assist/ameliorer") return ndjson({ genre: "texte", texte: "old grey stone" }, FIN)
    if (url === "/api/assist/blocage") return ndjson({ genre: "texte", texte: "Il manque le texte à envoyer." }, FIN)
    if (url === "/api/assist/blocage/preview") return new Response(JSON.stringify(CE_QUI_PART))
    if (url === "/api/assist/question/preview") return new Response(JSON.stringify(CE_QUI_PART))
    throw new Error(`route inattendue : ${url}`)
  }))
  return appels
}

function UnChamp({ nom, initial = "de la pierre grise" }: { nom: string; initial?: string }) {
  const [texte, setTexte] = useState(initial)
  return <AvecCoupDeMain champ="matiere" texte={texte} onGarder={setTexte}>
    <label>{nom}<input value={texte} onChange={(e) => setTexte(e.target.value)} /></label>
  </AvecCoupDeMain>
}

const marques = () => screen.queryAllByRole("button", { name: "Proposer en anglais" })
const ligne = () => screen.queryByRole("group", { name: "Demander" })
const proposition = () => screen.queryByRole("group", { name: "Proposition en anglais" })

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe("Échap ne referme que le dernier ouvert", () => {
  it("une ligne de question ouverte sur une proposition : le premier Échap ferme la ligne, le second la proposition", async () => {
    doublerFetch({ disponible: true })
    render(<div><UnChamp nom="C’est fait de quoi ?" /><DemanderIci ecran="jeu-de-tuiles" /></div>)
    await waitFor(() => expect(marques()).toHaveLength(1))
    fireEvent.click(marques()[0])
    await screen.findByText("old grey stone")
    expect(proposition()).not.toBeNull()

    // La proposition est là, et l'on demande par-dessus, depuis le champ.
    ;(screen.getByLabelText("C’est fait de quoi ?") as HTMLInputElement).focus()
    fireEvent.keyDown(window, { key: "/", ctrlKey: true })
    await waitFor(() => expect(ligne()).not.toBeNull())

    fireEvent.keyDown(window, { key: "Escape" })
    expect(ligne()).toBeNull()
    expect(proposition()).not.toBeNull()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(proposition()).toBeNull()
  })

  it("Échap sur une explication ne referme pas l'écran autour", async () => {
    doublerFetch({ disponible: true })
    const fermerLEcran = vi.fn()
    const Ecran = () => {
      // L'écran d'envoi écoute Échap sur `window`, en bouillonnement.
      window.onkeydown = (e) => { if (e.key === "Escape") fermerLEcran() }
      return <Raison texte="rien à envoyer" ecran="envoi" champ="Envoyer" />
    }
    render(<Ecran />)
    fireEvent.click(await screen.findByRole("button", { name: "pourquoi ›" }))
    await screen.findByText("Il manque le texte à envoyer.")
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("group", { name: "Pourquoi c'est bloqué" })).toBeNull()
    expect(fermerLEcran).not.toHaveBeenCalled()
    window.onkeydown = null
  })
})

describe("la disponibilité, lue une fois pour tout l'écran", () => {
  it("vingt champs montés ensemble : un seul GET /api/assist", async () => {
    const appels = doublerFetch({ disponible: true })
    render(<div>{Array.from({ length: 20 }, (_, i) => <UnChamp key={i} nom={`Champ ${i}`} />)}</div>)
    await waitFor(() => expect(marques()).toHaveLength(20))
    expect(appels.filter((a) => a.url === "/api/assist")).toHaveLength(1)
  })

  it("ce qu'une marque apprend, toutes le savent : relue indisponible, toutes se taisent ; relevée, toutes reviennent", async () => {
    const etat = { disponible: true }
    doublerFetch(etat)
    render(<div><UnChamp nom="Un" /><UnChamp nom="Deux" /><UnChamp nom="Trois" /></div>)
    await waitFor(() => expect(marques()).toHaveLength(3))
    etat.disponible = false
    await act(async () => { await relireDisponibilite() })
    expect(marques()).toHaveLength(0)
    etat.disponible = true
    await act(async () => { await relireDisponibilite() })
    expect(marques()).toHaveLength(3)
  })
})

describe("« Demander », posé sur toute l'application", () => {
  it("s'ouvre depuis n'importe quel champ, emporte son nom et jamais sa valeur", async () => {
    const appels = doublerFetch({ disponible: true })
    render(<div>
      <label>Dossier du jeu<input defaultValue="C:\\Jeux\\Marais" /></label>
      <DemanderIci ecran="reglages" />
    </div>)
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist")).toBe(true))
    const dossier = screen.getByLabelText("Dossier du jeu") as HTMLInputElement
    dossier.focus()
    await waitFor(() => {
      fireEvent.keyDown(window, { key: "/", ctrlKey: true })
      expect(ligne()).not.toBeNull()
    })
    fireEvent.change(screen.getByLabelText("Ta question"), { target: { value: "à quoi ça sert ?" } })
    fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part" }))
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist/question/preview")).toBe(true))
    const vu = appels.find((a) => a.url === "/api/assist/question/preview")!
    expect(vu.corps).toEqual({ texte: "à quoi ça sert ?", ecran: "reglages", champ: "Dossier du jeu" })
    expect(JSON.stringify(vu.corps)).not.toContain("Marais")
  })

  it("sur un clavier français, Ctrl+Maj+: (qui donne « / ») l'ouvre", async () => {
    const appels = doublerFetch({ disponible: true })
    render(<DemanderIci ecran="codex" />)
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist")).toBe(true))
    await waitFor(() => {
      fireEvent.keyDown(window, { key: "/", code: "Period", ctrlKey: true, shiftKey: true })
      expect(ligne()).not.toBeNull()
    })
  })

  it("« Voir ce qui part » se referme quand la question change : il ne montre jamais une question qui ne partira pas", async () => {
    const appels = doublerFetch({ disponible: true })
    render(<DemanderIci ecran="codex" />)
    await waitFor(() => expect(appels.some((a) => a.url === "/api/assist")).toBe(true))
    await waitFor(() => {
      fireEvent.keyDown(window, { key: "/", ctrlKey: true })
      expect(ligne()).not.toBeNull()
    })
    const question = screen.getByLabelText("Ta question")
    fireEvent.change(question, { target: { value: "première" } })
    fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part" }))
    await screen.findByText("La consigne")
    fireEvent.change(question, { target: { value: "seconde, tout autre" } })
    expect(screen.queryByText("La consigne")).toBeNull()
  })
})

describe("« pourquoi › » dans la raison", () => {
  it("l'explication ouverte ne met ni <p>, ni <pre>, ni <div> dans le <p> de la raison", async () => {
    doublerFetch({ disponible: true })
    const { container } = render(<Raison texte="rien à envoyer" ecran="envoi" champ="Envoyer" />)
    fireEvent.click(await screen.findByRole("button", { name: "pourquoi ›" }))
    await screen.findByText("Il manque le texte à envoyer.")
    fireEvent.click(screen.getByRole("button", { name: "Voir ce qui part" }))
    await screen.findByText("La consigne")
    expect(container.querySelector("p p, p pre, p div")).toBeNull()
  })
})
