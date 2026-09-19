// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { imageBuffer } from '../pixel-core.js';
import {
  paletteDeReference, appliquerPalette, harmoniserPalette,
  paletteDeReferenceLab, rapprocherDeLaReference, NOMBRE_COULEURS_REFERENCE,
} from '../tile-palette.js';
import { rapprocher } from '../tile-palette-lab.js';
import { mesurer } from '../tile-mesures.js';
import { atlasPosition } from '../tile-masks.js';
import { installerBouchonCanvas } from './canvas-shim';
// T31 mesure aussi le MOTEUR — la palette s'applique dans `renderLogical`, juste après la
// réduction. Même bouchon de canvas que tests/resample-texture.test.mjs, et import dynamique
// pour qu'il soit en place avant l'évaluation du module.
installerBouchonCanvas();
const { renderLogical } = await import('../vendor/tileset-engine.js');

// T26 bis (docs/PLAN-tilesets.md) : trois matières générées sans lien se rapprochent d'une
// seule pierre en se quantifiant sur la palette de 24 couleurs de la RÉFÉRENCE (le sol,
// premier élément du lot) — jamais sur l'union des matières, qui ne rapproche rien. Ces
// essais sont sur des images synthétiques `{width,height,data}`, sans DOM ni GPU.

const hex = (n) => n.toString(16).padStart(2, '0');
const couleurHex = (img, p) => `#${hex(img.data[p * 4])}${hex(img.data[p * 4 + 1])}${hex(img.data[p * 4 + 2])}`;

// Un grain déterministe (23 paliers de luminance, jamais un dégradé lisse) teinté par
// `tint` — le même grain sous deux teintes donne deux matières au motif identique mais à
// la couleur différente, exactement ce que T26 mesure (tronc partagé, teinte qui dérive).
function matiere(w, h, tint) {
  const img = imageBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = ((x * 37 + y * 17) % 23) / 23;
      const l = 70 + n * 130;
      const p = (y * w + x) * 4;
      img.data.set([Math.min(255, Math.round(l * tint[0])), Math.min(255, Math.round(l * tint[1])), Math.min(255, Math.round(l * tint[2])), 255], p);
    }
  }
  return img;
}

function luminance(image) {
  const out = new Float64Array(image.width * image.height);
  for (let p = 0; p < out.length; p++) out[p] = (image.data[p * 4] + image.data[p * 4 + 1] + image.data[p * 4 + 2]) / 3;
  return out;
}

// Corrélation de Pearson entre deux champs de luminance : 1 = même motif, 0 = sans rapport.
function correlation(a, b) {
  const n = a.length, meanA = a.reduce((s, v) => s + v, 0) / n, meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - meanA, db = b[i] - meanB; num += da * db; denA += da * da; denB += db * db; }
  return num / Math.sqrt(denA * denB || 1);
}

// La couleur moyenne d'une image, exprimée comme un écart à son propre gris (la direction
// chromatique) — un petit substitut du Δchroma mesuré dans le plan, suffisant pour vérifier
// que deux teintes se rapprochent après harmonisation.
function chromaVecteur(image) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < image.width * image.height; p++) {
    const i = p * 4;
    if (image.data[i + 3] < 8) continue;
    const lum = (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3;
    r += image.data[i] - lum; g += image.data[i + 1] - lum; b += image.data[i + 2] - lum; n++;
  }
  return [r / n, g / n, b / n];
}
function chromaDistance(a, b) {
  const [ra, ga, ba] = chromaVecteur(a), [rb, gb, bb] = chromaVecteur(b);
  return Math.sqrt((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2);
}

test('après harmonisation, chaque matière n’utilise que les couleurs de la palette du sol (24 au plus)', () => {
  const sol = matiere(32, 32, [1.0, 0.78, 0.55]);
  const face = matiere(32, 32, [0.5, 0.7, 1.05]);
  const bas = matiere(32, 32, [0.65, 1.0, 0.6]);
  const [solH, faceH, basH] = harmoniserPalette([sol, face, bas]);
  const palette = new Set(paletteDeReference(sol));
  assert.ok(palette.size <= 24, `palette de référence trop grande : ${palette.size}`);
  for (const img of [solH, faceH, basH]) {
    const couleurs = new Set();
    for (let p = 0; p < img.width * img.height; p++) if (img.data[p * 4 + 3] >= 8) couleurs.add(couleurHex(img, p));
    assert.ok(couleurs.size <= 24, `plus de 24 couleurs après harmonisation : ${couleurs.size}`);
    for (const c of couleurs) assert.ok(palette.has(c), `couleur hors de la palette de référence : ${c}`);
  }
  // À l'envers : sans harmonisation, l'union des trois matières dépasse largement 24
  // couleurs distinctes — la contrainte vérifiée ci-dessus n'est donc pas trivialement vraie.
  const brut = new Set();
  for (const img of [sol, face, bas]) for (let p = 0; p < img.width * img.height; p++) brut.add(couleurHex(img, p));
  assert.ok(brut.size > 24, `le lot brut ne dépasse pas 24 couleurs, l’essai ne prouve rien : ${brut.size}`);
});

test('l’alpha ne bouge pas après harmonisation, transparence et semi-transparence comprises', () => {
  const sol = matiere(16, 16, [1.0, 0.8, 0.6]);
  const face = matiere(16, 16, [0.6, 0.8, 1.1]);
  for (let p = 0; p < sol.width * sol.height; p += 5) sol.data[p * 4 + 3] = 0;
  for (let p = 0; p < face.width * face.height; p += 7) face.data[p * 4 + 3] = 120;
  const alphaAvant = [sol, face].map((img) => Array.from(img.data).filter((_, i) => i % 4 === 3));
  const [solH, faceH] = harmoniserPalette([sol, face]);
  const alphaApres = [solH, faceH].map((img) => Array.from(img.data).filter((_, i) => i % 4 === 3));
  assert.deepEqual(alphaApres, alphaAvant);
  // À l'envers : si un octet d'alpha changeait après coup, deepEqual doit le détecter —
  // sinon l'assertion ci-dessus ne teste rien.
  const altere = alphaApres.map((a) => [...a]);
  altere[0][0] = altere[0][0] === 255 ? 254 : 255;
  assert.notDeepEqual(altere, alphaAvant);
});

test('le motif est conservé : la luminance harmonisée corrèle fortement avec l’originale', () => {
  const sol = matiere(32, 32, [1.0, 0.8, 0.55]);
  const [solH] = harmoniserPalette([sol]);
  const c = correlation(luminance(sol), luminance(solH));
  assert.ok(c > 0.9, `corrélation trop faible entre l’original et l’harmonisé : ${c}`);
  // À l'envers : un aplat remplace tout le motif par une seule couleur — la corrélation
  // s'effondre, ce qui prouve que la mesure ci-dessus n'est pas toujours haute par construction.
  const aplat = imageBuffer(32, 32);
  for (let p = 0; p < aplat.width * aplat.height; p++) aplat.data.set([128, 128, 128, 255], p * 4);
  const cAplat = correlation(luminance(sol), luminance(aplat));
  assert.ok(cAplat < 0.3, `corrélation d’un aplat anormalement haute : ${cAplat}`);
});

test('deux matières de teintes très différentes se rapprochent en teinte après harmonisation — jamais via l’union', () => {
  const sol = matiere(32, 32, [1.05, 0.78, 0.5]);
  const face = matiere(32, 32, [0.45, 0.7, 1.15]);
  const avant = chromaDistance(sol, face);
  const [solH, faceH] = harmoniserPalette([sol, face]);
  const apres = chromaDistance(solH, faceH);
  assert.ok(apres < avant * 0.7, `la teinte ne se rapproche pas assez : ${avant} -> ${apres}`);
  // À l'envers : la palette de l'UNION des deux matières (mesurée dans le plan T26 bis
  // comme ne rapprochant rien) ne doit pas faire mieux que la référence seule.
  const union = imageBuffer(sol.width * 2, sol.height);
  for (let y = 0; y < sol.height; y++) {
    union.data.set(sol.data.subarray(y * sol.width * 4, (y + 1) * sol.width * 4), y * union.width * 4);
    union.data.set(face.data.subarray(y * face.width * 4, (y + 1) * face.width * 4), (y * union.width + sol.width) * 4);
  }
  const paletteUnion = paletteDeReference(union);
  const solU = appliquerPalette(sol, paletteUnion), faceU = appliquerPalette(face, paletteUnion);
  const apresUnion = chromaDistance(solU, faceU);
  assert.ok(apresUnion >= apres, `l’union rapproche plus que la référence seule, contraire à la mesure : ${apresUnion} < ${apres}`);
});

test('l’harmonisation est déterministe', () => {
  const sol = matiere(24, 24, [1.0, 0.8, 0.6]);
  const face = matiere(24, 24, [0.6, 0.85, 1.1]);
  const a = harmoniserPalette([sol, face]).map((img) => Array.from(img.data));
  const b = harmoniserPalette([sol, face]).map((img) => Array.from(img.data));
  assert.deepEqual(a, b);
});

// ===========================================================================
// Tranche T31 — la palette de référence
// ===========================================================================
//
// Deux choses distinguent T31 de T26 bis ci-dessus, et ce sont elles qui sont mesurées ici :
//
//  * la référence est DÉSIGNÉE (une ou plusieurs images de l'utilisateur), et le
//    rapprochement est la variante « douce » d'E4 — transfert de statistiques Lab (Reinhard)
//    puis plus-proche-couleur ΔE76, jamais une quantification nue ;
//  * la palette s'applique APRÈS la réduction, dans `renderLogical`. Son absence ne doit rien
//    déplacer : les trois empreintes plus bas ont été relevées AVANT d'écrire une ligne de la
//    tranche, comme T30 l'avait fait pour la sienne.

// Une pierre ocre de donjon : joints sombres larges, grain fin sur deux fréquences — assez de
// couleurs distinctes (165) pour qu'un k-means à 48 ait vraiment 48 centres à poser.
const pierreReference = (taille, periode, joint, teinte) => {
  const data = new Uint8ClampedArray(taille * taille * 4);
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dansJoint = (x % periode) < joint || (y % periode) < joint;
      const n = ((x * 29 + y * 13) % 31) / 31, m = ((x * 7 + y * 23) % 11) / 11;
      const L = dansJoint ? 6 + n * 10 : 90 + n * 70 + m * 20;
      const i = (y * taille + x) * 4;
      data[i] = Math.round(Math.min(255, L * teinte[0]));
      data[i + 1] = Math.round(Math.min(255, L * teinte[1]));
      data[i + 2] = Math.round(Math.min(255, L * teinte[2]));
      data[i + 3] = 255;
    }
  }
  return { width: taille, height: taille, data };
};

// La matière neuve à rapprocher : autre teinte, autre grain, autre période. Sa PART de pixels
// sombres est en revanche voisine de celle de la référence, et c'est délibéré — voir la note
// sur le quasi-noir dans le dernier essai.
const matiereNeuve = (taille, periode, joint, teinte) => {
  const data = new Uint8ClampedArray(taille * taille * 4);
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const dansJoint = (x % periode) < joint || (y % periode) < joint;
      const n = ((x * 37 + y * 17) % 23) / 23, g = ((x * 131 + y * 197) % 97) / 97;
      const L = dansJoint ? 26 + n * 22 + g * 14 : 120 + n * 70 + g * 40;
      const i = (y * taille + x) * 4;
      data[i] = Math.round(Math.min(255, L * teinte[0]));
      data[i + 1] = Math.round(Math.min(255, L * teinte[1]));
      data[i + 2] = Math.round(Math.min(255, L * teinte[2]));
      data[i + 3] = 255;
    }
  }
  return { width: taille, height: taille, data };
};

const OCRE = [1.0, 0.80, 0.55], BLEU = [0.55, 0.75, 1.0];
const referenceOcre = () => pierreReference(96, 24, 6, OCRE);

test('T31 · la palette de référence est déterministe, et deux références différentes ne donnent pas la même', () => {
  const ref = referenceOcre();
  const a = paletteDeReferenceLab([ref]), b = paletteDeReferenceLab([ref]);
  assert.equal(a.palette.length, NOMBRE_COULEURS_REFERENCE, 'la référence a de quoi remplir 48 centres');
  assert.deepEqual(a, b, 'deux relevés de la même référence doivent être identiques — il n’y a aucun tirage au sort dans l’amorçage');
  // Et le rapprochement qui s'ensuit l'est aussi, jusqu'au pixel.
  const neuve = matiereNeuve(64, 32, 10, BLEU);
  assert.deepEqual(
    [...rapprocherDeLaReference(neuve, a).data],
    [...rapprocherDeLaReference(neuve, b).data],
  );
  // À l'envers : une autre référence donne une autre palette, sinon l'égalité ci-dessus ne
  // prouverait qu'une fonction constante.
  const autre = paletteDeReferenceLab([pierreReference(96, 24, 6, BLEU)]);
  assert.notDeepEqual(autre.palette, a.palette);
});

test('T31 · l’alpha traverse le rapprochement intact, semi-transparence comprise', () => {
  const ref = paletteDeReferenceLab([referenceOcre()]);
  const neuve = matiereNeuve(32, 32, 10, BLEU);
  for (let p = 0; p < neuve.width * neuve.height; p += 5) neuve.data[p * 4 + 3] = 0;
  for (let p = 1; p < neuve.width * neuve.height; p += 7) neuve.data[p * 4 + 3] = 120;
  const avant = Array.from(neuve.data).filter((_, i) => i % 4 === 3);
  const apres = Array.from(rapprocherDeLaReference(neuve, ref).data).filter((_, i) => i % 4 === 3);
  assert.deepEqual(apres, avant);
  // À l'envers : un octet d'alpha changé doit faire échouer la comparaison ci-dessus.
  const altere = [...apres];
  altere[3] = altere[3] === 255 ? 254 : 255;
  assert.notDeepEqual(altere, avant);
});

test('T31 · deux matières de teintes opposées convergent en chroma une fois rapprochées de la même référence', () => {
  const ref = paletteDeReferenceLab([referenceOcre()]);
  const bleue = matiereNeuve(48, 32, 10, BLEU);
  const verte = matiereNeuve(48, 32, 10, [0.5, 1.05, 0.55]);
  const avant = chromaDistance(bleue, verte);
  const apres = chromaDistance(rapprocherDeLaReference(bleue, ref), rapprocherDeLaReference(verte, ref));
  assert.ok(apres < avant * 0.3, `la teinte ne converge pas assez : ${avant.toFixed(2)} -> ${apres.toFixed(2)}`);
});

test('T31 · la variante douce rapproche la luminance moyenne davantage que la dure', () => {
  // La mesure qui a décidé de la variante dans E4, rejouée sur des images synthétiques : le
  // transfert de statistiques AVANT l'indexation amène la matière dans la distribution de la
  // référence, là où le plus-proche-couleur seul la jette sur la palette depuis l'endroit où
  // elle se trouvait — et atterrit trop bas.
  const refImage = referenceOcre();
  const ref = paletteDeReferenceLab([refImage]);
  const neuve = matiereNeuve(64, 32, 10, BLEU);
  const cible = mesurer(refImage).moyL;
  const dure = Math.abs(mesurer(rapprocher(neuve, ref.palette)).moyL - cible);
  const douce = Math.abs(mesurer(rapprocherDeLaReference(neuve, ref)).moyL - cible);
  assert.ok(douce < dure, `la douce devrait être plus proche : douce=${douce.toFixed(1)} dure=${dure.toFixed(1)}`);
  // Et l'écart n'est pas un demi-point : mesuré 12,0 contre 21,5 sur ces images.
  assert.ok(dure - douce > 5, `écart trop faible entre les deux variantes : ${(dure - douce).toFixed(1)}`);
});

// --- Le moteur : la palette s'applique APRÈS la réduction, et son absence ne bouge rien ----

const hexRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
// La matière à joints de T28/T30, recopiée telle quelle : c'est sur ELLE que les empreintes
// ci-dessous ont été relevées, et la changer changerait ce qu'elles prouvent.
const matiereAJoints = (taille, periode, joint, pierre = 200) => {
  const data = new Uint8ClampedArray(taille * taille * 4);
  for (let y = 0; y < taille; y += 1) {
    for (let x = 0; x < taille; x += 1) {
      const v = ((x % periode) < joint || (y % periode) < joint) ? 0 : pierre;
      const i = (y * taille + x) * 4;
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
    }
  }
  return { data, width: taille, height: taille };
};
const reglagesT30 = (over = {}) => ({
  tilesetType: 'topdown-15', tileSize: 32, cornerRadius: 2, edgeStyle: 'rough', edgeRoughness: 3,
  edgeFrequency: 5, edgePadding: 4, baseColor: hexRgb('#92af70'), edgeColor: hexRgb('#43563d'),
  edgeFade: 3, shades: 4, textureNoise: 12, fleckAmount: 6, seed: 31415,
  whiteBackground: false, showGrid: false, pixelFlecks: true,
  surfaceTexture: matiereAJoints(256, 32, 6, 200),
  edgeTexture: matiereAJoints(256, 16, 4, 120),
  ...over,
});
const empreinte = (s) => createHash('sha256').update(Buffer.from(renderLogical(s).imageData.data.buffer)).digest('hex');
// Relevées AVANT d'écrire une ligne de T31, sur ces réglages exacts.
const EMPREINTE_T28 = '23674cc7fbd7e8967b5b4824712cc490e78f2b5bee9553e98151efd336f5606e';
const EMPREINTE_T30_CONTRASTE = 'b31a6d05f905369e3d72859051254500790e3ca46b615ad21eea967f5e38a879';
const EMPREINTE_T30_BLOB = 'ad673ea6d85867f5a719717efb6078d51b5a9f9c3277156264acdc8d4a653c7d';

test('T31 · sans settings.palette, l’atlas est celui de T30 au bit près', () => {
  // La garantie qui porte toute la tranche : le canal est branché sur les CINQ textures, et il
  // ne peut pas atteindre un rendu qui ne le demande pas. Trois empreintes, trois régimes.
  assert.equal(empreinte(reglagesT30()), EMPREINTE_T28);
  assert.equal(empreinte(reglagesT30({ reductionMode: 'contraste' })), EMPREINTE_T30_CONTRASTE);
  assert.equal(empreinte(reglagesT30({ tilesetType: 'blob-47', reductionMode: 'contraste', relief: 0 })), EMPREINTE_T30_BLOB);
  // Les formes vides comptent comme absentes : elles ne font pas autre chose en silence.
  assert.equal(empreinte(reglagesT30({ palette: null })), EMPREINTE_T28);
  assert.equal(empreinte(reglagesT30({ palette: [] })), EMPREINTE_T28);
  assert.equal(empreinte(reglagesT30({ palette: { palette: [] } })), EMPREINTE_T28);
  // Et une palette présente, elle, change bien quelque chose — sans quoi les six égalités
  // ci-dessus ne prouveraient qu'un canal débranché.
  const ref = paletteDeReferenceLab([referenceOcre()]);
  assert.notEqual(empreinte(reglagesT30({ palette: ref })), EMPREINTE_T28);
});

test('T31 · sur la case pleine du blob, la matière prend la palette de la référence', () => {
  // Les trois critères d'E4, mesurés par la fiche de `public/tile-mesures.js` (T30) sur la
  // case pleine du blob — la tuile qui ne porte QUE de la matière, sans bord ni coin.
  const refImage = referenceOcre();
  const ref = paletteDeReferenceLab([refImage]);
  const texture = matiereNeuve(256, 32, 10, BLEU);
  const reglages = (over = {}) => ({
    tilesetType: 'blob-47', tileSize: 32, cornerRadius: 2, edgeStyle: 'rough', edgeRoughness: 3,
    edgeFrequency: 5, edgePadding: 4, baseColor: hexRgb('#92af70'), edgeColor: hexRgb('#43563d'),
    edgeFade: 3, shades: 12, textureNoise: 12, fleckAmount: 6, seed: 31415, relief: 0,
    whiteBackground: false, showGrid: false, pixelFlecks: true, reductionMode: 'contraste',
    surfaceTexture: texture, edgeTexture: texture, ...over,
  });
  const casePleine = (canvas, tile) => {
    const { col, row } = atlasPosition('B47', 255); // 255 : tous les voisins présents — la tuile pleine
    const src = canvas.imageData;
    const out = { width: tile, height: tile, data: new Uint8ClampedArray(tile * tile * 4) };
    for (let y = 0; y < tile; y += 1) {
      for (let x = 0; x < tile; x += 1) {
        const s = ((row * tile + y) * src.width + (col * tile + x)) * 4, d = (y * tile + x) * 4;
        out.data.set(src.data.subarray(s, s + 4), d);
      }
    }
    return out;
  };
  const sans = casePleine(renderLogical(reglages()), 32);
  const avec = casePleine(renderLogical(reglages({ palette: ref })), 32);
  const fiche = mesurer(avec), ficheRef = mesurer(refImage), ficheSans = mesurer(sans);

  assert.ok(fiche.couleurs90 <= NOMBRE_COULEURS_REFERENCE, `90 % de la surface devrait tenir en ${NOMBRE_COULEURS_REFERENCE} couleurs, mesuré ${fiche.couleurs90}`);
  assert.ok(fiche.teinteConcentre >= 90, `teinte ±25° attendue ≥ 90 %, mesurée ${fiche.teinteConcentre.toFixed(1)} %`);
  // Le quasi-noir à ±5 points de la référence. Il faut dire à quelle condition : Reinhard
  // recale la MOYENNE et l'ÉCART-TYPE, pas la forme de la distribution — une matière dont la
  // part de pixels sombres serait très loin de celle de la référence ne pourrait pas atterrir
  // dans ±5, et ce serait une propriété de la méthode, pas un défaut du code. Les deux images
  // de cet essai portent donc une part de sombre voisine, comme un mur de donjon et un autre
  // mur de donjon. Mesuré : 43,75 % des deux côtés.
  assert.ok(
    Math.abs(fiche.quasiNoir - ficheRef.quasiNoir) <= 5,
    `quasi-noir attendu à ±5 de la référence (${ficheRef.quasiNoir.toFixed(1)} %), mesuré ${fiche.quasiNoir.toFixed(1)} %`,
  );

  // À l'envers, et c'est indispensable : SANS palette, la même tuile compte 93 couleurs pour
  // 90 % de sa surface et 0 % de quasi-noir. Les deux assertions ci-dessus ne sont donc pas
  // vraies par construction.
  assert.ok(ficheSans.couleurs90 > NOMBRE_COULEURS_REFERENCE, `sans palette, l’essai ne prouverait rien : ${ficheSans.couleurs90} couleurs`);
  assert.ok(Math.abs(ficheSans.quasiNoir - ficheRef.quasiNoir) > 5, `sans palette, le quasi-noir devrait être loin : ${ficheSans.quasiNoir.toFixed(1)} %`);

  // L'alpha de l'atlas n'est pas touché par la palette : la couverture vient du masque SDF,
  // jamais de la couleur de la matière.
  const alpha = (img) => Array.from(img.data).filter((_, i) => i % 4 === 3);
  assert.deepEqual(alpha(avec), alpha(sans));

  // La seconde écriture acceptée de `settings.palette` — le tableau d'images brutes, celle
  // dont les scripts Node se servent (`scripts/preuve-map-godot.mjs`, T32) — donne exactement
  // le même atlas que le descripteur calculé d'avance.
  const parImages = casePleine(renderLogical(reglages({ palette: [refImage] })), 32);
  assert.deepEqual([...parImages.data], [...avec.data]);
});
