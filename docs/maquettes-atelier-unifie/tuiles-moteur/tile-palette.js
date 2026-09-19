// La palette commune — tranche T26 bis (docs/PLAN-tilesets.md « ### T26 bis »).
//
// T26 a lié les deux ou trois matières d'une génération par le TEXTE (un tronc de
// description partagé) mais a fini sur une mesure franche : ça donne « trois pierres de
// la même carrière », pas une seule pierre — Δchroma 1,78 entre matières. Mesuré à part,
// sur les mêmes textures : quantifier les matières sur la palette de 24 couleurs de la
// matière de référence (jamais l'union des trois, qui ne rapproche rien — Δchroma 18,76
// contre 0,89) divise la teinte par deux en ne perdant que 5 % de grain, et ne touche ni
// au motif ni au raccord — contrairement à Reinhard ou à l'appariement d'histogrammes,
// mesurés à côté et écartés parce qu'ils aplatissent le pixel art pour gagner leur score.
//
// Module pur sans DOM, comme tile-ia-prompt.js : `quantize` (pixel-core.js) fait tout le
// travail de réduction de palette, ce fichier ne fait que fixer la convention — palette de
// la RÉFÉRENCE SEULE, jamais un mélange — pour que genererMatieresIa (tools.js) n'ait qu'à
// l'appeler une fois sur le lot complet, avant de poser les images.

import { quantize } from './pixel-core.js';
// T31 — la palette de référence. L'algorithme (histogramme pondéré, k-means Lab déterministe,
// Reinhard, plus-proche-couleur) vit dans le module pur `tile-palette-lab.js`, seule source,
// partagée avec le moteur et avec le banc `scripts/essai-palette-jeu.mjs`. Ce fichier n'en
// est que la façade côté atelier : il fixe les conventions (N = 48, la variante douce) comme
// il fixait déjà celle de T26 bis (la palette de la RÉFÉRENCE seule, jamais l'union).
import { paletteLabPonderee, rapprocherVersReference } from './tile-palette-lab.js';

export const NOMBRE_COULEURS = 24;
/**
 * N = 48, mesuré dans E4 (`docs/ETUDE-beau-mur-E4.md`) : à 24, le quasi-noir monte trop haut
 * — la matière se creuse là où le jeu, lui, reste lisible.
 */
export const NOMBRE_COULEURS_REFERENCE = 48;

const hex2 = (n) => n.toString(16).padStart(2, '0');

/**
 * La palette de `count` couleurs (24 par défaut) d'une image de référence, dans le format
 * attendu par `forcedPalette` (des chaînes `#rrggbb`) : on quantifie une fois, puis on
 * relit les couleurs distinctes du résultat — c'est la palette EFFECTIVE, jamais plus de
 * `count` entrées, jamais un aplat de nuances voisines non fusionnées.
 */
export function paletteDeReference(image, count = NOMBRE_COULEURS) {
  const quantifiee = quantize(image, count);
  const vues = new Set();
  for (let i = 0; i < quantifiee.data.length; i += 4) {
    if (quantifiee.data[i + 3] < 8) continue; // pixel transparent : sa couleur ne compte pas, quantize() la traite pareil.
    vues.add(`#${hex2(quantifiee.data[i])}${hex2(quantifiee.data[i + 1])}${hex2(quantifiee.data[i + 2])}`);
  }
  return [...vues];
}

/**
 * Quantifie une image sur une palette déjà extraite (`paletteDeReference`). L'alpha ne
 * bouge pas : `quantize` copie `image.data` puis ne réécrit que les canaux R/V/B des
 * pixels visibles, l'alpha original traverse tel quel.
 */
export function appliquerPalette(image, palette) {
  if (!palette || !palette.length) throw new Error('Palette de référence vide.');
  return quantize(image, palette.length, palette);
}

/**
 * Harmonise un lot de matières générées ensemble : la PREMIÈRE image du lot (dans l'ordre
 * de `matieresAttendues` — donc `surface`, le sol) sert de référence de palette, et
 * TOUTES les images, elle comprise, sont quantifiées sur cette même palette de 24
 * couleurs — pour que les trois partagent exactement 24 couleurs, pas 23 pour la
 * référence et jusqu'à 24 de plus pour chacune des autres.
 */
export function harmoniserPalette(images, count = NOMBRE_COULEURS) {
  if (!images.length) return images;
  const palette = paletteDeReference(images[0], count);
  return images.map((image) => appliquerPalette(image, palette));
}

// ===========================================================================
// T31 — la palette d'une référence DÉSIGNÉE
// ===========================================================================
//
// Deux différences de fond avec T26 bis, au-dessus, et elles expliquent pourquoi ce n'est
// pas la même fonction avec un autre nombre :
//
//  * la référence n'est pas une matière du lot, c'est une ou plusieurs images que
//    L'UTILISATEUR désigne (bibliothèque ou import) — le jeu dont on veut la couleur ;
//  * le rapprochement est la variante « douce » d'E4 (Reinhard puis plus-proche-couleur),
//    et non une quantification nue : le transfert de statistiques amène d'abord la matière
//    dans la distribution de la référence, l'indexation ne fait que la poser dessus.
//
// **La règle de composition avec T26 bis, et c'est la décision de la tranche** : une
// référence désignée REMPLACE la palette commune. Les deux quantifient ; les empiler
// quantifierait deux fois — la seconde passe travaillerait sur les 24 couleurs qu'a laissées
// la première, et la distribution de la référence n'aurait plus de quoi s'exprimer. C'est
// `public/tools.js` (`genererMatieresIa`) qui applique la règle : référence présente →
// `harmoniserPalette` n'est pas appelée.
//
// L'autre moitié de l'invariant est dans le moteur : la palette s'applique APRÈS la
// réduction, jamais avant. T26 bis harmonisait les maîtres 512 px, et la moyenne d'aire de
// la réduction recréait ensuite des couleurs intermédiaires entre les 24 retenues — la
// quantification était défaite par l'étape suivante. Voir `renderLogical`.

/**
 * La palette de référence d'un lot d'images désignées : `{ palette, stats }`, la forme exacte
 * que `settings.palette` attend côté moteur. `null` si le lot est vide ou entièrement
 * transparent — l'appelant n'a alors rien à passer au moteur, et rien ne bouge.
 */
export function paletteDeReferenceLab(images, n = NOMBRE_COULEURS_REFERENCE) {
  return paletteLabPonderee(images, n);
}

/**
 * Rapproche une image de sa référence — la variante douce d'E4. `ref` est ce que rend
 * `paletteDeReferenceLab`. L'implémentation est celle de `tile-palette-lab.js` : le moteur
 * appelle la même, ce qui est la seule façon d'être sûr que l'atelier montre ce qu'il exporte.
 */
export function rapprocherDeLaReference(image, ref) {
  return rapprocherVersReference(image, ref);
}
