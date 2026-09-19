// Déclaration honnête de tile-masks.js — voir LISEZMOI.md.

export const CORNER_BITS: { TL: number; TR: number; BL: number; BR: number };
export const NEIGHBOUR_BITS: {
  N: number; NE: number; E: number; SE: number; S: number; SW: number; W: number; NW: number;
};
export const SIDE_BITS: { N: number; E: number; S: number; W: number };
export const GODOT_TERRAIN_MODES: { MATCH_CORNERS_AND_SIDES: 0; MATCH_CORNERS: 1; MATCH_SIDES: 2 };
export const GODOT_PEERING_PREFIX: string;
export const GODOT_NO_TERRAIN: number;
export const GODOT_CELL_NEIGHBORS: Record<string, number>;
export const WANGID_ORDER: string[];
export const WANG_UNSET: number;

export function isCanonicalBlobMask(mask: number): boolean;

/** La grille 4×4 historique (coins/bords 16 pièces), la même que celle du moteur. */
export const W16_ATLAS_GRID: number[][];

export interface AtlasLayout {
  columns: number;
  rows: number;
  cells: number;
  positions: Array<{ mask: number; col: number; row: number }>;
  unusedCells: Array<{ col: number; row: number; index: number }>;
  note: string;
}

export interface MaskSet {
  id: string;
  masks: number[];
  fullMask: number;
  layout: AtlasLayout;
  godot: { mode: number; peeringBits: Array<[string, number]> };
  tiled: { wangsetType: string };
  [autre: string]: unknown;
}

export const W16: MaskSet;
export const B47: MaskSet;
export const E16: MaskSet;
export const TILE_MASK_SETS: { W16: MaskSet; B47: MaskSet; E16: MaskSet };

export function maskSet(set: string | MaskSet): MaskSet;
export function atlasPosition(set: string | MaskSet, mask: number): { mask: number; col: number; row: number; index: number };
export function maskAtPosition(set: MaskSet, col: number, row: number): number | null;

export function godotPeeringBits(
  set: MaskSet,
  mask: number,
  options?: { terrain?: number },
): Record<string, number>;
export function godotPeeringProperties(
  set: MaskSet,
  mask: number,
  options?: { terrain?: number },
): Array<[string, number]>;
export function maskFromGodotPeeringBits(
  set: MaskSet,
  bits: Record<string, number>,
  options?: { terrain?: number },
): number;

export function tiledWangId(set: MaskSet, mask: number, options?: { color?: number }): number[];
export function tiledWangIdString(set: MaskSet, mask: number, options?: { color?: number }): string;
export function maskFromTiledWangId(
  set: MaskSet,
  wangid: number[] | string,
  options?: { color?: number },
): number;
