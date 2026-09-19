// Déclaration honnête de tile-scene.js — voir LISEZMOI.md.

import type { CanvasContext2DLike, RGBAImage } from './types';
import { B47, NEIGHBOUR_BITS } from './tile-masks';

export function coursesHorizontales(grille: number[][]): unknown;
export function etatsDeBande(grille: number[][]): unknown;
export function jonctionsDiagonales(grille: number[][]): unknown;
export function penteVoisinsDessus(grille: number[][]): unknown;
export function masqueDessusMur(grille: number[][], x: number, y: number, penteInfo: unknown): number;

export function placerMur(
  descripteur: unknown,
  grille: number[][],
  x: number,
  y: number,
  hauteur: number,
  etat: unknown,
  penteInfo: unknown,
): void;
export function placerMurBiais(
  descripteur: unknown,
  grille: number[][],
  x: number,
  y: number,
  hauteur: number,
  sens: unknown,
  penteInfo: unknown,
): void;
export function caseMurPente(descripteur: unknown, j: unknown, hauteur: number): unknown;
export function placerOmbreBiais(descripteur: unknown, x: number, y: number, sens: unknown): unknown;
export function occupationMur(grille: number[][], hauteur: number): unknown;

export function emplacementsDecor(
  occupe: unknown,
  options: {
    colonnes: number;
    lignes: number;
    densite?: 'aucun' | 'leger' | 'dense' | string;
    graine?: number;
    variantes?: number;
    orientations?: Array<'n' | 'e' | 's' | 'w'>;
  },
): unknown;
export function caseDecor(descripteur: unknown, orientation: string, variant: number): unknown;

export const remplisseur: (grille: number[][]) => (x: number, y: number) => number;

/** Peint une carte (sol, murs, décor, personnage) sur le peintre fourni. */
export function dessinerScene(peintre: unknown, options: Record<string, unknown>): void;

export function masqueBlobDe(grille: number[][], x: number, y: number): number;

/** Peintre qui dessine sur un contexte canvas 2D (navigateur ou bouchon d'essai). */
export function peintreCanvas(ctx: CanvasContext2DLike, atlas: RGBAImage, scale: number): unknown;
/** Peintre pur qui écrit directement dans une image cible — utilisé par les essais et par le rendu serveur (TU10). */
export function peintrePixels(cible: RGBAImage, atlas: RGBAImage, scale: number): unknown;

export function descripteurScene(wallAtlasDescriptor: unknown, WALL_BAND_STATES: unknown): unknown;

export { B47, NEIGHBOUR_BITS };
