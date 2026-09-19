import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Tuiles } from "./Tuiles"
import { tuiles, type EnsembleTuiles } from "../api-tuiles"
import { api } from "../api"

vi.mock("./WorkflowsLocaux", () => ({ FabricationImageLocale: ({ onAsset }: { onAsset: (id: string) => void }) => <button onClick={() => onAsset('atlas')}>Garder le résultat fabriqué</button> }))
vi.mock("./BibliothequePourImage", () => ({ BibliothequePourImage: ({ onChoisir }: { onChoisir: (a: unknown) => void }) => <button onClick={() => onChoisir({ identifiant: 'atlas', projet: 'jeu', largeur: 16, hauteur: 16 })}>Atlas importé</button> }))
vi.mock("./pieces", () => ({ Libelle: ({ children }: { children: React.ReactNode }) => <>{children}</> }))

const ensemble = (): EnsembleTuiles => ({ identifiant: 'tuiles', projet: 'jeu', personnage: null, nom: 'Forêt', revision: 1, historique: [1], retenues: 0,
  grille: { taille: 16, marge: 0, espacement: 0, colonnes: 1, lignes: 1 }, source: { asset: 'atlas', empreinte: 'sha', dimensions: { largeur: 16, hauteur: 16 }, provenance: {} }, corrections: {},
  cellules: [{ x: 0, y: 0, nom: 'Herbe', retenue: false, terrain: null, correction: null, raccords: { nord: null, 'nord-est': null, est: null, 'sud-est': null, sud: null, 'sud-ouest': null, ouest: null, 'nord-ouest': null } }], terrains: [], carte: { largeur: 2, hauteur: 1, cases: [] },
  atlas_url: '/atlas.png', carte_url: '/carte.png', diagnostic: { pret: false, problemes: ['Retenez les tuiles à livrer.'], raccords: [], limite: 'Vérifiez les pixels.' } })

beforeEach(() => { localStorage.clear(); document.documentElement.style.setProperty('--color-apercu-herbe', '#458024') })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Ensembles de tuiles', () => {
  it('peint et retient une tuile, puis relit la révision enregistrée', async () => {
    const e = ensemble()
    vi.spyOn(tuiles, 'lister').mockResolvedValue([e])
    const garder = vi.spyOn(tuiles, 'garder').mockImplementation(async (_p, _id, _r, regles) => ({ ...e, ...regles, revision: 2, historique: [1, 2], retenues: 1, diagnostic: { ...e.diagnostic, pret: true, problemes: [] } }))
    const vue = render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir Forêt' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Retenir cette tuile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Case 2, 1 vide' }))
    expect(screen.getByRole('button', { name: 'Relire la livraison Godot' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Garder les changements' }))
    await waitFor(() => expect(garder).toHaveBeenCalled())
    expect(garder.mock.calls[0][3].carte.cases).toEqual([{ x: 1, y: 0, tuile_x: 0, tuile_y: 0 }])
    expect(garder.mock.calls[0][3].cellules[0].retenue).toBe(true)
    expect(await screen.findByRole('link', { name: 'Télécharger le paquet Godot' })).toHaveAttribute('href', '/api/projects/jeu/tilesets/tuiles/export.zip?revision=2')
    const garde = await garder.mock.results[0].value
    vue.unmount()
    vi.mocked(tuiles.lister).mockResolvedValue([garde])
    render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir Forêt' }))
    expect(screen.getByRole('button', { name: 'Case 2, 1 peinte' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Retenir cette tuile' })).toBeChecked()
  })

  it('réutilise le résultat réel de fabrication comme atlas sans deuxième appel', async () => {
    vi.spyOn(tuiles, 'lister').mockResolvedValue([])
    vi.spyOn(api, 'lireAsset').mockResolvedValue({ identifiant: 'atlas', projet: 'jeu', largeur: 16, hauteur: 16 } as never)
    const creer = vi.spyOn(tuiles, 'creer').mockResolvedValue(ensemble())
    render(<Tuiles projet="jeu" />)
    fireEvent.click(await screen.findByRole('button', { name: 'À partir d’une image déjà faite' }))
    fireEvent.change(screen.getByLabelText('Nom de l’ensemble'), { target: { value: 'Forêt' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fabriquer un atlas par IA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Garder le résultat fabriqué' }))
    await screen.findByAltText('Atlas choisi')
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’ensemble' }))
    await waitFor(() => expect(creer).toHaveBeenCalledWith('jeu', { nom: 'Forêt', image: 'atlas', grille: { taille: 16, marge: 0, espacement: 0 } }))
  })
})
