// La fiche de mesure d'une tuile — module PUR (aucune dépendance Node, aucun accès DOM).
//
// Pourquoi ce fichier existe. Ces trois fonctions ont été écrites dans
// `scripts/essai-echelles.mjs` pour l'étude E3 (`docs/ETUDE-beau-mur-E3.md`), et la tranche
// T30 a besoin exactement des mêmes pour comparer son réducteur à l'oracle PixelOE
// (`scripts/essai-reducteur.mjs`). Les recopier les ferait diverger au premier réglage
// changé, et deux bancs qui ne mesurent plus la même chose ne se comparent plus : c'est le
// même réflexe qu'en T18 pour le prompt exact. Une seule source, réimportée des deux côtés.
//
// Le fichier vit dans `public/` parce que c'est là que le dépôt met ses modules purs
// partageables navigateur/Node (`tile-masks.js`, `tile-check.js`, `tile-materials.js`) ; il
// n'est aujourd'hui lu que par des scripts, ce qui n'est pas une raison de le ranger
// ailleurs — la fiche a vocation à s'afficher dans l'onglet « Contrôle » un jour.
//
// Les images attendues ont la forme `{ width, height, data }` avec `data` en RGBA
// (Uint8ClampedArray ou Uint8Array), la même que `decodePng` de `lib/png.mjs` et que
// `createImageData`.

/**
 * La fiche d'une image : combien de couleurs pour 90 % de la surface, l'écart-type de
 * luminance, la part de quasi-noir, la concentration de teinte. Les pixels dont l'alpha est
 * sous 128 sont ignorés — une tuile de bord ne peint qu'une bande, et mesurer le vide autour
 * ferait mentir tous les nombres.
 */
export function mesurer(img) {
  const n = img.width * img.height;
  const compte = new Map();
  let sommeL = 0, vus = 0;
  for (let k = 0; k < n; k++) {
    const i = k * 4;
    if (img.data[i + 3] < 128) continue;
    const clef = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    compte.set(clef, (compte.get(clef) || 0) + 1);
    sommeL += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    vus++;
  }
  const tri = [...compte.entries()].sort((a, b) => b[1] - a[1]);
  let cumul = 0, utiles = 0;
  for (const [, c] of tri) { cumul += c; utiles++; if (cumul >= vus * 0.9) break; }
  const moyL = vus ? sommeL / vus : 0;
  const teintes = new Float64Array(36);
  let noirs = 0, colores = 0, sommeL2 = 0;
  for (let k = 0; k < n; k++) {
    const i = k * 4;
    if (img.data[i + 3] < 128) continue;
    const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const L = 0.299 * r + 0.587 * g + 0.114 * b;
    sommeL2 += (L - moyL) ** 2;
    if (L < 20) noirs++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 18) continue;
    let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
    h = ((h * 60) + 360) % 360;
    teintes[Math.floor(h / 10)]++; colores++;
  }
  let hDom = 0;
  for (let t = 1; t < 36; t++) if (teintes[t] > teintes[hDom]) hDom = t;
  let concentre = 0;
  for (let d = -2; d <= 2; d++) concentre += teintes[((hDom + d) % 36 + 36) % 36];
  const ecartL = vus ? Math.sqrt(sommeL2 / vus) : 0;
  return {
    couleursTotal: tri.length,
    couleurs90: utiles,
    moyL, ecartL,
    quasiNoir: vus ? (100 * noirs) / vus : 0,
    teinteConcentre: colores ? (100 * concentre) / colores : 0,
    partColoree: vus ? (100 * colores) / vus : 0,
  };
}

/**
 * Le masque de joints (trois niveaux : vide / pierre / joint, lu sur le canal rouge) réduit
 * à `cible` par MAXIMUM de bloc.
 *
 * Itération 3 de E3 : la moyenne de bloc dilue le masque à mort — un joint de 1-3 px dans un
 * bloc de 32 pèse moins de 10 % du bloc, sa moyenne ne dépasse jamais un seuil de « joint
 * dominant » et le dénominateur tombe à 0 (mesuré : 0/0 à 32, 64 et 128 px). PixelOE ne
 * réduit d'ailleurs pas par moyenne non plus. Le MAXIMUM du bloc dit si un joint TOUCHE ce
 * bloc, ce que la moyenne ne peut pas dire.
 */
export function masqueReduit(joints, cible) {
  const W = joints.width, bloc = W / cible;
  const out = new Float32Array(cible * cible);
  for (let y = 0; y < cible; y++) for (let x = 0; x < cible; x++) {
    let m = 0;
    for (let dy = 0; dy < bloc; dy++) for (let dx = 0; dx < bloc; dx++) {
      const i = (((y * bloc + dy) * W) + (x * bloc + dx)) * 4;
      if (joints.data[i] > m) m = joints.data[i];
    }
    out[y * cible + x] = m;
  }
  return out;
}

/**
 * Fidélité des joints : parmi les pixels de joint qui touchent au moins un voisin HORS
 * joint, quelle part reste plus sombre que la moyenne de ces voisins ?
 *
 * Itération 2 de E3 : la première version comparait chaque pixel de joint à TOUS ses
 * voisins. Au milieu d'un joint large, les voisins sont eux-mêmes du joint — donc tout aussi
 * sombres — et le pixel « échouait » sans qu'aucun fondu n'ait eu lieu. Un joint qui fond se
 * voit à sa BORDURE, contre la pierre.
 * Itération 4 : `seuilPierre` valait 100 sur un masque désormais MAXIMUM-poolé, où le niveau
 * « pierre » de base vaut déjà ~127 — presque aucun voisin ne passait le test. Le bon partage
 * est « joint » (≥ seuil) contre « pas joint » (< seuil), même seuil des deux côtés.
 *
 * Le 4-voisinage s'enroule horizontalement (le raccord) et se borne verticalement — un mur
 * n'est pas raccordable verticalement. Pour une matière raccordable dans les deux sens, c'est
 * une mesure prudente : elle ne compte jamais un raccord vertical à tort.
 */
export function fideliteJoints(masque, tuile, cible, seuil = 200, seuilPierre = seuil) {
  const lum = (x, y) => {
    const xm = ((x % cible) + cible) % cible, ym = Math.min(cible - 1, Math.max(0, y));
    const i = ((ym * cible) + xm) * 4;
    return 0.299 * tuile.data[i] + 0.587 * tuile.data[i + 1] + 0.114 * tuile.data[i + 2];
  };
  const mAt = (x, y) => {
    const xm = ((x % cible) + cible) % cible, ym = Math.min(cible - 1, Math.max(0, y));
    return masque[ym * cible + xm];
  };
  let total = 0, survivants = 0;
  for (let y = 0; y < cible; y++) for (let x = 0; x < cible; x++) {
    if (masque[y * cible + x] < seuil) continue;
    const voisinsPierre = [];
    if (mAt(x - 1, y) < seuilPierre) voisinsPierre.push(lum(x - 1, y));
    if (mAt(x + 1, y) < seuilPierre) voisinsPierre.push(lum(x + 1, y));
    if (y > 0 && mAt(x, y - 1) < seuilPierre) voisinsPierre.push(lum(x, y - 1));
    if (y < cible - 1 && mAt(x, y + 1) < seuilPierre) voisinsPierre.push(lum(x, y + 1));
    if (!voisinsPierre.length) continue; // joint intérieur : rien à prouver ici
    total++;
    const c = lum(x, y);
    const moy = voisinsPierre.reduce((a, b) => a + b, 0) / voisinsPierre.length;
    if (c < moy) survivants++;
  }
  return { total, survivants, pct: total ? (100 * survivants) / total : 0 };
}
