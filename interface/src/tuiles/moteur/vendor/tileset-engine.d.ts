// Déclaration honnête de vendor/tileset-engine.js — voir ../LISEZMOI.md.
// Seuls les exports que TU3 (l'atelier du jeu de tuiles) et les essais de ce dossier
// utilisent sont typés précisément ; le reste voyage en `unknown` plutôt qu'en `any`.

import type { CanvasLike, RGB, RGBAImage, TileSettings } from '../types';

/** Rend l'atlas complet dans un canevas et renvoie ce canevas (voir `imageData` posé dessus). */
export function renderLogical(settings: TileSettings): CanvasLike;

/** Réduit/agrandit une texture vers `size × size`, avec le mode de réduction choisi. */
export function resampleTexture(
  texture: RGBAImage,
  size: number,
  force?: number,
  radius?: number,
  mode?: 'compensee' | 'contraste' | 'moyenne',
): RGBAImage;

/** La disposition 4×4 historique (coins/bords 16 pièces) : `layout[row][col] = masque`. */
export const layout: number[][];

export function hexToRgb(hex: string): RGB;

/** Colonnes et lignes de l'atlas pour une sorte et des options d'atlas données. */
export function atlasShape(
  tilesetType: string,
  variants?: number,
  animatedFrames?: number,
  animatedAtlasCopies?: number,
  decor?: string,
): { columns: number; rows: number };

/** Les masques par colonnes/dessus de chaque sorte de terrain, indexés par matière. */
export function terrainLayers(settings: TileSettings): unknown;

/** Les dispositions d'atlas connues du moteur, par `tilesetType`. */
export const TILESET_LAYOUTS: Record<string, { columns: number; rows: number; [c: string]: unknown }>;

export const EDGE_STROKE_RATIO: number;
export const WALL_TOP_ROWS: unknown;
export const WALL_COLUMNS: number;
export const BLOB_CORNERS: unknown;
export const WALL_BAND_STATES: unknown;
export const WALL_BANDS: unknown;
export function wallAtlasDescriptor(...args: unknown[]): unknown;
export const WALL_UNPLACED_STATES: unknown;
export function decorAtlasDescriptor(...args: unknown[]): unknown;
export function biaisAtlasDescriptor(...args: unknown[]): unknown;
export const WALL_BIAIS_SENS: unknown;
export const WALL_BIAIS_PIECES: unknown;
export const DECOR_ORIENTATIONS: unknown;
export const DECOR_VARIANTS: unknown;
export const DECOR_DENSITIES: unknown;
export function variantAtlasDescriptor(...args: unknown[]): unknown;
export function variantTexturePhase(...args: unknown[]): unknown;
export function animationAtlasDescriptor(...args: unknown[]): unknown;
export function atlasAnimationDescriptor(...args: unknown[]): unknown;
export function atlasCopyRows(...args: unknown[]): number;
export const DEFAULT_ANIMATION_FRAME_DURATION_MS: number;
export const BLOB_LOWER_CELL: unknown;
