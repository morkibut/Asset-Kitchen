// Déclaration honnête de tile-check.js — voir LISEZMOI.md.

import type { CanvasLike } from './types';
import type { MaskSet } from './tile-masks';

/** Une image de planche telle que lue par le contrôle : `{ data, width, height, tile }`. */
export interface AtlasImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  tile: number;
}

export function alphaAt(img: AtlasImage, set: MaskSet, mask: number, x: number, y: number): number;
export function rightColumn(img: AtlasImage, set: MaskSet, mask: number): number[];
export function leftColumn(img: AtlasImage, set: MaskSet, mask: number): number[];
export function bottomRow(img: AtlasImage, set: MaskSet, mask: number): number[];
export function topRow(img: AtlasImage, set: MaskSet, mask: number): number[];
export function identical(a: number[], b: number[]): boolean;
export function edgeOf(p: number[], i: number): boolean;

/** -1 si la couture est saine ; sinon l'index du premier défaut. */
export function seamFault(a: number[], b: number[]): number;

export function compatibleHorizontal(setId: string, L: number, R: number): boolean;
export function compatibleVertical(setId: string, T: number, U: number): boolean;

export interface Defaut {
  type: string;
  mask?: number;
  [autre: string]: unknown;
}

export function checkMaskSetAtlas(img: AtlasImage, set: MaskSet): Defaut[];
export function checkWallAtlas(
  img: AtlasImage,
  options: { WALL_TOP_ROWS: unknown; WALL_BAND_STATES: unknown; biais?: unknown },
): Defaut[];

export function blobMaskAt(grid: number[][], x: number, y: number): number;
export function edgeMaskAt(grid: number[][], x: number, y: number): number;
export function cellMaskAt(setId: string, grid: number[][], x: number, y: number): number;

export function mulberry32(seed: number): () => number;
export function generateIsland(setId: string, seed: number): number[][];
export function islandCoverage(setId: string, grid: number[][]): number;
