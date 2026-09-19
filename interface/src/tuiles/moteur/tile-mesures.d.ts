// Déclaration honnête de tile-mesures.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export interface FicheMesure {
  couleurs90: number;
  ecartTypeL: number;
  partQuasiNoir: number;
  concentrationTeinte: number;
  [autre: string]: unknown;
}

export function mesurer(img: RGBAImage): FicheMesure;
export function masqueReduit(joints: unknown, cible: unknown): unknown;
export function fideliteJoints(
  masque: unknown,
  tuile: unknown,
  cible: unknown,
  seuil?: number,
  seuilPierre?: number,
): unknown;
