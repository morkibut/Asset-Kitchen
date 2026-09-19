// Déclaration honnête de pixel-core.js — voir LISEZMOI.md.

import type { RGBAImage } from './types';

export function imageBuffer(width: number, height: number, data?: Uint8ClampedArray): RGBAImage;
export function detectGrid(
  image: RGBAImage,
  maxStep?: number,
): {
  x: { step: number; offset: number; confidence: number };
  y: { step: number; offset: number; confidence: number };
  confidence: number;
  width: number;
  height: number;
};
export function resample(image: RGBAImage, width: number, height: number): RGBAImage;
export function snapGrid(
  image: RGBAImage,
  stepX: number,
  stepY?: number,
  offsetX?: number,
  offsetY?: number,
): RGBAImage;
export function removeBackground(image: RGBAImage, tolerance?: number): RGBAImage;
export function quantize(image: RGBAImage, count?: number, forcedPalette?: string[]): RGBAImage;
export function alphaBounds(
  image: RGBAImage,
  threshold?: number,
): { x: number; y: number; width: number; height: number } | null;
export function cropBuffer(image: RGBAImage, box: { x: number; y: number; width: number; height: number }): RGBAImage;
export function components(
  image: RGBAImage,
  minArea?: number,
  threshold?: number,
): Array<{ x: number; y: number; width: number; height: number; area: number; pixels: number[] }>;
export function isolatedComponent(
  image: RGBAImage,
  component: { x: number; y: number; width: number; height: number; pixels: number[] },
): RGBAImage;
export function splitGrid(image: RGBAImage, columns: number, rows: number): RGBAImage[];
export function alignFrames(
  frames: RGBAImage[],
  options?: { margin?: number; anchor?: 'bottom' | 'center'; powerOfTwo?: boolean },
): RGBAImage[];
export function packFrames(frames: RGBAImage[]): RGBAImage;
export function makeSeamless(image: RGBAImage, border?: number): RGBAImage;
