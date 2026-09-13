// AU21 · Une vidéo posée sur la toile y arrive, au lieu d'être refusée.
//
// **Le refus disait vrai sans être utile** : *« … n'est pas une image »*. La
// toile sait porter une vidéo depuis `AU18` — une carte qui se rejoue —, mais
// seulement par le bouton *Poser sur la toile* de la fiche d'un clip. Poser le
// fichier directement était le geste évident, et c'était le seul qui ne
// marchait pas.
//
// Ces essais tiennent la chaîne en deux temps : le fichier devient un clip du
// jeu, puis ce clip paraît sur la toile. Et ils tiennent surtout **ce qui n'a
// pas changé** : une image reste une image, et un doublon reste un doublon.

import { render, fireEvent, waitFor, cleanup } from "@testing-library/react"
import { describe, expect, test, vi, beforeEach } from "vitest"
import { api } from "../api"
import { useCollage, useDepot } from "./Tableau"

const JEU = "le-marais"

/** Une surface minuscule qui branche le collage et le dépôt, comme la toile.
 *  On ne monte pas l'écran entier : ce qui est mesuré ici est l'aiguillage
 *  entre une image et une vidéo, et rien d'autre. */
function Surface({ onErreur, onRafraichir }: { onErreur: (r: string) => void; onRafraichir: () => void }) {
  const collage = useCollage({ projet: JEU, onErreur, onRafraichir })
  const depot = useDepot(collage.collerFichier, collage.collerTexte)
  return <div data-testid="toile" {...depot.props} />
}

const deposer = (surface: HTMLElement, fichier: File) =>
  fireEvent.drop(surface, {
    dataTransfer: { files: [fichier], types: ["Files"], getData: () => "" },
  })

const video = (nom = "champy-marche-est.mp4", type = "video/mp4") =>
  new File(["des octets"], nom, { type })

describe("une vidéo posée sur la toile", () => {
  // **Le démontage est explicite** : ce fichier monte quatre fois la même
  // surface, et sans lui `getByTestId` en trouverait quatre au quatrième essai.
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test("devient un clip du jeu, puis une carte sur la toile", async () => {
    const importer = vi
      .spyOn(api, "importerClip")
      .mockResolvedValue({ clip: { identifiant: "clip-1" }, doublon: null } as never)
    const poser = vi
      .spyOn(api, "poserClipSurToile")
      .mockResolvedValue({ carte: {}, deja_presente: false } as never)
    const onRafraichir = vi.fn()
    const onErreur = vi.fn()

    const { getByTestId } = render(<Surface onErreur={onErreur} onRafraichir={onRafraichir} />)
    deposer(getByTestId("toile"), video())

    await waitFor(() => expect(poser).toHaveBeenCalledWith(JEU, "clip-1"))
    expect(importer).toHaveBeenCalled()
    expect(onRafraichir).toHaveBeenCalled()
    // **Et surtout : aucun refus.** C'est le défaut que la tranche lève.
    expect(onErreur).not.toHaveBeenCalled()
  })

  test("une vidéo déjà entrée se pose quand même", async () => {
    // **Un doublon n'est pas un refus.** La vidéo est déjà dans le jeu ; ce que
    // l'auteur demande ici est de la *voir sur la toile*. Refuser au motif
    // qu'elle existe serait le défaut d'`AU18` à l'identique — un « déjà là »
    // sans rien à montrer.
    vi.spyOn(api, "importerClip").mockResolvedValue({
      clip: null,
      doublon: { identifiant: "clip-ancien" },
    } as never)
    const poser = vi
      .spyOn(api, "poserClipSurToile")
      .mockResolvedValue({ carte: {}, deja_presente: false } as never)

    const { getByTestId } = render(<Surface onErreur={vi.fn()} onRafraichir={vi.fn()} />)
    deposer(getByTestId("toile"), video())

    await waitFor(() => expect(poser).toHaveBeenCalledWith(JEU, "clip-ancien"))
  })

  test("l’extension suffit quand le navigateur ne donne pas de type", async () => {
    // Mesuré : un fichier glissé depuis certains explorateurs arrive avec un
    // `type` vide. Se fier au seul en-tête MIME renverrait alors la vidéo dans
    // la chaîne des images, c'est-à-dire au refus qu'on vient de lever.
    const importer = vi
      .spyOn(api, "importerClip")
      .mockResolvedValue({ clip: { identifiant: "clip-2" }, doublon: null } as never)
    vi.spyOn(api, "poserClipSurToile").mockResolvedValue({ carte: {}, deja_presente: false } as never)

    const { getByTestId } = render(<Surface onErreur={vi.fn()} onRafraichir={vi.fn()} />)
    deposer(getByTestId("toile"), video("sans-type.webm", ""))

    await waitFor(() => expect(importer).toHaveBeenCalled())
  })

  test("une image reste une image, et passe par le collage d’avant", async () => {
    const coller = vi
      .spyOn(api, "collerImage")
      .mockResolvedValue({ carte: {}, doublon: null } as never)
    const importer = vi.spyOn(api, "importerClip")

    const { getByTestId } = render(<Surface onErreur={vi.fn()} onRafraichir={vi.fn()} />)
    deposer(getByTestId("toile"), new File(["x"], "artwork.png", { type: "image/png" }))

    await waitFor(() => expect(coller).toHaveBeenCalled())
    expect(importer).not.toHaveBeenCalled()
  })
})
