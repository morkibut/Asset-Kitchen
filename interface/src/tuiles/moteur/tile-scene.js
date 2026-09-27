// ---------------------------------------------------------------------------
// L'aperçu de jeu — assembler le tileset comme un moteur le ferait.
//
// Pourquoi ce module existe. L'atelier ne montrait que deux choses : l'ATLAS,
// c'est-à-dire la planche de pièces découpées, qui n'est pas faite pour être
// regardée ; et une petite carte de raccord, muette sur tout ce qui n'est pas un
// terrain plat. Le mode « Mur » n'avait aucun aperçu du tout — on exportait un
// mur sans l'avoir jamais vu debout. C'est le premier reproche à corriger : un
// tileset se juge assemblé, jamais en planche.
//
// Ce que ce module sait poser, et que l'atlas seul ne dit pas :
//
//  * l'EMPILEMENT d'un mur — dessus, faces répétées, base, ombre portée — et
//    donc la convention de placement, qui jusqu'ici n'existait nulle part dans
//    le dépôt ; voir `placerMur` ;
//  * le TRI EN PROFONDEUR (Y-sort) : un mur de la rangée du dessous recouvre
//    celui de la rangée du dessus, et le personnage passe devant ou derrière
//    selon sa ligne de pieds ;
//  * l'ANIMATION : les images d'une tuile animée, jouées en boucle — l'atelier
//    les exportait sans jamais les montrer bouger ;
//  * un PERSONNAGE, pour l'échelle. Une tuile de 32 px ne veut rien dire tant
//    qu'on n'a pas vu ce qui marche dessus.
//
// Le rendu passe par un « peintre » et non directement par un contexte canvas :
// l'atelier peint dans le navigateur, `scripts/apercu-tileset.mjs` peint dans un
// tableau de pixels, et la logique de scène — l'empilement, le tri, les états de
// bande — doit être la MÊME des deux côtés, sinon la preuve visuelle du dépôt ne
// prouve plus ce que l'atelier montre. Toutes les coordonnées passées au peintre
// sont en pixels du monde ; c'est lui qui connaît le grossissement.
//
// Aucune dépendance DOM en dehors de `peintreCanvas`, fourni en fin de fichier.
// ---------------------------------------------------------------------------
import { atlasPosition, B47, NEIGHBOUR_BITS } from './tile-masks.js';
import { cellMaskAt } from './tile-check.js';

// ===========================================================================
// 1. Le personnage — juste assez pour donner l'échelle
// ===========================================================================
//
// Huit pixels de large sur treize de haut : la taille d'un héros de jeu vu de
// dessus sur des tuiles de 16, donc un demi-corps sur des tuiles de 32. Deux
// images de marche, qui se distinguent par les jambes et par un pixel de
// balancement — c'est tout ce qu'il faut pour que l'œil lise un déplacement.
const PALETTE_HEROS = ['', '#f0c090', '#4a3527', '#3d6ea8', '#2b4d78', '#5a3a22', '#e8e8e8'];
const HEROS = [
  [
    '..2222..',
    '.222222.',
    '.211112.',
    '.216612.',
    '.211112.',
    '..1111..',
    '.344443.',
    '3444443.',
    '.344443.',
    '..4444..',
    '..5..5..',
    '..5..5..',
    '.55..55.',
  ],
  [
    '..2222..',
    '.222222.',
    '.211112.',
    '.216612.',
    '.211112.',
    '..1111..',
    '.344443.',
    '.3444443',
    '.344443.',
    '..4444..',
    '...55...',
    '..5..5..',
    '.55...5.',
  ],
];

/** Dessine le héros, pieds en (px, py) — la ligne de pieds EST le point de tri. */
function dessinerHeros(peintre, px, py, image, echelleSprite) {
  const motif = HEROS[image % HEROS.length];
  const largeur = motif[0].length * echelleSprite;
  const hauteur = motif.length * echelleSprite;
  const x0 = Math.round(px - largeur / 2);
  const y0 = Math.round(py - hauteur);
  // Une ombre sous les pieds : sans elle, un sprite posé sur un sol texturé a
  // l'air découpé et collé, exactement le défaut que le relief corrige sur les
  // tuiles.
  peintre.ellipse(px, py - echelleSprite * 0.5, largeur * 0.42, echelleSprite * 1.3, '#000000', 0.32);
  for (let y = 0; y < motif.length; y += 1) {
    for (let x = 0; x < motif[y].length; x += 1) {
      const index = motif[y][x];
      if (index === '.') continue;
      peintre.rect(x0 + x * echelleSprite, y0 + y * echelleSprite, echelleSprite, echelleSprite, PALETTE_HEROS[Number(index)], 1);
    }
  }
}

// ===========================================================================
// 2. L'empilement d'un mur
// ===========================================================================
//
// La convention de placement, décidée ici parce qu'elle n'existait nulle part
// ailleurs — l'atlas mur était rendu et exporté depuis la tranche T3 sans que
// personne ait jamais eu à dire où va chaque bande. Pour une case d'emprise
// (x, y), c'est-à-dire la case que le joueur ne peut pas traverser :
//
//     y − h      le DESSUS (blob 47, autotilé sur l'emprise)
//     y − h + 1  ┐
//     …          │ la FACE, répétée
//     y − 1      ┘
//     y          la BASE — collision et tri en profondeur
//     y + 1      l'OMBRE PORTÉE, sur le sol devant le pied
//
// `h` est « Hauteur du mur, en tuiles » : le nombre de cases occupées AU-DESSUS
// de la base. À h = 1 il n'y a pas de face du tout, le dessus se pose directement sur la
// base ; c'est le mur le plus bas qui ait un sens, et c'est aussi le cas limite
// qui vérifie que la boucle de faces peut être vide.
//
// La règle qui fait le plus de différence à l'œil est la dernière : l'ombre va
// sur la case DEVANT le pied, pas sur la case du pied. C'est elle qui impose que
// la pièce d'ombre colle au haut de sa case — voir `shadowSdf` dans le moteur,
// corrigé en même temps que ce fichier a été écrit.

/**
 * Les courses horizontales maximales d'une grille de booléens : les segments de
 * cases pleines qui se touchent dans une même rangée, `{ y, x0, x1 }`, bornes
 * comprises. C'est l'unité sur laquelle raisonne `etatsDeBande` — voir pourquoi
 * juste en dessous.
 */
export function coursesHorizontales(grille) {
  const courses = [];
  for (let y = 0; y < grille.length; y += 1) {
    const ligne = grille[y] || [];
    let x0 = null;
    for (let x = 0; x <= ligne.length; x += 1) {
      const plein = x < ligne.length && !!ligne[x];
      if (plein && x0 === null) x0 = x;
      if (!plein && x0 !== null) { courses.push({ y, x0, x1: x - 1 }); x0 = null; }
    }
  }
  return courses;
}

/**
 * Les états de bande de TOUTE la carte, en une passe — ce que la face, la base
 * et l'ombre doivent utiliser à chaque colonne. Rend un lecteur `(x, y) => id`.
 *
 * Pourquoi une passe sur la carte et non une lecture case par case (tranche T24).
 * L'ancienne version lisait les deux voisins est et ouest de la case, et rien
 * d'autre. Elle rendait donc un mur de course décalée d'une rangée — un escalier —
 * comme une suite de blocs séparés : chaque case y est « isolée », donc refermée
 * des deux côtés par la rentrée de bord, et il reste une fente de fond entre deux
 * marches qui se touchent pourtant en diagonale. Mesuré sur un escalier de cinq
 * marches, mur de trois tuiles de haut, tuile de 32 px : 1 645 pixels de fond dans
 * la bande des marches contre 0 une fois la jonction posée.
 *
 * La règle, et son invariant. Une jonction en diagonale, c'est DEUX courses de
 * rangées voisines dont l'une commence exactement une colonne après la fin de
 * l'autre. Les deux bouts qui se font face sont alors les deux MOITIÉS d'une même
 * jonction : on les raccorde ensemble, ou aucun des deux. Rien ici ne regarde une
 * case et ses huit voisines — c'est ce qui rend structurellement impossible le
 * défaut de la première règle réfutée en tranche 12 (« la case en diagonale porte
 * un mur »), qui raccordait au milieu d'un mur vertical : deux courses d'une seule
 * case empilées dans la MÊME colonne ne remplissent jamais `x0 === x1 + 1`.
 *
 * Le SEUL voisin neuf de T37, et pourquoi T41 l'a déplacé. T37 regardait `(x, y − 1)` — le
 * NORD — pour reconnaître un coin. Diagnostic vérifié dans `rectPieceSdf` (moteur,
 * `tileset-engine.js:908`) : un côté à `false` place le bord à l'INSET, et les coins
 * arrondis de la boîte sont hors de la tuile puisque nord et sud débordent toujours — donc
 * dans la tuile ce bord est une droite RENTRÉE, exactement celle du dessus qui la surmonte.
 * `left-end`/`right-end` avaient donc déjà le bon bord ; les « 828 px de fond dans l'angle »
 * que T37 mesurait étaient la bande de rentrée elle-même (4 px × 32 × 3 tuiles × 2 côtés),
 * pas un trou. Et T37 les a « supprimés » en faisant DÉBORDER la face (`west/east: true`)
 * au-delà d'un dessus qui, lui, restait rentré : sur la matière du jeu, la face dépasse le
 * dessus de 4 px à chaque coin où le mur part au nord — un défaut que rien ne détectait,
 * puisque la mesure de T37 ne comptait que le fond DANS l'angle, jamais la bande HORS de la
 * silhouette du dessus. Leçon : une mesure de raccord compte ce qui manque ET ce qui dépasse.
 * Un mur qui tourne au nord fait, pour une face qui regarde le sud, un coin EXTÉRIEUR — rien
 * à ombrer — donc `(x, y − 1)` ne déclenche plus rien ici ; un bout dont le mur part au nord
 * redevient simplement `left-end`/`right-end`.
 *
 * Le voisin qui compte, en T41 : `(x ∓ 1, y + 1)`, le SUD en diagonale. La coupure nette que
 * l'utilisateur avait signalée — le dessus rose contre la face verte, sur les captures de la
 * scène réelle du jeu — est un mur qui part au SUD : son dessus passe DEVANT la face de la
 * course du dessus et la coupe. Le montant qui descend n'a lui-même aucune bande visible
 * (il est intégralement recouvert par les pièces des rangées suivantes, voir `placerMur` et
 * l'ordre de peinture de `dessinerScene`), mais son DESSUS recouvre la face de la course
 * horizontale à la verticale exacte de ses côtés. La case de bande dont le voisin sud-ouest
 * `(x − 1, y + 1)` porte un mur reçoit `corner-left` : la matière continue sous le bord
 * rentré du dessus qui passe devant, et la pénombre OUEST dit l'ombre de ce dessus.
 * Symétrique à l'est : `(x + 1, y + 1)` → `corner-right`. La règle s'applique à N'IMPORTE
 * QUEL état de bande déjà calculé — `isolated`, un bout, ou `middle` — et c'est même le cas
 * courant : la première case visible de la face d'une pièce fermée, juste à côté du montant
 * qui descend, part de `middle` (voisins est ET ouest déjà posés par la course) et devient
 * `corner-left` ou `corner-right`. Une jonction en diagonale (T24) garde sa forme `middle`
 * quand aucun montant sud ne la touche, et gagne la pénombre du bon côté sinon — la
 * silhouette raccordée par T24 ne bouge pas, seule la couleur s'y ajoute.
 *
 * LIMITE ASSUMÉE, reprise de T37 mais sur le nouveau voisin : quand les DEUX diagonales sud
 * portent un mur — un montant de chaque côté, colonne isolée entre les deux — on retombe sur
 * `middle`. La matière traverse la case de bord à bord, sans aucune pénombre : deux joues
 * opposées sur une case de 32 px se liraient comme un pilier, pas comme un virage.
 *
 * Ce qui redevient vrai, comme avant T37 : une course d'une seule case surmontée d'un mur au
 * nord (aucun montant en diagonale sud) reste `isolated` — le nord ne compte plus pour rien.
 *
 * Et les deux flancs à 45° ? Ils ne sont toujours pas posés automatiquement, mais
 * pour une raison mesurée en T24 et non plus supposée : `flankSdf` rend un
 * CHEVRON symétrique — même rentrée en haut et en bas, creux maximal à mi-hauteur
 * (14 px de creux sur une tuile de 32) — et non une rampe à 45°. Deux chevrons
 * côte à côte ne forment donc jamais le « losange plein » que le plan leur prêtait :
 * empilés sur la hauteur du mur ils donnent une chaîne de pincements, c'est-à-dire
 * exactement le sablier. Les 36 affectations possibles des deux cases d'une
 * jonction ont été rendues et comptées : aucune paire de flancs ne referme la
 * fente, toutes en ouvrent davantage. Les deux pièces restent dans l'atlas,
 * exportées et posables à la main.
 */
export function etatsDeBande(grille) {
  const courses = coursesHorizontales(grille);
  const cle = (x, y) => `${x},${y}`;
  const ouest = new Set();
  const est = new Set();
  // Le raccord ordinaire : à l'intérieur d'une course, chaque case touche ses voisines.
  for (const c of courses) {
    for (let x = c.x0; x <= c.x1; x += 1) {
      if (x > c.x0) ouest.add(cle(x, c.y));
      if (x < c.x1) est.add(cle(x, c.y));
    }
  }
  // Les jonctions en diagonale : deux courses de rangées voisines qui se relaient
  // d'une colonne. Les deux moitiés sont ajoutées dans la même instruction — il n'y
  // a aucun chemin qui en pose une sans l'autre.
  const parRangee = new Map();
  for (const c of courses) {
    const liste = parRangee.get(c.y) || [];
    liste.push(c);
    parRangee.set(c.y, liste);
  }
  for (const [y, hautes] of parRangee) {
    for (const haut of hautes) {
      for (const bas of parRangee.get(y + 1) || []) {
        if (bas.x0 === haut.x1 + 1) { est.add(cle(haut.x1, y)); ouest.add(cle(bas.x0, y + 1)); }
        if (haut.x0 === bas.x1 + 1) { ouest.add(cle(haut.x0, y)); est.add(cle(bas.x1, y + 1)); }
      }
    }
  }
  // Le voisin qui compte en T41 — voir le commentaire d'en-tête. Lu sur la grille
  // d'occupation déjà construite, jamais sur les courses : ce qu'on demande n'est pas
  // « à quelle course appartient la case du dessus » mais « un montant descend-il ici,
  // en diagonale sud ». `(x, y − 1)` (T37) n'est plus consulté du tout : un bout qui
  // tourne au nord est un coin EXTÉRIEUR pour une face, rien à y ombrer.
  const rempli = remplisseur(grille);
  return (x, y) => {
    const k = cle(x, y);
    const w = ouest.has(k);
    const e = est.has(k);
    const montantSudOuest = rempli(x - 1, y + 1);
    const montantSudEst = rempli(x + 1, y + 1);
    // Les deux diagonales à la fois : la limite assumée, reprise de T37 sur le nouveau
    // voisin — deux joues opposées se liraient comme un pilier, pas comme un virage.
    if (montantSudOuest && montantSudEst) return 'middle';
    if (montantSudOuest) return 'corner-left';
    if (montantSudEst) return 'corner-right';
    if (w && e) return 'middle';
    if (w) return 'right-end';
    if (e) return 'left-end';
    return 'isolated';
  };
}

/**
 * Les jonctions en diagonale de la carte : `[{ xHaut, yHaut, xBas, yBas, sens }]`, une
 * par couple de courses qui se relaient d'une colonne d'une rangée à l'autre.
 *
 * C'est la fonction sœur d'`etatsDeBande` (T43) : cette dernière calcule EXACTEMENT la
 * même chose depuis T24 — `bas.x0 === haut.x1 + 1` descend à droite, `haut.x0 ===
 * bas.x1 + 1` descend à gauche — puis la jette dans deux `Set` d'où plus rien ne peut la
 * relire. Elle est reprise ici mot pour mot, sans toucher à `etatsDeBande` : la règle a
 * été mesurée en T24 (1 645 px de fond entre deux marches sans elle, 0 avec), et deux
 * copies d'une règle éprouvée valent mieux qu'une réécriture des deux.
 *
 * `sens` nomme la direction dans laquelle le mur DESCEND : « droite » quand la course du
 * bas commence juste après la fin de celle du haut, « gauche » dans l'autre cas.
 * `(xHaut, yHaut)` est la case de la course du HAUT qui touche la jonction — c'est elle,
 * et elle seule, qui prend la bande en biais ; une course de plusieurs cases garde toutes
 * ses autres faces droites.
 */
export function jonctionsDiagonales(grille) {
  const courses = coursesHorizontales(grille);
  const parRangee = new Map();
  for (const c of courses) {
    const liste = parRangee.get(c.y) || [];
    liste.push(c);
    parRangee.set(c.y, liste);
  }
  const jonctions = [];
  // Le bout d'un mur VERTICAL n'est pas une marche d'escalier : une case haute dont la
  // voisine du nord est pleine descend d'une colonne, elle ne continue pas une diagonale.
  // Sans ce filtre, une colonne qui touchait en diagonale la dernière marche d'un
  // escalier en fabriquait un second en sens inverse, et les deux se disputaient la même
  // case basse : encoche en V dans le dessus, fente, triangle de brique — vu par Damien.
  const rempli = remplisseur(grille);
  for (const [y, hautes] of parRangee) {
    for (const haut of hautes) {
      for (const bas of parRangee.get(y + 1) || []) {
        if (bas.x0 === haut.x1 + 1 && !rempli(haut.x1, y - 1)) jonctions.push({ xHaut: haut.x1, yHaut: y, xBas: bas.x0, yBas: y + 1, sens: 'droite' });
        if (haut.x0 === bas.x1 + 1 && !rempli(haut.x0, y - 1)) jonctions.push({ xHaut: haut.x0, yHaut: y, xBas: bas.x1, yBas: y + 1, sens: 'gauche' });
      }
    }
  }
  return jonctions;
}

/**
 * Les cellules dont le dessus reçoit un bit forcé pour une pente voisine (T44) —
 * `{ nord: Set<'x,y'>, lateral: Map<'x,y', 'E'|'W'> }`, en coordonnées d'EMPRISE
 * (celles que `masqueDessusMur` reçoit, pas la rangée du dessus).
 *
 * Le point dur, mesuré : sans le bit NE (ou NW), `blobSdf` creuse une encoche de
 * coin rentrant exactement au point où deux diagonales consécutives se rejoignent —
 * 20 + 16 px de désaccord de couture sans lui contre 5 + 4 avec, tuile 32 ; 32 + 36
 * contre 8 + 9, tuile 64. D'où trois bits, jamais un seul :
 *
 *  * la case BASSE d'une jonction (`xBas, yBas` — celle que `jonctionsDiagonales`
 *    rend pour la course du bas) a la pente à son NORD : bit N forcé ;
 *  * la case HAUTE (`xHaut, yHaut`) a la pente à son côté — EST pour une pente qui
 *    descend à droite, OUEST en miroir ;
 *  * une case qui reçoit les DEUX à la fois (une marche intermédiaire d'un escalier
 *    de plusieurs jonctions consécutives, à la fois case basse d'une jonction et
 *    case haute de la suivante) reçoit en plus NE (ou NW) — c'est lui qui referme
 *    l'encoche, `masqueDessusMur` ne le déduit jamais tout seul du couple N + E/W ;
 *  * la case BASSE a aussi, du côté de la case haute, le dessus du RACCORD de celle-ci
 *    (`arriere`) : bit W forcé pour une pente qui descend à droite, E en miroir, et NW
 *    (NE) avec le nord. Sans lui, le bord rentré de ce côté laissait une fente de sol
 *    verticale sur toute la case, à chaque marche — vue par Damien sur capture.
 */
export function penteVoisinsDessus(grille) {
  const nord = new Set();
  const lateral = new Map();
  const arriere = new Map();
  for (const j of jonctionsDiagonales(grille)) {
    nord.add(`${j.xBas},${j.yBas}`);
    lateral.set(`${j.xHaut},${j.yHaut}`, j.sens === 'droite' ? 'E' : 'W');
    const cleBas = `${j.xBas},${j.yBas}`;
    // Une case basse peut recevoir deux jonctions (un V) : on garde les deux côtés.
    arriere.set(cleBas, (arriere.get(cleBas) || '') + (j.sens === 'droite' ? 'W' : 'E'));
  }
  return { nord, lateral, arriere };
}

/**
 * Le masque du dessus d'un mur à l'emprise (x, y) — celui de `cellMaskAt`, avec le bit
 * sud (et les diagonales qu'il rend valides) forcé à posé.
 *
 * T22, mesuré : le masque brut laisse le bord sud du dessus transparent sur une course
 * horizontale (bits E|W, cas (7, 1) de l'atlas B47) — c'est la rentrée `blobInset` du
 * moteur, correcte pour un terrain vu de dessus (on voit le sol au-delà du bord) mais
 * fausse pour un mur : sous le dessus il y a toujours la face, jamais du vide. D'où une
 * bande de sol transparente, pleine largeur, entre le dessus et la face — le trou qui
 * laisse voir à travers le mur. Le dessus d'un mur ne peut jamais avoir l'air ouvert au
 * sud, puisqu'il ne l'est jamais en pratique.
 *
 * T44 : le même raisonnement pour le bord ARRIÈRE, aux deux cases que touche une pente
 * de bord arrière — voir `penteVoisinsDessus`. `penteInfo`, omis, est recalculé (même
 * convention que l'`etat` de `placerMur` : pratique à l'appel isolé, coûteux en boucle,
 * donc l'appelant qui boucle le passe déjà calculé une fois — voir `dessinerScene`).
 */
export function masqueDessusMur(grille, x, y, penteInfo) {
  let masque = cellMaskAt('B47', grille, x, y);
  masque |= NEIGHBOUR_BITS.S;
  const info = penteInfo || penteVoisinsDessus(grille);
  const cle = `${x},${y}`;
  const forceNord = info.nord.has(cle);
  const forceLateral = info.lateral.get(cle);
  const arriereCotes = (info.arriere && info.arriere.get(cle)) || '';
  if (forceNord) masque |= NEIGHBOUR_BITS.N;
  if (forceLateral === 'E' || arriereCotes.includes('E')) masque |= NEIGHBOUR_BITS.E;
  if (forceLateral === 'W' || arriereCotes.includes('W')) masque |= NEIGHBOUR_BITS.W;
  if (masque & NEIGHBOUR_BITS.E) masque |= NEIGHBOUR_BITS.SE;
  if (masque & NEIGHBOUR_BITS.W) masque |= NEIGHBOUR_BITS.SW;
  if (forceNord && forceLateral === 'E') masque |= NEIGHBOUR_BITS.NE;
  if (forceNord && forceLateral === 'W') masque |= NEIGHBOUR_BITS.NW;
  if (forceNord && arriereCotes.includes('W')) masque |= NEIGHBOUR_BITS.NW;
  if (forceNord && arriereCotes.includes('E')) masque |= NEIGHBOUR_BITS.NE;
  return masque;
}

/**
 * Les cases d'atlas d'un mur à l'emprise (x, y), de bas en haut dans l'ordre où
 * il faut les peindre. Rend une liste `{col, row, dx, dy}` en cases de carte.
 *
 * `etat` est l'état de bande de la case, déjà calculé pour toute la carte par
 * `etatsDeBande` : la scène le calcule UNE fois et le passe ici, parce qu'un
 * placeur de jonctions doit voir la carte entière et qu'on ne la relit pas une
 * fois par case. Omis, il est recalculé — pratique à l'appel isolé, coûteux en
 * boucle. `penteInfo` (T44) suit la même convention pour `masqueDessusMur`.
 */
export function placerMur(descripteur, grille, x, y, hauteur, etat, penteInfo) {
  const colonneEtat = descripteur.etats.indexOf(etat || etatsDeBande(grille)(x, y));
  const pieces = [];
  // Une case dont la voisine du SUD est un mur n'a ni base ni face visibles : la pile
  // de la voisine recouvre ces rangées. Les peindre quand même laissait un liseré de
  // brique dans la rentrée latérale du dessus de la voisine — vu par Damien sur
  // capture. Seule exception, côté par côté : si cette case continue vers l'est (ou
  // l'ouest) et pas la voisine du sud, sa base bouche la rentrée de la voisine en
  // bout de course, et on la garde.
  const r = remplisseur(grille);
  const couverte = r(x, y + 1) && (!r(x - 1, y) || r(x - 1, y + 1)) && (!r(x + 1, y) || r(x + 1, y + 1));
  // La base : la case de l'emprise elle-même.
  if (!couverte) pieces.push({ col: colonneEtat, row: descripteur.baseRow, dx: x, dy: y });
  // Les faces, de la base vers le haut.
  for (let k = 1; k < hauteur && !couverte; k += 1) pieces.push({ col: colonneEtat, row: descripteur.faceRow, dx: x, dy: y - k });
  // Le dessus : le blob, autotilé sur l'emprise — c'est lui qui porte la silhouette.
  // Voir `masqueDessusMur` pour ce que le masque brut de `cellMaskAt` ne dit pas.
  const p = atlasPosition('B47', masqueDessusMur(grille, x, y, penteInfo));
  pieces.push({ col: p.col, row: p.row, dx: x, dy: y - hauteur });
  return pieces;
}

/**
 * Les cases d'atlas de la case HAUTE d'une jonction en diagonale, quand sa face est
 * remplacée par la bande EN BIAIS (T43). Même contrat que `placerMur` — une liste
 * `{col, row, dx, dy}` de bas en haut — et le même dessus, inchangé.
 *
 * La géométrie, et pourquoi elle occupe une rangée de plus. Le bord GAUCHE de la bande
 * reste à la hauteur de la face droite voisine ; son bord DROIT descend d'une case et
 * rejoint la première face de la course du dessous. Entre les deux, la pente est de 45°
 * pile : une case de descente pour une case de largeur. Une face visible de `hauteur`
 * rangées en prend donc `hauteur + 1`, la demi-case perdue en haut se rattrapant en bas.
 * Pour une emprise (x, y) et une hauteur h :
 *
 *     y − h        le dessus, inchangé (blob autotilé sur l'emprise)
 *     y − h + 1    RACCORD     : dessus au-dessus-droite, face cisaillée au-dessous-gauche
 *     y − h + 2 …  FACE        : la face cisaillée pleine, répétée
 *     y − 1        FACE
 *     y            BASE-HAUTE  : la case d'emprise ; la pénombre de contact y entre en biais
 *     y + 1        BASE-BASSE  : la moitié qui reste de la base, un triangle
 *
 * L'ombre portée suit dans `dessinerScene`, sur (y + 1) et (y + 2) : elle est peinte dans
 * une passe séparée, avant toute matière, et n'a donc rien à faire dans cette liste.
 *
 * `hauteur === 1` (T45) : RACCORD et BASE-HAUTE réclamaient la même rangée (`y`), la
 * raison même pour laquelle cette fonction rendait `null` jusqu'ici et le mur repassait
 * droit — retour de Damien, 16 septembre 2026 : « si mon mur fait que 1 de hauteur ça ne
 * marche pas ». La pièce RACCORD-BASE (`b['raccord-base']`) est la fusion exacte des deux
 * qui se disputaient la case ; elle prend seule la rangée `y`, sans face intermédiaire :
 *
 *     y − 1        le dessus, inchangé (blob autotilé sur l'emprise)
 *     y            RACCORD-BASE : dessus au-dessus-droite, base-haute au-dessous-gauche
 *     y + 1        BASE-BASSE  : inchangée
 *
 * `hauteur < 1` reste `null` : il n'y a alors aucune case d'emprise à peindre.
 */
export function placerMurBiais(descripteur, grille, x, y, hauteur, sens, penteInfo) {
  const b = descripteur.biais && descripteur.biais[sens];
  if (!b || hauteur < 1) return null;
  const pieces = [];
  pieces.push({ col: b['base-basse'].col, row: b['base-basse'].row, dx: x, dy: y + 1 });
  if (hauteur === 1) {
    pieces.push({ col: b['raccord-base'].col, row: b['raccord-base'].row, dx: x, dy: y });
  } else {
    pieces.push({ col: b['base-haute'].col, row: b['base-haute'].row, dx: x, dy: y });
    for (let k = 1; k <= hauteur - 2; k += 1) pieces.push({ col: b.face.col, row: b.face.row, dx: x, dy: y - k });
    pieces.push({ col: b.raccord.col, row: b.raccord.row, dx: x, dy: y - hauteur + 1 });
  }
  const p = atlasPosition('B47', masqueDessusMur(grille, x, y, penteInfo));
  pieces.push({ col: p.col, row: p.row, dx: x, dy: y - hauteur });
  return pieces;
}

/**
 * La case d'atlas de la tuile de PENTE du bord arrière du dessus, à la jonction `j`
 * (un élément de `jonctionsDiagonales(grille)`), pour une hauteur de mur `hauteur` —
 * tranche T44. Rend `{ col, row, dx, dy }`, sur la case VIDE du décrochement : à la
 * même rangée que le dessus de la course du haut (`yHaut − hauteur`), une colonne à
 * l'est de `xHaut` pour une pente qui descend à droite, à l'ouest en miroir. `null`
 * si le descripteur ne porte pas de bloc en biais (dispositions autres que `wall`).
 */
export function caseMurPente(descripteur, j, hauteur) {
  const b = descripteur.biais && descripteur.biais[j.sens];
  if (!b || !b.pente) return null;
  const dx = j.sens === 'droite' ? j.xHaut + 1 : j.xHaut - 1;
  return { col: b.pente.col, row: b.pente.row, dx, dy: j.yHaut - hauteur };
}

/** Les deux cases d'ombre portée de la bande en biais, de la même jonction. */
export function placerOmbreBiais(descripteur, x, y, sens) {
  const b = descripteur.biais && descripteur.biais[sens];
  if (!b) return [];
  return [
    { col: b['ombre-haute'].col, row: b['ombre-haute'].row, dx: x, dy: y + 1 },
    { col: b['ombre-basse'].col, row: b['ombre-basse'].row, dx: x, dy: y + 2 },
  ];
}

// ===========================================================================
// 2 bis. Le calque de décor organique (T27)
// ===========================================================================
//
// Ce que ce calque corrige, mot pour mot : « ça ne crée pas du tout un visuel
// cohérent et ça crée des escaliers ». T24 a mesuré qu'aucune pièce d'atlas ne
// referme une diagonale, et les trois recherches de la section « Tranches 25 à
// 27 » du plan ont établi qu'aucun système d'autotile ne modélise un bord à 45°.
// La technique de la référence — et de tous les tilesets de donjon consultés —
// est ailleurs : la matière reste orthogonale, et un calque de gravats posé
// PAR-DESSUS casse la lecture de la grille. La diagonale perçue est un effet de
// silhouette.
//
// Où se posent les pièces, et pourquoi là. Sur les cases VIDES qui touchent la
// matière — jamais sur la matière elle-même. Une tuile ne peint que sa propre
// case : posée du côté plein, elle ne retoucherait que l'intérieur de la
// silhouette, que personne ne regarde ; posée du côté vide, elle ajoute de la
// matière AU-DELÀ du bord, et c'est la seule façon de déplacer la silhouette.
//
// L'OCCUPATION, et non l'emprise. En mode mur, la silhouette qui se lit comme un
// escalier n'est pas celle des cases de collision : c'est celle de tout ce qui
// est PEINT — dessus, faces répétées, base. Une pièce posée le long de l'emprise
// seule ne toucherait que le pied du mur et laisserait l'escalier intact plus
// haut. `occupationMur` rend donc la vraie occupation, hauteur comprise.

/**
 * L'occupation dessinée d'une carte de murs : une case est occupée si une pièce
 * de mur y est peinte, c'est-à-dire si l'emprise porte un mur à cette colonne,
 * de cette rangée jusqu'à `hauteur` rangées plus bas (le mur monte depuis sa
 * base). L'ombre portée n'en fait pas partie — elle est une tache sur le sol, pas
 * de la matière, et un gravat a le droit de se poser dessus.
 */
export function occupationMur(grille, hauteur) {
  const rempli = remplisseur(grille);
  return (x, y) => {
    for (let k = 0; k <= hauteur; k += 1) if (rempli(x, y + k)) return true;
    return false;
  };
}

// Les deux crans qui posent quelque chose. Ce sont des SEUILS de tirage, pas des
// comptes : chaque case de bord tire son propre nombre et se compare à celui de
// son cran, si bien qu'une case ne dépend jamais de ce qui a été posé ailleurs —
// la condition du déterminisme (voir `hachage01`).
// Six crans depuis le 27 septembre 2026 (Asset Kitchen) ; « leger » et « dense » gardent
// leur seuil d'avant, au bit près.
const DECOR_SEUILS = { aucun: 0, rare: 0.15, leger: 0.42, moyen: 0.65, dense: 0.88, partout: 1 };

// Décalages de graine du décor, distincts les uns des autres : présence,
// orientation et variante doivent être trois tirages indépendants, sinon toutes
// les pièces posées porteraient la même variante.
const DECOR_GRAINE_PRESENCE = 7717;
const DECOR_GRAINE_ORIENTATION = 7723;
const DECOR_GRAINE_VARIANTE = 7741;

// Le côté opposé. Une pièce de décor se pose PAR PAIRES de part et d'autre d'une
// frontière — voir `emplacementsDecor` — et la moitié intérieure s'appuie sur le
// bord opposé à celui de la moitié extérieure.
const DECOR_OPPOSE = { n: 's', e: 'w', s: 'n', w: 'e' };
// Le vecteur de chaque côté, dans le même ordre de lecture que partout ailleurs.
const DECOR_VECTEUR = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };

/**
 * Les pièces de décor d'une carte : `[{ x, y, orientation, variant, moitie }]`,
 * une par case au plus — une case d'une couche de tuiles ne porte qu'une tuile.
 *
 * `occupe(x, y)` dit ce qui est peint (voir `occupationMur`, ou le masque en
 * mode terrain). Déterministe à graine et carte données : chaque case ne lit que
 * ses propres coordonnées, jamais un compteur ni un tirage précédent.
 *
 * **Une pièce est la MOITIÉ d'une jonction, pas un bout de bord** — la leçon que
 * T24 a payée cher sur les flancs à 45°, appliquée ici du premier coup, et
 * MESURÉE avant d'être crue. Une première version ne posait que la moitié
 * extérieure, dans la case vide. Elle a produit un défaut pire que celui qu'elle
 * corrigeait : le moteur rentre le bord d'une pièce de mur de `edgePadding`
 * pixels (`edgeInset`), si bien qu'entre le gravat — arrêté net au bord de SA
 * case — et la maçonnerie il restait une fente de fond de 4 px, parfaitement
 * droite, sur toute la hauteur du mur. Mesuré sur la carte en escalier : un
 * segment de silhouette rectiligne de 140 px là où le plus long, sans décor,
 * faisait 32 px. Un calque censé casser la grille venait d'en dessiner une.
 *
 * La moitié INTÉRIEURE, posée sur la case occupée et appuyée sur le bord opposé,
 * couvre exactement cette rentrée : les deux masses se rejoignent par-dessus la
 * frontière et la fente n'existe plus. Les deux moitiés sont ajoutées dans la
 * même instruction — comme la jonction en diagonale de T24, il n'existe aucun
 * chemin de code qui en pose une sans l'autre.
 *
 * La seule exception, et elle est nette : une case occupée déjà réclamée par une
 * autre jonction garde sa pièce, et la seconde jonction reste à une moitié. Une
 * couche de tuiles ne porte qu'une tuile par case ; c'est la frontière du
 * mécanisme, pas un raté.
 */
export function emplacementsDecor(occupe, { colonnes, lignes, densite = 'aucun', graine = 0, variantes = 3, orientations = ['n', 'e', 's', 'w'], colles = true }) {
  const seuil = DECOR_SEUILS[densite] || 0;
  if (!seuil) return [];
  const pieces = [];
  const reservees = new Set();
  for (let y = 0; y < lignes; y += 1) {
    for (let x = 0; x < colonnes; x += 1) {
      if (occupe(x, y)) continue;
      // L'orientation nomme le côté où se trouve la matière : la pièce s'appuie
      // dessus et déborde vers l'intérieur de sa propre case.
      const cotes = orientations.filter((o) => {
        const [dx, dy] = DECOR_VECTEUR[o] || [0, 0];
        return occupe(x + dx, y + dy);
      });
      if (!cotes.length) continue;
      if (hachage01(x, y, graine + DECOR_GRAINE_PRESENCE) >= seuil) continue;
      const orientation = cotes[Math.min(cotes.length - 1, Math.floor(hachage01(x, y, graine + DECOR_GRAINE_ORIENTATION) * cotes.length))];
      const variant = Math.min(variantes - 1, Math.floor(hachage01(x, y, graine + DECOR_GRAINE_VARIANTE) * variantes));
      pieces.push({ x, y, orientation, variant, moitie: 'exterieure' });
      // Des cailloux détachés (`colles` faux) tiennent entiers dans leur case : rien à
      // raccorder, donc pas de moitié intérieure peinte sur la matière — c'est elle qui
      // cassait le motif du chemin.
      if (!colles) continue;
      const [dx, dy] = DECOR_VECTEUR[orientation];
      const ix = x + dx;
      const iy = y + dy;
      const cle = `${ix},${iy}`;
      if (reservees.has(cle)) continue;
      reservees.add(cle);
      // La moitié intérieure prend la variante suivante : deux moitiés de la même
      // forme se liraient comme un motif miroir, ce qui est exactement la
      // régularité que le calque existe pour casser.
      pieces.push({
        x: ix,
        y: iy,
        orientation: DECOR_OPPOSE[orientation],
        variant: (variant + 1) % variantes,
        moitie: 'interieure',
      });
    }
  }
  return pieces;
}

/**
 * La case d'atlas d'une pièce de décor. La géométrie vient telle quelle du
 * descripteur du moteur (`decorAtlasDescriptor`) — jamais réinventée ici, comme
 * pour les variantes en T19.
 */
export function caseDecor(descripteur, orientation, variant) {
  const cell = descripteur.cells.find((c) => c.orientation === orientation && c.variant === variant);
  return cell ? { col: cell.col, row: cell.row } : null;
}

/** Lecture d'une grille de booléens qui rend faux hors des bords. */
export const remplisseur = (grille) => (x, y) =>
  y >= 0 && y < grille.length && x >= 0 && x < grille[y].length && !!grille[y][x];

// ===========================================================================
// 3. La scène
// ===========================================================================

/**
 * Peint une scène complète.
 *
 * `options` :
 *   tile        — la taille d'une tuile, en pixels ;
 *   colonnes, lignes — la carte, en cases ;
 *   set         — 'W16' | 'B47' | 'E16', ou null en mode mur ;
 *   masqueDe(x, y) — le masque de la case, une case d'atlas {col, row}, ou null ;
 *   mur         — { hauteur, rempli(x, y), descripteur } ou null ;
 *   sol         — { couleur, motif } : le sol sous tout le reste, motif facultatif ;
 *   animation   — { col, row, pas, images, toutes } ou null ; `image` dit laquelle
 *                 jouer ; `toutes` (T10 bis) anime chaque tuile, pas seulement celle
 *                 posée en (col, row) ;
 *   image       — l'index d'image courant ;
 *   variants    — { mask, count, list, seed } ou null (T19) : `mask` est le masque de
 *                 la tuile pleine (`variantAtlasDescriptor` côté moteur, relu tel quel),
 *                 `list` ses `count` variantes ({ col, row }), `seed` la graine du
 *                 tirage — voir `caseAtlas` et `tirerVariante` plus bas ;
 *   heros       — { x, y, image } en cases (flottant), ou null ;
 *   reperes     — vrai pour souligner la ligne de collision / de tri.
 */
export function dessinerScene(peintre, options) {
  const { tile, colonnes, lignes, set, masqueDe, mur, sol, animation, image = 0, variants, decor, heros, reperes } = options;
  // Le sol : une couleur, et par-dessus un motif de la taille d'une tuile quand
  // on en donne un. C'est ce qui évite l'aplat sous un mur texturé — dans un jeu,
  // le sol est une couche de tuiles comme une autre, pas un fond de fenêtre.
  peintre.fond(sol.couleur);
  if (sol.motif) peintre.fondMotif(sol.motif, tile);

  // --- Le terrain (dispositions à autotile) --------------------------------
  if (set) {
    for (let y = 0; y < lignes; y += 1) {
      for (let x = 0; x < colonnes; x += 1) {
        const masque = masqueDe(x, y);
        if (masque === null || masque === undefined) continue;
        // Un masque, ou directement une case d'atlas. La seconde forme existe pour
        // la 48ᵉ case du blob (tranche T7 bis) : entièrement le terrain du dessous,
        // elle ne porte aucun masque — c'est précisément ce qui la distingue du
        // masque 0, qui est un îlot isolé de terrain supérieur.
        const p = typeof masque === 'number' ? caseAtlas(set, masque, animation, image, variants, x, y) : masque;
        peintre.tuile(p.col * tile, p.row * tile, tile, x * tile, y * tile);
      }
    }
  }

  // --- Les murs ------------------------------------------------------------
  // Le personnage se glisse dans cette boucle, à sa ligne de pieds : c'est ce qui
  // le fait passer DERRIÈRE un mur en remontant et DEVANT en redescendant. Posé
  // avant ou après la boucle, il serait toujours du même côté de tous les murs et
  // l'aperçu mentirait sur le tri en profondeur.
  const poserHeros = () => {
    if (!heros) return;
    dessinerHeros(peintre, heros.x * tile, heros.y * tile, heros.image || 0, Math.max(1, Math.round(tile / 16)));
  };
  let herosPose = false;

  // Les jonctions en diagonale de la carte de murs (T43/T44), hors de `if (mur)` :
  // le décor, plus bas, en a besoin lui aussi pour ne pas poser un gravat sur la
  // case qu'une pente occupe déjà.
  let jonctions = [];

  if (mur) {
    const { hauteur, grille, descripteur } = mur;
    const rempli = remplisseur(grille);
    // Les états de bande, pour toute la carte et une seule fois : ils viennent des
    // courses, pas des cases, donc ils ne se recalculent pas case par case.
    const etatDe = etatsDeBande(grille);
    if (descripteur.biais) jonctions = jonctionsDiagonales(grille);
    // Les cases hautes des jonctions en diagonale (T43) : leur face, leur base et leur
    // ombre sont remplacées par la bande EN BIAIS. `sensBiais(x, y)` rend le sens de la
    // pente, ou `undefined` pour toutes les autres cases — donc une case sur laquelle
    // rien ne change suit exactement le chemin d'avant la tranche.
    // T45 : la garde `hauteur >= 2` levée — `placerMurBiais` sait désormais poser la
    // bande en biais pour un mur d'une seule case de haut, avec la pièce RACCORD-BASE.
    const sensBiais = new Map();
    if (descripteur.biais) {
      for (const j of jonctions) sensBiais.set(`${j.xHaut},${j.yHaut}`, j.sens);
    }
    // T44 : les bits N/E/W/NE/NW forcés sur les dessus que touche une pente de bord
    // arrière — calculés UNE fois sur TOUTES les jonctions. Indépendant de la garde
    // `hauteur >= 2` ci-dessus, qui ne restreint que la face EN BIAIS (T43) : le bord
    // arrière du dessus se pose même pour un mur d'un seul étage.
    const penteInfo = descripteur.biais ? penteVoisinsDessus(grille) : null;
    // Les ombres d'abord, toutes : une ombre ne doit jamais passer par-dessus un
    // mur, même celui de la rangée suivante.
    for (let y = 0; y < lignes; y += 1) {
      for (let x = 0; x < colonnes; x += 1) {
        if (!rempli(x, y) || rempli(x, y + 1)) continue;
        const sens = sensBiais.get(`${x},${y}`);
        if (sens) {
          // L'ombre en biais prend DEUX cases : le pied du mur descend d'une case sur la
          // largeur, et son ombre avec lui. Une seule case laisserait un trou d'ombre à
          // chaque marche — 63 px par marche sur une tuile de 32, l'aire du triangle qui
          // déborde à droite.
          for (const p of placerOmbreBiais(descripteur, x, y, sens)) {
            peintre.tuile(p.col * tile, p.row * tile, tile, p.dx * tile, p.dy * tile);
          }
          continue;
        }
        const colonneEtat = descripteur.etats.indexOf(etatDe(x, y));
        peintre.tuile(colonneEtat * tile, descripteur.shadowRow * tile, tile, x * tile, (y + 1) * tile);
      }
    }
    // Puis les murs, rangée par rangée du haut vers le bas : le peintre naïf EST
    // le tri en profondeur, tant qu'on trie sur la ligne de base.
    for (let y = 0; y < lignes; y += 1) {
      if (heros && !herosPose && heros.y <= y) { poserHeros(); herosPose = true; }
      for (let x = 0; x < colonnes; x += 1) {
        if (!rempli(x, y)) continue;
        // La bande en biais est peinte AU TOUR DE SA CASE D'EMPRISE (x, y), comme la pile
        // droite qu'elle remplace, et non dans une passe à part : c'est ce qui garde le
        // peintre naïf juste. Sa pièce la plus basse tombe en (x, y + 1) — une colonne que
        // la course du dessous n'occupe jamais (elle commence en x + 1, sinon il n'y
        // aurait pas de jonction), donc rien ne peut la recouvrir à tort, et rien qu'elle
        // peigne ne recouvre une rangée déjà finie. Mesuré sur l'escalier de cinq marches.
        const sens = sensBiais.get(`${x},${y}`);
        const pieces = sens ? placerMurBiais(descripteur, grille, x, y, hauteur, sens, penteInfo) : null;
        for (const piece of pieces || placerMur(descripteur, grille, x, y, hauteur, etatDe(x, y), penteInfo)) {
          peintre.tuile(piece.col * tile, piece.row * tile, tile, piece.dx * tile, piece.dy * tile);
        }
        if (reperes) peintre.rect(x * tile, y * tile + tile - 1, tile, 1, '#ff4d6d', 0.85);
      }
    }
    // La pente du bord arrière (T44) : une par jonction, sur sa propre case vide et
    // sa propre rangée — jamais recouverte, jamais recouvrante (couverture max 1,
    // mesuré sur toute la scène), donc son tour de peinture n'a pas besoin de suivre
    // le tri en profondeur ci-dessus.
    for (const j of jonctions) {
      const p = caseMurPente(descripteur, j, hauteur);
      if (p) peintre.tuile(p.col * tile, p.row * tile, tile, p.dx * tile, p.dy * tile);
    }
  }

  // --- Le décor organique (T27) -------------------------------------------
  // Posé APRÈS la matière : un gravat est devant le mur qu'il borde, et il a le
  // droit de couvrir l'ombre portée, qui n'est qu'une tache sur le sol. Il ne
  // peut jamais recouvrir la matière elle-même — il n'occupe que des cases vides.
  if (decor && decor.descripteur && decor.densite && decor.densite !== 'aucun') {
    // T44 : les cases qu'une pente occupe déjà comptent comme occupées pour le
    // décor — sans quoi `emplacementsDecor` y verrait une case vide bordée de
    // matière, exactement la condition qui lui fait poser un gravat, et les deux
    // pièces se superposeraient sur la même case.
    const cellesPente = mur && mur.descripteur.biais
      ? new Set(jonctions.map((j) => caseMurPente(mur.descripteur, j, mur.hauteur)).filter(Boolean).map((p) => `${p.dx},${p.dy}`))
      : null;
    const occupe = mur
      ? (x, y) => occupationMur(mur.grille, mur.hauteur)(x, y) || (cellesPente ? cellesPente.has(`${x},${y}`) : false)
      : (x, y) => {
          if (x < 0 || y < 0 || x >= colonnes || y >= lignes) return false;
          const m = masqueDe(x, y);
          return m !== null && m !== undefined;
        };
    for (const piece of emplacementsDecor(occupe, {
      colonnes,
      lignes,
      densite: decor.densite,
      graine: decor.graine || 0,
      colles: decor.colles !== false,
      variantes: decor.descripteur.variants,
      orientations: decor.descripteur.orientations,
    })) {
      // T44 : `emplacementsDecor` pose sa moitié INTÉRIEURE SUR une case occupée, par
      // construction (T27 — elle couvre la rentrée du mur) : marquer la case de pente
      // comme occupée l'empêche d'y NAÎTRE une pièce, mais pas d'y RECEVOIR la moitié
      // intérieure d'une pièce voisine. La pente n'a pas de rentrée à couvrir — elle EST
      // déjà le comblement — donc aucune pièce, extérieure ou intérieure, n'y a sa place.
      if (cellesPente && cellesPente.has(`${piece.x},${piece.y}`)) continue;
      const c = caseDecor(decor.descripteur, piece.orientation, piece.variant);
      if (c) peintre.tuile(c.col * tile, c.row * tile, tile, piece.x * tile, piece.y * tile);
    }
  }

  if (heros && !herosPose) poserHeros();
}

/**
 * Un hachage entier ordinaire de (x, y, graine), rendu dans [0, 1). Pas de
 * `Math.random()` et aucun état conservé entre deux appels : à mêmes arguments,
 * toujours le même résultat — c'est ce qui rend le tirage de variante (T19)
 * déterministe, stable d'une frappe à l'autre, et indifférent à ce qui se passe
 * ailleurs sur la carte (peindre une case ne redistribue pas les autres).
 */
function hachage01(x, y, graine) {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(graine | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * L'indice tiré pour la case (x, y) parmi l'originale (0) et les `count`
 * variantes (1..count) — ou toujours 0 quand `variants` est absent ou vide.
 * Tirage uniforme, déterministe : voir `hachage01`.
 */
function tirerVariante(variants, x, y) {
  if (!variants || !variants.count) return 0;
  return Math.floor(hachage01(x, y, variants.seed || 0) * (variants.count + 1));
}

/**
 * La case d'atlas d'un masque — celle de la disposition, sauf deux cas :
 *
 *  * c'est la tuile pleine et un tirage de variante (T19, `variants`) en
 *    désigne une autre : `tirerVariante` choisit alors, une fois pour toutes
 *    par case de carte, entre l'originale et ses `variants.count` variantes —
 *    la géométrie de la ligne de variantes n'est pas réinventée ici, elle
 *    vient telle quelle de `variantAtlasDescriptor` côté moteur ;
 *  * c'est la tuile animée et qu'une image autre que la première est
 *    demandée. Les images descendent dans la COLONNE de la tuile pleine, par
 *    pas de `pas` lignes : c'est la disposition qu'impose Godot, mesurée sur
 *    le moteur en tranche T10, et l'aperçu la relit telle quelle plutôt que
 *    d'en inventer une seconde.
 *
 * Les deux se composent sans se marcher dessus : le tirage de variante choisit
 * D'ABORD la case de départ (originale ou variante), et le décalage
 * d'animation s'applique ensuite à CETTE case. En atlas de copies (`toutes`),
 * le décalage s'applique à n'importe quelle case, variante comprise, puisque
 * c'est l'atlas entier qui est répété. En animation d'une seule tuile (pas
 * `toutes`), seule la case qui EST la tuile pleine reçoit le décalage — une
 * variante, à une autre colonne, reste donc immobile : c'est fidèle à
 * l'export, où seule la tuile pleine porte des images.
 */
// `animation.toutes` (tranche T10 bis) : l'atlas entier est répété une fois par image,
// donc TOUTE tuile descend du même pas — il n'y a plus de tuile à reconnaître, et c'est
// exactement ce qui fait qu'aucune voisine ne reste en arrière.
function caseAtlas(set, masque, animation, image, variants, x, y) {
  let p = atlasPosition(set, masque);
  if (variants && masque === variants.mask) {
    const indice = tirerVariante(variants, x, y);
    if (indice > 0) p = variants.list[indice - 1];
  }
  if (!animation || !image) return p;
  if (!animation.toutes && (p.col !== animation.col || p.row !== animation.row)) return p;
  return { col: p.col, row: p.row + (image % animation.images) * animation.pas };
}

/**
 * Le masque blob d'une case, quand la carte est une grille de booléens.
 * Raccourci de confort pour l'appelant — la vraie règle vit dans tile-check.js.
 */
export function masqueBlobDe(grille, x, y) {
  return cellMaskAt('B47', grille, x, y);
}

// ===========================================================================
// 4. Les peintres
// ===========================================================================

/**
 * Le peintre du navigateur. `scale` est un entier : un aperçu de jeu ne se
 * grossit jamais à un facteur fractionnaire, sinon les pixels de l'atlas se
 * mélangent et on juge un flou au lieu de juger un tileset.
 */
export function peintreCanvas(ctx, atlas, scale) {
  ctx.imageSmoothingEnabled = false;
  return {
    fond(couleur) {
      ctx.fillStyle = couleur;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
    fondMotif(motif, taille) {
      for (let y = 0; y * taille * scale < ctx.canvas.height; y += 1) {
        for (let x = 0; x * taille * scale < ctx.canvas.width; x += 1) {
          ctx.drawImage(motif, 0, 0, taille, taille, x * taille * scale, y * taille * scale, taille * scale, taille * scale);
        }
      }
    },
    tuile(sx, sy, taille, dx, dy) {
      ctx.drawImage(atlas, sx, sy, taille, taille, dx * scale, dy * scale, taille * scale, taille * scale);
    },
    rect(x, y, w, h, couleur, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = couleur;
      ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
      ctx.globalAlpha = 1;
    },
    ellipse(cx, cy, rx, ry, couleur, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = couleur;
      ctx.beginPath();
      ctx.ellipse(cx * scale, cy * scale, rx * scale, ry * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * Le peintre hors navigateur : il compose dans un tableau de pixels RGBA. C'est
 * lui qui permet à `scripts/apercu-tileset.mjs` et aux essais de produire la
 * MÊME scène que l'atelier, sans canvas et sans navigateur — donc de prouver ce
 * que l'atelier montre au lieu de le redire.
 *
 * `cible` et `atlas` sont deux `{ data, width, height }`. La composition tient
 * compte de l'alpha : l'ombre portée du mur est semi-transparente, et un atlas
 * porte des cases vides qu'il ne faut pas peindre en noir.
 */
export function peintrePixels(cible, atlas, scale) {
  const poser = (x, y, r, g, b, a) => {
    if (a <= 0 || x < 0 || y < 0 || x >= cible.width || y >= cible.height) return;
    const i = (y * cible.width + x) * 4;
    if (a >= 1) {
      cible.data[i] = r; cible.data[i + 1] = g; cible.data[i + 2] = b; cible.data[i + 3] = 255;
      return;
    }
    cible.data[i] = Math.round(cible.data[i] * (1 - a) + r * a);
    cible.data[i + 1] = Math.round(cible.data[i + 1] * (1 - a) + g * a);
    cible.data[i + 2] = Math.round(cible.data[i + 2] * (1 - a) + b * a);
    cible.data[i + 3] = 255;
  };
  const hex = (couleur) => [
    parseInt(couleur.slice(1, 3), 16),
    parseInt(couleur.slice(3, 5), 16),
    parseInt(couleur.slice(5, 7), 16),
  ];
  return {
    fond(couleur) {
      const [r, g, b] = hex(couleur);
      for (let i = 0; i < cible.data.length; i += 4) {
        cible.data[i] = r; cible.data[i + 1] = g; cible.data[i + 2] = b; cible.data[i + 3] = 255;
      }
    },
    fondMotif(motif, taille) {
      for (let y = 0; y < cible.height; y += 1) {
        for (let x = 0; x < cible.width; x += 1) {
          const sx = Math.floor(x / scale) % taille;
          const sy = Math.floor(y / scale) % taille;
          const src = (sy * motif.width + sx) * 4;
          poser(x, y, motif.data[src], motif.data[src + 1], motif.data[src + 2], motif.data[src + 3] / 255);
        }
      }
    },
    tuile(sx, sy, taille, dx, dy) {
      for (let y = 0; y < taille; y += 1) {
        for (let x = 0; x < taille; x += 1) {
          const src = ((sy + y) * atlas.width + sx + x) * 4;
          const a = atlas.data[src + 3] / 255;
          if (a <= 0) continue;
          for (let ky = 0; ky < scale; ky += 1) {
            for (let kx = 0; kx < scale; kx += 1) {
              poser((dx + x) * scale + kx, (dy + y) * scale + ky, atlas.data[src], atlas.data[src + 1], atlas.data[src + 2], a);
            }
          }
        }
      }
    },
    rect(x, y, w, h, couleur, alpha) {
      const [r, g, b] = hex(couleur);
      for (let py = 0; py < h * scale; py += 1) {
        for (let px = 0; px < w * scale; px += 1) poser(Math.round(x * scale) + px, Math.round(y * scale) + py, r, g, b, alpha);
      }
    },
    ellipse(cx, cy, rx, ry, couleur, alpha) {
      const [r, g, b] = hex(couleur);
      for (let py = Math.floor((cy - ry) * scale); py <= Math.ceil((cy + ry) * scale); py += 1) {
        for (let px = Math.floor((cx - rx) * scale); px <= Math.ceil((cx + rx) * scale); px += 1) {
          const u = (px + 0.5 - cx * scale) / (rx * scale);
          const v = (py + 0.5 - cy * scale) / (ry * scale);
          if (u * u + v * v <= 1) poser(px, py, r, g, b, alpha);
        }
      }
    },
  };
}

/**
 * Le descripteur de bandes que la scène attend, tiré de celui du moteur.
 *
 * `biais` (T43) est `{ droite: { raccord, face, 'base-haute', … }, gauche: … }`, chaque
 * pièce donnant sa case `{col, row}`. Il est lu sur le descripteur du moteur et jamais
 * recalculé ici — même règle que pour les variantes en T19. Ces deux lignes ne bougent
 * pas avec le réglage de décor (voir leur commentaire côté moteur), ce qui est
 * exactement ce qui permet à cette fonction de rester sans argument.
 */
export function descripteurScene(wallAtlasDescriptor, WALL_BAND_STATES) {
  const d = wallAtlasDescriptor();
  const biais = {};
  for (const c of d.cells) {
    if (!c.sens) continue;
    (biais[c.sens] = biais[c.sens] || {})[c.piece] = { col: c.col, row: c.row };
  }
  return {
    faceRow: d.faceRow,
    baseRow: d.baseRow,
    shadowRow: d.shadowRow,
    etats: WALL_BAND_STATES.map((s) => s.id),
    biais: Object.keys(biais).length ? biais : null,
  };
}

export { B47, NEIGHBOUR_BITS };
