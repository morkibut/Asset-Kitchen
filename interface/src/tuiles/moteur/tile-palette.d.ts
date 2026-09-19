// Déclaration honnête de tile-palette.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export const NOMBRE_COULEURS: number;
export const NOMBRE_COULEURS_REFERENCE: number;

export function paletteDeReference(image: RGBAImage, count?: number): string[];
export function appliquerPalette(image: RGBAImage, palette: string[]): RGBAImage;

/** La palette commune de sc-clone (T26 bis) : quantifie tout le lot sur la palette (jusqu'à
 *  `count` couleurs) tirée de la première image — celle-ci comprise. Même longueur en sortie
 *  qu'en entrée. */
export function harmoniserPalette(images: RGBAImage[], count?: number): RGBAImage[];

export function paletteDeReferenceLab(images: RGBAImage[], n?: number): unknown;
export function rapprocherDeLaReference(image: RGBAImage, ref: unknown): RGBAImage;
