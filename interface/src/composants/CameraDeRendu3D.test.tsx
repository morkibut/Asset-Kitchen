import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, test, vi } from "vitest"
import { useState } from "react"
import { CameraDeRendu3D } from "./CameraDeRendu3D"
import type { Catalogue3D, Demande3D } from "../api-3d"
vi.mock("./ApercuModele3D", () => ({ default: ({ onCamera }: { onCamera: (c: { azimut: number; elevation: number }) => void }) => <button onClick={() => onCamera({ azimut: 137, elevation: 22 })}>Utiliser cet angle pour le rendu</button> }))
const catalogue = { angles: [{ valeur: "face", azimut: 0, elevation: 0 }], angle_defaut: "face", defaut: "Marche", camera_libre: { azimut: { minimum: 0, maximum: 360, pas: 1 }, elevation: { minimum: -90, maximum: 90, pas: 1 } }, plage_animation: { minimum: 0, maximum: 100, unite: "%" } } as Catalogue3D
beforeEach(cleanup)
test("l’angle de la vue devient le réglage du rendu ; la pose demande une seule frame", async () => {
  let lu: Demande3D
  function Ecran() {
    const [demande, set] = useState<Demande3D>({ cle: "cle", etape: "rendu", personnage_externe: "hero", reglages: {}, cadence: 8 })
    lu = demande
    return <CameraDeRendu3D catalogue={catalogue} demande={demande} onChanger={(v) => set((d) => ({ ...d, ...v }))} />
  }
  render(<Ecran />)
  fireEvent.click(screen.getByRole("button", { name: "Choisir l’angle sur le modèle" }))
  fireEvent.click(await screen.findByRole("button", { name: "Utiliser cet angle pour le rendu" }))
  expect(screen.getByLabelText("Azimut du rendu")).toHaveValue(137)
  fireEvent.change(screen.getByLabelText("Élévation du rendu — curseur"), { target: { value: "41" } })
  expect(lu!.camera).toEqual({ azimut: 137, elevation: 41 })
  fireEvent.click(screen.getByLabelText("Choisir une portion du mouvement"))
  fireEvent.change(screen.getByLabelText("debut du mouvement"), { target: { value: "24" } })
  fireEvent.click(screen.getByLabelText("Une seule frame (pose)"))
  expect(lu!.plage).toEqual({ debut: 24, fin: 24 })
  expect(lu!.reglages.nombre_images).toBe(1)
})
