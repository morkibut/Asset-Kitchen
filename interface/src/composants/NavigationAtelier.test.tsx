import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { NavigationAtelier } from "./NavigationAtelier"

afterEach(cleanup)

it('garde les six destinations de la maquette et un seul chemin vers les réglages', () => {
  const aller = vi.fn(), replier = vi.fn()
  render(<NavigationAtelier jeu="Le marais" descriptionJeu="Pixel art · 32 px" actif="assets" travauxEnCours={2} replie={false} onReplier={replier} onAller={aller} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} />)
  const nav = within(screen.getByRole('navigation', { name: 'Atelier' }))
  expect(nav.getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(['Le jeu', 'Univers & toile', 'Les assets', 'Galerie', 'Fabrications', 'Livrer au jeu'])
  expect(nav.getByRole('button', { name: 'Les assets' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getAllByRole('button', { name: 'Réglages' })).toHaveLength(1)
  expect(screen.queryByText('Les personnages')).not.toBeInTheDocument()
  fireEvent.click(nav.getByRole('button', { name: 'Fabrications' }))
  expect(aller).toHaveBeenCalledWith('fabrications')
  fireEvent.click(screen.getByRole('button', { name: 'Replier la navigation' }))
  expect(replier).toHaveBeenCalledWith(true)
})

it('garde toutes les destinations nommées et atteignables pendant le repli', () => {
  const aller = vi.fn()
  render(<NavigationAtelier jeu="Le marais" actif="univers" replie onReplier={vi.fn()} onAller={aller} onChangerJeu={vi.fn()} onGuide={vi.fn()} onRecherche={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Univers & toile' }))
  expect(aller).toHaveBeenCalledWith('univers')
  expect(screen.getByRole('button', { name: 'Déplier la navigation' })).toHaveAttribute('aria-expanded', 'false')
})
