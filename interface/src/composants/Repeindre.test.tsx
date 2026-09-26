// PX3 · Repeindre une zone — l'écran de la fabrique, `fetch` doublé.
//
// Ce qu'on vérifie : peindre la zone, écrire, lancer (le bouton annonce le
// temps avant de partir), garder, jeter, recommencer, rouvrir un calque, et le
// bouton grisé avec sa raison quand aucun modèle ne sait repeindre une zone.
//
// ⚠️ **Un essai laisse la zone tourner** (point 8octies) : on corrige le texte
// *pendant* que la zone se repeint, et « Recommencer » doit reprendre ce qui est
// parti pour ce calque-là, pas le brouillon d'après. Arrêter le suivi pour lire
// l'écran supprimerait précisément ce défaut.

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, test, vi } from "vitest"
import type { Asset } from "../api"
import type { CalqueRepeint, EtatDeLaZone } from "../api-zone"
import { EcranRepeindre } from "./Repeindre"

const ASSET = {
  identifiant: "img",
  label: "Héros",
  empreinte: "e1",
  largeur: 16,
  hauteur: 16,
  rendu_largeur: 16,
  rendu_hauteur: 16,
} as unknown as Asset

const TEMPS = { secondes: null, mesures: 0, vitesse: "environ 30 secondes par image" }

function calque(texte: string, identifiant = "calque-1"): CalqueRepeint {
  return {
    identifiant,
    empreinte: "c1",
    label: "Héros · zone",
    image: "img",
    texte,
    zone: [{ garde: true, rayon: 1, points: [[5, 4], [10, 4]], couleur: "" }],
    affinage: [],
    retouche: [],
    couleurs: 3,
    fond: "#808080",
    modele: "Local:zone",
    rendu_largeur: 16,
    rendu_hauteur: 16,
    cree_le: 1,
    generation: "g1",
    graine: 42,
    force: 0.75,
    parti: { texte: `pixel art, ${texte}`, negatif: "" },
    mesures: { pixels_hors_zone: 0, pixels_du_sujet_perdus: 0, pixels_changes: 12, pixels_de_la_zone: 40, couleurs_neuves: 2 },
  }
}

const OUTIL = { identifiant: "sdxl-retouche-zone", nom: "Retouche d'une zone", pret: true, manque: [], modele: "Local:zone", vitesse: TEMPS.vitesse }

function etat(sur: Partial<EtatDeLaZone> = {}): EtatDeLaZone {
  return {
    image: "img",
    modele: { identifiant: "Local:zone", nom: "Retouche d'une zone" },
    raison: null,
    outil: OUTIL,
    // PX7 : un seul moteur dans ces essais-là — les cinq se couvrent dans
    // `tests/test_px7_moteurs.py`, côté serveur, et dans les essais dédiés au
    // choix du modèle.
    outils: [OUTIL],
    modeles: [{ identifiant: "Local:zone", nom: "Retouche d'une zone", famille: "sdxl", raison: null, temps: TEMPS }],
    temps: TEMPS,
    force: { minimum: 0.5, maximum: 1, defaut: 0.9 },
    couleurs: { defaut: 4, maximum: 16 },
    calques: [],
    ...sur,
  }
}

type Appel = { url: string; methode: string; corps: unknown }

/** Le serveur doublé. `tours` : combien de lectures du suivi répondent « en
 *  cours » avant que le calque arrive — la zone tourne pendant ce temps. */
function doubler({ etatInitial = etat(), tours = 0, texteDuCalque = (t: string) => t } = {}) {
  const appels: Appel[] = []
  let lance = ""
  let lectures = 0
  let numero = 0
  let courant = etatInitial
  const repondre = (corps: unknown, statut = 200) =>
    new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } })
  const fetchDouble = vi.fn(async (entree: unknown, options?: RequestInit) => {
    const url = String(entree)
    const methode = options?.method ?? "GET"
    const corps = options?.body ? JSON.parse(String(options.body)) : null
    appels.push({ url, methode, corps })
    if (url === "/api/assets/img/zone" && methode === "GET") return repondre(courant)
    if (url === "/api/assets/img/zone/preview") return repondre({ texte: `pixel art, ${corps.texte}`, negatif: "", fond: "#808080" })
    if (url === "/api/assets/img/zone" && methode === "POST") {
      lance = texteDuCalque(corps.texte)
      lectures = 0
      numero += 1
      return repondre({ generation: `g${numero}`, statut: "en_attente", raison: null, calque: null, graine: null, force: null, parti: null }, 201)
    }
    if (url.startsWith("/api/zone/g")) {
      lectures += 1
      if (lectures <= tours) return repondre({ generation: "g", statut: "en_cours", raison: null, calque: null, graine: null, force: null, parti: null })
      const c = calque(lance, `calque-${numero}`)
      courant = { ...courant, calques: [c] }
      return repondre({ generation: "g", statut: "reussie", raison: null, calque: c, graine: c.graine, force: c.force, parti: c.parti })
    }
    if (url === "/api/assets/delete") return repondre({ supprimes: corps.identifiants, annulation_s: 10, expire_le: 0 })
    if (url.includes("/install")) {
      courant = etat()
      return repondre({})
    }
    return repondre({})
  })
  vi.stubGlobal("fetch", fetchDouble)
  return { appels }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent)
  HTMLElement.prototype.setPointerCapture = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function monter(onRetoucher = vi.fn()) {
  const onErreur = vi.fn()
  render(<EcranRepeindre asset={ASSET} onErreur={onErreur} onRetoucher={onRetoucher} intervalle={10} />)
  return { onErreur, onRetoucher }
}

async function peindreLaTete() {
  const toile = await waitFor(() => {
    const noeud = document.querySelector("[data-toile-main]")
    if (!noeud) throw new Error("pas de toile")
    return noeud as HTMLElement
  })
  toile.getBoundingClientRect = () => ({ left: 0, top: 0, width: 160, height: 160 }) as DOMRect
  fireEvent.pointerDown(toile, { button: 0, clientX: 55, clientY: 45, pointerId: 1 })
  fireEvent.pointerMove(toile, { clientX: 105, clientY: 45, pointerId: 1 })
  fireEvent.pointerUp(toile, { pointerId: 1 })
}

const bouton = () => document.querySelector("[data-lancer-la-zone]") as HTMLButtonElement
const ecrire = (texte: string) =>
  fireEvent.change(screen.getByRole("textbox", { name: "Ce qu'il faut mettre dans la zone" }), { target: { value: texte } })
const lancesAvec = (appels: Appel[]) =>
  appels.filter((a) => a.url === "/api/assets/img/zone" && a.methode === "POST").map((a) => a.corps as { texte: string; zone: unknown[]; force?: number; couleurs?: number; graine?: number })

test("sans modèle capable, le bouton est grisé avec la raison, et l'outil s'installe d'ici", async () => {
  const raison = "Aucun modèle installé ne sait repeindre une zone : installez l'outil « Retouche d'une zone »."
  const { appels } = doubler({ etatInitial: etat({
    modele: null, raison, temps: null,
    outils: [{ ...OUTIL, modele: null }],
    modeles: [],
  }) })
  monter()
  await waitFor(() => expect(document.querySelector("[data-sans-modele]")?.textContent).toContain("installez l'outil"))
  await peindreLaTete()
  ecrire("blue hair")
  expect(bouton().disabled).toBe(true)
  expect(screen.getAllByText(`— ${raison}`).length).toBe(1)
  fireEvent.click(screen.getByRole("button", { name: /Installer l’outil/ }))
  await waitFor(() => expect(bouton().disabled).toBe(false))
  expect(appels.some((a) => a.url === "/api/workflow-profiles/styles/sdxl-retouche-zone/install")).toBe(true)
  expect(lancesAvec(appels)).toEqual([])
})

test("peindre, écrire, lancer : le temps est annoncé avant, la zone et le texte partent, le calque revient", async () => {
  const { appels } = doubler({ tours: 1 })
  monter()
  await waitFor(() => expect(bouton().textContent).toContain("environ 30 secondes par image"))
  expect(screen.getByText(/Pas encore mesuré sur cette machine/)).toBeTruthy()
  // Rien de peint : grisé, et il dit pourquoi.
  expect(bouton().disabled).toBe(true)
  expect(screen.getByText("— Peins d'abord la zone à repeindre.")).toBeTruthy()
  await peindreLaTete()
  expect(screen.getByText("— Écris ce qu'il faut mettre dans la zone.")).toBeTruthy()
  ecrire("blue spiky hair")
  // Ce qui part se lit avant de partir.
  await waitFor(() => expect(document.querySelector("[data-ce-qui-part]")?.textContent).toContain("pixel art, blue spiky hair"))
  fireEvent.click(bouton())
  await waitFor(() => expect(document.querySelector("[data-resultat-de-la-zone]")).toBeTruthy())
  const [parti] = lancesAvec(appels)
  expect(parti.texte).toBe("blue spiky hair")
  expect(parti.zone).toEqual([{ garde: true, rayon: 1, points: [[5, 4], [10, 4]], couleur: "" }])
  expect(parti.graine).toBeUndefined()
  // Le calque revenu : sur l'image, et seul.
  expect(document.querySelector("[data-calque-repeint]")).toBeTruthy()
  expect(screen.getByText("l'image avec le calque")).toBeTruthy()
  expect(screen.getByText("le calque seul")).toBeTruthy()
  // Garder : le jugement se referme, le calque reste dans la liste.
  fireEvent.click(screen.getByRole("button", { name: "Garder" }))
  await waitFor(() => expect(document.querySelector("[data-resultat-de-la-zone]")).toBeNull())
  expect(document.querySelector("[data-calques-repeints]")?.textContent).toContain("blue spiky hair")
  expect(appels.some((a) => a.url === "/api/assets/delete")).toBe(false)
})

test("jeter supprime le calque, et rien d'autre", async () => {
  const { appels } = doubler()
  monter()
  await waitFor(() => expect(bouton().textContent).toContain("secondes"))
  await peindreLaTete()
  ecrire("blue hair")
  fireEvent.click(bouton())
  await waitFor(() => expect(document.querySelector("[data-resultat-de-la-zone]")).toBeTruthy())
  fireEvent.click(screen.getByRole("button", { name: "Jeter" }))
  await waitFor(() => expect(document.querySelector("[data-resultat-de-la-zone]")).toBeNull())
  expect(appels.filter((a) => a.url === "/api/assets/delete").map((a) => a.corps)).toEqual([{ identifiants: ["calque-1"] }])
  expect(lancesAvec(appels).length).toBe(1)
})

test("recommencer reprend ce qui est parti pour ce calque, même si le texte a changé pendant que la zone tournait", async () => {
  // **La zone tourne** pendant qu'on corrige le texte : le suivi reste vivant.
  const { appels } = doubler({ tours: 4 })
  monter()
  await waitFor(() => expect(bouton().textContent).toContain("secondes"))
  await peindreLaTete()
  ecrire("blue hair")
  fireEvent.click(bouton())
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("La zone se repeint"))
  ecrire("a red hat")
  await waitFor(() => expect(document.querySelector("[data-resultat-de-la-zone]")).toBeTruthy())
  expect(document.querySelector("[data-resultat-de-la-zone]")?.textContent).toContain("blue hair")
  fireEvent.click(screen.getByRole("button", { name: "Recommencer" }))
  await waitFor(() => expect(lancesAvec(appels).length).toBe(2))
  const [, second] = lancesAvec(appels)
  expect(second.texte).toBe("blue hair")
  // Le calque d'avant est jeté, les réglages du calque repartent, pas la graine.
  expect(appels.filter((a) => a.url === "/api/assets/delete").map((a) => a.corps)).toEqual([{ identifiants: ["calque-1"] }])
  expect(second.force).toBe(0.75)
  expect(second.couleurs).toBe(3)
  expect(second.graine).toBeUndefined()
})

test("un calque gardé se rouvre avec sa zone, son texte et ses réglages, et part à la main", async () => {
  const deja = calque("a red bandana", "calque-9")
  doubler({ etatInitial: etat({ calques: [deja] }) })
  const { onRetoucher } = monter()
  const ligne = await screen.findByRole("button", { name: /a red bandana/ })
  fireEvent.click(ligne)
  expect((screen.getByRole("textbox", { name: "Ce qu'il faut mettre dans la zone" }) as HTMLTextAreaElement).value).toBe("a red bandana")
  expect((screen.getByRole("spinbutton", { name: "Graine" }) as HTMLInputElement).value).toBe("42")
  expect((screen.getByRole("spinbutton", { name: "Couleurs neuves permises" }) as HTMLInputElement).value).toBe("3")
  expect((screen.getByRole("slider", { name: "Force de la retouche" }) as HTMLInputElement).value).toBe("0.75")
  expect(document.querySelector("[data-resultat-de-la-zone]")?.textContent).toContain("graine 42")
  // La zone rouverte est peinte : le bouton n'attend plus que d'être cliqué.
  expect(bouton().disabled).toBe(false)
  fireEvent.click(screen.getByRole("button", { name: "Retoucher ce calque ›" }))
  expect(onRetoucher).toHaveBeenCalledWith("calque-9")
})
