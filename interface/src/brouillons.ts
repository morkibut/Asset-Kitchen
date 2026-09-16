/**
 * **L'index des brouillons — ce qu'on a laissé en plan, et où le reprendre.**
 *
 * Les brouillons existaient déjà, un par écran, chacun sous sa clé
 * (`asset-kitchen:brouillon:v1:{clé}`, `composants/BrouillonLocal.tsx`). Ils ne
 * se voyaient que depuis l'écran qui les avait écrits : un travail laissé à
 * moitié était invisible depuis partout ailleurs (`RP16`).
 *
 * Ce fichier ne garde **aucun brouillon**. Il tient la liste de ceux qui
 * existent, avec juste assez pour les retrouver :
 *
 * | ce qu'une ligne porte | à quoi ça sert |
 * |---|---|
 * | `cle` | le brouillon lui-même, sous son adresse d'origine |
 * | `ecran` | l'écran qui l'a laissé — *La retouche*, *Le montage*… |
 * | `quoi` | une ligne pour le reconnaître : le sujet, le mouvement, le nom |
 * | `modifie` | depuis quand il attend |
 * | `retour` | la pile de lieux où le reprendre, telle quelle |
 *
 * **Le retour est la pile, pas une adresse inventée.** `lieux.ts` tient déjà
 * « où l'on est, et par où on y est arrivé » ; on en garde une copie au moment
 * où le brouillon s'écrit, et le tiroir la repose. Un écran n'a donc rien à
 * dire de sa position, et aucun genre de lieu n'a besoin d'être traduit une
 * seconde fois — ce qui aurait fait deux vérités à tenir d'accord.
 *
 * **Il vit dans le navigateur, à côté de ce qu'il indexe.** Un brouillon
 * d'écran n'est pas un fichier du jeu, et *les fichiers font foi* (T3) veut
 * dire que ce qui n'est pas un fichier ne prétend pas l'être. Ce qui est déjà
 * sur le disque — un travail lancé, une bande sans case — a son foyer côté
 * serveur, et le tiroir le lit **là**, sans en garder de copie.
 *
 * ⚠️ **Une ligne meurt avec son brouillon, jamais après.** Elle s'efface dans
 * le même geste, et la lecture rejette de toute façon celles dont le brouillon
 * n'est plus dans ce navigateur : le tiroir ne montre jamais une ligne morte,
 * même si quelque chose s'est mal passé en l'écrivant.
 */

import type { Lieu } from "./lieux"

export type LigneDeBrouillon = {
  /** La clé du brouillon, telle que l'écran l'a donnée à `useBrouillonLocal`. */
  cle: string
  /** L'écran qui l'a laissé. */
  ecran: string
  /** De quoi il s'agit, en une ligne. */
  quoi: string
  /** Depuis quand il attend. */
  modifie: number
  /** La pile de lieux où le reprendre. */
  retour: Lieu[]
}

type Index = { version: 1; lignes: LigneDeBrouillon[] }

/** L'adresse d'un brouillon dans ce navigateur — inchangée depuis son origine. */
export const adresseDuBrouillon = (cle: string) => `asset-kitchen:brouillon:v1:${cle}`

const INDEX = "asset-kitchen:brouillons:v1"

/** Le nom de l'événement qui dit « la liste a bougé », pour que le tiroir et le
 *  compteur se relisent sans attendre un aller-retour par le serveur. */
export const CHANGEMENT_DE_BROUILLON = "asset-kitchen:brouillons"

function lire(): LigneDeBrouillon[] {
  try {
    const texte = localStorage.getItem(INDEX)
    const lu = texte ? (JSON.parse(texte) as Index) : null
    return lu?.version === 1 && Array.isArray(lu.lignes) ? lu.lignes : []
  } catch {
    return []
  }
}

function ecrire(lignes: LigneDeBrouillon[]): void {
  try {
    // **Un index vide se retire.** Sans ça, le navigateur garderait une clé qui
    // ne dit plus rien, et « plus aucun brouillon » ne se distinguerait pas de
    // « jamais eu de brouillon ».
    if (lignes.length === 0) localStorage.removeItem(INDEX)
    else localStorage.setItem(INDEX, JSON.stringify({ version: 1, lignes } satisfies Index))
  } catch {
    // Un navigateur qui refuse d'écrire ne doit pas emporter l'écran avec lui :
    // l'écran dit déjà, à sa place, que le brouillon ne peut pas être conservé.
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGEMENT_DE_BROUILLON))
  } catch {
    // Hors navigateur, personne n'écoute.
  }
}

/** Les brouillons qui attendent, le plus récent d'abord.
 *
 *  **Une ligne dont le brouillon n'est plus là est retirée au passage**, et
 *  l'index réécrit : c'est la seule réparation que ce fichier fasse, et elle
 *  vaut mieux qu'un tiroir qui renvoie vers un travail effacé. */
export function brouillonsLaissesEnPlan(): LigneDeBrouillon[] {
  const lignes = lire()
  const vivantes = lignes.filter((l) => {
    try {
      return localStorage.getItem(adresseDuBrouillon(l.cle)) !== null
    } catch {
      return false
    }
  })
  if (vivantes.length !== lignes.length) ecrire(vivantes)
  return [...vivantes].sort((a, b) => b.modifie - a.modifie)
}

/** Déclarer, ou remettre à jour, la ligne d'un brouillon. */
export function declarerLeBrouillon(ligne: LigneDeBrouillon): void {
  const lignes = lire()
  const rang = lignes.findIndex((l) => l.cle === ligne.cle)
  const ancienne = rang >= 0 ? lignes[rang] : null
  // **Une pile vide ne remplace pas un retour connu.** Un écran monté avant que
  // l'application ait dit où l'on est écrirait sinon un retour qui ne mène
  // nulle part, et le brouillon deviendrait irrattrapable depuis le tiroir.
  const retour = ligne.retour.length ? ligne.retour : (ancienne?.retour ?? [])
  const suite = { ...ligne, retour }
  if (
    ancienne &&
    ancienne.ecran === suite.ecran &&
    ancienne.quoi === suite.quoi &&
    JSON.stringify(ancienne.retour) === JSON.stringify(suite.retour) &&
    ancienne.modifie === suite.modifie
  )
    return
  if (rang >= 0) lignes[rang] = suite
  else lignes.push(suite)
  ecrire(lignes)
}

/** Retirer la ligne d'un brouillon — enregistré, repris ou abandonné. */
export function retirerLeBrouillon(cle: string): void {
  const lignes = lire()
  const restantes = lignes.filter((l) => l.cle !== cle)
  if (restantes.length !== lignes.length) ecrire(restantes)
}

/** Effacer le brouillon **et** sa ligne, d'un seul geste. C'est ce que fait le
 *  tiroir quand on jette un brouillon depuis lui, sans ouvrir son écran. */
export function jeterLeBrouillon(cle: string): void {
  try {
    localStorage.removeItem(adresseDuBrouillon(cle))
  } catch {
    // Rien à faire de plus : la ligne part quand même, et la lecture suivante
    // ne montrera pas un brouillon qu'on ne sait pas retirer.
  }
  retirerLeBrouillon(cle)
}

// ── Où l'on est, au moment où un brouillon s'écrit ──────────────────────────
//
// **Une seule application, une seule pile.** L'alternative était de faire
// descendre la pile en propriété jusqu'aux treize écrans qui gardent un
// brouillon — treize signatures élargies pour une valeur qu'aucun d'eux ne lit.

let ici: Lieu[] = []

/** L'application dit où elle est. Appelé d'un seul endroit. */
export function noterOuLonEst(pile: readonly Lieu[]): void {
  ici = [...pile]
}

/** Où l'on est, pour le brouillon qui s'écrit maintenant. */
export function ouLonEst(): Lieu[] {
  return ici
}
