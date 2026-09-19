// Déclaration honnête de tile-ia-prompt.js — voir LISEZMOI.md.
// Le texte de génération sera composé côté serveur en Python (TU5, portage de ce module) ;
// ce module reste ici pour ses essais et pour un éventuel aperçu côté écran.

export interface Cadrage {
  nom: string;
  aide: string;
  consigne: string;
  [autre: string]: unknown;
}

export const CADRAGES: Record<string, Cadrage>;
export const LISTE_CADRAGES: Array<{ id: string; nom: string; aide: string }>;

export function cadrageParDefaut(cible: string): string;

export function matieresAttendues(
  mode: { wall?: boolean } | null | undefined,
  options?: { secondTerrain?: boolean },
): Array<{ cible: string; cadrage: string }>;

/** Compose le prompt final : pierre, puis motif, puis la consigne du cadrage. */
export function composerPrompt(pierre: string, motif: string, cadrage: string): string;

export function tailleParDefaut(reference: string | null | undefined): number;

export function seedsPourTirages(depart: number, tirages: number, parTirage?: number): number[];

export interface CorpsGeneration {
  prompt: string;
  perspective: string;
  seed: number;
  width: number;
  height: number;
  reference?: string;
  [autre: string]: unknown;
}

export function corpsGeneration(options: {
  pierre: string;
  motif: string;
  cadrage: string;
  preset?: string;
  seed?: number;
  project?: string;
  reference?: string;
  denoise?: number;
  comfyUrl?: string;
  checkpoint?: string;
  taille?: number;
}): CorpsGeneration;
