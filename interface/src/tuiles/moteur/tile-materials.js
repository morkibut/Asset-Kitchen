// ---------------------------------------------------------------------------
// Matières intégrées — des textures raccordables sans IA ni GPU.
//
// Pourquoi ce module existe. Le moteur sait estamper une texture à travers ses
// masques depuis la tranche T1, mais l'atelier n'avait que deux façons de lui en
// donner une : un fichier importé à la main, ou une génération ComfyUI. Sans
// l'une ni l'autre, un tileset sortait en aplat de deux couleurs — la raison
// numéro un pour laquelle le résultat par défaut n'était pas regardable.
//
// L'invariant d'échantillonnage est respecté par CONSTRUCTION, pas par chance :
// chaque matière est dessinée à exactement la taille de tuile, et tous ses
// motifs se lisent modulo cette taille. Période = taille de tuile, donc deux
// tuiles voisines se raccordent où qu'elles tombent sur la carte. Voir
// « L'invariant de l'estampage » dans public/vendor/tileset-engine.js.
//
// Chaque matière rend DEUX images : la surface et son contour. Ce n'est pas un
// luxe — `materialColor` (moteur) mélange les deux texels au même (lx, ly) selon
// la nuance. Donner une surface texturée et un contour en aplat ferait fondre la
// matière vers une couleur plate dès qu'on approche du bord : les joints de
// pierre disparaîtraient exactement là où l'œil les cherche. Le contour est donc
// la même image, assombrie et refroidie vers la teinte d'ombre de la matière.
//
// Chaque matière est une PALETTE plus un champ qui rend un indice de palette.
// Pas un dégradé continu qu'on quantifierait après coup : à 32 px, c'est le
// nombre de couleurs qui fait qu'une image se lit comme du pixel art plutôt que
// comme une photo réduite.
//
// Aucune dépendance DOM : importable par le navigateur comme par Node, comme
// tile-masks.js et tile-check.js.
// ---------------------------------------------------------------------------

// ===========================================================================
// 1. Le bruit, rebouclé sur la texture
// ===========================================================================

const hash2 = (x, y, seed) => {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (v, n) => ((v % n) + n) % n;

/**
 * Bruit de valeur sur une maille de `cells × cells` REBOUCLÉE : les sommets
 * d'indice `cells` et `0` sont le même sommet, donc la texture se raccorde à
 * elle-même bord à bord. C'est la seule propriété qui compte ici — tout le
 * reste du module en dépend.
 */
function wrapNoise(x, y, size, cells, seed) {
  const fx = (x / size) * cells;
  const fy = (y / size) * cells;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash2(wrap(x0, cells), wrap(y0, cells), seed);
  const b = hash2(wrap(x0 + 1, cells), wrap(y0, cells), seed);
  const c = hash2(wrap(x0, cells), wrap(y0 + 1, cells), seed);
  const d = hash2(wrap(x0 + 1, cells), wrap(y0 + 1, cells), seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Trois octaves du bruit ci-dessus. Les mailles doublent, donc chacune reboucle aussi. */
function wrapFbm(x, y, size, cells, seed, octaves = 3) {
  let value = 0;
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o += 1) {
    value += wrapNoise(x, y, size, cells << o, seed + o * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return value / total;
}

/**
 * Voronoï rebouclé : `cells × cells` points tirés au sort, un par maille, et la
 * recherche du plus proche parcourt les neuf mailles voisines EN INDICES
 * REBOUCLÉS — c'est ce qui fait qu'une dalle coupée par le bord droit continue
 * sur le bord gauche. Rend la distance au plus proche, la distance au second, et
 * l'identité de la maille gagnante (pour donner un ton propre à chaque dalle).
 */
function wrapVoronoi(x, y, size, cells, seed, jitter = 0.85) {
  const fx = (x / size) * cells;
  const fy = (y / size) * cells;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let best = Infinity;
  let second = Infinity;
  let bestId = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      const cx = wrap(ix + ox, cells);
      const cy = wrap(iy + oy, cells);
      const px = ix + ox + 0.5 + (hash2(cx, cy, seed) - 0.5) * jitter;
      const py = iy + oy + 0.5 + (hash2(cx, cy, seed + 7919) - 0.5) * jitter;
      const d = Math.hypot(fx - px, fy - py);
      if (d < best) {
        second = best;
        best = d;
        bestId = cy * cells + cx;
      } else if (d < second) second = d;
    }
  }
  return { distance: best, gap: second - best, id: bestId };
}

/**
 * Le plus grand DIVISEUR de `size` qui n'excède pas `cible`, jamais moins que
 * `mini`.
 *
 * Toute matière à motif régulier — briques, planches, carrelage, rides de sable,
 * ondes d'eau — a une période, et cette période doit diviser la taille de la
 * texture, sans quoi le motif se coupe au bord et la tuile ne se raccorde plus.
 * Écrire `Math.round(size / 5)` semblait innocent : sur une tuile de 32 px ça
 * donne 6, qui ne divise pas 32, et les rides du sable repartaient de travers à
 * chaque tuile. Le défaut était invisible à l'œil — une seule nuance d'écart,
 * noyée dans le grain — et il a fallu le raisonnement, pas la mesure, pour le
 * trouver : un essai statistique de couture ne distingue pas un décalage d'une
 * nuance du contraste normal d'une matière (mesuré sur quarante graines).
 *
 * D'où ce passage obligé : aucune matière ne calcule sa période elle-même. La
 * faute n'est plus à détecter, elle est devenue impossible à écrire.
 */
export function periode(size, cible, mini = 2) {
  let meilleur = mini;
  for (let d = mini; d <= size; d += 1) {
    if (size % d !== 0) continue;
    if (d <= cible || meilleur < mini) meilleur = d;
    if (d > cible) break;
  }
  // Si `size` n'admet aucun diviseur dans la fourchette (une taille première, par
  // exemple), on rend `size` : une période d'une texture entière se raccorde
  // toujours, même si le motif ne se répète pas dans la tuile.
  return size % meilleur === 0 ? meilleur : size;
}

/**
 * Des brins verticaux, enroulés sur la hauteur de la texture. Deux passes : un
 * brin clair et un brin sombre par colonne, chacun présent une fois sur deux.
 *
 * `wrap(y - depart, size)` est tout le secret du raccord : un brin qui sort par
 * le bas rentre par le haut, donc aucune tuile ne coupe un brin en deux sans
 * que la tuile d'à côté le continue. Rend 0 (rien), 1 (clair) ou 2 (sombre).
 */
function brins(x, y, size, longueurMax, densite, seed) {
  for (const [sel, code] of [[0, 1], [9973, 2]]) {
    if (hash2(x, sel, seed) > densite) continue;
    const depart = Math.floor(hash2(x, sel + 1, seed) * size);
    const longueur = 2 + Math.floor(hash2(x, sel + 2, seed) * longueurMax);
    if (wrap(y - depart, size) < longueur) return code;
  }
  return 0;
}

// ===========================================================================
// 2. Les matières
// ===========================================================================
//
// Une matière déclare :
//   nom      — le libellé français de la liste déroulante ;
//   role     — 'sol' (elle peut porter un terrain) ou 'mur' (une face verticale,
//              proposée d'abord pour la face d'un mur) ;
//   dephasable — voir « L'invariant de tolérance de phase » ci-dessous ;
//   palette  — de la plus claire à la plus sombre, dans l'ordre où le champ les
//              adresse ; c'est la limite de couleurs qui fait le pixel art ;
//   ombre    — la teinte vers laquelle le contour refroidit ;
//   champ    — (x, y, c) → indice de palette. `c` porte la taille, la graine et
//              les raccourcis de bruit, pour que chaque matière tienne en
//              quelques lignes lisibles.
//
// Les couleurs sont écrites en hexadécimal : c'est sous cette forme qu'on les
// compare à l'œil dans un éditeur, et la conversion ne coûte rien, une fois.
//
// LA RÈGLE QUI GOUVERNE TOUTES LES MATIÈRES ORGANIQUES : aucun motif plus large
// qu'un tiers de tuile. La période d'une texture vaut la taille de la tuile —
// c'est l'invariant du pipeline, pas un réglage — donc TOUT se répète d'une case
// à l'autre. Ce qui décide si la répétition se VOIT, c'est la taille du plus
// gros motif : une plaque de 16 px sur une tuile de 32 se reconnaît au premier
// coup d'œil et l'œil lit un tampon ; un grain de 4 px se lit comme de la
// matière. Les matières régulières — briques, planches, carrelage — sont
// l'exception assumée : leur motif EST une grille, et une grille qui se répète
// est ce qu'on attend d'elle.
//
// L'INVARIANT DE TOLÉRANCE DE PHASE (`dephasable`, tranche T13). Une variante de
// la tuile pleine ne se distingue vraiment de l'originale que si elle montre un
// AUTRE bout de la matière : décaler la graine de teinte ne suffit pas, parce que
// l'échantillonnage de texture ne lit que (lx, ly) et retombe donc, graine ou pas,
// exactement sur le même motif. Le moteur peut décaler cette lecture d'une phase
// constante — la texture est rebouclée, une variante reste donc raccordable AVEC
// ELLE-MÊME. Ce qu'elle perd, c'est la continuité avec sa VOISINE : au bord entre
// une variante déphasée et une tuile normale, le motif reprend ailleurs.
//
// Sur une matière organique, cette reprise ne se voit pas — un brin d'herbe n'a
// pas de position attendue. Sur une matière à motif régulier — briques, planches,
// carrelage —, elle se voit immédiatement : le rang de briques se décale au milieu
// du mur, la rainure entre deux planches saute. Chaque matière déclare donc si
// elle tolère le déphasage, et c'est exactement la même frontière que l'exception
// du paragraphe précédent : `dephasable: false` pour les trois matières dont le
// motif EST une grille, `true` pour les dix autres.
//
// Une matière importée ou générée par l'IA n'a aucune déclaration : le défaut y
// est donc « ne pas déphaser » (voir `tolerePhase`). C'est le choix sûr, et pas
// par prudence abstraite — le cadrage `motif` de public/tile-ia.js produit
// justement des matières à grille (dallage, appareillage, planches), et une
// couture visiblement cassée est un défaut plus grave qu'une variante qui se
// contente de varier sa teinte.

const rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

export const MATIERES = {
  herbe: {
    nom: 'Herbe',
    role: 'sol',
    dephasable: true,
    palette: ['#a9c178', '#8fae63', '#749450', '#5c7b40', '#486534'],
    ombre: '#2c3f24',
    champ(x, y, c) {
      // Des plaques larges d'abord — c'est elles qui portent la matière — puis
      // quelques brins courts. L'erreur à éviter est l'inverse : un semis de
      // pixels isolés sur toute la surface ne lit pas comme de l'herbe, il lit
      // comme du bruit d'image.
      const plaque = c.fbm(x, y, 8, 11);
      let niveau = plaque < 0.44 ? 3 : plaque < 0.6 ? 2 : 1;
      const brin = c.brin(x, y, 3, 0.4, 31);
      if (brin === 1) niveau = Math.max(0, niveau - 1);
      if (brin === 2) niveau = Math.min(4, niveau + 1);
      return niveau;
    },
  },

  prairie: {
    nom: 'Herbe haute',
    role: 'sol',
    dephasable: true,
    palette: ['#b7cd82', '#93b167', '#75974f', '#57793c', '#3e5a2c'],
    ombre: '#28381d',
    champ(x, y, c) {
      // De l'herbe haute, ce sont des BRINS, longs et serrés, sur un fond qui
      // s'assombrit par plaques. Un voronoï avait d'abord été essayé ici : il
      // donnait un filet d'écailles, pas un pré.
      const fond = c.fbm(x, y, 7, 19);
      let niveau = fond < 0.45 ? 3 : 2;
      const brin = c.brin(x, y, 9, 0.75, 61);
      if (brin === 1) niveau = Math.max(0, niveau - 2);
      if (brin === 2) niveau = Math.min(4, niveau + 1);
      return niveau;
    },
  },

  pierre: {
    nom: 'Dalles de pierre',
    role: 'sol',
    dephasable: true,
    palette: ['#b9b5ac', '#9e9a91', '#847f77', '#6a655e', '#4a4640'],
    ombre: '#2f2d2a',
    champ(x, y, c) {
      // Des dalles irrégulières : le joint est la ligne où les deux plus proches
      // points sont à égalité, et chaque dalle prend un ton propre tiré de son id.
      const v = c.voronoi(x, y, 3, 23, 0.75);
      if (v.gap < 0.13) return 4;
      const ton = Math.floor(hash2(v.id, 5, c.seed + 29) * 3);
      const grain = c.fbm(x, y, 8, 37) > 0.55 ? 0 : 1;
      // Le haut d'une dalle capte la lumière : un liseré clair juste sous le joint.
      const lisere = v.gap < 0.22 && c.fbm(x, y + 2, 3, 23) > c.fbm(x, y, 3, 23);
      return clamp(ton + grain - (lisere ? 1 : 0), 0, 3);
    },
  },

  brique: {
    nom: 'Briques',
    role: 'mur',
    dephasable: false,
    palette: ['#c07a58', '#a96246', '#8d4d38', '#70402f', '#4f2f24'],
    ombre: '#33201a',
    champ(x, y, c) {
      // Appareillage à joints croisés. La hauteur de rangée et la longueur
      // divisent la texture, sinon l'appareil se briserait d'une tuile à l'autre.
      const hauteur = periode(c.size, c.size / 8, 4);
      const longueur = periode(c.size, c.size / 4, 8);
      const rang = Math.floor(y / hauteur);
      const decalage = (rang % 2) * (longueur / 2);
      // La colonne décalée se lit MODULO LA TEXTURE avant d'être divisée par la
      // longueur d'une brique. Sans ce `wrap`, une rangée décalée donnait à la
      // dernière colonne et à la première deux numéros de brique différents, donc
      // deux tons différents : une marche de teinte pile sur la couture, là où le
      // joint ne vient même pas la masquer. Trouvé par l'essai de raccord de
      // tests/tile-materials.test.mjs, pas à l'œil — à 32 px, on ne la voyait pas.
      const colonne = wrap(x + decalage, c.size);
      const jx = wrap(colonne, longueur);
      const jy = wrap(y, hauteur);
      if (jx < 1 || jy < 1) return 4; // le joint
      if (jy < 2) return 0; // la lumière sur l'arête haute de la brique
      const ton = Math.floor(hash2(rang, Math.floor(colonne / longueur), c.seed + 41) * 3);
      const grain = c.h(x, y, 43) > 0.8 ? 1 : 0;
      return clamp(1 + ton + grain - 1, 0, 3);
    },
  },

  roche: {
    nom: 'Roche brute',
    role: 'mur',
    dephasable: true,
    palette: ['#8e8c88', '#767470', '#5e5c59', '#484644', '#323130'],
    ombre: '#1f1e1e',
    champ(x, y, c) {
      // Une roche, c'est un relief bosselé plus quelques fissures — pas une
      // mosaïque. Des facettes de voronoï avaient été essayées ici et rendaient
      // une peau de reptile : le ton par facette se lit comme un motif, jamais
      // comme de la pierre. Le relief vient donc du bruit, et l'éclairage de sa
      // PENTE — la différence entre deux échantillons décalés en diagonale,
      // c'est-à-dire une dérivée, ce qui fait saillir les bosses.
      const relief = c.fbm(x, y, 5, 71);
      const pente = c.fbm(x - 1.5, y - 1.5, 5, 71) - c.fbm(x + 1.5, y + 1.5, 5, 71);
      let niveau = relief < 0.42 ? 2 : relief < 0.58 ? 1 : 0;
      niveau += pente > 0.05 ? -1 : pente < -0.05 ? 2 : 1;
      // Les fissures : la ligne de niveau d'un second bruit, donc des courbes
      // continues et non des traits isolés.
      if (Math.abs(c.fbm(x, y, 3, 73) - 0.5) < 0.022) niveau = 4;
      if (c.h(x, y, 79) > 0.97) niveau = clamp(niveau - 1, 0, 4);
      return clamp(niveau, 0, 4);
    },
  },

  terre: {
    nom: 'Terre battue',
    role: 'sol',
    dephasable: true,
    palette: ['#a98761', '#96744f', '#7f6142', '#664c34', '#4c3826'],
    ombre: '#2e2117',
    champ(x, y, c) {
      // De larges plaques de terre tassée, et de rares cailloux. Le piège est le
      // semis serré : un caillou tous les trois pixels ne fait pas un sol, il
      // fait de la neige d'antenne.
      const fond = c.fbm(x, y, 5, 83);
      let niveau = fond < 0.4 ? 3 : fond < 0.58 ? 2 : 1;
      if (c.fbm(x, y, 9, 87) > 0.62) niveau = clamp(niveau - 1, 0, 4);
      // Un caillou : deux pixels clairs posés sur un pixel sombre, la plus
      // petite forme qui se lise comme un volume à cette taille.
      const caillou = c.h(Math.floor(x / 2), Math.floor(y / 2), 89);
      if (caillou > 0.985) niveau = 0;
      else if (caillou > 0.975) niveau = 4;
      return niveau;
    },
  },

  sable: {
    nom: 'Sable',
    role: 'sol',
    dephasable: true,
    palette: ['#eadaa8', '#dcc78e', '#c9b177', '#b39a63', '#96804f'],
    ombre: '#5f5133',
    champ(x, y, c) {
      // Des rides : une sinusoïde dont la période divise la texture, tordue par
      // un bruit doux pour qu'elles n'aient pas l'air imprimées.
      const pas = periode(c.size, c.size / 5, 4);
      const onde = Math.sin(((y + c.fbm(x, y, 4, 97) * 6) / pas) * Math.PI * 2);
      let niveau = onde > 0.45 ? 1 : onde < -0.45 ? 3 : 2;
      if (c.h(x, y, 101) > 0.97) niveau = 0;
      return niveau;
    },
  },

  eau: {
    nom: 'Eau',
    role: 'sol',
    dephasable: true,
    palette: ['#8fd2e2', '#5fb4cf', '#3a8fb8', '#2b6f9a', '#1f5279'],
    ombre: '#133a5c',
    champ(x, y, c) {
      // De l'eau vue de dessus, ce sont des ondes HORIZONTALES et des éclats
      // horizontaux. Un bruit comprimé verticalement avait été essayé : il
      // rendait des pointes de flèches répétées, parce qu'un bruit étiré garde
      // ses lobes et qu'on les reconnaît d'une tuile à l'autre.
      const pas = periode(c.size, c.size / 4, 4);
      const onde = Math.sin(((y + c.fbm(x, y, 4, 103) * 7) / pas) * Math.PI * 2);
      let niveau = onde > 0.5 ? 2 : onde < -0.4 ? 4 : 3;
      // Les éclats de lumière : de courts tirets horizontaux sur la crête, un
      // pixel de haut, deux à quatre de long.
      const tiret = c.h(Math.floor(x / 3), y, 107);
      if (onde > 0.72 && tiret > 0.62) niveau = 1;
      if (onde > 0.9 && tiret > 0.82) niveau = 0;
      return niveau;
    },
  },

  bois: {
    nom: 'Planches',
    role: 'mur',
    dephasable: false,
    palette: ['#c49a63', '#a87f4f', '#8c6740', '#6f5132', '#4c3722'],
    ombre: '#2f2216',
    champ(x, y, c) {
      const largeur = periode(c.size, c.size / 4, 4);
      const planche = Math.floor(y / largeur);
      const jy = wrap(y, largeur);
      if (jy < 1) return 4; // la rainure entre deux planches
      if (jy < 2) return 0; // l'arête éclairée sous la rainure
      const ton = Math.floor(hash2(planche, 0, c.seed + 113) * 2);
      // Le fil du bois : un bruit très allongé dans le sens de la planche.
      const fil = c.fbm(x, y * 6, 2, 127 + planche);
      let niveau = 1 + ton + (fil < 0.38 ? 1 : 0);
      // Un nœud de loin en loin.
      const n = c.voronoi(x, y, 3, 131, 0.9);
      if (n.distance < 0.16 && hash2(n.id, 1, c.seed + 137) > 0.72) niveau = n.distance < 0.09 ? 4 : 3;
      return clamp(niveau, 0, 4);
    },
  },

  neige: {
    nom: 'Neige',
    role: 'sol',
    dephasable: true,
    palette: ['#ffffff', '#eef3f8', '#d8e2ee', '#bccbdd', '#9fb0c6'],
    ombre: '#6d7f99',
    champ(x, y, c) {
      const relief = c.fbm(x, y, 7, 139);
      let niveau = relief < 0.42 ? 3 : relief < 0.58 ? 2 : 1;
      if (c.h(x, y, 149) > 0.985) niveau = 0; // un éclat de givre
      if (relief < 0.3) niveau = 4;
      return niveau;
    },
  },

  feuillage: {
    nom: 'Feuillage',
    role: 'sol',
    dephasable: true,
    palette: ['#7fae55', '#66913f', '#4f752f', '#3b5a24', '#2a411a'],
    ombre: '#182a10',
    champ(x, y, c) {
      // Des touffes rondes, éclairées en haut à gauche : c'est le dégradé par
      // touffe, et non la couleur moyenne, qui fait lire une canopée.
      const v = c.voronoi(x, y, 4, 151, 0.95);
      const lumiere = c.fbm(x - 2, y - 2, 4, 151) - c.fbm(x + 2, y + 2, 4, 151);
      let niveau = v.distance < 0.3 ? 1 : v.distance < 0.55 ? 2 : 3;
      niveau += lumiere > 0.06 ? -1 : lumiere < -0.06 ? 1 : 0;
      if (v.gap < 0.08) niveau = 4; // l'ombre entre deux touffes
      return clamp(niveau, 0, 4);
    },
  },

  lave: {
    nom: 'Lave',
    role: 'sol',
    dephasable: true,
    palette: ['#ffe9a3', '#ff9d3c', '#e2521c', '#7a2d16', '#2e1a13'],
    ombre: '#150b08',
    champ(x, y, c) {
      // L'inverse de la pierre : ici c'est le JOINT qui brille, et les dalles
      // qui sont sombres. Les mêmes deux lignes de voronoï, lues à l'envers.
      const v = c.voronoi(x, y, 3, 157, 0.8);
      if (v.gap < 0.06) return 0;
      if (v.gap < 0.12) return 1;
      if (v.gap < 0.18) return 2;
      const croute = c.fbm(x, y, 8, 163) > 0.55 ? 3 : 4;
      return croute;
    },
  },

  carrelage: {
    nom: 'Carrelage de donjon',
    role: 'sol',
    dephasable: false,
    palette: ['#9a9aa4', '#84848e', '#6d6d77', '#565660', '#3c3c45'],
    ombre: '#26262c',
    champ(x, y, c) {
      const pas = periode(c.size, c.size / 2, 8);
      const jx = wrap(x, pas);
      const jy = wrap(y, pas);
      if (jx < 1 || jy < 1) return 4;
      if (jx < 2 || jy < 2) return 0;
      const ton = Math.floor(hash2(Math.floor(x / pas), Math.floor(y / pas), c.seed + 167) * 2);
      // Les éclats : un coin usé de loin en loin, sans quoi un carrelage régulier
      // se lit comme une grille et non comme un sol.
      const eclat = c.fbm(x, y, 10, 173);
      return clamp(1 + ton + (eclat > 0.7 ? 1 : 0), 0, 3);
    },
  },
};

/** Les matières, dans l'ordre d'affichage : les sols d'abord, les faces ensuite. */
export const LISTE_MATIERES = Object.entries(MATIERES).map(([id, m]) => ({ id, nom: m.nom, role: m.role, dephasable: m.dephasable }));

/**
 * Cette matière tolère-t-elle le déphasage de texture d'une variante ? Voir
 * « L'INVARIANT DE TOLÉRANCE DE PHASE » en tête de la section 2.
 *
 * Tout ce qui n'est pas une matière intégrée déclarée — un identifiant vide, une
 * texture importée, une texture générée par l'IA — rend `false` : sans déclaration,
 * on ne déphase pas. C'est le seul défaut sûr, et il est volontairement silencieux
 * côté moteur (la variante existe quand même, elle ne varie que par sa teinte).
 */
export function tolerePhase(id) {
  const matiere = MATIERES[id];
  return matiere ? matiere.dephasable === true : false;
}

// ===========================================================================
// 3. Rendu
// ===========================================================================

/**
 * Le contour d'une matière : la même image, assombrie et tirée vers sa teinte
 * d'ombre. Pas une couleur plate — voir l'en-tête du module : c'est ce qui garde
 * les joints lisibles jusque sur le bord de la silhouette.
 */
function couleurContour(couleur, ombre) {
  return {
    r: Math.round(couleur.r * 0.52 + ombre.r * 0.44),
    g: Math.round(couleur.g * 0.52 + ombre.g * 0.44),
    b: Math.round(couleur.b * 0.52 + ombre.b * 0.44),
  };
}

/**
 * Rend une matière à `size × size` — la taille de tuile, toujours, pour que le
 * rééchantillonnage du moteur soit l'identité et que l'invariant tienne sans
 * qu'on ait à y penser.
 *
 * Rend `{ surface, contour }`, chacun au format que le moteur attend d'une
 * texture importée : `{ data: Uint8ClampedArray RGBA, width, height }`. Les deux
 * se branchent donc exactement où un fichier importé se branchait.
 */
export function rendreMatiere(id, size, seed = 1) {
  const matiere = MATIERES[id];
  if (!matiere) throw new Error(`Matière inconnue : ${id}`);
  const palette = matiere.palette.map(rgb);
  const ombre = rgb(matiere.ombre);
  const contourPalette = palette.map((c) => couleurContour(c, ombre));
  const surface = new Uint8ClampedArray(size * size * 4);
  const contour = new Uint8ClampedArray(size * size * 4);
  const c = {
    size,
    seed,
    h: (x, y, sel) => hash2(x, y, seed + sel),
    fbm: (x, y, cells, sel) => wrapFbm(x, y, size, cells, seed + sel),
    voronoi: (x, y, cells, sel, jitter) => wrapVoronoi(x, y, size, cells, seed + sel, jitter),
    brin: (x, y, longueurMax, densite, sel) => brins(x, y, size, longueurMax, densite, seed + sel),
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = clamp(Math.round(matiere.champ(x, y, c)), 0, palette.length - 1);
      const i = (y * size + x) * 4;
      const s = palette[index];
      const o = contourPalette[index];
      surface[i] = s.r; surface[i + 1] = s.g; surface[i + 2] = s.b; surface[i + 3] = 255;
      contour[i] = o.r; contour[i + 1] = o.g; contour[i + 2] = o.b; contour[i + 3] = 255;
    }
  }
  return {
    surface: { data: surface, width: size, height: size },
    contour: { data: contour, width: size, height: size },
  };
}

/**
 * La couleur moyenne de la surface d'une matière — ce qu'on met dans le
 * sélecteur de couleur pour que l'interface reste cohérente, et ce que
 * l'aperçu de jeu peint sous la carte. Calculée sur la palette, pas sur les
 * pixels : c'est la même intention et ça ne coûte rien.
 */
export function couleurMoyenne(id) {
  const palette = MATIERES[id].palette.map(rgb);
  const somme = palette.reduce((a, c) => ({ r: a.r + c.r, g: a.g + c.g, b: a.b + c.b }), { r: 0, g: 0, b: 0 });
  return { r: Math.round(somme.r / palette.length), g: Math.round(somme.g / palette.length), b: Math.round(somme.b / palette.length) };
}
