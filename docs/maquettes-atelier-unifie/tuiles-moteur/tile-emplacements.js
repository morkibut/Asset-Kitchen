// Les emplacements de texture d'un tileset.
//
// Avant cette tranche, une destination de texture existait TROIS fois dans le panneau :
// une liste déroulante de matière, un couple de boutons « Texture de… / Retirer la
// texture de… », et un champ de description pour l'IA. Trois chemins qui n'échangeaient
// rien, douze boutons pour cinq destinations, et aucune vignette : on ne pouvait ni voir
// ce qui était posé, ni comparer deux matières sans refaire le chemin entier.
//
// Ici, une destination est un EMPLACEMENT : une source (`vide`, `matiere`, `import`,
// `ia`), de quoi la rejouer, et l'image qu'il porte. Les trois chemins de remplissage
// écrivent au même endroit, donc un tileset reste texturable moitié à la main, moitié
// par l'IA, sans code en double.
//
// L'INVARIANT : une bordure suit sa surface tant que le lien tient.
//
// Ce n'est pas une commodité d'interface. `rendreMatiere()` rend la surface ET son
// contour d'un seul tenant, parce que le moteur les reçoit ensemble comme les deux bouts
// d'une même rampe de couleur — le contour est ce que le bord de la tuile assombrit.
// Les traiter comme deux emplacements indépendants obligeait à choisir deux fois la même
// matière, et laissait poser une bordure de brique sur une surface d'herbe sans que rien
// ne le signale.
//
// Ce module ne touche pas au DOM : c'est ce qui le rend éprouvable. Voir
// tests/tile-emplacements.test.mjs.

import { MATIERES, rendreMatiere } from './tile-materials.js';

// `bordure` : l'emplacement que celui-ci entraîne quand le lien tient.
// `suit`    : l'emplacement dont celui-ci dépend — l'autre bout du même lien.
// `part`    : quelle des deux images d'une matière atterrit ici.
export const EMPLACEMENTS = [
  { id: 'surface', nom: 'Surface', role: 'sol', bordure: 'bordure' },
  { id: 'bordure', nom: 'Bordure', role: 'sol', suit: 'surface', part: 'contour' },
  { id: 'face', nom: 'Face du mur', role: 'mur' },
  { id: 'bas', nom: 'Sol dessous', role: 'sol', bordure: 'bordureBas' },
  { id: 'bordureBas', nom: 'Bordure du dessous', role: 'sol', suit: 'bas', part: 'contour' },
];

export const PAR_ID = Object.fromEntries(EMPLACEMENTS.map((e) => [e.id, e]));
const IDS = EMPLACEMENTS.map((e) => e.id);

/** Ce que la disposition réclame, dans l'ordre où ça se présente à l'écran. */
export function emplacementsActifs(mode, secondTerrain = false) {
  const actifs = ['surface', 'bordure'];
  if (mode && mode.wall) actifs.push('face');
  if (secondTerrain) actifs.push('bas', 'bordureBas');
  return actifs.map((id) => PAR_ID[id]);
}

const cle = (matiere, size, seed) => `${matiere}|${size}|${seed}`;

export function creerEtat() {
  const etat = {};
  for (const id of IDS) etat[id] = { source: 'vide', matiere: '', nom: '', image: null, lie: true, cle: '' };
  return etat;
}

function verifier(etat, id) {
  if (!PAR_ID[id]) throw new Error(`Emplacement inconnu : ${id}`);
  if (!etat || !etat[id]) throw new Error(`État d'emplacements incomplet : ${id} manque.`);
}

// La mémoire de `cle` sert à distinguer « cet emplacement est vide » de « sa matière a
// déjà été rendue à cette taille et à cette graine ». Sans elle, on re-rendrait treize
// matières à chaque frappe dans un champ — et on écraserait une image importée.
function ecrireMatiere(etat, id, matiereId, size, seed) {
  const part = PAR_ID[id].part || 'surface';
  etat[id] = {
    source: 'matiere',
    matiere: matiereId,
    nom: MATIERES[matiereId].nom,
    image: rendreMatiere(matiereId, size, seed)[part],
    lie: etat[id].lie,
    cle: cle(matiereId, size, seed),
  };
}

/**
 * Pose une matière intégrée. Sur une bordure encore liée, ça revient à la poser sur sa
 * surface : le lien est une promesse dans les deux sens, sinon le clic mentirait.
 */
export function poserMatiere(etat, id, matiereId, size, seed) {
  verifier(etat, id);
  if (!MATIERES[matiereId]) throw new Error(`Matière inconnue : ${matiereId}`);
  const cible = PAR_ID[id].suit && etat[id].lie ? PAR_ID[id].suit : id;
  ecrireMatiere(etat, cible, matiereId, size, seed);
  const paire = PAR_ID[cible].bordure;
  if (paire && etat[paire].lie) ecrireMatiere(etat, paire, matiereId, size, seed);
  return etat;
}

/**
 * Pose une image — importée à la main, ou rendue par l'IA. Elle rompt le lien : une
 * bordure ne peut plus suivre une matière qui n'est plus là, et laisser le lien affiché
 * ferait croire qu'elle suivra le prochain changement.
 */
export function poserImage(etat, id, image, nom = '', source = 'import') {
  verifier(etat, id);
  if (!image || !image.width || !image.height) throw new Error(`Image invalide pour l'emplacement ${id}.`);
  const lie = PAR_ID[id].suit ? false : etat[id].lie;
  etat[id] = { source, matiere: '', nom, image, lie, cle: '' };
  const paire = PAR_ID[id].bordure;
  if (paire) etat[paire] = { ...etat[paire], lie: false };
  return etat;
}

/** Rend la main aux couleurs de repli. Emporte la bordure liée, jamais une déliée. */
export function vider(etat, id) {
  verifier(etat, id);
  const vide = (avant) => ({ source: 'vide', matiere: '', nom: '', image: null, lie: avant.lie, cle: '' });
  etat[id] = vide(etat[id]);
  const paire = PAR_ID[id].bordure;
  if (paire && etat[paire].lie) etat[paire] = vide(etat[paire]);
  return etat;
}

/** Rompt ou rétablit le lien d'une bordure. Rétablir la recolle tout de suite à sa surface. */
export function relier(etat, id, lie, size, seed) {
  verifier(etat, id);
  const parent = PAR_ID[id].suit;
  if (!parent) throw new Error(`L'emplacement ${id} ne porte pas de lien.`);
  etat[id] = { ...etat[id], lie: !!lie };
  if (lie && etat[parent].source === 'matiere') ecrireMatiere(etat, id, etat[parent].matiere, size, seed);
  return etat;
}

/**
 * Re-rend les matières intégrées quand la taille de tuile ou la graine a bougé.
 *
 * Ce n'est pas une optimisation : l'invariant d'échantillonnage veut que la période
 * d'une texture vaille la taille de la tuile, donc une matière rendue en 32 px ne peut
 * pas servir à une tuile de 64. Les images importées, elles, ne bougent pas — c'est le
 * moteur qui les ramène à la taille voulue.
 */
export function rafraichirMatieres(etat, size, seed) {
  for (const id of IDS) {
    const emplacement = etat[id];
    if (emplacement.source !== 'matiere') continue;
    if (emplacement.cle === cle(emplacement.matiere, size, seed)) continue;
    ecrireMatiere(etat, id, emplacement.matiere, size, seed);
  }
  return etat;
}

/** Ce que le moteur attend, nommé comme il le nomme. */
export function texturesDe(etat) {
  return {
    surfaceTexture: etat.surface.image,
    edgeTexture: etat.bordure.image,
    faceTexture: etat.face.image,
    lowerSurfaceTexture: etat.bas.image,
    lowerEdgeTexture: etat.bordureBas.image,
  };
}
