// Types partagés par les déclarations du moteur de tuiles (interface/src/tuiles/moteur).
// Ce fichier n'est pas un module de sc-clone : c'est l'habillage TypeScript honnête pour
// ce que TU3 appellera. Voir LISEZMOI.md.

/** Une image RGBA en mémoire — le format que rendent et acceptent tous les modules purs. */
export interface RGBAImage {
  readonly width: number;
  readonly height: number;
  data: Uint8ClampedArray;
}

/** La couleur d'une matière, telle que rendue par les fonctions du moteur. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

/**
 * Le canevas que `renderLogical` et `peintreCanvas` manipulent. En navigateur c'est un vrai
 * `HTMLCanvasElement` ; sous vitest/Node, un bouchon minimal (voir `__tests__/canvas-shim.ts`)
 * qui n'implémente que `getContext('2d')`, `createImageData` et `putImageData`.
 */
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasContext2DLike | null;
  /** Posé par le bouchon d'essai après `putImageData` : ce que `renderLogical` a peint. */
  imageData?: RGBAImage;
}

export interface CanvasContext2DLike {
  createImageData(width: number, height: number): RGBAImage;
  putImageData(image: RGBAImage, dx: number, dy: number): void;
  [autre: string]: unknown;
}

/**
 * Les réglages d'un rendu de moteur (`renderLogical`, `dessinerScene`…). La liste des clés
 * n'est pas figée ici volontairement — sc-clone en ajoute au fil des tranches (T8, T10 bis,
 * T13, T27, T30, T43…) — un index signature honnête vaut mieux qu'une énumération qui
 * mentirait par omission. Les champs les plus lus sont typés ; le reste voyage en `unknown`.
 */
export interface TileSettings {
  tilesetType: 'topdown-15' | 'topdown-17' | 'blob-47' | 'edge-16' | 'wall' | string;
  tileSize: number;
  seed: number;
  [reglage: string]: unknown;
}

/** Le masque canonique d'une pièce (0-255 pour le blob, 0-15 pour coins/côtés). */
export type Masque = number;
