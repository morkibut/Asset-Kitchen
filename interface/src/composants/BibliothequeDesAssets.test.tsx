import { afterEach, expect, it, vi } from "vitest"
import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BibliothequeDesAssets } from "./BibliothequeDesAssets"
import { api, type GrilleDeFamille, type Piece, type SujetDeLaGrille } from "../api"
import { MemoireDuParcours } from "./MemoireDuParcours"

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const sujet = (id: string): SujetDeLaGrille => ({ identifiant: id, projet: 'jeu', nom: id, description: 'Un héros', type: 'personnage', cree_le: 1, vignette: null, collections: [], compte: { images: { fait: 0, attendu: 1 }, bandes: { fait: 0, attendu: 1 }, poses: { fait: 0, attendu: 1 }, complet: false, detail: [] } })
const grille = (sujets: SujetDeLaGrille[]): GrilleDeFamille => ({ personnages: sujets, total: sujets.length, groupes: [{ identifiant: 'heros', nom: 'Héros', sujets: 0 }], filtres: { tous: sujets.length, incomplets: sujets.length, 'sans-description': 0 } })
const props = () => ({ jeu: 'jeu', pieces: [], rafraichi: 0, onOuvrir: vi.fn(), onPiece: vi.fn(), onFamille: vi.fn(), onGalerie: vi.fn() })

it('ouvre une collection dans la bibliothèque et expose les ateliers spécialisés', async () => {
  const lister = vi.spyOn(api, 'familleDeSujets').mockImplementation(async f => grille(f === 'personnages' ? [sujet('Pèlerin')] : []))
  const tuiles = vi.fn(), sons = vi.fn()
  render(<BibliothequeDesAssets {...props()} onTuiles={tuiles} onSons={sons} />)
  await screen.findByRole('button', { name: /Pèlerin/ })
  const nav = within(screen.getByRole('navigation', { name: 'Familles et collections' }))
  fireEvent.click(nav.getByRole('button', { name: /Personnages/ }))
  fireEvent.click(await nav.findByRole('button', { name: /Héros/ }))
  await waitFor(() => expect(lister).toHaveBeenCalledWith('personnages', expect.objectContaining({ collection: 'heros', tri: 'nom' })))
  fireEvent.click(nav.getByRole('button', { name: 'Les tuiles' })); fireEvent.click(nav.getByRole('button', { name: 'Les sons' }))
  expect(tuiles).toHaveBeenCalledOnce(); expect(sons).toHaveBeenCalledOnce()
})

it('garde les échecs de rangement sélectionnés après une réussite partielle', async () => {
  vi.spyOn(api, 'familleDeSujets').mockImplementation(async f => grille(f === 'personnages' ? [sujet('Alpha'), sujet('Beta')] : []))
  const ranger = vi.spyOn(api, 'rangerSujet').mockImplementation(async (_c, _j, s) => { if (s === 'Beta') throw new Error('Disque momentanément occupé'); return {} as never })
  render(<BibliothequeDesAssets {...props()} />)
  await screen.findByRole('button', { name: /Alpha/ })
  fireEvent.click(screen.getByRole('button', { name: 'Sélectionner les sujets affichés' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ranger la sélection' }))
  fireEvent.click(screen.getByRole('button', { name: 'Garder le rangement' }))
  await waitFor(() => expect(ranger).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('alert')).toHaveTextContent('1 rangement(s) n’ont pas abouti')
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Beta' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Alpha' })).not.toBeChecked()
  })
})

it('un équipement associé montre un aperçu identifiable, ou dit qu’il reste à créer', async () => {
  // Critère AU2 : « Les équipements associés montrent un aperçu identifiable. »
  // Cette liste existait déjà (`apercusDesPieces`), mais rien ne la
  // vérifiait — les essais du fichier passent tous `pieces: []`.
  vi.spyOn(api, 'familleDeSujets').mockImplementation(async () => grille([]))
  const heaume: Piece = {
    identifiant: 'heaume',
    nom: 'Le heaume',
    description: '',
    emplacement: '',
    portee: 'contenue',
    concept_arts: ['carte-du-heaume'],
  }
  const sac: Piece = {
    identifiant: 'sac',
    nom: 'Le sac',
    description: '',
    emplacement: '',
    portee: 'contenue',
    concept_arts: [],
  }
  render(<BibliothequeDesAssets {...props()} pieces={[heaume, sac]} />)

  const nav = within(screen.getByRole('navigation', { name: 'Familles et collections' }))
  fireEvent.click(nav.getByRole('button', { name: /Équipement/ }))

  // Une pièce qui a un concept art montre son image, identifiable par son
  // adresse — la même que celle de la fiche de la carte.
  const ligneHeaume = (await screen.findByText('Le heaume')).closest('li')!
  // `alt=""` retire l'image de l'arbre d'accessibilité (c'est voulu, la
  // légende voisine porte déjà le nom) : on la retrouve par sa balise.
  expect(ligneHeaume.querySelector('img')?.getAttribute('src')).toBe(
    api.imageCarte('carte-du-heaume', ''),
  )

  // Une pièce sans aucun retenu ni concept art le dit, plutôt que de
  // montrer un cadre vide sans explication.
  const ligneSac = screen.getByText('Le sac').closest('li')!
  expect(within(ligneSac).getByText('À créer')).toBeTruthy()
  expect(ligneSac.querySelector('img')).toBeNull()
})

it('retrouve la collection, la recherche et la vue après retour depuis une fiche', async () => {
  const lister = vi.spyOn(api, 'familleDeSujets').mockImplementation(async f => grille(f === 'personnages' ? [sujet('Pèlerin')] : []))
  function Parcours() {
    const [visible, setVisible] = useState(true)
    return <MemoireDuParcours><button onClick={() => setVisible(v => !v)}>Changer d’écran</button>{visible && <BibliothequeDesAssets {...props()} />}</MemoireDuParcours>
  }
  render(<Parcours />)
  await screen.findByRole('button', { name: /Pèlerin/ })
  const nav = within(screen.getByRole('navigation', { name: 'Familles et collections' }))
  fireEvent.click(nav.getByRole('button', { name: /Personnages/ }))
  fireEvent.click(await nav.findByRole('button', { name: /Héros/ }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'pèlerin' } })
  fireEvent.click(screen.getByRole('button', { name: 'Grille' }))
  fireEvent.click(screen.getByRole('button', { name: 'Changer d’écran' }))
  fireEvent.click(screen.getByRole('button', { name: 'Changer d’écran' }))
  expect(screen.getByRole('searchbox')).toHaveValue('pèlerin')
  expect(screen.getByRole('button', { name: 'Grille' })).toHaveAttribute('aria-pressed', 'true')
  await waitFor(() => expect(lister).toHaveBeenCalledWith('personnages', expect.objectContaining({ collection: 'heros', recherche: 'pèlerin' })))
})
