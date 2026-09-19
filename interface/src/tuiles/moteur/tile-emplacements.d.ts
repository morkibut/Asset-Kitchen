// Déclaration honnête de tile-emplacements.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export interface Emplacement {
  id: string;
  nom: string;
  role: 'sol' | 'mur' | string;
  bordure?: string;
  suit?: string;
  part?: 'contour' | 'surface';
}

export const EMPLACEMENTS: Emplacement[];
export const PAR_ID: Record<string, Emplacement>;

export function emplacementsActifs(mode: { wall?: boolean } | null | undefined, secondTerrain?: boolean): Emplacement[];

export interface EtatEmplacement {
  source: 'vide' | 'matiere' | 'import' | 'ia';
  matiere: string;
  nom: string;
  image: RGBAImage | null;
  lie: boolean;
  cle: string;
}

export type EtatEmplacements = Record<string, EtatEmplacement>;

export function creerEtat(): EtatEmplacements;
export function poserMatiere(etat: EtatEmplacements, id: string, matiereId: string, size: number, seed: number): EtatEmplacements;
export function poserImage(etat: EtatEmplacements, id: string, image: RGBAImage, nom?: string, source?: string): EtatEmplacements;
export function vider(etat: EtatEmplacements, id: string): EtatEmplacements;
export function relier(etat: EtatEmplacements, id: string, lie: boolean, size: number, seed: number): EtatEmplacements;
export function rafraichirMatieres(etat: EtatEmplacements, size: number, seed: number): EtatEmplacements;
export function texturesDe(etat: EtatEmplacements): Record<string, RGBAImage | null>;
