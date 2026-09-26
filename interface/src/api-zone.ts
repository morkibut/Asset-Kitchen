// PX3 · Repeindre une zone — les routes de la fabrique « Repeindre ».
//
// Rien n'est recalculé ici : ce sont exactement les clés que
// `atelier/services/zone.py` (`ServiceZone`) écrit. Le temps annoncé reprend le
// type des styles locaux (`TempsLocal`, `api-workflows.ts`) : c'est la même
// mesure (`ServiceGenerations.temps_attendu`), lue au même endroit.

import { appeler, type Trait } from "./api"
import type { TempsLocal } from "./api-workflows"

/** L'outil local qui sait repeindre une zone, tel que l'installation le voit. */
export type OutilDeZone = {
  identifiant: string
  nom: string
  pret: boolean
  manque: string[]
  /** Le modèle installé, ou `null` tant que l'outil ne l'est pas. */
  modele: string | null
  vitesse: string | null
}

/** Ce que la génération dit être parti — enregistré, jamais recomposé. */
export type PartiDeLaZone = { texte: string; negatif: string } | null

export type MesuresDeLaZone = {
  pixels_hors_zone: number
  pixels_du_sujet_perdus: number
  pixels_changes: number
  pixels_de_la_zone: number
  couleurs_neuves: number
}

/** Un calque repeint, de quoi le rouvrir tel qu'il a été demandé. */
export type CalqueRepeint = {
  identifiant: string
  empreinte: string | null
  label: string
  image: string
  texte: string
  zone: Trait[]
  /** La main de C4 posée depuis — ce qu'elle ôte, et ce qu'elle tranche ou ramène. */
  affinage: Trait[]
  retouche: Trait[]
  couleurs: number
  fond: string
  modele: string
  rendu_largeur: number
  rendu_hauteur: number
  cree_le: number
  generation: string | null
  graine: number | null
  force: number | null
  parti: PartiDeLaZone
  mesures: MesuresDeLaZone | null
}

/** PX7 : un modèle qui sait repeindre une zone, grisé ou non. */
export type ModeleDeZone = {
  identifiant: string
  nom: string
  famille: string | null
  /** Pourquoi il est grisé — `null` quand il est prêt. */
  raison: string | null
  /** Le temps de **ce** modèle-là — le bouton suit celui qu'on a choisi. */
  temps: TempsLocal | null
}

export type EtatDeLaZone = {
  image: string
  modele: { identifiant: string; nom: string } | null
  /** Pourquoi on ne peut pas repeindre — `null` quand on peut. */
  raison: string | null
  outil: OutilDeZone
  /** PX7 : un outil par famille de moteur local, prêt ou non. */
  outils: OutilDeZone[]
  /** PX7 : tous les modèles capables, grisés ou non — c'est parmi eux qu'on choisit. */
  modeles: ModeleDeZone[]
  temps: TempsLocal | null
  force: { minimum: number; maximum: number; defaut: number } | null
  couleurs: { defaut: number; maximum: number }
  calques: CalqueRepeint[]
}

export type ResultatDeLaZone = {
  generation: string
  statut: "en_attente" | "en_cours" | "reussie" | "echouee" | "interrompue"
  raison: string | null
  calque: CalqueRepeint | null
  graine: number | null
  force: number | null
  parti: PartiDeLaZone
}

export type DemandeDeZone = {
  texte: string
  zone: Trait[]
  graine?: number | null
  force?: number | null
  couleurs?: number
  /** PX7 : le modèle choisi, ou rien pour le défaut du catalogue. */
  modele?: string | null
}

export const zone = {
  etat: (image: string) => appeler<EtatDeLaZone>(`/assets/${encodeURIComponent(image)}/zone`),
  cequiPart: (image: string, texte: string, modele?: string | null) =>
    appeler<{ texte: string; negatif: string; fond: string }>(`/assets/${encodeURIComponent(image)}/zone/preview`, {
      method: "POST",
      body: JSON.stringify({ texte, modele: modele ?? null }),
    }),
  lancer: (image: string, demande: DemandeDeZone) =>
    appeler<ResultatDeLaZone>(`/assets/${encodeURIComponent(image)}/zone`, {
      method: "POST",
      body: JSON.stringify(demande),
    }),
  resultat: (generation: string) => appeler<ResultatDeLaZone>(`/zone/${encodeURIComponent(generation)}`),
}

export const TERMINES: readonly ResultatDeLaZone["statut"][] = ["reussie", "echouee", "interrompue"]
