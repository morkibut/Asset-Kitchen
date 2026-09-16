import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { NavigationAtelier } from "./NavigationAtelier"

afterEach(cleanup)

it('garde les six destinations de la maquette et un seul chemin vers les réglages', () => {
  const aller = vi.fn(), replier = vi.fn()
  render(<NavigationAtelier jeu="Le marais" descriptionJeu="Pixel art · 32 px" actif="assets" travauxEnCours={2} replie={false} onReplier={replier} onAller={aller} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} />)
  const nav = within(screen.getByRole('navigation', { name: 'Atelier' }))
  expect(nav.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Le jeu', 'Univers & toile', 'Les sujets', 'Galerie', 'Fabrications', 'Livrer au jeu'])
  expect(nav.getByRole('button', { name: 'Les sujets' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('button', { name: 'Réglages' })).toHaveLength(1)
  expect(screen.queryByText('Les personnages')).not.toBeInTheDocument()
  fireEvent.click(nav.getByRole('button', { name: 'Fabrications' }))
  expect(aller).toHaveBeenCalledWith('fabrications')
  fireEvent.click(screen.getByRole('button', { name: 'Replier la navigation' }))
  expect(replier).toHaveBeenCalledWith(true)
})

it('ouvre le tiroir des brouillons depuis le pied de la colonne, sans devenir une neuvième porte', () => {
  const tiroir = vi.fn()
  render(<NavigationAtelier jeu="Le marais" actif="galerie" travauxEnCours={5} brouillons={3} replie={false} onReplier={vi.fn()} onAller={vi.fn()} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} onBrouillons={tiroir} />)
  // Ni dans « Atelier », ni dans « Préférences » : la liste fermée des huit
  // portes ne bouge pas (`docs/vocabulaire.html`).
  expect(within(screen.getByRole('navigation', { name: 'Atelier' })).queryByText(/Brouillons/)).not.toBeInTheDocument()
  expect(within(screen.getByRole('navigation', { name: 'Préférences' })).queryByText(/Brouillons/)).not.toBeInTheDocument()
  const porte = screen.getByRole('button', { name: 'Brouillons à reprendre · 3' })
  expect(porte).toHaveTextContent('Brouillons · 3')
  fireEvent.click(porte)
  expect(tiroir).toHaveBeenCalled()
  // Le compteur est celui qu'on lui donne, toutes familles comprises, et il ne
  // porte aucune couleur d'alerte.
  expect(screen.getByLabelText('5 fabrications en cours')).toHaveTextContent('5')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('garde toutes les destinations nommées et atteignables pendant le repli', () => {
  const aller = vi.fn()
  render(<NavigationAtelier jeu="Le marais" actif="univers" replie onReplier={vi.fn()} onAller={aller} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Univers & toile' }))
  expect(aller).toHaveBeenCalledWith('univers')
  expect(screen.getByRole('button', { name: 'Déplier la navigation' })).toHaveAttribute('aria-expanded', 'false')
})
