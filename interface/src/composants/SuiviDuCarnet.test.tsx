import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { LigneFabrication } from "../lignes-de-fabrication"

// La fusion des trois origines a ses propres essais (écran Fabrications) :
// ici, seule compte la règle de l'encadré — ce qui tourne, ce qui est arrivé,
// et ce qui a été vu.
let lignes: LigneFabrication[] = []
vi.mock("../lignes-de-fabrication", async (importer) => ({
  ...(await importer<typeof import("../lignes-de-fabrication")>()),
  useLignesDeFabrication: () => ({ lignes, erreur: "", setErreur: () => {}, relireLesTravaux: () => {}, poserEtatLocal: () => {} }),
}))
const { SuiviDuCarnet } = await import("./SuiviDuCarnet")

const T0 = 1_800_000_000
const ligne = (cle: string, humeur: LigneFabrication["humeur"], laceLe: number, plus: Partial<LigneFabrication> = {}): LigneFabrication => ({
  cle, origine: "appel", titre: cle, sousTitre: "", humeur, raison: null, laceLe, serieCle: null, vignette: { src: null, lettre: "I" }, ...plus,
})

function monter(props: Partial<Parameters<typeof SuiviDuCarnet>[0]> = {}) {
  const gestes = { onTravail: vi.fn(), onClip: vi.fn(), onAsset: vi.fn(), onFabrications: vi.fn() }
  const vue = render(<SuiviDuCarnet projet="le-marais" personnages={[]} chantier={[]} clips={[]} replie={false} {...gestes} {...props} />)
  return { ...gestes, vue }
}

beforeEach(() => { window.localStorage.clear(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(T0 * 1000) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("le pied du carnet : ce qui tourne et ce qui est arrivé", () => {
  it("ne montre rien quand rien ne tourne ni n'est arrivé", () => {
    lignes = []
    monter()
    expect(screen.queryByRole("region", { name: "Suivi des fabrications" })).toBeNull()
  })

  it("l'historique d'avant la première lecture n'est pas « arrivé »", () => {
    lignes = [ligne("vieille", "terminee", T0 - 3600)]
    monter()
    expect(screen.queryByText(/Arrivé/)).toBeNull()
  })

  it("montre ce qui tourne, avec son âge", () => {
    lignes = [ligne("mara marche", "en_cours", T0 - 120)]
    monter()
    expect(screen.getByText("En cours · 1")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ouvrir mara marche · depuis 2 min" })).toBeTruthy()
  })

  it("une génération vue tourner, partie avant le repère, arrive quand même", () => {
    window.localStorage.setItem("atelier.suivi-du-carnet.le-marais", JSON.stringify({ depuis: T0, vus: [], suivis: [] }))
    lignes = [ligne("longue", "en_cours", T0 - 600)]
    const { vue } = monter()
    lignes = [ligne("longue", "terminee", T0 - 600)]
    vue.rerender(<SuiviDuCarnet projet="le-marais" personnages={[]} chantier={[]} clips={[]} replie={false} onTravail={vi.fn()} onClip={vi.fn()} onAsset={vi.fn()} onFabrications={vi.fn()} />)
    expect(screen.getByText("Arrivé · 1")).toBeTruthy()
  })

  it("une arrivée reste après un rechargement, et part une fois ouverte", () => {
    window.localStorage.setItem("atelier.suivi-du-carnet.le-marais", JSON.stringify({ depuis: T0 - 60, vus: [], suivis: [] }))
    lignes = [ligne("image", "terminee", T0 - 30, { appel: { identifiant: "g1", modele: "", prompt: "", cree_le: T0 - 30, cout_usd: 0, statut: "reussie", reussies: 1, rates: [], vignette: "a1" } })]
    const premier = monter()
    premier.vue.unmount()
    const { onAsset } = monter()
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir image · à voir" }))
    expect(onAsset).toHaveBeenCalledWith("a1")
    expect(screen.queryByText(/Arrivé/)).toBeNull()
    cleanup(); monter()
    expect(screen.queryByText(/Arrivé/)).toBeNull()
  })

  it("une ratée arrive aussi, une annulation non", () => {
    window.localStorage.setItem("atelier.suivi-du-carnet.le-marais", JSON.stringify({ depuis: T0 - 60, vus: [], suivis: [] }))
    lignes = [
      ligne("ratée", "ratee", T0 - 10),
      ligne("annulée", "terminee", T0 - 10, { origine: "travail", travail: { identifiant: "t1", etat: "annule" } as LigneFabrication["travail"] }),
    ]
    monter()
    expect(screen.getByText("Arrivé · 1")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ouvrir ratée · ratée" })).toBeTruthy()
  })

  it("« Tout marquer vu » vide la liste d'un coup", () => {
    window.localStorage.setItem("atelier.suivi-du-carnet.le-marais", JSON.stringify({ depuis: T0 - 60, vus: [], suivis: [] }))
    lignes = [ligne("a", "terminee", T0 - 10), ligne("b", "terminee", T0 - 5)]
    monter()
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Tout marquer vu" })) })
    expect(screen.queryByText(/Arrivé/)).toBeNull()
  })

  it("un travail s'ouvre dans sa fenêtre", () => {
    lignes = [ligne("anim", "en_cours", T0 - 5, { origine: "travail", travail: { identifiant: "t9", etat: "en_cours" } as LigneFabrication["travail"] })]
    const { onTravail } = monter()
    fireEvent.click(screen.getByRole("button", { name: /Ouvrir anim/ }))
    expect(onTravail).toHaveBeenCalledWith("t9")
  })

  it("le titre d'une image est le texte tapé, pas le texte composé", async () => {
    const { texteDeLAuteur } = await vi.importActual<typeof import("../lignes-de-fabrication")>("../lignes-de-fabrication")
    expect(texteDeLAuteur("CONTEXT\n\nTechnical constraints: sprite\n\nREQUEST\n\nMara qui court")).toBe("Mara qui court")
    expect(texteDeLAuteur("Mara qui court")).toBe("Mara qui court")
  })

  it("replié, il ne garde que les deux compteurs", () => {
    window.localStorage.setItem("atelier.suivi-du-carnet.le-marais", JSON.stringify({ depuis: T0 - 60, vus: [], suivis: [] }))
    lignes = [ligne("x", "en_cours", T0 - 5), ligne("y", "terminee", T0 - 5)]
    const { onFabrications } = monter({ replie: true })
    fireEvent.click(screen.getByRole("button", { name: "1 en cours · 1 arrivée" }))
    expect(onFabrications).toHaveBeenCalled()
  })
})
