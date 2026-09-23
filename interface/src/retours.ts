// **RV7 — le retour, là où l'on a cliqué.**
//
// Ce qui est parti, lu **au serveur** et rangé par case visée. La forme est
// écrite en tête de `atelier/services/retours.py` : un retour se déduit des
// travaux conservés et du chantier des images, il ne s'enregistre nulle part.
// L'écran n'en pousse aucun — il relit, et c'est ce qui fait qu'une case « en
// cours » survit à un rechargement de la page.
//
// Ce module tient trois choses, et rien d'autre :
// - la relecture des retours d'un sujet (`useRetoursDuSujet`), redemandée
//   quand le flux annonce qu'un travail ou une génération a bougé ;
// - l'annonce elle-même, passée du flux aux écrans par un événement de la
//   fenêtre — le même patron que `brouillons.ts`. Les onglets du sujet n'ont
//   ainsi rien à recevoir de la page qui les porte ;
// - le temps d'un retour, écrit une seule fois : « 1 min 20 / ≈ 3 min ».

import { useEffect, useState } from "react"
import { dureeEnClair, duree } from "./api"
import { travaux, type Retour, type RetoursParCase } from "./api-travaux"

/** L'événement de la fenêtre qui dit « une fabrication a bougé ». */
export const CHANGEMENT_DE_FABRICATION = "atelier:fabrication"

/** Ce que le flux annonce d'un travail (`ServiceTravaux._garder`). La vérité
 *  reste le travail relu : ce message ne sert qu'à dire *quand* relire, et à
 *  l'avis d'arrivée de savoir où mener. */
export type AnnonceDeTravail = {
  projet: string
  identifiant: string
  etat: string
  nature?: string | null
  personnage?: string | null
  pose?: string | null
  direction?: string | null
  controle?: string | null
  raison?: string | null
}

export type ChangementDeFabrication =
  | { genre: "travail"; annonce: AnnonceDeTravail }
  | { genre: "generation"; projet: string | null; personnage: string | null }

export function annoncerUneFabrication(detail: ChangementDeFabrication) {
  window.dispatchEvent(new CustomEvent<ChangementDeFabrication>(CHANGEMENT_DE_FABRICATION, { detail }))
}

export function ecouterLesFabrications(recevoir: (detail: ChangementDeFabrication) => void): () => void {
  const ecoute = (e: Event) => recevoir((e as CustomEvent<ChangementDeFabrication>).detail)
  window.addEventListener(CHANGEMENT_DE_FABRICATION, ecoute)
  return () => window.removeEventListener(CHANGEMENT_DE_FABRICATION, ecoute)
}

const VIDE: RetoursParCase = { retours: [], clips_suivis: [] }

/** Les retours d'un sujet, relus au serveur à l'ouverture et à chaque annonce
 *  qui le concerne — une relecture à la fois, les annonces rapprochées se
 *  fondent en une. `maintenant` avance d'une seconde tant qu'un retour tourne,
 *  pour que le temps écoulé bouge sans rien redemander. */
export function useRetoursDuSujet(projet: string, personnage: string): RetoursParCase & { maintenant: number } {
  const [lus, setLus] = useState<RetoursParCase>(VIDE)
  const [maintenant, setMaintenant] = useState(() => Date.now() / 1000)
  useEffect(() => {
    let vivant = true
    let attente: number | null = null
    const relire = () => {
      attente = null
      travaux.retours(projet, personnage)
        // Une réponse d'une autre forme (un serveur d'avant RV7, un double
        // d'essai qui répond à tout) ne montre simplement aucun retour.
        .then((r) => { if (vivant) setLus({ retours: Array.isArray(r?.retours) ? r.retours : [], clips_suivis: Array.isArray(r?.clips_suivis) ? r.clips_suivis : [] }) })
        .catch(() => { /* l'écran garde ce qu'il avait : une relecture ratée n'efface rien */ })
    }
    relire()
    const arreter = ecouterLesFabrications((d) => {
      const qui = d.genre === "travail" ? d.annonce.personnage : d.personnage
      const ou = d.genre === "travail" ? d.annonce.projet : d.projet
      if ((qui && qui !== personnage) || (ou && ou !== projet)) return
      if (attente === null) attente = window.setTimeout(relire, 250)
    })
    return () => { vivant = false; arreter(); if (attente !== null) window.clearTimeout(attente) }
  }, [projet, personnage])
  const tourne = lus.retours.some((r) => r.etat === "en_cours")
  useEffect(() => {
    if (!tourne) return
    setMaintenant(Date.now() / 1000)
    const intervalle = window.setInterval(() => setMaintenant(Date.now() / 1000), 1000)
    return () => window.clearInterval(intervalle)
  }, [tourne])
  return { ...lus, maintenant }
}

/** Les retours d'une rangée : même pose, même direction. `premiere` range dans
 *  la première rangée d'une pose ce qui ne vise aucune direction qu'elle
 *  montre — même repli qu'une image ou une bande sans direction. */
export function retoursDeLaRangee(
  retours: readonly Retour[], pose: string, direction: string | null, premiere: boolean, directionsMontrees: readonly (string | null)[],
): Retour[] {
  return retours.filter((r) => r.pose === pose && (
    r.direction === (direction ?? "") ||
    (premiere && !directionsMontrees.includes(r.direction || null))
  ))
}

/** Le temps d'un retour, écrit une seule fois pour la case et la fenêtre :
 *  « 1 min 20 / ≈ 3 min », ou le temps écoulé seul quand personne ne sait
 *  combien attendre (un payant, un moteur jamais mesuré). */
export function tempsDuRetour(lanceLe: number | null | undefined, attendu: number | null | undefined, maintenant: number): string {
  if (!lanceLe) return ""
  const ecoule = dureeEnClair(Math.max(0, maintenant - lanceLe))
  return attendu ? `${ecoule} / ≈ ${duree(attendu)}` : ecoule
}
