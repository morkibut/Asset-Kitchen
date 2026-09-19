// SN7 · Caler un son sur une animation : poser et retirer « image 3 : pas »
// sur la bande, l'entendre à chaque boucle, et changer la cadence sans que le
// repère quitte son image. Les routes sont doublées : rien ne part.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import type { Bande, Personnage } from "../api"
import { imagesTraversees, variante, type ReperesSonores } from "../api-reperes-sonores"
import { CalageSonore, animationsDuSujet, texteDuCalage } from "./CalageSonore"
import { rangDeLaBande } from "./Apercu"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

const MARCHE = { identifiant: "marche-sud", pose: "marche", direction: "sud", compte: 4, cadence: 8, sens: "boucle",
  case_largeur: 16, case_hauteur: 16, favori: true, cree_le: 1, rang: 0 } as unknown as Bande
const ANIMATIONS = [{ bande: MARCHE, nom: "marche · sud" }]
const repere = (image: number, cle = "pas") => ({ bande: "marche-sud", image, cle, nom: "Pas", nom_bande: "marche-sud", pose: "marche",
  direction: "sud", compte: 4, cadence: 8, signal: null })
const vueAvec = (...images: number[]): ReperesSonores => ({ projet: "jeu", sujet: "heros", reperes: images.map((k) => repere(k)),
  sons: { pas: ["s1", "s2", "s3"] }, revision: 1 })

function reponse(corps: unknown) {
  return Promise.resolve(new Response(JSON.stringify(corps), { status: 200, headers: { "Content-Type": "application/json" } }))
}

describe("les règles", () => {
  test("une variante au hasard, jamais deux fois la même de suite", () => {
    let derniere: number | null = null
    for (let i = 0; i < 200; i++) {
      const k = variante(3, derniere)
      expect(k).toBeGreaterThanOrEqual(0)
      expect(k).toBeLessThan(3)
      expect(k).not.toBe(derniere)
      derniere = k
    }
    expect(variante(1, 0)).toBe(0)
  })

  test("les images traversées entre deux pas, aller-retour compris", () => {
    const boucle = (p: number) => rangDeLaBande(p, 4, "boucle")
    expect(imagesTraversees(0, 1, boucle)).toEqual([2])
    // Un réveil en retard saute deux images : leurs repères sonnent quand même.
    expect(imagesTraversees(1, 4, boucle)).toEqual([3, 4, 1])
    const allerRetour = (p: number) => rangDeLaBande(p, 4, "aller-retour")
    expect(imagesTraversees(0, 6, allerRetour)).toEqual([2, 3, 4, 3, 2, 1])
  })

  test("« Calé sur » dit l'animation et ses images", () => {
    expect(texteDuCalage(vueAvec(3), "pas", ANIMATIONS)).toBe("marche · sud, image 3")
    expect(texteDuCalage(vueAvec(1, 3), "pas", ANIMATIONS)).toBe("marche · sud, images 1 et 3")
    expect(texteDuCalage(vueAvec(3), "attaque", ANIMATIONS)).toBe("")
  })

  test("une animation par mouvement et direction, celle qui sortirait dans le jeu", () => {
    const personnage = { cases: [{ pose: "marche", bandes: [MARCHE], directions: [{ identifiant: "sud", nom: "Sud", bandes: [MARCHE] }] }] } as unknown as Personnage
    expect(animationsDuSujet(personnage, [{ identifiant: "marche", nom: "Marche" } as never]).map((a) => a.nom)).toEqual(["Marche · sud"])
  })
})

describe("la bande", () => {
  test("cliquer une image y pose le repère ; la recliquer le retire", async () => {
    const appels: { url: string; methode: string }[] = []
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      appels.push({ url, methode: init?.method ?? "GET" })
      return reponse(init?.method === "DELETE" ? vueAvec() : vueAvec(2, 3))
    }))
    const onVue = vi.fn()
    render(<CalageSonore projet="jeu" sujet="heros" cle="pas" nom="Pas" animations={ANIMATIONS} vue={vueAvec(3)} onVue={onVue} onJouer={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Image 3" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Image 2" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText(/Image 3 : pas\./)).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Image 2" })) })
    expect(appels.at(-1)).toEqual({ url: "/api/projects/jeu/subjects/heros/sound-cues/marche-sud/2/pas", methode: "PUT" })
    expect(onVue).toHaveBeenLastCalledWith(vueAvec(2, 3))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Image 3" })) })
    expect(appels.at(-1)).toEqual({ url: "/api/projects/jeu/subjects/heros/sound-cues/marche-sud/3/pas", methode: "DELETE" })
  })

  test("« Jouer » fait entendre le son à chaque passage sur l'image, à chaque boucle", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] })
    const onJouer = vi.fn()
    render(<CalageSonore projet="jeu" sujet="heros" cle="pas" nom="Pas" animations={ANIMATIONS} vue={vueAvec(3)} onVue={vi.fn()} onJouer={onJouer} />)
    fireEvent.click(screen.getByRole("button", { name: "▶ Jouer" }))
    // Huit images par seconde, quatre images : l'image 3 passe à 250 ms, puis toutes les 500 ms.
    act(() => vi.advanceTimersByTime(250))
    expect(onJouer).toHaveBeenCalledTimes(1)
    expect(onJouer).toHaveBeenCalledWith("pas")
    act(() => vi.advanceTimersByTime(1000))
    expect(onJouer).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole("button", { name: "■ Arrêter" }))
    act(() => vi.advanceTimersByTime(1000))
    expect(onJouer).toHaveBeenCalledTimes(3)
  })

  test("changer la cadence garde le repère sur la même image", async () => {
    const corps: unknown[] = []
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => { corps.push(JSON.parse(String(init?.body ?? "null"))); return reponse({ ...MARCHE, cadence: 12 }) }))
    render(<CalageSonore projet="jeu" sujet="heros" cle="pas" nom="Pas" animations={ANIMATIONS} vue={vueAvec(3)} onVue={vi.fn()} onJouer={vi.fn()} />)
    await act(async () => { fireEvent.change(screen.getByRole("combobox", { name: "Cadence" }), { target: { value: "12" } }) })
    expect(corps).toEqual([{ cadence: 12 }])
    expect(screen.getByRole("combobox", { name: "Cadence" })).toHaveValue("12")
    expect(screen.getByRole("button", { name: "Image 3" })).toHaveAttribute("aria-pressed", "true")
  })
})
