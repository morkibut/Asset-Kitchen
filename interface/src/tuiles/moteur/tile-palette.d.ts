// Déclaration honnête de tile-palette.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export const NOMBRE_COULEURS: number;
export const NOMBRE_COULEURS_REFERENCE: number;

export function paletteDeReference(image: RGBAImage, count?: number): string[];
export function appliquerPalette(image: RGBAImage, palette: string[]): RGBAImage;

/** La palette commune de sc-clone (T26 bis) : jusqu'à `count` couleurs, tirées de la référence. */
export function harmoniserPalette(images: RGBAImage[], count?: number): string[];

export function paletteDeReferenceLab(images: RGBAImage[], n?: number): unknown;
export function rapprocherDeLaReference(image: RGBAImage, ref: unknown): RGBAImage;
