// Déclaration honnête de tile-materials.js — voir LISEZMOI.md.

import type { RGB, RGBAImage } from './types';

export function periode(size: number, cible: number, mini?: number): number;

export interface Matiere {
  nom: string;
  role: string;
  dephasable: boolean;
  palette: string[];
  ombre: string;
  champ: (x: number, y: number, c: unknown) => number;
  [autre: string]: unknown;
}

/** Les 13 matières intégrées, indexées par identifiant. */
export const MATIERES: Record<string, Matiere>;
export const LISTE_MATIERES: Array<{ id: string; nom: string; role: string; dephasable: boolean }>;

export function tolerePhase(id: string): boolean;

/** Rend la surface et le contour d'une matière, à la taille de tuile demandée. */
export function rendreMatiere(id: string, size: number, seed?: number): { surface: RGBAImage; contour: RGBAImage };

export function couleurMoyenne(id: string): RGB;
