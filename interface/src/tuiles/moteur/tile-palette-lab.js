// La palette de référence, en espace Lab — tranche T31 (docs/PLAN-tilesets.md, « ### T31 »).
//
// Module PUR : aucun accès au DOM, aucune dépendance Node, aucun import d'app.js. C'est la
// condition pour qu'il serve les TROIS appelants qui en ont besoin, sans divergence :
//
//   * `public/vendor/tileset-engine.js` — applique la palette après la réduction ;
//   * `public/tile-palette.js` — la façade de l'atelier (`paletteDeReferenceLab`) ;
//   * `scripts/essai-palette-jeu.mjs` — le banc de l'étude E4, qui a MESURÉ cet algorithme
//     et qui réimporte désormais ces fonctions au lieu de les définir.
//
// Ce que E4 a établi (docs/ETUDE-beau-mur-E4.md), et qui décide de tout ce qui suit :
//
//   * la « palette du jeu » n'est pas une liste de couleurs, c'est une DISTRIBUTION — d'où
//     le k-means pondéré par la surface (un pixel = une voix) plutôt qu'un relevé de teintes
//     distinctes, où un liseré d'un pixel pèserait autant qu'un mur entier ;
//   * la variante retenue est la « douce » à N = 48 : transfert de statistiques Lab
//     (Reinhard) PUIS plus-proche-couleur ΔE76. La « dure » (plus-proche-couleur seul)
//     laisse la matière neuve loin de la distribution du jeu, et N = 24 pousse le quasi-noir
//     trop haut.
//
// Le choix de l'espace Lab n'est pas décoratif : la règle « la couleur la plus proche »
// porte sur la couleur PERÇUE. En RGB, un bleu saturé et un gris moyen ont des composantes
// du même ordre alors que l'œil les sépare nettement.
//
// Les images attendues ont la forme `{ width, height, data }`, `data` en RGBA
// (Uint8ClampedArray ou Uint8Array) — la même que `decodePng` (lib/png.mjs), que
// `createImageData` et que les textures d'emplacement (tile-emplacements.js).
//
// Les pixels dont l'alpha est sous 128 ne comptent dans AUCUNE mesure et ne sont jamais
// réécrits : une tuile de bord ne peint qu'une bande, et compter le vide autour ferait
// mentir la distribution comme il ferait mentir la fiche de `tile-mesures.js`.

// ---------------------------------------------------------------------------
// sRGB ↔ Lab (D65)
// ---------------------------------------------------------------------------
//
// Ces constantes sont celles que le moteur utilisait en propre depuis T30 (le choix du
// pixel représentatif de `choixContraste` se fait en Lab) : elles sont reprises ICI au bit
// près, et le moteur les importe maintenant d'ici au lieu d'en garder une copie. C'est ce
// qui garde vraies, sans y toucher, toutes les empreintes SHA-256 de T30.
const LAB_XN = 0.95047, LAB_YN = 1.0, LAB_ZN = 1.08883;
const LAB_DELTA3 = 0.008856451679035631; // (6/29)³
const LAB_PENTE = 7.787037037037035;     // 1/(3·(6/29)²)
const LAB_DECAL = 0.13793103448275862;   // 4/29
const labF = (t) => (t > LAB_DELTA3 ? Math.cbrt(t) : t * LAB_PENTE + LAB_DECAL);
const labFInv = (t) => (t > 0.20689655172413793 ? t * t * t : (t - LAB_DECAL) / LAB_PENTE);
const srgbVersLineaire = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lineaireVersSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/**
 * RGB 0-255 → [L, a, b]. Écrit dans `sortie` à l'offset `o` — la boucle de pixels du moteur
 * passe son propre tampon pour ne pas allouer un tableau par pixel ; un appelant qui n'a
 * qu'une couleur à convertir omet les deux arguments et reçoit un tableau neuf.
 */
export function rgbVersLab(r, g, b, sortie = [0, 0, 0], o = 0) {
  const rl = srgbVersLineaire(Math.min(255, Math.max(0, r)) / 255);
  const gl = srgbVersLineaire(Math.min(255, Math.max(0, g)) / 255);
  const bl = srgbVersLineaire(Math.min(255, Math.max(0, b)) / 255);
  const fx = labF((0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / LAB_XN);
  const fy = labF((0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl) / LAB_YN);
  const fz = labF((0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / LAB_ZN);
  sortie[o] = 116 * fy - 16;
  sortie[o + 1] = 500 * (fx - fy);
  sortie[o + 2] = 200 * (fy - fz);
  return sortie;
}

/** [L, a, b] → RGB 0-255, NON arrondi. Même convention de `sortie` / `o` que ci-dessus. */
export function labVersRgb(L, a, b, sortie = [0, 0, 0], o = 0) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const X = labFInv(fx) * LAB_XN, Y = labFInv(fy) * LAB_YN, Z = labFInv(fz) * LAB_ZN;
  const rl = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  const gl = -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z;
  const bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  sortie[o] = Math.min(255, Math.max(0, lineaireVersSrgb(rl) * 255));
  sortie[o + 1] = Math.min(255, Math.max(0, lineaireVersSrgb(gl) * 255));
  sortie[o + 2] = Math.min(255, Math.max(0, lineaireVersSrgb(bl) * 255));
  return sortie;
}

/**
 * ΔE76 au CARRÉ entre deux couleurs Lab. Le nom le dit exprès : la racine ne sert jamais ici
 * — on ne fait que COMPARER des distances (plus proche centre, point le plus éloigné) — et
 * l'extraire coûterait une racine par pixel et par couleur de palette.
 */
export function dE76Carre(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

// ---------------------------------------------------------------------------
// L'histogramme pondéré par la surface
// ---------------------------------------------------------------------------

/**
 * Le compte de pixels par couleur RGB sur un LOT d'images (`{ compte, total }`). Le poids
 * d'une couleur est sa surface : c'est le seul poids qui a un sens quand on cherche « la
 * distribution du jeu » et non « les couleurs que le jeu contient ».
 *
 * Plusieurs images sont la règle, pas l'exception : E4 a relevé la palette sur les CINQ
 * `wall_rock_*`, et l'utilisateur désigne une ou plusieurs références.
 */
export function histogrammeImages(images) {
  const compte = new Map(); // clef RGB (24 bits) → nombre de pixels
  let total = 0;
  for (const img of images || []) {
    if (!img || !img.data) continue;
    const n = (img.width || 0) * (img.height || 0);
    for (let k = 0; k < n; k += 1) {
      const i = k * 4;
      if (img.data[i + 3] < 128) continue;
      const clef = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
      compte.set(clef, (compte.get(clef) || 0) + 1);
      total += 1;
    }
  }
  return { compte, total };
}

// ---------------------------------------------------------------------------
// k-means Lab pondéré, amorçage farthest-point — DÉTERMINISTE
// ---------------------------------------------------------------------------

/**
 * `n` couleurs représentatives d'un histogramme, en Lab, pondérées par la surface.
 * Rend `[{ lab, rgb, poids }]`, `poids` étant la part de surface du centre (0 à 1).
 *
 * Il n'y a AUCUN tirage au sort ici, et c'est un choix : un k-means amorcé au hasard rendrait
 * une palette différente à chaque rendu, donc un atlas qui bouge sans qu'on ait touché à un
 * réglage. Le premier centre est la couleur la plus fréquente ; les suivants sont pris au
 * point le plus éloigné des centres déjà posés (distance² × poids), ce qui est l'amorçage
 * `k-means++` privé de son tirage — le même que celui qu'E4 a mesuré.
 */
export function kmeansLab(compte, total, n, iters = 20) {
  const entries = [...compte.entries()].map(([clef, poids]) => {
    const r = (clef >> 16) & 255, g = (clef >> 8) & 255, b = clef & 255;
    return { rgb: [r, g, b], lab: rgbVersLab(r, g, b), poids };
  });
  if (!entries.length) return [];

  // Amorçage 1 : la couleur la plus fréquente. `>` strict, donc à égalité c'est la première
  // rencontrée dans l'ordre de balayage qui gagne — l'ordre de la Map, lui-même déterministe.
  let seedIdx = 0;
  for (let i = 1; i < entries.length; i += 1) if (entries[i].poids > entries[seedIdx].poids) seedIdx = i;
  const centres = [entries[seedIdx].lab.slice()];

  const dmin = entries.map((e) => dE76Carre(e.lab, centres[0]));
  while (centres.length < n && centres.length < entries.length) {
    let best = -1, bestScore = -1;
    for (let i = 0; i < entries.length; i += 1) {
      const score = dmin[i] * entries[i].poids;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) break;
    centres.push(entries[best].lab.slice());
    const dernier = centres[centres.length - 1];
    for (let i = 0; i < entries.length; i += 1) dmin[i] = Math.min(dmin[i], dE76Carre(entries[i].lab, dernier));
  }

  // Lloyd pondéré, borné : `iters` passes au plus, et on sort dès que plus rien ne bouge.
  const assign = new Int32Array(entries.length);
  for (let it = 0; it < iters; it += 1) {
    let bouge = false;
    for (let i = 0; i < entries.length; i += 1) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centres.length; c += 1) {
        const d = dE76Carre(entries[i].lab, centres[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (assign[i] !== best) bouge = true;
      assign[i] = best;
    }
    const somme = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < entries.length; i += 1) {
      const s = somme[assign[i]], w = entries[i].poids;
      s[0] += entries[i].lab[0] * w; s[1] += entries[i].lab[1] * w; s[2] += entries[i].lab[2] * w; s[3] += w;
    }
    for (let c = 0; c < centres.length; c += 1) {
      if (somme[c][3] > 0) centres[c] = [somme[c][0] / somme[c][3], somme[c][1] / somme[c][3], somme[c][2] / somme[c][3]];
    }
    if (!bouge) break;
  }

  const poidsCentre = centres.map(() => 0);
  for (let i = 0; i < entries.length; i += 1) poidsCentre[assign[i]] += entries[i].poids;

  return centres.map((lab, c) => ({
    lab,
    rgb: labVersRgb(lab[0], lab[1], lab[2]),
    poids: total ? poidsCentre[c] / total : 0,
  }));
}

// ---------------------------------------------------------------------------
// Statistiques Lab (moyenne / écart-type par canal)
// ---------------------------------------------------------------------------

/** Les statistiques d'un histogramme — pondérées par la surface, comme la palette. */
export function statsLabHistogramme(compte, total) {
  const s = [0, 0, 0];
  const lab = [0, 0, 0];
  for (const [clef, poids] of compte) {
    rgbVersLab((clef >> 16) & 255, (clef >> 8) & 255, clef & 255, lab, 0);
    s[0] += lab[0] * poids; s[1] += lab[1] * poids; s[2] += lab[2] * poids;
  }
  const moy = s.map((v) => (total ? v / total : 0));
  const v = [0, 0, 0];
  for (const [clef, poids] of compte) {
    rgbVersLab((clef >> 16) & 255, (clef >> 8) & 255, clef & 255, lab, 0);
    v[0] += (lab[0] - moy[0]) ** 2 * poids; v[1] += (lab[1] - moy[1]) ** 2 * poids; v[2] += (lab[2] - moy[2]) ** 2 * poids;
  }
  return { moyenne: moy, ecart: v.map((x) => Math.sqrt(total ? x / total : 0)) };
}

/** Les mêmes statistiques, sur une image — c'est la SOURCE du transfert de Reinhard. */
export function statsLabImage(img) {
  const s = [0, 0, 0];
  const lab = [0, 0, 0];
  let n = 0;
  const pixels = img.width * img.height;
  for (let k = 0; k < pixels; k += 1) {
    const i = k * 4;
    if (img.data[i + 3] < 128) continue;
    rgbVersLab(img.data[i], img.data[i + 1], img.data[i + 2], lab, 0);
    s[0] += lab[0]; s[1] += lab[1]; s[2] += lab[2]; n += 1;
  }
  const moy = s.map((v) => (n ? v / n : 0));
  const v = [0, 0, 0];
  for (let k = 0; k < pixels; k += 1) {
    const i = k * 4;
    if (img.data[i + 3] < 128) continue;
    rgbVersLab(img.data[i], img.data[i + 1], img.data[i + 2], lab, 0);
    v[0] += (lab[0] - moy[0]) ** 2; v[1] += (lab[1] - moy[1]) ** 2; v[2] += (lab[2] - moy[2]) ** 2;
  }
  return { moyenne: moy, ecart: v.map((x) => Math.sqrt(n ? x / n : 0)) };
}

// ---------------------------------------------------------------------------
// Les deux temps de la variante « douce »
// ---------------------------------------------------------------------------

/**
 * Plus-proche-couleur ΔE76 sur une palette `[{ lab, rgb }]` — la variante « dure » d'E4 prise
 * seule, le second temps de la « douce ».
 *
 * L'alpha traverse tel quel, et un pixel sous 128 garde AUSSI sa couleur : il ne comptait pas
 * dans la distribution, il n'a pas à être indexé sur elle.
 */
export function rapprocher(img, palette) {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.length) };
  const n = img.width * img.height;
  const lab = [0, 0, 0];
  for (let k = 0; k < n; k += 1) {
    const i = k * 4;
    out.data[i] = img.data[i]; out.data[i + 1] = img.data[i + 1]; out.data[i + 2] = img.data[i + 2];
    out.data[i + 3] = img.data[i + 3];
    if (img.data[i + 3] < 128) continue;
    rgbVersLab(img.data[i], img.data[i + 1], img.data[i + 2], lab, 0);
    let best = 0, bestD = Infinity;
    for (let c = 0; c < palette.length; c += 1) {
      const d = dE76Carre(lab, palette[c].lab);
      if (d < bestD) { bestD = d; best = c; }
    }
    const [r, g, b] = palette[best].rgb;
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
  }
  return out;
}

/**
 * Transfert de statistiques Lab (Reinhard) : chaque canal est recentré et remis à l'échelle
 * de la référence. C'est le PREMIER temps de la variante douce — la matière neuve migre vers
 * la distribution de la référence AVANT d'être indexée, au lieu d'être jetée sur la palette
 * la plus proche depuis l'endroit où elle se trouvait.
 */
export function transfertReinhard(img, statsSrc, statsRef) {
  const out = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.length) };
  const n = img.width * img.height;
  const lab = [0, 0, 0], rgb = [0, 0, 0];
  for (let k = 0; k < n; k += 1) {
    const i = k * 4;
    out.data[i] = img.data[i]; out.data[i + 1] = img.data[i + 1]; out.data[i + 2] = img.data[i + 2];
    out.data[i + 3] = img.data[i + 3];
    if (img.data[i + 3] < 128) continue;
    rgbVersLab(img.data[i], img.data[i + 1], img.data[i + 2], lab, 0);
    for (let c = 0; c < 3; c += 1) {
      // Écart-type source plancher à 1e-3 : une image d'aplat parfait a un écart nul sur un
      // canal, et diviser par lui enverrait tous ses pixels à l'infini.
      const es = Math.max(1e-3, statsSrc.ecart[c]);
      lab[c] = ((lab[c] - statsSrc.moyenne[c]) / es) * statsRef.ecart[c] + statsRef.moyenne[c];
    }
    labVersRgb(lab[0], lab[1], lab[2], rgb, 0);
    out.data[i] = rgb[0]; out.data[i + 1] = rgb[1]; out.data[i + 2] = rgb[2];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Les deux entrées publiques
// ---------------------------------------------------------------------------

/**
 * La palette de référence et ses statistiques, depuis un lot d'images :
 * `{ palette: [{ lab, rgb, poids }], stats: { moyenne, ecart } }`.
 *
 * L'histogramme est construit UNE fois et sert aux deux — la palette (k-means) et les
 * statistiques du transfert. Les recalculer séparément ferait deux balayages de plus et,
 * surtout, ouvrirait la porte à ce qu'ils ne portent plus sur le même lot.
 */
export function paletteLabPonderee(images, n = 48) {
  const { compte, total } = histogrammeImages(images);
  if (!total) return null;
  return { palette: kmeansLab(compte, total, Math.max(1, Math.round(n))), stats: statsLabHistogramme(compte, total) };
}

/**
 * La variante « douce » d'E4, en un geste : Reinhard vers les statistiques de la référence,
 * puis plus-proche-couleur sur sa palette. `ref` est ce que rend `paletteLabPonderee`.
 *
 * C'est l'implémentation unique ; `public/tile-palette.js` l'expose sous le nom
 * `rapprocherDeLaReference` pour l'atelier, et le moteur l'appelle directement.
 */
export function rapprocherVersReference(image, ref) {
  if (!ref || !ref.palette || !ref.palette.length) return image;
  const statsSrc = statsLabImage(image);
  const douce = ref.stats ? transfertReinhard(image, statsSrc, ref.stats) : image;
  return rapprocher(douce, ref.palette);
}
