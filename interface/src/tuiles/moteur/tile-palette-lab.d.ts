// Déclaration honnête de tile-palette-lab.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export function rgbVersLab(r: number, g: number, b: number, sortie?: number[], o?: number): number[];
export function labVersRgb(L: number, a: number, b: number, sortie?: number[], o?: number): number[];
export function dE76Carre(a: number[], b: number[]): number;
export function histogrammeImages(images: RGBAImage[]): unknown;
export function kmeansLab(compte: unknown, total: number, n: number, iters?: number): unknown;
export function statsLabHistogramme(compte: unknown, total: number): unknown;
export function statsLabImage(img: RGBAImage): unknown;
export function rapprocher(img: RGBAImage, palette: unknown): RGBAImage;
export function transfertReinhard(img: RGBAImage, statsSrc: unknown, statsRef: unknown): RGBAImage;
export function paletteLabPonderee(images: RGBAImage[], n?: number): unknown;
export function rapprocherVersReference(image: RGBAImage, ref: unknown): RGBAImage;
