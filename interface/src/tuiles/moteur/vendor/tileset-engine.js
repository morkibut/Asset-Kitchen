// Adapted from SpriteCook/spritecook-tileset-gen, MIT, Copyright (c) 2026 SpriteCook.
// License: ./LICENSE-SpriteCook.txt
//
// Le réducteur « contraste » (tranche T30 — `poidsExpansion`, `expansionContours`,
// `choixContraste`, plus loin dans ce fichier) est un portage de PixelOE,
// Copyright 2024 KohakuBlueLeaf, distribué sous Apache License 2.0.
// License: ./LICENSE-PixelOE.txt — source d'origine : `pixeloe/torch/outline.py`
// (`expansion_weight`, `outline_expansion`) et
// `pixeloe/torch/downscale/contrast_based.py` (`contrast_downscale`).

// Les jeux de masques du blob et du bord, leurs dispositions d'atlas et leurs bits
// viennent de public/tile-masks.js — source unique, verrouillée par
// tests/tile-masks.test.mjs. Rien n'est redéfini ni recalculé ici.
import { B47, E16, NEIGHBOUR_BITS, SIDE_BITS, maskAtPosition, atlasPosition } from "../tile-masks.js";
// La conversion Lab et la palette de référence (tranche T31) viennent de
// public/tile-palette-lab.js — module pur, sans DOM ni Node, partagé avec
// public/tile-palette.js (la façade de l'atelier) et avec scripts/essai-palette-jeu.mjs (le
// banc de l'étude E4). Le moteur en avait sa propre copie de `rgbVersLab`/`labVersRgb`
// depuis T30 ; elle a été retirée, pas dupliquée une troisième fois.
import { rgbVersLab, labVersRgb, paletteLabPonderee, rapprocherVersReference } from "../tile-palette-lab.js";

      const layout = [
        [4, 10, 13, 12],
        [9, 14, 15, 7],
        [2, 3, 11, 5],
        [0, 8, 6, 1],
      ];

      const emptyPiece = { kind: "empty" };
      const rectPiece = (connections) => ({ kind: "rect", ...connections });
      const topdown17Layout = [
        [emptyPiece, emptyPiece, emptyPiece, emptyPiece, emptyPiece],
        [
          rectPiece({ s: true }),
          rectPiece({ e: true, s: true }),
          rectPiece({ e: true, s: true, w: true }),
          rectPiece({ s: true, w: true }),
          { kind: "innerCorners" },
        ],
        [
          rectPiece({ n: true, s: true }),
          rectPiece({ n: true, e: true, s: true }),
          rectPiece({ n: true, e: true, s: true, w: true }),
          rectPiece({ n: true, s: true, w: true }),
          emptyPiece,
        ],
        [
          rectPiece({ n: true }),
          rectPiece({ n: true, e: true }),
          rectPiece({ n: true, e: true, w: true }),
          rectPiece({ n: true, w: true }),
          emptyPiece,
        ],
        [
          rectPiece({}),
          rectPiece({ e: true }),
          rectPiece({ e: true, w: true }),
          rectPiece({ w: true }),
          emptyPiece,
        ],
      ];

      // ===========================================================================
      // Mur top-down (tilesetType: 'wall') — tranche T3.
      //
      // Décision d'architecture de la session orchestratrice (Opus), appliquée telle
      // quelle, non rediscutée ici : un mur n'est pas une tuile mais un empilement de
      // trois bandes sous le dessus, toutes larges de WALL_COLUMNS (la largeur du blob) :
      //   - lignes 0 .. WALL_TOP_ROWS-1 : le DESSUS, le blob 47 intégral et INCHANGÉ —
      //     c'est ce que garantit blobPixelColor plus bas, verbatim entre les deux modes.
      //   - une ligne FACE, une ligne BASE, une ligne OMBRE, sur 6 des 8 colonnes de la
      //     largeur — puis 8 sur 8 depuis T37, qui a rempli les deux dernières avec les
      //     deux états de coin plutôt que de rallonger l'atlas.
      // La hauteur du mur ne se cuit jamais dans l'atlas : une seule ligne de face
      // existe ici, et c'est au moment du placement — hors de cette tranche — qu'elle
      // se répète verticalement pour couvrir la hauteur voulue. Voir wallAtlasDescriptor.
      const WALL_TOP_ROWS = B47.layout.rows; // le dessus est le blob 47, sans le modifier.
      const WALL_COLUMNS = B47.layout.columns; // même largeur que le blob : 8.

      // Les HUIT états d'une bande basse, dans l'ordre de colonne imposé par les tranches :
      // isolé, extrémité gauche, milieu, extrémité droite, les deux flancs à 45° (T3), puis
      // les deux coins (T37). `west`/`east` disent si la matière déborde vers ce voisin —
      // même vocabulaire que `piece.w`/`piece.e` de rectPieceSdf, réutilisé tel quel pour
      // les quatre premiers états. Les flancs portent en plus `flank`, qui sélectionne le
      // chanfrein dédié (flankSdf) plutôt que la boîte à bords droits.
      //
      // T37 — L'INVARIANT que les deux derniers états posent, et dont T38 à T40 héritent :
      // *une extrémité de course qui tourne n'est pas une extrémité libre.* Chaque côté d'un
      // état de bande dit désormais lequel des TROIS cas il est — libre (rentrée arrondie),
      // continu (la matière déborde vers le voisin), ou EN COIN (elle déborde aussi, mais
      // l'œil doit y lire un virage) — là où `west`/`east` seuls n'en distinguaient que deux.
      // Toute tranche qui ajoutera un état de bande doit répondre pour ses deux côtés, plus
      // jamais par un booléen.
      //
      // D'où la forme des deux coins : géométriquement, ce sont des `middle` — les deux
      // côtés à `true`, donc plus AUCUN bord libre arrondi à l'endroit précis où se voyait
      // la coupure droite (mesure en tête de la section T37 du plan : 828 px de fond dans
      // les deux colonnes d'angle d'une scène en L, ramenés à 0). C'est `corner` qui nomme
      // le côté où la face du mur REVIENT, et lui seul porte la pénombre d'angle — voir
      // wallCornerOcclusionShade. Les deux moitiés sont indissociables : la géométrie seule
      // recolle la matière sans qu'on lise l'angle, la pénombre seule n'a rien à assombrir.
      //
      // Les deux colonnes sont ajoutées en 6 et 7, après les flancs, et jamais intercalées :
      // ce sont les deux colonnes restées libres depuis T3, donc aucune case déjà peinte ne
      // se décale, `atlasShape('wall')` reste 8 × 9 et `cells.length` reste 72 — c'est ce qui
      // tient la tranche en une seule et laisse les exports déjà écrits valides.
      const WALL_BAND_STATES = [
        { id: "isolated", west: false, east: false },
        { id: "left-end", west: false, east: true },
        { id: "middle", west: true, east: true },
        { id: "right-end", west: true, east: false },
        { id: "flank-left", west: false, east: true, flank: "left" },
        { id: "flank-right", west: true, east: false, flank: "right" },
        // Le bout GAUCHE d'une course dont le mur monte au nord : c'est son côté ouest,
        // libre jusqu'ici, qui devient continu et porte la pénombre ; son côté est ne bouge
        // pas (`left-end` le donnait déjà à `true`). `corner-right` en est le miroir exact.
        { id: "corner-left", west: true, east: true, corner: "west" },
        { id: "corner-right", west: true, east: true, corner: "east" },
      ];

      // Les trois bandes basses, dans leur ordre de ligne sous le dessus.
      const WALL_BANDS = [
        { id: "face" },
        { id: "base" },
        { id: "shadow" },
      ];

      /** Bande de la ligne d'atlas mur, ou `null` si `row` appartient au dessus. */
      function wallBandAt(row) {
        const offset = row - WALL_TOP_ROWS;
        return offset >= 0 && offset < WALL_BANDS.length ? WALL_BANDS[offset] : null;
      }

      /**
       * État de la colonne d'une bande basse, ou `null` au-delà — plus aucune colonne n'est
       * libre depuis T37 (les huit états occupent les huit colonnes), mais la garde reste :
       * c'est elle qui rend `placeable` faux si une disposition future désynchronisait la
       * largeur de l'atlas et le nombre d'états.
       */
      function wallBandStateAt(col) {
        return col < WALL_BAND_STATES.length ? WALL_BAND_STATES[col] : null;
      }

      // ===========================================================================
      // La face EN BIAIS des jonctions en diagonale — tranche T43.
      // ===========================================================================
      //
      // D'où ça vient. L'utilisateur a cisaillé la face à la main (skew) sur un escalier :
      // la face devient une bande continue à 45° et l'escalier se lit comme un mur oblique.
      // T24 avait conclu l'inverse parce qu'elle essayait de couper le 45° À L'INTÉRIEUR
      // d'une seule case (un chevron de 32 px), ce qui ne peut pas enjamber une marche ;
      // le parallélogramme, lui, relie deux marches. Sa conclusion reste vraie pour ce
      // qu'elle a mesuré, elle ne s'applique pas à cette forme.
      //
      // LA PRÉMISSE, MESURÉE (16 septembre 2026, prototype jetable) et non supposée : une
      // matière de période UNE tuile, lue cisaillée d'un nombre ENTIER de cases par case,
      // reste périodique par case. Zéro pixel d'écart AU BIT PRÈS entre « la même tuile
      // 1×1 recopiée partout » et « chaque case rendue avec la phase que sa position
      // globale lui impose » — empilement comme escalier de cinq marches, brique
      // procédurale comme texture IA importée, tuile 32 comme 64. Contre-épreuve : 0,5 et
      // 0,25 cassent jusqu'à 52 % des pixels. D'où la conséquence qui tient toute la
      // tranche : IL N'Y A AUCUNE PIÈCE PLUS GRANDE QU'UNE CASE. Les peintres de
      // tile-scene.js ne changent pas, l'export Godot n'a besoin ni de `size_in_atlas` ni
      // de `texture_origin`, Tiled garde une seule image, le Y-sort par rangée reste juste.
      //
      // L'AXE DU CISAILLEMENT EST L'AXE Y, mesuré lui aussi : `(ax − ay, ay)` cisaille en
      // x — les assises restent horizontales, les joints de tête penchent, ça se lit comme
      // une image inclinée. `(ax, ay − ax)` cisaille en y — LES ASSISES SUIVENT LA PENTE,
      // les joints restent verticaux, ça se lit comme un mur bâti en oblique, et c'est ce
      // que le skew de l'utilisateur a produit. Les deux sont exactement périodiques ;
      // seul le second est du bâti.
      //
      // Ce qui se lit cisaillé, et ce qui ne se lit pas cisaillé. Tout ce qui dépend de la
      // position DANS LA MATIÈRE de face l'est — la matière elle-même (procédurale comme
      // `faceTexture` importée), le bruit de teinte, la géométrie de l'ombre portée et la
      // pénombre de contact au sol, qui dit « le pied du mur est ici » et suit donc la
      // pente. Le relief rasant et le bruit de BORD ne le sont pas : ils dépendent de la
      // géométrie de la case, la mesure a montré qu'ils ne cassent rien, et bruiter la
      // coupe diagonale ouvre 43 px de trous (voir juste en dessous).
      //
      // LA DIAGONALE PASSE COIN À COIN, SANS RENTRÉE ET SANS BRUIT. Décalée de ±1 px :
      // 190 px de trous ou de recouvrement ; bruitée : 43 px de trous, parce que les deux
      // moitiés sont perturbées indépendamment. Coin à coin et lisse : 319 sauts sur 319
      // valent exactement 1 px sur le profil haut de l'escalier, zéro trou. Et le pixel de
      // la diagonale appartient à UNE SEULE moitié, sinon 64 px de recouvrement par case —
      // d'où l'inégalité stricte d'un seul côté dans `coupeBiais` : `u ≤ 0` en haut à
      // droite, `u > 0` en bas à gauche, exclusif et exhaustif par construction.
      //
      // UNE COURSE CISAILLÉE OCCUPE UNE RANGÉE DE PLUS. La demi-case perdue en haut se
      // rattrape en bas : une face visible de H rangées en prend H + 1. Le schéma, pour une
      // pente qui descend à droite, une case de large, hauteur de mur h (ici h = 3), la
      // case d'emprise étant (x, y) — chaque ligne est une rangée de carte :
      //
      //     rangée        colonne x (la bande en biais)          colonne x+1 (course du bas)
      //     ---------------------------------------------------------------------------
      //     y − h         dessus de la course du haut            (vide)
      //     y − h + 1     RACCORD  : dessus ╲ face cisaillée     dessus de la course du bas
      //     y − h + 2     FACE     : face cisaillée pleine       face
      //     …             FACE                                   face
      //     y − 1         FACE                                   face
      //     y             BASE-HAUTE : pleine case, la pénombre   face
      //                   de contact entre en biais par la gauche
      //     y + 1         BASE-BASSE : moitié haut-droite         base (collision, Y-sort)
      //                   OMBRE-HAUTE : moitié bas-gauche
      //     y + 2         OMBRE-BASSE : le bout d'ombre qui       ombre portée
      //                   déborde à droite
      //
      // Six pièces par sens, douze en tout — et non les huit que le plan annonçait à vue :
      // la base coupée en demande DEUX (celle qui reste pleine à gauche et la triangulaire
      // à droite), et l'ombre aussi, puisque le pied du mur descend d'une case et emmène
      // son ombre avec lui. Les compter à cinq laissait 63 px d'ombre manquante par marche
      // sur une tuile de 32 (l'aire du triangle `lx > tuile − profondeur`), c'est-à-dire un
      // trou d'ombre à chaque marche de l'escalier.
      //
      // Les douze tiennent en DEUX LIGNES de six colonnes, ajoutées à la fin de l'atlas
      // MUR — avant les lignes de décor, qui restent ce qu'elles sont : un calque posé
      // par-dessus, toujours dernier. C'est ce qui donne aux tuiles en biais une position
      // FIXE (lignes 9 et 10) que le réglage de décor ne déplace jamais : sans quoi la
      // scène, qui lit `descripteurScene()` sans connaître la densité de décor, irait
      // chercher les tuiles deux lignes trop haut dès qu'on allume le décor.
      const WALL_BIAIS_SENS = ["droite", "gauche"];

      // Les six pièces, dans l'ordre de colonne — de haut en bas de la bande assemblée.
      //  * `coupe`    : quelle moitié de la case la pièce garde ('haut' = au-dessus-droite
      //                 de la diagonale, 'bas' = au-dessous-gauche, null = toute la case) ;
      //  * `decalage` : de combien de tuiles la LECTURE cisaillée est décalée vers le bas.
      //                 C'est lui, et lui seul, qui distingue `base-haute` de `base-basse`
      //                 et les deux ombres : la matière est périodique à la tuile, donc ce
      //                 décalage ne change rien à la matière, mais il déplace la pénombre
      //                 de contact et la boîte d'ombre portée d'exactement une rangée ;
      //  * `dessus`   : la moitié JETÉE reçoit la matière du dessus au lieu du vide — la
      //                 marche descend en lobe sur cette moitié (bord AVANT du dessus) ;
      //  * `dy`       : la rangée de pose, comptée depuis la rangée d'emprise. `null` pour
      //                 les pièces dont la rangée dépend de la hauteur du mur.
      const WALL_BIAIS_PIECES = [
        { id: "raccord", band: "face", coupe: "bas", decalage: 0, dessus: true, dy: null },
        { id: "face", band: "face", coupe: null, decalage: 0, dessus: false, dy: null },
        { id: "base-haute", band: "base", coupe: null, decalage: 0, dessus: false, dy: 0 },
        { id: "base-basse", band: "base", coupe: "haut", decalage: 1, dessus: false, dy: 1 },
        { id: "ombre-haute", band: "shadow", coupe: "bas", decalage: 0, dessus: false, dy: 1 },
        { id: "ombre-basse", band: "shadow", coupe: null, decalage: 1, dessus: false, dy: 2 },
      ];
      const WALL_BIAIS_ROWS = WALL_BIAIS_SENS.length;
      const WALL_BIAIS_FIRST_ROW = WALL_TOP_ROWS + WALL_BANDS.length;

      // ===========================================================================
      // La tuile de PENTE du bord ARRIÈRE du dessus — tranche T44.
      // ===========================================================================
      //
      // Ce que T43 laisse ouvert (voir son commentaire d'en-tête, « bande hors de la
      // silhouette du dessus », 384 px mesurés et inchangés) n'est PAS le même défaut
      // que celui-ci : T43 cisaille la FACE, T44 comble le bord ARRIÈRE du DESSUS — le
      // côté opposé, resté en dents de scie parce que chaque case de dessus garde son
      // coin carré alors que la droite à 45° qui les enveloppe passe pile par leurs
      // coins. Ce qui manque n'est pas une coupe mais un REMPLISSAGE : le triangle
      // inférieur-gauche (mirroir : inférieur-droit) de la case VIDE du décrochement,
      // entre la droite et les deux cases de mur qu'elle touche — exactement la place
      // où T27 et T39 posaient leurs gravats de décor, avec une forme nette à la place
      // d'un galet.
      //
      // LE POINT DUR, MESURÉ le 16 septembre (sept variantes × deux masques × deux
      // tailles, prototype jetable) : le bord libre en pente peut rejoindre les deux
      // bords rentrés qu'il touche sans marche ni fente, dans une seule case, d'une
      // seule façon.
      //  * La diagonale passe COIN À COIN, lisse, sans rentrée ni arrondi ni bruit —
      //    même conclusion que la diagonale INTÉRIEURE de T43, bien que celle-ci soit
      //    un bord EXTÉRIEUR. 0 saut ≠ 1 px sur 95 (tuile 32) et sur 191 (tuile 64) au
      //    profil arrière, contour continu sans interruption. Toute rentrée dégrade :
      //    perpendiculaire, 17 à 44 sauts ; verticale, 11 ; avec bruit, 23 à 44 — le
      //    bruit casse la droite quelle que soit son amplitude, parce qu'il la déplace
      //    PERPENDICULAIREMENT là où il déplace les bords voisins VERTICALEMENT, et il
      //    est déjà en phase entre tuiles (coordonnées locales) : « partager le bruit »
      //    n'est pas un réglage qui existe.
      //  * La tuile reste 1×1 — ce sont les VOISINES qui changent de masque, jamais
      //    elle. Voir `penteVoisinsDessus` (public/tile-scene.js) pour le bit N/E/W/NE/NW
      //    forcé sur les deux dessus qu'elle touche.
      //  * Hors matière, transparent — jamais `outsideColor` : la case vide porte déjà
      //    son sol (le chemin de T27), une seconde couche le recouvrirait.
      //
      // OÙ ELLE SE POSE DANS L'ATLAS. Les colonnes 6 et 7 des deux lignes en biais
      // (T43) sont restées libres — six pièces de face sur huit colonnes. Une pente
      // par ligne, jamais les deux dans la même : la ligne « droite » (sens de la
      // pente qui descend à droite) prend la colonne 6, dans la continuité des six
      // pièces de face qui la précèdent ; la ligne « gauche » prend la colonne 7, son
      // miroir. Décision : une seule pente par ligne plutôt que dupliquer la même
      // pièce dans les deux colonnes libres d'une même ligne — ça suffit à ce que les
      // DEUX colonnes cessent d'être libres (le contrôle que `checkWallAtlas` doit
      // maintenant faire), sans peindre une case pour rien. `WALL_PENTE_COL` fixe ce
      // choix ; `biaisAtlasDescriptor` en tire la cellule, `checkWallAtlas` s'y réfère.
      const WALL_PENTE_COL = { droite: WALL_BIAIS_PIECES.length, gauche: WALL_BIAIS_PIECES.length + 1 };

      // ===========================================================================
      // La pièce RACCORD-BASE — mur d'UNE case de haut — tranche T45.
      // ===========================================================================
      //
      // `placerMurBiais` rend `null` pour `hauteur < 2` : le RACCORD (rangée y − h + 1)
      // et la BASE-HAUTE (rangée y) tombent alors sur la même case, et le mur repasse
      // droit — l'escalier revient, seule la pente du bord arrière (T44) se pose. Damien,
      // 16 septembre 2026 : « si mon mur fait que 1 de hauteur ça ne marche pas ».
      //
      // La pièce est la FUSION EXACTE des deux qui se disputent la case, jamais un
      // troisième dessin : moitié au-dessus de la diagonale (`u ≤ 0`), le dessus plein,
      // exactement comme la moitié JETÉE du raccord (`piece.dessus`, voir
      // `wallBiaisPixelColor`) ; moitié au-dessous (`u > 0`), le pixel de `base-haute` à
      // l'identique — même bande ("base"), même décalage (0), donc même lecture cisaillée
      // et même pénombre de contact. Ce n'est pas un hasard de conception que les deux
      // moitiés existent déjà ailleurs dans le moteur : `WALL_RACCORD_BASE_PIECE`
      // ci-dessous ne fait que réutiliser `biaisPieceColor` avec la configuration qui
      // produit cette fusion — aucun nouveau chemin de couleur, donc aucun risque que la
      // moitié `u > 0` diverge de `base-haute` d'un bit.
      //
      // OÙ ELLE SE POSE. Chaque ligne en biais garde encore UNE colonne libre après T44
      // (WALL_PENTE_COL en occupe une par ligne) : celle-ci prend l'autre — l'exact
      // symétrique de WALL_PENTE_COL, colonne à colonne, ligne à ligne. `atlasShape('wall')`
      // ne bouge pas : aucune ligne ni colonne n'est ajoutée, seules les deux dernières
      // cases libres du bloc en biais cessent de l'être.
      const WALL_RACCORD_BASE_COL = { droite: WALL_BIAIS_PIECES.length + 1, gauche: WALL_BIAIS_PIECES.length };

      /**
       * De quel côté de la diagonale tombe le pixel (ax, ay) — la SEULE fonction qui
       * connaisse le sens de la pente, et donc le seul endroit où le miroir se joue.
       *
       * Rend `u`, entier, nul EXACTEMENT sur la diagonale coin à coin. Et ce n'est pas
       * qu'un test de moitié : `u` est aussi, au demi-pixel près, la LIGNE que la lecture
       * cisaillée doit lire — la diagonale de coupe et la pente du cisaillement sont la
       * même droite, donc une seule quantité les décrit toutes les deux. C'est ce qui rend
       * impossible qu'elles se désynchronisent.
       */
      function biaisU(sens, ax, ay, tileSize) {
        return sens === "droite" ? ay - ax : ay + ax - (tileSize - 1);
      }

      /** La pièce garde-t-elle ce pixel ? Exclusif et exhaustif : `u ≤ 0` XOR `u > 0`. */
      function biaisGarde(piece, u) {
        if (piece.coupe === "haut") return u <= 0;
        if (piece.coupe === "bas") return u > 0;
        return true;
      }

      /**
       * Le polygone de collision d'une pièce en biais, en coordonnées UNITAIRES de la case
       * (0..1, coin haut-gauche à coin bas-droite) — `null` pour la case pleine, que
       * l'export sait déjà écrire en rectangle. Seule `base-basse` en a un autre : elle est
       * la moitié haut-droite (ou haut-gauche) de sa case, donc un TRIANGLE, et
       * `PackedVector2Array` accepte n'importe quel polygone (seul le rectangle était câblé
       * en dur dans godotWallTileset).
       */
      function biaisCollisionPoints(pieceId, sens) {
        if (pieceId !== "base-basse") return null;
        return sens === "droite"
          ? [[0, 0], [1, 0], [1, 1]]
          : [[0, 0], [1, 0], [0, 1]];
      }

      /** Lignes ajoutées par le bloc en biais — le mur seul en a, les autres modes zéro. */
      function biaisRowCount(tilesetType) {
        return tilesetType === "wall" ? WALL_BIAIS_ROWS : 0;
      }

      /**
       * Le bloc de tuiles en biais : une ligne par sens de pente, une colonne par pièce.
       * `firstRow` est la première ligne ajoutée, c'est-à-dire la hauteur de l'atlas mur
       * SANS décor — les lignes de décor viennent après, pas avant (voir le commentaire
       * d'en-tête de section). `null` pour toute disposition autre que le mur.
       */
      function biaisAtlasDescriptor(tilesetType) {
        if (tilesetType !== "wall") return null;
        const cells = [];
        WALL_BIAIS_SENS.forEach((sens, i) => {
          WALL_BIAIS_PIECES.forEach((piece, j) => {
            cells.push({
              sens,
              piece: piece.id,
              band: piece.band,
              col: j,
              row: WALL_BIAIS_FIRST_ROW + i,
              dy: piece.dy,
            });
          });
          // La pente du bord arrière du dessus (T44) : une par ligne, dans la colonne
          // libre que WALL_PENTE_COL lui réserve — voir son commentaire. `band: "pente"`
          // n'est ni "face" ni "base" : elle ne porte ni collision ni Y-sort (c'est du
          // dessus, immobile, jamais recouvert — mesuré, couverture max 1 sur toute la
          // scène), et `WALL_BAND_CLASS` (exports.js) lui donne sa propre classe Tiled.
          cells.push({
            sens,
            piece: "pente",
            band: "pente",
            col: WALL_PENTE_COL[sens],
            row: WALL_BIAIS_FIRST_ROW + i,
            dy: null,
          });
          // Le raccord-base (T45), dans la colonne libre restante — celle que la pente
          // (juste au-dessus) n'a pas prise. `band: "base"` et `dy: 0` : c'est ce qui la
          // fait porter collision et Y-sort exactement comme base-haute côté
          // `wallAtlasDescriptor`, sans qu'aucune règle spécifique n'ait à le redire.
          cells.push({
            sens,
            piece: "raccord-base",
            band: "base",
            col: WALL_RACCORD_BASE_COL[sens],
            row: WALL_BIAIS_FIRST_ROW + i,
            dy: 0,
          });
        });
        return {
          firstRow: WALL_BIAIS_FIRST_ROW,
          rows: WALL_BIAIS_ROWS,
          columns: WALL_BIAIS_PIECES.length,
          sens: WALL_BIAIS_SENS.slice(),
          pieces: WALL_BIAIS_PIECES.map((p) => p.id),
          cells,
        };
      }

      // Ce que le moteur sait rendre, et sous quelle forme d'atlas. Les deux
      // dispositions historiques sont carrées par hasard, pas par nature : le blob tient
      // en 8 × 6 parce que 47 est premier et qu'aucun rectangle ne tombe juste. D'où des
      // colonnes et des lignes distinctes partout, plutôt qu'un unique nombre de cases.
      // Les tailles du blob et du bord ne sont pas réécrites : elles sont lues sur la
      // disposition que public/tile-masks.js publie, sans quoi l'atlas et les exports
      // pourraient diverger en silence.
      const TILESET_LAYOUTS = {
        "topdown-15": { label: "15 pièces", columns: 4, rows: 4, maskSet: "W16" },
        "topdown-17": { label: "17 pièces", columns: 5, rows: 5, maskSet: null },
        "blob-47": { label: "Blob 47", columns: B47.layout.columns, rows: B47.layout.rows, maskSet: "B47" },
        "edge-16": { label: "Bord 16", columns: E16.layout.columns, rows: E16.layout.rows, maskSet: "E16" },
        wall: {
          label: "Mur (dessus + face + base + ombre)",
          columns: WALL_COLUMNS,
          // T43 : les deux lignes en biais font partie de la disposition du MUR, pas d'un
          // calque optionnel — d'où leur place ici plutôt que dans un compteur à part.
          // C'est ce qui les met à une ligne FIXE, que le réglage de décor ne déplace
          // jamais, et ce qui fait suivre `atlasShape`, `atlasRowsSansDecor` et
          // `decorAtlasDescriptor` sans qu'aucun d'eux ait à connaître la tranche.
          rows: WALL_TOP_ROWS + WALL_BANDS.length + WALL_BIAIS_ROWS,
          maskSet: null,
        },
      };

      // ===========================================================================
      // Variantes de la tuile pleine — tranche T8.
      // ===========================================================================
      //
      // Décision d'architecture de la session orchestratrice, appliquée telle quelle,
      // non rediscutée ici : une variante n'est PAS une « alternative tile » Godot — ces
      // dernières partagent la région de texture de la tuile d'origine, donc le même
      // dessin, inutile ici. Une variante est une case d'atlas À PART, qui porte
      // EXACTEMENT les mêmes bits de peering / le même wangid que la tuile pleine du
      // jeu courant. Godot et Tiled tirent alors au sort, parmi toutes les tuiles dont
      // les bits correspondent au voisinage, pondéré par `probability`.
      //
      // Trois dispositions ont une tuile pleine identifiable — celle dont le masque est
      // le OU de tous les bits du jeu : le mode 15 pièces (masque 15 de `layout`), le
      // blob 47 (masque 255) et le bord 16 (masque 15). Les variantes s'ajoutent SOUS la
      // grille publiée par tile-masks.js, dans une ligne neuve : ligne 4 pour W16 et E16
      // (4 × 4), ligne 6 pour B47 (8 × 6). La disposition publiée par tile-masks.js n'est
      // pas touchée — cette ligne existe seulement ici, en plus. Les 17 pièces et le mur
      // n'ont pas de jeu de masques et n'ont donc pas de variantes ; la tranche ne les
      // couvre pas.

      /**
       * Position et masque de la tuile pleine du jeu courant — le OU de tous les bits
       * du jeu, celle dont une variante reprend exactement les bits de peering. `null`
       * pour toute disposition sans jeu de masques (17 pièces, mur).
       */
      function fullTileOfLayout(tilesetType) {
        if (tilesetType === "topdown-15") {
          for (let row = 0; row < layout.length; row += 1) {
            for (let col = 0; col < layout[row].length; col += 1) {
              if (layout[row][col] === 15) return { mask: 15, col, row };
            }
          }
          return null;
        }
        if (tilesetType === "blob-47") {
          const p = atlasPosition(B47, B47.fullMask);
          return { mask: B47.fullMask, col: p.col, row: p.row };
        }
        if (tilesetType === "edge-16") {
          const p = atlasPosition(E16, E16.fullMask);
          return { mask: E16.fullMask, col: p.col, row: p.row };
        }
        return null;
      }

      // 3 est la borne « utile » de la tranche, et c'est aussi une borne DE SÛRETÉ : les
      // variantes occupent les premières colonnes de leur ligne neuve, et la plus
      // étroite des dispositions concernées (W16, E16) n'a que 4 colonnes. Au-delà de 3,
      // une variante déborderait hors de l'atlas et ne serait simplement jamais rendue —
      // silencieusement, puisque la boucle de pixels ne visite que les colonnes de la
      // largeur annoncée. On coupe donc net à 3 plutôt que de laisser ce piège ouvert.
      function clampVariants(variants) {
        const n = Math.round(variants || 0);
        return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
      }

      // Bornée à 8, la borne « utile » de l'énoncé, et à rien d'autre : les images
      // descendent en COLONNE sous la tuile de base (voir animationRowStride), donc
      // l'atlas s'allonge d'autant de lignes qu'il en faut et aucune image ne peut
      // sortir de la largeur. C'est la différence avec clampVariants, qui doit bien
      // tenir dans la largeur publiée puisque les variantes, elles, occupent une ligne.
      function clampAnimatedFrames(tilesetType, animatedFrames) {
        const n = Math.round(animatedFrames || 0);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.min(8, n);
      }

      /**
       * Pas vertical, en cases, entre deux images d'animation consécutives.
       *
       * **Contrainte du moteur, mesurée sur Godot 4.7.2 headless et non déduite de la
       * documentation** (`TileSetAtlasSource.get_tile_texture_region`) :
       *
       *   - l'image 0 d'une tuile animée EST la case de la tuile elle-même — jamais une
       *     case ailleurs dans l'atlas, il n'y a aucun réglage pour la déplacer ;
       *   - `animation_columns = 1` empile les images vers le BAS, `= 0` les aligne vers
       *     la DROITE ;
       *   - `animation_separation` se compte en CASES d'atlas, pas en pixels : à
       *     `columns = 1` et `separation = (0, 2)`, les images tombent sur les lignes
       *     1, 4, 7 — pas 1, 2, 3 ;
       *   - si une image tomberait sur une case déjà déclarée, Godot REFUSE tout le
       *     réglage et laisse la tuile à une seule image, en silence côté rendu.
       *
       * D'où la disposition retenue : les images descendent dans la COLONNE de la tuile
       * pleine, avec le plus petit pas qui fait tomber l'image 1 sous tout ce qui est déjà
       * occupé — la grille de la disposition, plus la ligne des variantes si elle existe.
       * La largeur de l'atlas ne bouge donc pas (les `tileid` Tiled des tuiles existantes
       * sont calculés dessus), et aucune case déjà peinte n'est recouverte.
       *
       * En blob le pas vaut 1 — la tuile pleine est déjà sur la dernière ligne, les images
       * se suivent sans trou. En 15 pièces il vaut 3, donc deux lignes vides entre deux
       * images : du transparent, que le PNG ne paie presque pas, contre la garantie que le
       * moteur trouve ses images là où on les a peintes.
       */
      function animationRowStride(tilesetType, variants = 0) {
        const target = fullTileOfLayout(tilesetType);
        if (!target) return 0;
        const base = TILESET_LAYOUTS[tilesetType];
        return base.rows + (clampVariants(variants) > 0 ? 1 : 0) - target.row;
      }

      // Forme d'atlas d'une disposition, en cases. Un type inconnu retombe sur le 4 × 4
      // historique : l'appelant reçoit une image plutôt qu'une exception.
      //
      // `variants` (0 par défaut) ajoute UNE ligne sous la grille publiée par
      // tile-masks.js, seulement quand la disposition a une tuile pleine identifiable.
      // À 0 — le réglage de tous les appelants existants (public/exports.js,
      // public/tools.js), qui n'ont pas à connaître les variantes pour continuer à lire
      // la bonne forme — rien ne change : l'atlas garde sa taille au bit près.
      //
      // `animatedFrames` (0 par défaut, tranche T10) allonge l'atlas jusqu'à la dernière
      // image de l'animation, qui descend dans la colonne de la tuile pleine par pas de
      // `animationRowStride` — voir son commentaire pour la contrainte Godot qui impose
      // cette disposition. On prend le maximum plutôt qu'une somme : la première image
      // occupe une case DÉJÀ comptée (celle de la tuile pleine), et les suivantes peuvent
      // s'arrêter avant le bas d'une ligne de variantes existante.
      // Même garde que pour les variantes : sans tuile pleine identifiable, ou à 0, rien
      // ne change.
      //
      // `atlasCopies` (0 par défaut, tranche T10 bis) multiplie la HAUTEUR par le nombre
      // de copies de phase : l'atlas animé est l'atlas de base répété verticalement,
      // chaque copie à une phase différente. Il prime sur `animatedFrames` — les deux
      // mécanismes descendent sous l'atlas et ne peuvent pas s'y superposer proprement,
      // voir clampAtlasCopies.
      //
      // `decor` (tranche T27, « aucun » par défaut) ajoute SES lignes tout à la fin,
      // après les variantes, après les images, après les copies de phase. C'est la
      // règle qui lui permet de coexister avec les trois : aucun des mécanismes
      // précédents ne compte de ligne au-delà de ce que `atlasRowsSansDecor` rend,
      // donc aucun ne peut réclamer une ligne de décor, et le décor n'en déplace
      // aucune. À « aucun », `decorRowCount` vaut 0 et cette fonction est
      // rigoureusement celle d'avant la tranche.
      function atlasRowsSansDecor(tilesetType, variants = 0, animatedFrames = 0, atlasCopies = 0) {
        const found = TILESET_LAYOUTS[tilesetType] || TILESET_LAYOUTS["topdown-15"];
        const target = fullTileOfLayout(tilesetType);
        const variantRow = clampVariants(variants) > 0 && target ? 1 : 0;
        const copies = clampAtlasCopies(tilesetType, atlasCopies);
        if (copies > 0) return (found.rows + variantRow) * copies;
        const count = target ? clampAnimatedFrames(tilesetType, animatedFrames) : 0;
        const lastFrameRow =
          count > 0 ? target.row + (count - 1) * animationRowStride(tilesetType, variants) : -1;
        return Math.max(found.rows + variantRow, lastFrameRow + 1);
      }

      function atlasShape(tilesetType, variants = 0, animatedFrames = 0, atlasCopies = 0, decor = "aucun") {
        const found = TILESET_LAYOUTS[tilesetType] || TILESET_LAYOUTS["topdown-15"];
        return {
          columns: found.columns,
          rows: atlasRowsSansDecor(tilesetType, variants, animatedFrames, atlasCopies) + decorRowCount(decor),
        };
      }

      // Un grand nombre premier, sans autre vertu que d'éviter tout chevauchement avec
      // les décalages de graine déjà en usage ailleurs dans ce fichier (113, 421, 809,
      // 1607…) : n'importe quel écart aurait tout aussi bien décorrélé le hachage.
      const VARIANT_GRAIN_STEP = 104729;

      /**
       * Graine de GRAIN d'une variante — jamais la graine de bruit de BORD, qui reste
       * celle de l'atlas (voir fullTilePixelColor plus bas, dans renderLogical) : c'est
       * cette dernière qui pilote sdf + edgeNoise, donc la silhouette. En ne décalant
       * que celle-ci, une variante reste, contour pour contour, un calque exact de
       * l'originale ; seuls le niveau de teinte et le placement des taches bougent.
       */
      function variantGrainSeed(seed, variantIndex) {
        return seed + variantIndex * VARIANT_GRAIN_STEP;
      }

      // Déphasage de TEXTURE d'une variante — tranche T13. Neutre par défaut : tant que
      // l'appelant ne déclare pas `settings.texturePhase`, il vaut (0, 0) et la lecture
      // de texture reste exactement celle de la tuile d'origine.
      const NO_TEXTURE_PHASE = { tx: 0, ty: 0 };

      /**
       * Le pas de phase, en pixels, que la variante `variantIndex` applique à la lecture
       * de sa texture de surface.
       *
       * Pourquoi il fallait ce canal, et pourquoi la seule graine de grain ne suffisait
       * pas : `texelAt` ne lit que (lx, ly) — c'est L'INVARIANT DE L'ESTAMPAGE, la raison
       * même pour laquelle deux tuiles voisines se raccordent. Une variante décalée en
       * graine rejoue donc son bruit de teinte, mais retombe texel pour texel sur le même
       * motif : sur une matière texturée — et c'est devenu le cas par défaut depuis les
       * matières intégrées — elle ne se distingue quasiment pas de l'originale. Le seul
       * canal qui montre un AUTRE bout de la matière est la phase de lecture.
       *
       * Ce que ce décalage coûte, et à qui : la texture est rebouclée sur la taille de
       * tuile, donc une variante déphasée reste raccordable avec elle-même et avec une
       * autre variante de même phase — mais plus avec la tuile normale d'à côté, où le
       * motif reprend ailleurs. C'est invisible sur une matière organique et criant sur
       * une grille. D'où l'invariant posé côté matières (`dephasable`,
       * public/tile-materials.js) : c'est l'appelant qui décide, par `settings.texturePhase`,
       * et le moteur ne déphase jamais de sa propre initiative.
       *
       * Borne du tirage : chaque axe tombe dans [T/4, 3T/4]. Ce n'est pas une commodité —
       * un hachage laissé libre rend de temps en temps un décalage de 1 ou 2 px, c'est-à-dire
       * une variante visuellement identique à l'originale, exactement le défaut que la
       * tranche corrige. On garantit donc un quart de tuile au minimum sur chaque axe,
       * dans les deux sens.
       */
      function variantTexturePhase(size, variantIndex, seed) {
        const quart = Math.max(1, Math.round(size / 4));
        const plage = Math.max(1, size - 2 * quart + 1);
        return {
          tx: quart + Math.floor(hash2(variantIndex, 1, seed + 2753) * plage),
          ty: quart + Math.floor(hash2(variantIndex, 2, seed + 2753) * plage),
        };
      }

      /**
       * Ce que l'atlas porte en variantes de la tuile pleine — le descripteur que
       * l'export (hors de cette tranche) consommera pour écrire `probability` côté
       * Godot comme côté Tiled. Par case neuve : sa position, le masque dont elle est
       * une variante — donc les bits de peering / le wangid à y recopier tels quels,
       * voir la décision d'architecture ci-dessus — et sa probabilité suggérée.
       *
       * Convention de probabilité retenue ici : l'originale et ses variantes se
       * partagent une masse de 1, à parts égales — `1 / (1 + variants)` chacune. Rien
       * n'imposait ce total-là : `probability` est un poids RELATIF aussi bien chez
       * Godot que chez Tiled, un lot {1, 1, 1} tire exactement comme un lot
       * {⅓, ⅓, ⅓}. On fixe cette convention parce qu'elle se dit en une phrase —
       * l'originale n'est pas favorisée, chaque version a une chance égale d'être
       * tirée — plutôt que de laisser chaque format d'export réinventer sa propre
       * normalisation.
       *
       * `null` si la disposition n'a pas de tuile pleine identifiable, ou si
       * `variants` vaut 0 : l'atlas n'a alors pas changé, rien à décrire.
       */
      function variantAtlasDescriptor(tilesetType, variants) {
        const count = clampVariants(variants);
        const target = count > 0 ? fullTileOfLayout(tilesetType) : null;
        if (!target) return null;
        const base = TILESET_LAYOUTS[tilesetType];
        const probability = 1 / (count + 1);
        return {
          tilesetType,
          mask: target.mask,
          original: { col: target.col, row: target.row, probability },
          variants: Array.from({ length: count }, (_, i) => ({
            col: i,
            row: base.rows,
            mask: target.mask,
            probability,
          })),
        };
      }

      // ===========================================================================
      // Tuiles animées — tranche T10.
      // ===========================================================================
      //
      // Décision d'architecture de la session orchestratrice, appliquée telle quelle,
      // non rediscutée ici : on anime la TUILE PLEINE du jeu courant — exactement la même
      // cible que les variantes ci-dessus (fullTileOfLayout), pour la même raison : c'est
      // elle qui couvre les grandes surfaces (eau, lave, herbes hautes), là où une
      // animation se voit. Les images vont sur une ligne neuve dédiée, ajoutée sous
      // l'atlas — après la ligne de variantes si elle existe, jamais à sa place — aux
      // colonnes 0..N-1, colonnes restantes transparentes. `animation_columns` (exposé
      // par le descripteur plus bas) vaut N : les images restent sur cette seule ligne,
      // aucun rebouclage vers la ligne suivante.

      // Rayon du déphasage circulaire, en mailles du bruit de teinte (shadeLattice) — voir
      // animationPhase juste en dessous. Choisi par la mesure, pas à l'oeil : seamlessFbm
      // interpole ENTRE quatre coins de maille hachés, indépendants les uns des autres —
      // un déphasage qui reste dans une même maille (R ≲ 1) varie donc en douceur avec
      // l'écart angulaire, alors qu'un déphasage qui saute plusieurs mailles retombe sur
      // des coins hachés sans rapport, où la « distance d'image » cesse de suivre la
      // distance angulaire. 0,5 est le plus grand rayon testé (balayage 0,15 à 3, un pas
      // de tests/tileset.test.mjs à l'appui) qui reste dans ce régime lisse sur les trois
      // dispositions : au-delà, la propriété de boucle (voir animationPhase) se vérifie
      // encore EN MOYENNE sur beaucoup de graines mais plus graine par graine, ce qui
      // aurait rendu l'essai qui la mesure fragile sans rien changer au rendu par défaut.
      const ANIMATION_PHASE_RADIUS = 0.5;

      /**
       * Déphasage d'une image d'animation — dans le domaine du bruit de TEINTE (level) et
       * des taches, jamais dans celui du CONTOUR (voir fullTilePixelColor plus bas : `sdf`
       * et `edgeNoise` ne reçoivent jamais ce déphasage, exactement comme une variante ne
       * décale jamais sa graine de bord). C'est la différence avec `variantGrainSeed` :
       * une variante saute à une graine décorrélée (les hachages ne sont pas continus en
       * graine, donc rien ne les rapproche) ; une image d'animation, elle, DOIT boucler
       * proprement, donc on décale une COORDONNÉE — continue par construction, grâce à
       * l'interpolation de seamlessFbm — plutôt qu'une graine.
       *
       * Le déphasage est un point qui tourne sur un cercle de rayon ANIMATION_PHASE_RADIUS :
       * l'image 0 est à l'angle 0, et l'écart angulaire entre deux images consécutives est
       * 2π / N. Comme l'image N (jamais rendue — le cycle boucle sur l'image 0) reviendrait
       * exactement au point de départ, la DERNIÈRE image (N-1) n'est qu'à 2π/N de la
       * première, alors que deux images à l'opposé du cycle en sont à π, la moitié du tour.
       *
       * Dans l'espace de la PHASE, c'est une propriété de géométrie pure et exacte : sur un
       * cercle, la longueur de la corde entre deux points croît avec leur écart angulaire
       * tant que celui-ci reste sous un demi-tour (corde = 2·R·sin(écart/2), croissante sur
       * [0, π]) — quels que soient R > 0 et N ≥ 2, la dernière image part TOUJOURS d'un
       * point plus proche du premier que deux points opposés du cycle ne le sont entre eux.
       * Ce que devient cette distance de PHASE une fois passée par le bruit haché puis la
       * quantification en teintes n'a plus cette garantie exacte pixel par pixel (voir le
       * commentaire d'ANIMATION_PHASE_RADIUS ci-dessus) — mais elle tient nettement, en
       * moyenne, au rayon retenu : la boucle ne saute pas. tests/tileset.test.mjs mesure cette
       * propriété sur l'atlas réellement rendu plutôt que de la tenir pour acquise.
       */
      // Le cercle est TRANSLATÉ pour passer par l'origine : l'image 0 est exactement à
      // (0, 0), donc elle rend la tuile pleine au bit près. Ce n'est pas un détail
      // d'élégance — l'image 0 d'une tuile animée EST la case de la tuile pleine côté
      // Godot (voir animationRowStride), la même case que l'atlas non animé peint : sans
      // cette translation, activer l'animation changerait l'aspect de la tuile au repos.
      // Une translation ne change aucune distance entre deux points du cercle, donc la
      // propriété de boucle démontrée ci-dessus tient identiquement.
      function animationPhase(frameIndex, frameCount) {
        const theta = (2 * Math.PI * frameIndex) / frameCount;
        return {
          dx: ANIMATION_PHASE_RADIUS * (Math.cos(theta) - 1),
          dy: ANIMATION_PHASE_RADIUS * Math.sin(theta),
          // Jamais de déphasage de BORD ici, et c'est tout le sujet de la limite connue
          // de T10 : la silhouette d'une tuile animée doit rester celle de ses voisines
          // statiques. Seule la tranche T10 bis, qui anime l'atlas entier, peut bouger
          // ce canal-là — voir atlasPhase.
          ex: 0,
          ey: 0,
          // Marque l'appel comme venant d'une image d'animation : une variante partage le
          // même paramètre mais ne doit jamais recevoir l'ondulation, elle n'a pas de
          // voisine dans le temps avec qui boucler.
          animated: true,
        };
      }

      // Durée par image par défaut, en millisecondes (5 images par seconde) : un repère
      // raisonnable pour de l'eau ou de la lave qui respire doucement, jamais imposé —
      // public/tools.js expose un réglage qui le remplace.
      const DEFAULT_ANIMATION_FRAME_DURATION_MS = 200;

      /**
       * Ce que l'atlas porte en images d'animation de la tuile pleine du jeu courant — sur
       * le modèle de variantAtlasDescriptor : la ligne neuve où les images sont rendues,
       * leur nombre, `animation_columns` (toujours égal à ce nombre, voir plus haut) et la
       * durée suggérée par image. `null` dans les mêmes conditions que variantAtlasDescriptor
       * — pas de tuile pleine identifiable, ou `animatedFrames` à 0 — pour que l'appelant
       * sache qu'il n'y a rien à décrire, exactement comme pour les variantes.
       *
       * `variants` (0 par défaut) dit si la ligne des variantes existe déjà : elle occupe
       * la première ligne libre, donc elle allonge le pas vertical d'un cran — voir
       * animationRowStride.
       *
       * `mask` est le masque de la tuile pleine, celui que public/tools.js doit utiliser
       * pour indexer `animations` auprès des écrivains de public/exports.js. Ceux-ci
       * retrouvent la case de base depuis la position historique de ce masque dans
       * public/tile-masks.js — et c'est exactement la case de l'image 0, ce qui n'est pas
       * une coïncidence mais la contrainte du moteur (voir animationRowStride). Les deux
       * réglages qui disent au moteur où sont les images suivantes, `animationColumns` et
       * `separation`, sont donnés ici : ils doivent être recopiés tels quels dans la spec
       * d'export, sans quoi le moteur ira chercher ses images ailleurs.
       */
      function animationAtlasDescriptor(tilesetType, animatedFrames, variants = 0, frameDurationMs = DEFAULT_ANIMATION_FRAME_DURATION_MS) {
        const count = clampAnimatedFrames(tilesetType, animatedFrames);
        const target = count > 0 ? fullTileOfLayout(tilesetType) : null;
        if (!target) return null;
        const rowStride = animationRowStride(tilesetType, variants);
        return {
          tilesetType,
          mask: target.mask,
          col: target.col,
          row: target.row,
          count,
          // 1 = empilement vertical ; separation se compte en cases, et vaut le pas
          // moins la case de la tuile elle-même. Mesuré sur Godot 4.7.2, pas déduit.
          animationColumns: 1,
          separation: [0, rowStride - 1],
          rowStride,
          frameDurationMs,
          frames: Array.from({ length: count }, (_, i) => ({
            col: target.col,
            row: target.row + i * rowStride,
          })),
        };
      }

      // ===========================================================================
      // Animer l'atlas ENTIER — tranche T10 bis.
      // ===========================================================================
      //
      // Ce que T10 a mesuré et qui condamne son propre mécanisme : une tuile animée au
      // milieu de tuiles statiques ne peut pas bouger sans se désaccorder de ses
      // voisines. Pousser l'amplitude faisait sauter le pixel de couture jusqu'à
      // 53/255 partout où l'eau animée touche un bord non animé. Ce n'est pas un
      // réglage à corriger, c'est la forme qui est fausse.
      //
      // La forme qui tient : l'atlas animé est N COPIES VERTICALES DE L'ATLAS ENTIER,
      // chacune à une phase différente. Trois conséquences, toutes par construction :
      //
      //  * le pas vertical entre deux images d'une même tuile vaut le nombre de lignes
      //    de l'atlas de base — le MÊME pour toutes les tuiles, donc aucune image ne
      //    peut tomber sur une case déjà déclarée (la case de la tuile (c, r) en copie k
      //    est (c, r + k·S) avec 0 ≤ r < S : deux images coïncident seulement si elles
      //    sont la même). C'est la condition exacte sous laquelle Godot accepte
      //    l'animation — voir animationRowStride pour ce que coûte de la rater ;
      //  * toutes les tuiles bougent sur la même horloge Godot : il n'y a plus de
      //    voisine statique, donc plus de couture à désaccorder ;
      //  * l'amplitude peut enfin porter sur le BRUIT DE BORD, c'est-à-dire sur la
      //    silhouette elle-même. Décaler une coordonnée d'un bruit qui reboucle sur la
      //    tuile laisse ce bruit rebouclé : les deux côtés d'une couture lisent la même
      //    valeur qu'avant, à ceci près qu'ils la lisent ailleurs — ensemble. C'est ce
      //    canal-là, et non le bruit de teinte, qui fait qu'on VOIT l'animation (T10
      //    mesurait 4 % de pixels changés sur la teinte seule, et 7 % en poussant le
      //    rayon douze fois plus loin : la teinte n'était pas le levier).
      //
      // Coût assumé : la hauteur de l'atlas est multipliée par N.

      // Ce qui se règle ici n'est PAS le rayon du cercle de phase mais le PAS entre deux
      // images consécutives — la corde, en mailles de bruit. Le rayon s'en déduit
      // (atlasPhaseRadius). Mesuré, et c'est la correction que cette tranche a payée :
      //
      //  * à rayon fixe, l'animation change de vitesse quand on change le nombre
      //    d'images. À 4 copies, deux images voisines sont à 1,41 R l'une de l'autre ;
      //    à 8 copies, à 0,77 R. Le même réglage donnait donc une saccade à 4 images et
      //    un frémissement à 8 — alors que le sens du réglage, pour qui s'en sert, est
      //    « la longueur de la boucle », pas « la vitesse ».
      //  * et surtout : seamlessFbm interpole ENTRE quatre coins de maille hachés
      //    (voir ANIMATION_PHASE_RADIUS, T10). Tant que le pas reste dans la maille,
      //    deux images voisines se ressemblent, donc ça COULE. Au-delà, elles tombent
      //    sur des coins sans rapport et l'animation devient un grésillement. C'est le
      //    pas, pas le rayon, qui décide de ce régime — d'où ce paramétrage.
      //
      // Un demi-maille de teinte et un quart de maille de bord : le plus grand pas
      // mesuré qui reste dans le régime lisse sur les trois dispositions.
      const ATLAS_ANIMATION_SHADE_STEP = 0.55;
      const ATLAS_ANIMATION_EDGE_STEP = 0.25;

      // Rayon du cercle qui donne ce pas-là : corde = 2·R·sin(π/N).
      function atlasPhaseRadius(step, copyCount) {
        return step / (2 * Math.sin(Math.PI / copyCount));
      }

      // Bornée à 8 comme clampAnimatedFrames, et refusée en dessous de 2 : une copie
      // unique n'est pas une animation, c'est l'atlas. 0 et 1 valent donc « désactivé ».
      // Même porte que T10 sur la disposition : sans tuile pleine identifiable (17
      // pièces, mur), le mécanisme ne s'applique pas — voir le commentaire de
      // atlasAnimationDescriptor pour la raison, qui est la même que celle de T10.
      function clampAtlasCopies(tilesetType, copies) {
        const n = Math.round(copies || 0);
        if (!Number.isFinite(n) || n < 2) return 0;
        if (!fullTileOfLayout(tilesetType)) return 0;
        return Math.min(8, n);
      }

      // Hauteur d'UNE copie, en cases : la disposition, plus la ligne de variantes si
      // elle existe. C'est aussi le pas vertical de l'animation, et c'est le même pour
      // toutes les tuiles — d'où la garantie de non-recouvrement ci-dessus.
      function atlasCopyRows(tilesetType, variants = 0) {
        const base = TILESET_LAYOUTS[tilesetType] || TILESET_LAYOUTS["topdown-15"];
        return base.rows + (clampVariants(variants) > 0 && fullTileOfLayout(tilesetType) ? 1 : 0);
      }

      /**
       * Déphasage de la copie `copyIndex`. Même géométrie que animationPhase (T10) — un
       * point sur un cercle translaté pour passer par l'origine, donc la copie 0 rend
       * l'atlas de base AU BIT PRÈS — avec deux différences :
       *
       *  * il porte aussi `ex`/`ey`, le déphasage du bruit de BORD, que T10 ne pouvait
       *    pas se permettre (sa tuile animée avait des voisines statiques) ;
       *  * son rayon se déduit du PAS voulu et du nombre de copies, au lieu d'être fixe.
       *
       * La propriété de boucle est ici plus forte que celle de T10, et c'est le pas
       * constant qui la donne : sur un cercle, les N cordes entre images consécutives
       * sont TOUTES égales, y compris celle qui referme le cycle (image N-1 → image 0).
       * La boucle ne peut donc pas sauter au raccord, quel que soit le rayon et quel que
       * soit le régime du bruit — là où la formulation de T10 (« la dernière image est
       * plus proche de la première que deux images opposées ») n'est vraie que dans le
       * régime lisse. tests/tileset.test.mjs mesure l'uniformité des pas sur l'atlas
       * réellement rendu, raccord compris.
       */
      function atlasPhase(copyIndex, copyCount) {
        const theta = (2 * Math.PI * copyIndex) / copyCount;
        const rShade = atlasPhaseRadius(ATLAS_ANIMATION_SHADE_STEP, copyCount);
        const rEdge = atlasPhaseRadius(ATLAS_ANIMATION_EDGE_STEP, copyCount);
        return {
          dx: rShade * (Math.cos(theta) - 1),
          dy: rShade * Math.sin(theta),
          ex: rEdge * (Math.cos(theta) - 1),
          ey: rEdge * Math.sin(theta),
          animated: true,
        };
      }

      /**
       * Ce que l'atlas porte en copies de phase — le descripteur que public/exports.js
       * consomme pour écrire LA MÊME déclaration d'animation sur TOUTES les tuiles du
       * jeu (option `atlasAnimation`), ce qui est la différence mécanique avec T10 qui
       * n'en animait qu'une.
       *
       * `separation` vaut `copyRows - 1` en CASES (le pas moins la case de la tuile
       * elle-même), `columns` vaut 1 : la mesure de T10 sur Godot 4.7.2 vaut ici sans
       * changement, seule la valeur du pas change. `rows` est la hauteur physique de
       * l'atlas — l'export Tiled en a besoin pour déclarer son `<image>`, sans quoi il
       * annonce un atlas plus court que les `tileid` qu'il référence.
       *
       * `null` quand il n'y a rien à décrire : moins de 2 copies, ou disposition sans
       * tuile pleine identifiable — `fullTileOfLayout` n'a rien à offrir au mur, qui
       * n'a pas de jeu de masques. Ses bandes basses ne partagent de toute façon pas
       * la géométrie du dessus (voir wallBandPixelColor : depuis T25, la base LIT
       * bien le même bruit de teinte que la face, mais l'ombre garde la sienne, à
       * part) — une phase y déraccorderait ce que rien, ici, ne demande d'accorder.
       */
      function atlasAnimationDescriptor(
        tilesetType,
        atlasCopies,
        variants = 0,
        frameDurationMs = DEFAULT_ANIMATION_FRAME_DURATION_MS,
      ) {
        const count = clampAtlasCopies(tilesetType, atlasCopies);
        if (!count) return null;
        const copyRows = atlasCopyRows(tilesetType, variants);
        return {
          tilesetType,
          count,
          copyRows,
          rows: copyRows * count,
          animationColumns: 1,
          separation: [0, copyRows - 1],
          frameDurationMs,
          frames: Array.from({ length: count }, () => frameDurationMs / 1000),
        };
      }

      // Le déphasage nul, partagé par tous les chemins de couleur : c'est LUI le
      // comportement d'avant cette tranche, et c'est parce qu'il est le défaut de chaque
      // fonction qu'aucune empreinte existante ne bouge.
      const NO_PHASE = { dx: 0, dy: 0, ex: 0, ey: 0 };

      // Corner bits: TL = 1, TR = 2, BL = 4, BR = 8. Each tile is a union of the
      // filled quadrants. A quadrant side bleeds (extends to the tile edge) when the
      // region across it is grass — either outside the tile (so neighbours connect) or
      // a filled quadrant inside the tile (so the seam merges). A side facing empty
      // space is the only place the silhouette, rounding, and roughness appear.
      const quadrants = [
        { bit: 1, col: 0, row: 0 },
        { bit: 2, col: 1, row: 0 },
        { bit: 4, col: 0, row: 1 },
        { bit: 8, col: 1, row: 1 },
      ];

      function bitAt(col, row) {
        if (col < 0 || col > 1 || row < 0 || row > 1) return -1; // outside tile = always grass
        return 1 << (row * 2 + col);
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function lerp(a, b, t) {
        return a + (b - a) * t;
      }

      function smoothstep(t) {
        return t * t * (3 - 2 * t);
      }

      // Smooth minimum: like Math.min but rounds the concave junction where two shapes
      // meet, by radius ~k. Used to union the quadrant boxes so inner notch corners
      // round inward instead of meeting at a sharp 90 degrees.
      function smin(a, b, k) {
        if (k <= 0) return Math.min(a, b);
        const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
        return lerp(b, a, h) - k * h * (1 - h);
      }

      function hexToRgb(hex) {
        const clean = hex.replace("#", "");
        return {
          r: parseInt(clean.slice(0, 2), 16),
          g: parseInt(clean.slice(2, 4), 16),
          b: parseInt(clean.slice(4, 6), 16),
        };
      }

      function mixColor(a, b, t) {
        const amount = clamp(t, 0, 1);
        return {
          r: Math.round(lerp(a.r, b.r, amount)),
          g: Math.round(lerp(a.g, b.g, amount)),
          b: Math.round(lerp(a.b, b.b, amount)),
        };
      }

      function shadeColor(color, amount) {
        return {
          r: clamp(Math.round(color.r + amount), 0, 255),
          g: clamp(Math.round(color.g + amount), 0, 255),
          b: clamp(Math.round(color.b + amount), 0, 255),
        };
      }

      function hash2(x, y, seed) {
        let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      }

      function valueNoise(x, y, seed) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const tx = smoothstep(x - xi);
        const ty = smoothstep(y - yi);
        const a = hash2(xi, yi, seed);
        const b = hash2(xi + 1, yi, seed);
        const c = hash2(xi, yi + 1, seed);
        const d = hash2(xi + 1, yi + 1, seed);
        return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
      }

      function fbm(x, y, seed) {
        let total = 0;
        let amp = 0.55;
        let freq = 1;
        let norm = 0;
        for (let i = 0; i < 4; i += 1) {
          total += valueNoise(x * freq, y * freq, seed + i * 71) * amp;
          norm += amp;
          amp *= 0.5;
          freq *= 2;
        }
        return total / norm;
      }

      // Bruit raccordable : la même fonction pour toutes les tuiles, et périodique sur
      // exactement une tuile. C'est le pendant, côté silhouette, de l'invariant de
      // l'estampage de texture — la période doit diviser la taille de tuile, sinon la
      // phase change d'une case de carte à l'autre et la couture réapparaît.
      //
      // Pourquoi les modes 15 et 17 s'en passent : chez eux, tout bord raccordable
      // déborde de `ext`, si bien que le bruit ne se voit que sur la silhouette — jamais
      // sur une couture. Le blob, lui, a des bords qui rentrent (côté sans voisin) et des
      // encoches qui mordent le bord de tuile : ces frontières-là tombent EN FACE de
      // celles de la tuile d'à côté. Un bruit qui changerait de graine d'une tuile à
      // l'autre y ouvrirait une marche que rien ne rattraperait.
      //
      // `period` compte des mailles du réseau entier, pas des pixels. Chaque octave
      // reboucle sur `period × freq` : elles rebouclent donc toutes ensemble, pile à la
      // tuile, au lieu de battre les unes contre les autres.
      function wrapLattice(value, period) {
        const m = value % period;
        return m < 0 ? m + period : m;
      }

      function seamlessValueNoise(x, y, seed, period) {
        const xi = Math.floor(x);
        const yi = Math.floor(y);
        const tx = smoothstep(x - xi);
        const ty = smoothstep(y - yi);
        const x0 = wrapLattice(xi, period);
        const x1 = wrapLattice(xi + 1, period);
        const y0 = wrapLattice(yi, period);
        const y1 = wrapLattice(yi + 1, period);
        const a = hash2(x0, y0, seed);
        const b = hash2(x1, y0, seed);
        const c = hash2(x0, y1, seed);
        const d = hash2(x1, y1, seed);
        return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
      }

      function seamlessFbm(x, y, seed, period) {
        let total = 0;
        let amp = 0.55;
        let freq = 1;
        let norm = 0;
        for (let i = 0; i < 4; i += 1) {
          total += seamlessValueNoise(x * freq, y * freq, seed + i * 71, period * freq) * amp;
          norm += amp;
          amp *= 0.5;
          freq *= 2;
        }
        return total / norm;
      }

      // Signed distance to an axis-aligned box [l,t,r,b] with corners rounded by `radius`.
      // Flat sides sit exactly on the box bounds; only corners curve inward.
      function roundedBoxSdf(px, py, l, t, r, b, radius) {
        const cx = (l + r) * 0.5;
        const cy = (t + b) * 0.5;
        const hx = (r - l) * 0.5;
        const hy = (b - t) * 0.5;
        const rad = Math.min(radius, hx, hy);
        const qx = Math.abs(px - cx) - (hx - rad);
        const qy = Math.abs(py - cy) - (hy - rad);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
        const inside = Math.min(Math.max(qx, qy), 0);
        return outside + inside - rad;
      }

      // Each quadrant's interior sides reach past the tile centre by OVERLAP * tile.
      // That widens the bands slightly (the reference divides sit near 0.58, not 0.5)
      // and, crucially, makes diagonal tiles (TL+BR, TR+BL) overlap into one connected
      // shape with a centre bridge instead of pinching at a single point.
      const OVERLAP = 0.09;

      function maskSdf(mask, x, y, tileSize, radius, roughness) {
        const half = tileSize * 0.5;
        const ov = OVERLAP * tileSize;
        // Push only the outer (tile-edge) sides out by this much so neither the corner
        // rounding nor the edge noise ever bites into a bleeding edge; tiles stay
        // connectable. Interior sides are left in place: they merge with filled
        // neighbours through the `ov` overlap and round where they face empty space.
        const ext = radius + roughness + 1;
        let dist = null;
        for (const q of quadrants) {
          if ((mask & q.bit) === 0) continue;

          let l = q.col === 0 ? 0 - ext : half - ov;
          let r = q.col === 1 ? tileSize + ext : half + ov;
          let t = q.row === 0 ? 0 - ext : half - ov;
          let b = q.row === 1 ? tileSize + ext : half + ov;

          // Smooth union so the inner corners of notch tiles round inward (concave)
          // by the same radius, matching the convex rounding of single corners.
          const d = roundedBoxSdf(x, y, l, t, r, b, radius);
          dist = dist === null ? d : smin(dist, d, radius);
        }
        return dist === null ? 9999 : dist;
      }

      // Distance from a point to the nearest empty region in the tile, built as the
      // mirror of the grass quadrants (each empty quadrant pulled back by `ov` where a
      // filled quadrant overlaps into it). Evaluated only at grass pixels, so the union
      // by Math.min is exact. Drives the edge fade, which then darkens only along the
      // real grass/empty silhouette and never along the seam between two filled
      // quadrants or along a clean bleeding edge.
      function maskVoidSdf(mask, x, y, tileSize, radius) {
        const half = tileSize * 0.5;
        const ov = OVERLAP * tileSize;
        const filled = (nb) => nb !== -1 && (mask & nb) !== 0;
        let dist = Infinity;
        for (const q of quadrants) {
          if ((mask & q.bit) !== 0) continue; // empty quadrants only

          const l = q.col === 0 ? 0 : filled(bitAt(q.col - 1, q.row)) ? half + ov : half;
          const r = q.col === 1 ? tileSize : filled(bitAt(q.col + 1, q.row)) ? half - ov : half;
          const t = q.row === 0 ? 0 : filled(bitAt(q.col, q.row - 1)) ? half + ov : half;
          const b = q.row === 1 ? tileSize : filled(bitAt(q.col, q.row + 1)) ? half - ov : half;

          dist = Math.min(dist, roundedBoxSdf(x, y, l, t, r, b, radius));
        }
        return dist;
      }

      function rectPieceSdf(piece, x, y, tileSize, radius, roughness, padding) {
        const ext = radius + roughness + 1;
        const inset = edgeInset(tileSize, padding);
        const l = piece.w ? 0 - ext : inset;
        const r = piece.e ? tileSize + ext : tileSize - inset;
        const t = piece.n ? 0 - ext : inset;
        const b = piece.s ? tileSize + ext : tileSize - inset;
        return roundedBoxSdf(x, y, l, t, r, b, radius);
      }

      function innerCornersSdf(x, y, tileSize, radius, roughness, padding) {
        const ext = radius + roughness + 1;
        const base = roundedBoxSdf(x, y, 0 - ext, 0 - ext, tileSize + ext, tileSize + ext, radius);
        const notch = edgeInset(tileSize, padding);
        const notchRadius = Math.max(1, Math.min(radius, notch * 0.45));
        const notches = [
          roundedBoxSdf(x, y, 0 - ext, 0 - ext, notch, notch, notchRadius),
          roundedBoxSdf(x, y, tileSize - notch, 0 - ext, tileSize + ext, notch, notchRadius),
          roundedBoxSdf(x, y, 0 - ext, tileSize - notch, notch, tileSize + ext, notchRadius),
          roundedBoxSdf(x, y, tileSize - notch, tileSize - notch, tileSize + ext, tileSize + ext, notchRadius),
        ];
        return Math.max(base, -Math.min(...notches));
      }

      function topdown17Sdf(piece, x, y, tileSize, radius, roughness, padding) {
        if (!piece || piece.kind === "empty") return 9999;
        if (piece.kind === "innerCorners") return innerCornersSdf(x, y, tileSize, radius, roughness, padding);
        return rectPieceSdf(piece, x, y, tileSize, radius, roughness, padding);
      }

      // La rentrée d'un bord sans voisin, commune au blob et aux pièces rectangulaires :
      // au moins 1 px pour que la silhouette existe, au plus un tiers de la tuile pour
      // qu'il reste de la matière au milieu.
      function edgeInset(tileSize, padding) {
        return clamp(Math.round(padding), 1, Math.max(1, Math.floor(tileSize * 0.35)));
      }

      // La rentrée du blob, elle, ne descend jamais sous l'amplitude du bruit de bord.
      // En dessous, la frontière du terrain sort de la tuile là où le bruit la pousse : la
      // silhouette n'est plus une forme mais un bord de tuile grignoté au hasard, et le
      // raccord se dégrade — deux tuiles voisines lisent le bruit à un pixel d'écart, et
      // cet écart, rapporté à une rentrée d'un pixel, se voit. Les valeurs du panneau
      // (padding = tile / 8) sont déjà au-dessus du plancher : il ne rattrape que les
      // réglages extrêmes, sans jamais rogner un choix raisonnable.
      function blobInset(tileSize, padding, roughness) {
        const floor = Math.min(1 + Math.ceil(roughness / 2), Math.max(1, Math.floor(tileSize * 0.35)));
        return Math.max(edgeInset(tileSize, padding), floor);
      }

      // Les quatre coins du blob : la diagonale et les deux cardinaux qui l'encadrent.
      const BLOB_CORNERS = [
        { diagonal: NEIGHBOUR_BITS.NW, sides: NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.W, col: 0, row: 0 },
        { diagonal: NEIGHBOUR_BITS.NE, sides: NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.E, col: 1, row: 0 },
        { diagonal: NEIGHBOUR_BITS.SW, sides: NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.W, col: 0, row: 1 },
        { diagonal: NEIGHBOUR_BITS.SE, sides: NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.E, col: 1, row: 1 },
      ];

      // Blob 47 — huit voisins. La tuile est pleine par construction ; ce sont ses bords
      // qui bougent. Une seule boîte arrondie porte les quatre côtés, et les coins
      // intérieurs se creusent par soustraction, exactement comme innerCornersSdf.
      //
      //  * Côté dont le voisin porte le même terrain : le bord DÉBORDE de `ext`. La
      //    couture avec la tuile d'à côté disparaît, et — c'est là tout l'intérêt du
      //    débordement — ni l'arrondi (`radius`) ni l'irrégularité (`roughness`) ne
      //    peuvent revenir mordre à l'intérieur de la tuile : le bord reste connectable
      //    quels que soient les réglages.
      //  * Côté sans voisin : le bord RENTRE de `inset`. C'est là, et seulement là, que
      //    se voient la silhouette, l'arrondi convexe et l'irrégularité.
      //  * Coin dont les deux cardinaux sont présents mais la diagonale absente : une
      //    ENCOCHE concave. C'est le « coin intérieur », la pièce qui distingue un blob
      //    47 d'un simple 16 ; sans elle, quatre cases dont une seule est vide donnent
      //    une tuile pleine et le trou disparaît de la carte.
      //  * Coin dont un cardinal manque : rien de spécial, l'arrondi convexe des deux
      //    bords rentrants suffit. Le bit diagonal n'y est même pas lu — la
      //    canonicalisation de public/tile-masks.js le force à zéro, il ne dirait rien.
      //
      // Pourquoi l'encoche fait exactement `inset` de côté, et pas un réglage à part.
      // Prenons le coin haut-gauche creusé : N et O sont présents, NO absent. La tuile du
      // dessus a donc, elle, son voisin O absent — son bord gauche rentre de `inset`. La
      // tuile de gauche a son voisin N absent — son bord haut rentre de `inset`. Les
      // trois morsures se retrouvent le long des deux mêmes coutures : elles doivent
      // tomber sur la même ligne, sinon on voit une marche. La profondeur de l'encoche
      // est imposée par le raccord ; ce n'est pas un paramètre esthétique.
      function blobSdf(mask, x, y, tileSize, radius, roughness, padding) {
        const ext = radius + roughness + 1;
        const inset = blobInset(tileSize, padding, roughness);
        const l = mask & NEIGHBOUR_BITS.W ? 0 - ext : inset;
        const r = mask & NEIGHBOUR_BITS.E ? tileSize + ext : tileSize - inset;
        const t = mask & NEIGHBOUR_BITS.N ? 0 - ext : inset;
        const b = mask & NEIGHBOUR_BITS.S ? tileSize + ext : tileSize - inset;
        let dist = roundedBoxSdf(x, y, l, t, r, b, radius);

        // L'arrondi de l'encoche reprend celui des coins convexes : deux vocabulaires de
        // forme sur la même carte se repèrent au premier coup d'œil. Il est seulement
        // borné par la profondeur de l'encoche, pour que l'arc reste confiné au coin et
        // laisse le bord de tuile parfaitement plat — un arc qui déborderait jusqu'au
        // bord ne tomberait plus en face de la rentrée droite du voisin.
        const notchRadius = Math.min(radius, Math.max(0, inset - 1));
        for (const corner of BLOB_CORNERS) {
          if ((mask & corner.sides) !== corner.sides) continue;
          if (mask & corner.diagonal) continue;
          const nl = corner.col === 0 ? 0 - ext : tileSize - inset;
          const nr = corner.col === 0 ? inset : tileSize + ext;
          const nt = corner.row === 0 ? 0 - ext : tileSize - inset;
          const nb = corner.row === 0 ? inset : tileSize + ext;
          dist = Math.max(dist, -roundedBoxSdf(x, y, nl, nt, nr, nb, notchRadius));
        }
        return dist;
      }

      // Pénombre des coins rentrants du dessus (T38). Le défaut, nommé dans le plan :
      // rien n'assombrit un coin rentrant du blob, et l'angle se lit comme un pli de
      // papier plutôt que comme un creux. La géométrie de l'encoche existe déjà dans
      // blobSdf ; ce qui manque est la couleur qui la DIT.
      //
      // L'énumération des coins actifs se DÉRIVE de BLOB_CORNERS et de son prédicat —
      // les deux côtés adjacents raccordés, la diagonale entre eux à zéro — jamais
      // recopiée : une liste écrite à la main serait une troisième source de vérité
      // sur la même géométrie que blobSdf porte déjà, et elle diffèrerait en silence
      // le jour où l'une des deux bouge sans l'autre. Comptage de contrôle, tenu par
      // essai : sur les 47 masques du blob, 31 ont au moins un coin rentrant (16 à un
      // coin, 10 à deux, 4 à trois, 1 à quatre — le masque 85, la croix), **52** coins
      // en tout (16×1 + 10×2 + 4×3 + 1×4 ; le plan de la tranche annonçait 50, erreur de
      // somme démentie par l'essai de comptage), et 16 masques n'en reçoivent aucun.
      //
      // La grandeur de pilotage est la SDF de la boîte d'encoche elle-même — celle que
      // blobSdf calcule déjà par coin actif (roundedBoxSdf sur nl/nt/nr/nb) — et non la
      // distance au POINT de coin : une atténuation radiale déborderait sur les bords
      // plats que le raccord avec la tuile voisine exige de laisser intacts, puisque
      // l'encoche est un carré arrondi, pas un point. Ce n'est pas non plus la distance
      // signée globale que rend blobSdf : `edgeAmount`, dans blobPixelColor, la
      // consomme déjà pour assombrir TOUS les bords, convexes compris ; la réutiliser
      // mélangerait l'occlusion d'angle au liseré de silhouette — exactement ce que
      // cette pénombre doit rester la seule à distinguer.
      //
      // nl/nt/nr/nb et notchRadius reprennent EXPRÈS, littéralement, le calcul de la
      // boucle de blobSdf ci-dessus plutôt que d'en factoriser un appel commun : la
      // consigne de la tranche est de ne jamais toucher blobSdf (les six empreintes du
      // blob et de ses voisins en dépendent), donc c'est cette fonction-ci qui duplique,
      // jamais l'inverse. Portée de la rampe : le même calcul de marge que notchRadius
      // (`inset - 1`, jamais l'inset entier) — elle reste ainsi TOUJOURS strictement
      // à l'intérieur de l'encoche, jamais sur le bord plat de la tuile où le raccord
      // avec la case voisine l'exige intact. Cas limite traité, pas ignoré : à
      // `edgeStyle: 'clean'` et aux réglages extrêmes, `roughness` tombe à 0 et `inset`
      // peut ne valoir qu'1 px (blobInset retombe sur edgeInset seul) — la marge tombe
      // alors à 0 et l'occlusion s'éteint proprement plutôt que de sortir de l'encoche.
      //
      // Plusieurs coins actifs sur un même masque (jusqu'à quatre, masque 85) : le plus
      // sombre l'emporte (`Math.max`), pas une somme — les quatre encoches d'un même
      // coin tombent chacune dans son propre quart de tuile et la rampe, plus courte que
      // l'encoche, n'en sort jamais : les zones ne se recouvrent pas, donc max et somme
      // rendent le même résultat partout où une seule rampe est active, et max reste le
      // choix correct si jamais deux rampes venaient à se toucher sur une tuile minuscule.
      function blobCornerOcclusionShade(mask, x, y, tileSize, radius, roughness, padding, max) {
        if (max <= 0) return 0;
        const ext = radius + roughness + 1;
        const inset = blobInset(tileSize, padding, roughness);
        const notchRadius = Math.min(radius, Math.max(0, inset - 1));
        const rampWidth = Math.max(0, inset - 1);
        if (rampWidth <= 0) return 0;
        let shade = 0;
        for (const corner of BLOB_CORNERS) {
          if ((mask & corner.sides) !== corner.sides) continue;
          if (mask & corner.diagonal) continue;
          const nl = corner.col === 0 ? 0 - ext : tileSize - inset;
          const nr = corner.col === 0 ? inset : tileSize + ext;
          const nt = corner.row === 0 ? 0 - ext : tileSize - inset;
          const nb = corner.row === 0 ? inset : tileSize + ext;
          const d = roundedBoxSdf(x, y, nl, nt, nr, nb, notchRadius);
          if (d >= rampWidth) continue;
          const p = 1 - Math.max(0, d) / rampWidth;
          shade = Math.max(shade, p * p * max);
        }
        return shade;
      }

      // Bord 16 — quatre côtés, pour les chemins, clôtures, rails et rivières.
      // Le quart de la tuile : assez large pour porter une texture, assez étroit pour
      // qu'un croisement se lise comme un croisement.
      const EDGE_STROKE_RATIO = 0.25;

      // Bornée à 80 % de la tuile : au-delà il n'y a plus de croisement à lire, et il ne
      // resterait plus assez de place entre le bras et le bord pour y confiner le congé
      // d'union (voir edgeSdf).
      function edgeStrokeHalf(tileSize, strokeWidth) {
        const width = strokeWidth > 0 ? strokeWidth : tileSize * EDGE_STROKE_RATIO;
        return clamp(width, 2, tileSize * 0.8) * 0.5;
      }

      // Un tronçon central, plus un bras vers chaque côté connecté. Le bras traverse le
      // bord de tuile et déborde de `ext`, pour la même raison que partout ailleurs.
      // Comme la demi-épaisseur est la même des deux côtés d'une couture, les deux bandes
      // tombent exactement l'une en face de l'autre — le raccord est acquis sans table.
      //
      // Les bras s'unissent par `smin` et non par `Math.min` : à la patte d'oie d'un
      // croisement, un minimum franc laisse un angle droit rentrant que l'œil lit comme
      // un défaut de découpe. `smin` y pose le même congé que l'arrondi des extrémités.
      //
      // Le rayon du congé est borné à la moitié de la distance qui sépare le bras du bord
      // de tuile, et c'est un point dur, pas une précaution. `smin` ne s'écarte de
      // `Math.min` que là où deux formes passent à moins de `k` l'une de l'autre ; si `k`
      // atteignait une couture, la forme du bord y dépendrait des AUTRES bras — or ils ne
      // sont pas les mêmes des deux côtés d'une couture, et elle s'ouvrirait. Aux valeurs
      // par défaut (bras au quart de la tuile), la borne ne mord sur rien.
      //
      // Le masque 0 n'est pas une case vide mais un tronçon isolé — une borne, un rocher
      // de rivière : c'est ce que Godot pose quand aucun voisin ne se raccorde.
      function edgeSdf(mask, x, y, tileSize, radius, roughness, strokeWidth) {
        const ext = radius + roughness + 1;
        const h = edgeStrokeHalf(tileSize, strokeWidth);
        const c = tileSize * 0.5;
        const rad = Math.min(radius, h);
        const fillet = Math.min(rad, (c - h) * 0.5);
        let dist = roundedBoxSdf(x, y, c - h, c - h, c + h, c + h, rad);
        const arms = [
          [SIDE_BITS.N, c - h, 0 - ext, c + h, c + h],
          [SIDE_BITS.E, c - h, c - h, tileSize + ext, c + h],
          [SIDE_BITS.S, c - h, c - h, c + h, tileSize + ext],
          [SIDE_BITS.W, 0 - ext, c - h, c + h, c + h],
        ];
        for (const [bit, al, at, ar, ab] of arms) {
          if ((mask & bit) === 0) continue;
          dist = smin(dist, roundedBoxSdf(x, y, al, at, ar, ab, rad), fillet);
        }
        return dist;
      }

      // ===========================================================================
      // Mur top-down — géométrie des bandes basses (face, base, ombre).
      // ===========================================================================

      // Distance signée à un flanc à 45°, pour les colonnes 4 et 5 d'une bande basse.
      // Construit comme l'union — via `smin`, déjà utilisé plus haut pour arrondir les
      // coins du blob et la patte d'oie du bord 16 — de deux demi-plans inclinés à 45°
      // qui se croisent à mi-hauteur de la tuile :
      //   upper : la droite passant par (inset, 0), montante vers le bas ;
      //   lower : la droite passant par (inset, tileSize), montante vers le haut.
      // Le flanc s'ouvre plein vers son côté raccordé (il déborde de `ext`, comme tout
      // bord connecté ailleurs dans ce fichier) et se referme vers l'autre côté par un
      // chanfrein dont la base vaut exactement `inset` — la même rentrée que les états
      // orthogonaux — EN HAUT COMME EN BAS. C'est ce qui rend le flanc empilable : la
      // bande face se répète verticalement pour construire la hauteur du mur, et si le
      // haut et le bas d'une même case n'avaient pas la même rentrée, la répétition
      // ferait apparaître une marche à chaque raccord de copie.
      function flankSdf(mirrored, x, y, tileSize, radius, roughness, padding) {
        const inset = edgeInset(tileSize, padding);
        const px = mirrored ? tileSize - x : x;
        const upper = (inset + y - px) / Math.SQRT2;
        const lower = (inset + (tileSize - y) - px) / Math.SQRT2;
        const fillet = Math.min(radius, tileSize * 0.25);
        return smin(upper, lower, fillet);
      }

      // L'emprise d'un état de bande basse : les six états orthogonaux (les quatre de T3
      // plus les deux coins de T37) réutilisent directement rectPieceSdf (déjà éprouvé par
      // le mode 17 pièces) avec le haut et le bas toujours débordants — une bande face n'a
      // pas de dessus ni de dessous à elle, seulement des côtés gauche/droite qui se
      // raccordent ou non. Les deux flancs remplacent cette boîte par le chanfrein de
      // flankSdf.
      //
      // Un coin ne demande RIEN de plus ici, et c'est le point : ses deux côtés sont à
      // `true`, donc il tombe sur la même boîte pleine que `middle` — la matière va jusqu'au
      // bord de la case des deux côtés, et le bord libre arrondi qui faisait la coupure
      // droite disparaît sans nouvelle géométrie. Ce qui distingue un coin d'un milieu est
      // entièrement dans la COULEUR (wallCornerOcclusionShade), jamais dans la silhouette :
      // c'est ce qui garantit qu'un coin se raccorde à un milieu sans couture, alpha pour
      // alpha, et que checkWallAtlas peut le vérifier avec les mêmes outils qu'en T3.
      function wallFootprintSdf(state, x, y, tileSize, radius, roughness, padding) {
        if (state.flank) return flankSdf(state.flank === "right", x, y, tileSize, radius, roughness, padding);
        return rectPieceSdf({ n: true, s: true, w: state.west, e: state.east }, x, y, tileSize, radius, roughness, padding);
      }

      // Profondeur de l'ombre portée, en fraction de la tuile — voir shadowSdf.
      const WALL_SHADOW_DEPTH_RATIO = 0.35;
      // Alpha de l'ombre portée (sur 255) — valeur par défaut, reprise quand le réglage
      // (T23, `settings.wallShadowAlpha`) est absent : c'est ce qui garde le rendu d'avant
      // cette tranche identique au bit près tant que personne n'a touché le curseur.
      // Semi-transparente, pour rester discrète.
      const WALL_SHADOW_ALPHA = 110;

      // Pénombre de contact de la base avec le sol (T25). Trois recherches sourcées
      // (voir docs/PLAN-tilesets.md, « Tranches 25 à 27 ») ont établi qu'un mur
      // top-down 3/4 n'a que deux parties, dessus et face, et que le contact au sol
      // s'y peint comme une ombre dans les derniers pixels du bas de la face —
      // jamais comme une troisième matière. C'est tout ce que la base ajoute
      // au-dessus du chemin de couleur de la face : un assombrissement PROGRESSIF
      // (une rampe, pas une marche) sur le dernier tiers de la tuile, jamais un
      // aplat sur toute sa hauteur — voir wallBaseContactShade juste en dessous.
      //
      // Le dernier tiers et l'assombrissement maximal ci-dessous sont mesurés sur
      // docs/reference/reference.png, pas déduits : plus court, la pénombre se
      // lisait comme un simple trait ; plus long, elle redevenait la bande sombre
      // que cette tranche supprime.
      const WALL_BASE_CONTACT_START = 2 / 3;
      const WALL_BASE_CONTACT_MAX = 40;

      /**
       * Assombrissement (unités de `shadeColor`) de la pénombre de contact au
       * pixel `ay` — coordonnée LOCALE de la bande base, 0..tileSize, la même
       * convention que le reste de wallBandPixelColor. Nul jusqu'à
       * WALL_BASE_CONTACT_START, puis une rampe quadratique (elle s'accélère vers
       * le bas, comme une ombre qui s'épaissit au contact) jusqu'à
       * WALL_BASE_CONTACT_MAX — jamais atteint pile puisque le pixel est pris en
       * son CENTRE (`ay + 0.5`), pas à son bord inférieur.
       */
      function wallBaseContactShade(ay, tileSize) {
        const t = (ay + 0.5) / tileSize;
        if (t <= WALL_BASE_CONTACT_START) return 0;
        const p = (t - WALL_BASE_CONTACT_START) / (1 - WALL_BASE_CONTACT_START);
        return p * p * WALL_BASE_CONTACT_MAX;
      }

      // Pénombre d'angle (T37) — largeur de la rampe, en fraction de la tuile, prise du
      // BORD du coin vers l'intérieur. Un tiers : exactement la proportion que T25 a
      // mesurée sur docs/reference/reference.png pour la pénombre de contact, et pour la
      // même raison, dans l'autre direction. Essayée plus courte (un sixième) sur la scène
      // en L rendue par scripts/apercu-tileset.mjs, elle se lit comme un trait noir posé
      // sur la face, pas comme une joue de mur ; plus large (une moitié), la face entière
      // du coin fonce et le mur change de couleur en tournant, ce qui est le défaut
      // symétrique de celui que la tranche corrige.
      const WALL_CORNER_OCCLUSION_WIDTH = 1 / 3;

      /**
       * Assombrissement (unités de `shadeColor`) de la pénombre d'angle au pixel `ax`
       * — coordonnée LOCALE de la bande, 0..tileSize, la même convention que
       * `wallBaseContactShade` juste au-dessus. Nul pour tout état sans `corner`, et
       * nul aussi tant que `max` vaut 0 : c'est ce qui rend le réglage exactement
       * neutre, au bit près (voir wallBandPixelColor).
       *
       * Ce qu'elle dit, et pourquoi une rampe. Au coin, la face du mur REVIENT : le mur
       * continue vers le nord, donc les derniers pixels du côté du coin ne montrent plus
       * la face de devant mais la joue perpendiculaire, qui ne prend pas la même lumière.
       * On assombrit cette joue — jamais un contour. D'où la même rampe quadratique que
       * la pénombre de contact, qui s'accélère vers le bord : une MARCHE y remettrait
       * exactement la coupure droite que la tranche supprime, déplacée de dix pixels.
       */
      function wallCornerOcclusionShade(state, ax, tileSize, max) {
        if (!state.corner || max <= 0) return 0;
        const local = (ax + 0.5) / tileSize;
        // Distance normalisée au bord du coin : 0 sur ce bord, 1 à l'autre bout de la case.
        const t = state.corner === "east" ? 1 - local : local;
        if (t >= WALL_CORNER_OCCLUSION_WIDTH) return 0;
        const p = 1 - t / WALL_CORNER_OCCLUSION_WIDTH;
        return p * p * max;
      }

      // Ombre portée au pied du mur : TOUJOURS la même profondeur — une tuile de long
      // quelle que soit la hauteur du mur, puisque rien dans l'atlas ne connaît cette
      // hauteur — et sur une seule face, celle qui touche le sol. Elle reprend l'emprise
      // gauche/droite de son état — y compris pour un flanc, qui n'a ici pas besoin de
      // son chanfrein : une ombre molle n'a pas d'arête à 45°, seulement la bonne largeur
      // pour rester sous la pièce du dessus.
      //
      // Elle colle au HAUT de sa case, et c'est ce qui dit où la poser : la case DEVANT
      // le pied du mur, celle du sol juste en dessous de la base. La version d'origine la
      // collait au bas de sa case — une disposition qu'aucun code de placement n'a jamais
      // consommée, et qui, une fois l'aperçu de jeu écrit, décollait visiblement l'ombre
      // du mur d'une tuile entière. Le défaut ne pouvait pas se voir avant qu'un mur soit
      // réellement assemblé quelque part.
      function shadowSdf(state, x, y, tileSize, radius, roughness, padding) {
        const ext = radius + roughness + 1;
        const inset = edgeInset(tileSize, padding);
        const depth = tileSize * WALL_SHADOW_DEPTH_RATIO;
        const l = state.west ? 0 - ext : inset;
        const r = state.east ? tileSize + ext : tileSize - inset;
        const t = 0 - ext; // flush avec le haut : l'ombre touche le pied du mur
        const b = depth;
        return roundedBoxSdf(x, y, l, t, r, b, Math.min(radius, depth * 0.4));
      }

      /**
       * Décrit l'atlas mur : une entrée par case, dans l'ordre ligne par ligne puis
       * colonne par colonne — 8 × 9 = 72 cases. C'est ce que consommera le câblage
       * d'export (tranche T4, hors de celle-ci) : il n'a pas à redeviner la disposition
       * depuis les pixels, ni à recalculer quelle bande porte la collision ou le tri en
       * profondeur (Y-sort). Les deux ne sont posés que sur la bande base — jamais le
       * dessus, la face ou l'ombre — et comme un mur bloque tout le passage sur sa
       * cellule, la collision est le rectangle plein de la cellule, pas le contour
       * visuel de l'état (donc vraie aussi sur un flanc).
       *
       * `wallHeightTiles` n'influence jamais l'atlas — voir le commentaire en tête de
       * section : une seule ligne de face existe, et se répète au moment du placement,
       * hors de cette tranche. Le paramètre ne fait que voyager avec le reste de la
       * description plutôt que d'être retenu à part par l'appelant. Décision prise seule
       * pendant l'exécution de cette tranche, la disposition d'atlas elle-même ayant
       * déjà été tranchée par ailleurs : 3 tuiles par défaut n'est qu'un repère
       * raisonnable, sans conséquence sur la géométrie.
       */
      // Les états de bande qu'aucun export ne déclare plus comme pièces à poser
      // (tranche T27). Ils restent PEINTS dans l'atlas — les retirer déplacerait toutes
      // les cases suivantes et casserait les empreintes comme les fichiers déjà
      // exportés — mais plus rien ne dit à un artiste de les poser : T24 a mesuré que
      // `flankSdf` rend un chevron symétrique, jamais une rampe, et qu'aucun assemblage
      // de chevrons ne referme une jonction. C'est le décor organique qui remplit ce
      // rôle désormais.
      const WALL_UNPLACED_STATES = ["flank-left", "flank-right"];
      function wallAtlasDescriptor({ wallHeightTiles = 3, decor = "aucun" } = {}) {
        const columns = WALL_COLUMNS;
        const bandRows = WALL_TOP_ROWS + WALL_BANDS.length;
        const decorInfo = decorAtlasDescriptor("wall", decor);
        const biaisInfo = biaisAtlasDescriptor("wall");
        const rows = bandRows + WALL_BIAIS_ROWS + decorRowCount(decor);
        const baseRow = WALL_TOP_ROWS + WALL_BANDS.findIndex((b) => b.id === "base");
        const cells = [];
        for (let row = 0; row < bandRows; row += 1) {
          for (let col = 0; col < columns; col += 1) {
            const bandInfo = wallBandAt(row);
            if (!bandInfo) {
              // Dessus : le blob 47. `state` porte le masque huit bits, ou `null` pour
              // l'unique case libre (7, 5) — jamais 0, qui est l'îlot isolé, un masque
              // légitime au même titre que les 46 autres.
              const mask = maskAtPosition(B47, col, row);
              cells.push({ col, row, band: "top", state: mask, collision: false, ySort: false, placeable: mask !== null });
              continue;
            }
            const state = wallBandStateAt(col);
            const isBase = bandInfo.id === "base" && state !== null;
            // `placeable` (T27) : ce que l'export déclare comme pièce à poser. Faux
            // pour les deux colonnes libres, qui n'ont jamais rien porté, ET pour les
            // deux flancs à 45°, qui sortent de l'export par cette seule ligne — voir
            // WALL_UNPLACED_STATES juste au-dessus.
            const placeable = state !== null && !WALL_UNPLACED_STATES.includes(state.id);
            cells.push({
              col,
              row,
              band: bandInfo.id,
              state: state ? state.id : null,
              collision: isBase && placeable,
              ySort: isBase && placeable,
              placeable,
            });
          }
        }
        // Les douze tuiles en biais (T43) plus les deux pentes du bord arrière (T44),
        // juste après les trois bandes. Elles n'ont pas d'`état` de bande — elles ne
        // sont pas une colonne de plus dans les huit états, mais une géométrie à part,
        // choisie par le SENS de la pente et par la PIÈCE. Collision et Y-sort suivent
        // la même règle qu'ailleurs : seule la base les porte — la pente (T44) n'en a
        // aucun des deux, c'est du dessus, immobile, jamais recouvert. Deux nouveautés
        // de T43, et elles sont mesurées, pas décoratives :
        //  * `collisionPoints` — `base-basse` est un demi-carré, donc un TRIANGLE ; le
        //    rectangle plein y ferait buter le joueur dans le vide sur une demi-case ;
        //  * `ySortRows` — la bande est UN objet et doit se trier comme un seul : toutes
        //    ses pièces s'ancrent sur la rangée d'EMPRISE (celle de la carte, celle de la
        //    collision, celle que le peintre de `dessinerScene` parcourt), donc une pièce
        //    posée `dy` rangées plus bas remonte son `y_sort_origin` de `dy` tuiles.
        if (biaisInfo) {
          for (const cell of biaisInfo.cells) {
            const base = cell.band === "base";
            cells.push({
              col: cell.col,
              row: cell.row,
              band: cell.band,
              state: null,
              sens: cell.sens,
              piece: cell.piece,
              collision: base,
              ySort: base,
              ySortRows: cell.dy,
              collisionPoints: biaisCollisionPoints(cell.piece, cell.sens),
              placeable: true,
            });
          }
        }
        // Les lignes de décor, tout à la fin — après les trois bandes, jamais à leur
        // place : la géométrie du mur ne bouge pas d'une case quand on allume le décor.
        if (decorInfo) {
          for (const cell of decorInfo.cells) {
            cells.push({
              col: cell.col,
              row: cell.row,
              band: "decor",
              state: null,
              orientation: cell.orientation,
              variant: cell.variant,
              collision: false,
              ySort: false,
              placeable: true,
            });
          }
        }
        return {
          columns,
          rows,
          topRows: WALL_TOP_ROWS,
          faceRow: WALL_TOP_ROWS,
          baseRow,
          shadowRow: WALL_TOP_ROWS + 2,
          wallHeightTiles,
          unplacedStates: WALL_UNPLACED_STATES.slice(),
          decor: decorInfo,
          biais: biaisInfo,
          cells,
        };
      }

      // ===========================================================================
      // Le calque de décor organique — tranche T27.
      // ===========================================================================
      //
      // Le reproche qui l'ouvre, mot pour mot : « ça ne crée pas du tout un visuel
      // cohérent et ça crée des escaliers ». Trois recherches (voir
      // docs/PLAN-tilesets.md, « Tranches 25 à 27 ») ont établi qu'AUCUN système
      // d'autotile ne modélise un bord à 45° — blob 47, dual-grid, Wang, terrains de
      // Godot 4 reposent tous sur « un coin ne compte que si ses deux côtés sont
      // pleins », donc la diagonale s'effondre structurellement en coin. La technique
      // de la référence (docs/reference/reference.png, la paroi de grotte à droite)
      // et de tous les tilesets de donjon consultés est autre : un CALQUE DE DÉCOR
      // organique posé par-dessus un terrain resté orthogonal. La diagonale perçue est
      // un effet de silhouette, jamais de géométrie.
      //
      // Ce que le moteur en rend : des pièces de gravats — de petites masses
      // irrégulières estampées avec la matière du dessus — qui se posent dans la case
      // VIDE au bord de la matière et DÉBORDENT depuis cette frontière vers
      // l'intérieur de leur case. C'est ce débordement qui casse la grille : là où la
      // silhouette tombait pile sur une frontière de case, elle tombe maintenant
      // quelque part au milieu de la case voisine, et pas au même endroit d'une case
      // à l'autre.
      //
      // Pourquoi la pièce est peinte dans la case VIDE et non dans celle de la
      // matière : une tuile ne peut peindre que sa propre case. Poser le gravat du
      // côté plein ne ferait que retoucher l'intérieur de la silhouette, qui est
      // justement la partie que personne ne regarde ; posé du côté vide, il ajoute de
      // la matière AU-DELÀ du bord, ce qui est la seule façon de déplacer la
      // silhouette elle-même. C'est aussi ce qui rend le calque exportable tel quel :
      // une pièce de décor est une tuile sans terrain, sur une couche au-dessus.

      // Les trois crans du réglage. « aucun » est le défaut, et c'est lui qui garantit
      // que l'atlas d'aujourd'hui ne bouge pas d'un bit : aucune ligne ajoutée, aucun
      // chemin de code atteint.
      // Depuis le 27 septembre 2026 (Asset Kitchen), six crans : la forme des pièces ne
      // dépend pas du cran — seule la pose en dépend (`emplacementsDecor`) —, et tout cran
      // autre que « aucun » ajoute les mêmes lignes à l'atlas.
      const DECOR_DENSITIES = ["aucun", "rare", "leger", "moyen", "dense", "partout"];

      // Une ligne d'atlas par ORIENTATION — le côté de la case où se trouve la matière
      // contre laquelle la pièce s'appuie — et une colonne par VARIANTE. Quatre
      // orientations, trois variantes : douze cases, sur quatre lignes de trois
      // colonnes. Trois variantes tiennent dans la plus étroite des dispositions
      // (15 pièces et chemin 16 n'ont que 4 colonnes), la même borne de sûreté que
      // clampVariants s'impose pour la même raison.
      const DECOR_ORIENTATIONS = ["n", "e", "s", "w"];
      const DECOR_VARIANTS = 3;

      // Jusqu'où la masse déborde depuis la frontière, en fraction de tuile. Le plan
      // demandait « un tiers à une moitié » ; 0,46 est la valeur retenue à l'image sur
      // la carte en escalier — voir docs/PLAN-tilesets.md, « T27 ».
      const DECOR_DEPTH = 0.46;

      // Décalages de graine du décor, sans autre vertu que d'éviter tout chevauchement
      // avec ceux déjà en usage dans ce fichier (113, 421, 809, 1607…, 104729).
      const DECOR_SEED_STEP = 7717;

      function clampDecor(decor) {
        const id = typeof decor === "string" ? decor : "aucun";
        return DECOR_DENSITIES.includes(id) ? id : "aucun";
      }

      /** Lignes d'atlas que le décor ajoute — 0 quand il est refusé. */
      function decorRowCount(decor) {
        return clampDecor(decor) === "aucun" ? 0 : DECOR_ORIENTATIONS.length;
      }

      /**
       * Coordonnées CANONIQUES d'un point de la pièce : le repère dans lequel toute
       * pièce s'appuie sur le bord du HAUT de sa case. Les quatre orientations sont
       * la même forme vue par quatre isométries du carré — une seule géométrie à
       * écrire, donc une seule à mesurer, et quatre bords qui se ressemblent comme les
       * quatre bords d'une même roche.
       */
      function decorCanonical(orientation, x, y, tileSize) {
        if (orientation === "s") return [x, tileSize - y];
        if (orientation === "w") return [y, x];
        if (orientation === "e") return [y, tileSize - x];
        return [x, y]; // "n"
      }

      /**
       * Les masses d'une pièce, en coordonnées canoniques. Déterministe : à mêmes
       * (orientation, variante, graine), la même liste — c'est un art d'atlas, cuit
       * une fois, pas un tirage par case de carte.
       *
       * La forme : trois à cinq galets ronds alignés le long du bord, unis par `smin`
       * (le même congé que celui qui arrondit les coins du blob et la patte d'oie du
       * bord 16) en une masse d'un seul tenant — la silhouette ronde et bosselée des
       * rochers de la référence — puis un ou deux ÉCLATS détachés, plus petits, unis
       * par un `Math.min` franc pour qu'ils restent séparés. Les éclats détachés
       * comptent autant que la masse : ce sont eux qui font que le bord ne se lit plus
       * comme une ligne, mais comme une zone.
       */
      function decorShape(orientation, variantIndex, tileSize, seed, options = null) {
        if (options) return decorShapeFine(orientation, variantIndex, tileSize, seed, options);
        const o = DECOR_ORIENTATIONS.indexOf(orientation);
        const s = (seed | 0) + DECOR_SEED_STEP * (variantIndex + 1) + o * 131;
        const alea = (k) => hash2(k, o + 1, s + k * 37);
        const depth = tileSize * DECOR_DEPTH;
        const count = 3 + Math.floor(alea(1) * 2); // 3 ou 4 galets
        const masses = [];
        for (let i = 0; i < count; i += 1) {
          // Les centres se répartissent sur toute la largeur — sans quoi un bout du
          // bord resterait nu et la frontière de case y redeviendrait visible — avec
          // assez de gigue pour qu'aucune pièce ne se lise comme une rangée régulière.
          const cx = tileSize * ((i + 0.5) / count) + (alea(10 + i) - 0.5) * (tileSize / count) * 0.7;
          // Un rayon d'au moins un cinquième de tuile : à `count` galets sur la
          // largeur, deux voisins se recouvrent alors toujours, ce qui est la
          // condition pour que la masse soit d'un seul tenant le long du bord.
          const r = tileSize * (0.2 + alea(30 + i) * 0.1);
          // Le centre peut sortir PAR LE HAUT : la moitié haute du galet est alors
          // rognée par le bord de la case, et c'est voulu — la pièce doit toucher la
          // frontière sur toute sa largeur, sinon on verrait un liseré de fond entre
          // la matière et son gravat.
          const cy = -r * 0.35 + alea(50 + i) * (depth - r * 0.5);
          masses.push({ cx, cy, r, fillet: r * 0.45 });
        }
        const eclats = [];
        for (let i = 0; i < 2; i += 1) {
          eclats.push({
            cx: tileSize * (0.1 + alea(70 + i) * 0.8),
            // Les éclats vivent PLUS LOIN que la masse, entre son pied et le fond de
            // la case : c'est leur distance au bord qui casse la lecture de la grille.
            cy: depth * (0.9 + alea(90 + i) * 0.6),
            r: tileSize * (0.06 + alea(110 + i) * 0.05),
          });
        }
        return { masses, eclats };
      }

      /**
       * Les réglages fins des cailloux (Asset Kitchen, 27 septembre 2026), chacun de 1 à
       * 10 : `taille`, `nombre` (galets par pièce), `ecart` (jusqu'où ils s'éloignent du
       * bord), et `colles` (vrai : une partie des galets s'appuie sur le bord et la pose
       * les apparie, comme l'ancien gravat ; faux : tous sont détachés).
       *
       * Ce que la forme d'avant faisait mal, vu à l'usage : trois ou quatre galets d'un
       * quart de tuile chacun, soudés et répartis sur TOUTE la largeur de la case — donc
       * coupés net par ses côtés, ce qui dessinait des blocs carrés au lieu de cailloux,
       * et aucune façon de les faire plus petits. Ici chaque galet tient ENTIER dans sa
       * case (sauf, accrochés, par le côté de la matière), avec une marge qui absorbe le
       * bruit de bord : aucun côté de case ne peut plus le couper.
       */
      function clampFin(v, defaut) {
        const n = Math.round(Number(v));
        return Number.isFinite(n) ? clamp(n, 1, 10) : defaut;
      }

      function decorShapeFine(orientation, variantIndex, tileSize, seed, options) {
        const taille = clampFin(options.taille, 3);
        const nombre = clampFin(options.nombre, 4);
        const ecart = clampFin(options.ecart, 4);
        const colles = options.colles === true;
        const o = DECOR_ORIENTATIONS.indexOf(orientation);
        const s = (seed | 0) + DECOR_SEED_STEP * (variantIndex + 1) + o * 131 + 50021;
        const alea = (k) => hash2(k, o + 1, s + k * 37);
        const rMax = Math.max(1, tileSize * (0.025 + 0.02 * taille));
        const portee = tileSize * (0.1 + 0.07 * ecart);
        const accroches = colles ? Math.max(1, Math.ceil(nombre / 2)) : 0;
        const galets = [];
        for (let i = 0; i < nombre; i += 1) {
          for (let essai = 0; essai < 8; essai += 1) {
            const k = 200 + i * 16 + essai * 2;
            // Les galets se serrent près du bord et s'éclaircissent en s'éloignant, et
            // rapetissent avec la distance : un éboulis, pas une grille de points.
            const loin = i < accroches ? 0 : Math.pow(alea(k), 1.6);
            const r = Math.max(1, rMax * (0.5 + 0.5 * alea(k + 1)) * (1 - 0.45 * loin));
            const marge = r * 0.25 + 1;
            const cx = r + marge + alea(k + 3) * Math.max(0, tileSize - 2 * (r + marge));
            const cy = i < accroches
              ? r * (alea(k + 5) * 0.5 - 0.2)
              : Math.min(tileSize - r - marge, r + marge + loin * Math.max(0, portee - r - marge));
            if (galets.some((g) => Math.hypot(g.cx - cx, g.cy - cy) < g.r + r + 1)) continue;
            // Un caillou n'est pas un disque : un peu écrasé, un peu penché. Le grand axe
            // reste `r`, donc la marge qui le garde dans sa case tient toujours.
            galets.push({ cx, cy, r, ratio: 0.62 + 0.38 * alea(k + 7), angle: alea(k + 9) * Math.PI });
            break;
          }
        }
        return { fine: true, galets };
      }

      /** Distance (approchée, jamais surestimée hors du galet) à un galet ovale et penché. */
      function galetSdf(g, u, v) {
        const du = u - g.cx;
        const dv = v - g.cy;
        const c = Math.cos(g.angle);
        const sn = Math.sin(g.angle);
        const a = du * c + dv * sn;
        const b = (-du * sn + dv * c) / g.ratio;
        return (Math.hypot(a, b) - g.r) * g.ratio;
      }

      /** Le rayon du galet dont le bord est le plus proche du point — cailloux fins seulement. */
      function decorRayonProche(shape, orientation, x, y, tileSize) {
        const [u, v] = decorCanonical(orientation, x, y, tileSize);
        let best = Infinity;
        let r = 1;
        for (const g of shape.galets) {
          const d = Math.abs(galetSdf(g, u, v));
          if (d < best) { best = d; r = g.r; }
        }
        return r;
      }

      /**
       * Distance signée à une pièce de décor. `shape` vient de `decorShape` — calculé
       * une fois par case d'atlas, jamais par pixel : la boucle de pixels appelle
       * cette fonction des milliers de fois, et `grazing` quatre fois de plus.
       */
      function decorSdf(shape, orientation, x, y, tileSize) {
        const [u, v] = decorCanonical(orientation, x, y, tileSize);
        let d = Infinity;
        if (shape.fine) {
          for (const g of shape.galets) d = Math.min(d, galetSdf(g, u, v));
          return d;
        }
        for (const m of shape.masses) {
          const dist = Math.hypot(u - m.cx, v - m.cy) - m.r;
          d = Number.isFinite(d) ? smin(d, dist, m.fillet) : dist;
        }
        for (const e of shape.eclats) d = Math.min(d, Math.hypot(u - e.cx, v - e.cy) - e.r);
        return d;
      }

      /**
       * Ce que l'atlas porte en décor — le descripteur que les exports consomment,
       * sur le modèle de `variantAtlasDescriptor` (T13) et de `atlasAnimationDescriptor`
       * (T10 bis) : le moteur sait où il a peint, personne ne le redevine.
       *
       * `firstRow` est la première ligne ajoutée, c'est-à-dire la hauteur de l'atlas
       * SANS décor : variantes, images d'animation et copies de phase sont déjà toutes
       * comptées dedans. C'est ce qui fait cohabiter les quatre mécanismes sans qu'aucun
       * ne réclame la ligne d'un autre.
       *
       * `null` quand il n'y a rien à décrire — décor refusé, le défaut.
       */
      function decorAtlasDescriptor(tilesetType, decor, variants = 0, animatedFrames = 0, atlasCopies = 0) {
        const density = clampDecor(decor);
        if (density === "aucun") return null;
        const base = TILESET_LAYOUTS[tilesetType] || TILESET_LAYOUTS["topdown-15"];
        const firstRow = atlasRowsSansDecor(tilesetType, variants, animatedFrames, atlasCopies);
        const cells = [];
        DECOR_ORIENTATIONS.forEach((orientation, i) => {
          for (let variant = 0; variant < DECOR_VARIANTS; variant += 1) {
            cells.push({ orientation, variant, col: variant, row: firstRow + i });
          }
        });
        return {
          tilesetType,
          density,
          columns: base.columns,
          orientations: DECOR_ORIENTATIONS.slice(),
          variants: DECOR_VARIANTS,
          depth: DECOR_DEPTH,
          firstRow,
          rows: DECOR_ORIENTATIONS.length,
          atlasRows: firstRow + DECOR_ORIENTATIONS.length,
          cells,
        };
      }

      // =====================================================================
      // Tranche 30 — la réduction qui garde le trait
      // =====================================================================
      //
      // Portage JS de PixelOE (Copyright 2024 KohakuBlueLeaf, Apache-2.0, voir
      // ./LICENSE-PixelOE.txt) : `pixeloe/torch/outline.py` (`expansion_weight`,
      // `outline_expansion`) et `pixeloe/torch/downscale/contrast_based.py`
      // (`contrast_downscale`).
      //
      // Pourquoi porter plutôt qu'appeler. Mesuré sur la machine : `import torch` 1,83 s
      // + `import pixeloe` 3,38 s = 5,21 s avant le premier pixel, à chaque appel (un
      // sous-processus ne garde rien), trois matières par mur, à refaire à chaque
      // changement de taille de tuile. Et, lu dans le paquet, PixelOE rembourre d'un bloc
      // entier en `replicate` même quand la source est un multiple exact, puis recadre au
      // centre : le raccord n'est pas garanti par CONSTRUCTION, seulement « pas trop
      // abîmé ». Ici toutes les fenêtres s'enroulent en modulo — c'est l'invariant de la
      // tranche, et le même réflexe qu'en T12 : rendre la faute impossible, pas détectable.
      //
      // Ce que le portage change volontairement, et pourquoi :
      //   · les statistiques locales du poids sont calculées PAR PIXEL en fenêtre
      //     glissante enroulée, là où PixelOE déplie des patchs à pas `k/2` puis replie en
      //     moyennant. Le pas fabrique des paliers de la taille du pas ; la fenêtre
      //     glissante n'en fabrique aucun, et rien ici ne dépend du découpage en patchs ;
      //   · l'érosion et la dilatation sont un min/max 3×3 répété `épaisseur` fois, là où
      //     PixelOE applique une fois un noyau circulaire dont le rayon croît avec
      //     l'épaisseur. Même portée à une fraction de pixel près, sans table de noyaux ;
      //   · `choixContraste` part de la MÉDIANE du bloc, là où PixelOE part du pixel
      //     CENTRAL du bloc et ne le remplace qu'en cas d'asymétrie. Le pixel central d'un
      //     bloc de 4 n'a aucune raison d'être représentatif ; la médiane, si. Les deux
      //     branches min/max, elles, sont portées telles quelles.
      // Aucun de ces écarts n'est une supposition : le banc `scripts/essai-reducteur.mjs`
      // mesure la fiche du portage CONTRE `python scripts/outil-pixeloe.py` (l'oracle) sur
      // la même source et aux mêmes réglages.

      // ── CIE Lab (D65), la seule chose que PixelOE emprunte à kornia ────────────────
      // Le choix du pixel représentatif se fait en Lab et pas en RGB parce que la règle
      // (« le plus sombre » ou « le plus clair » du bloc) porte sur la LUMINANCE perçue :
      // en RGB, un bleu saturé et un gris moyen ont des composantes du même ordre alors
      // que l'œil les sépare nettement.
      // `rgbVersLab` et `labVersRgb` étaient définies ici jusqu'à T31 ; elles vivent
      // désormais dans `public/tile-palette-lab.js`, importé en tête de fichier, parce que
      // T31 en a besoin des DEUX côtés de la réduction et qu'une troisième copie (moteur,
      // palette, banc E4) aurait divergé au premier changement de constante. Les valeurs
      // sont reprises au bit près : les empreintes SHA-256 de T30 ne bougent pas.

      /**
       * Moyenne d'aire vers `taille × taille`, RGB seulement. Sert d'intermédiaire à 4 × la
       * cible (E3) ; à l'agrandissement, le rectangle source se réduit à un pixel et la
       * moyenne redonne exactement le plus proche voisin, comme la moyenne d'aire principale.
       *
       * Le modulo des indices n'est jamais ATTEINT, et c'est honnête de le dire : une moyenne
       * d'aire partitionne la source, ses rectangles ne franchissent donc aucun bord (la borne
       * haute vaut au plus `W`). Il est écrit quand même pour que l'invariant de la tranche —
       * toutes les fenêtres s'enroulent — reste vrai si ces bornes changent un jour, et pour
       * qu'on n'ait pas à redémontrer ce paragraphe à ce moment-là.
       */
      function moyenneAireEnroulee(texture, taille) {
        const out = new Float32Array(taille * taille * 3);
        const W = texture.width, H = texture.height;
        for (let y = 0; y < taille; y += 1) {
          const y0 = Math.floor((y * H) / taille);
          const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * H) / taille));
          for (let x = 0; x < taille; x += 1) {
            const x0 = Math.floor((x * W) / taille);
            const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * W) / taille));
            let r = 0, g = 0, b = 0, n = 0;
            for (let sy = y0; sy < y1; sy += 1) {
              const my = ((sy % H) + H) % H;
              for (let sx = x0; sx < x1; sx += 1) {
                const mx = ((sx % W) + W) % W;
                const from = (my * W + mx) * 4;
                r += texture.data[from]; g += texture.data[from + 1]; b += texture.data[from + 2];
                n += 1;
              }
            }
            const to = (y * taille + x) * 3;
            out[to] = r / n; out[to + 1] = g / n; out[to + 2] = b / n;
          }
        }
        return out;
      }

      /**
       * Min ou max 3×3 enroulé, `iterations` fois, sur un tampon RGB en flottant.
       * Séparable : une passe horizontale puis une verticale, chacune en modulo.
       * `iterations` fois un 3×3 vaut un disque de rayon `iterations` à une fraction de
       * pixel près — c'est ce qui remplace la table de noyaux circulaires de PixelOE.
       */
      function morpho3x3Enroule(src, taille, iterations, prendreMax) {
        let cur = src;
        for (let it = 0; it < iterations; it += 1) {
          const h = new Float32Array(taille * taille * 3);
          for (let y = 0; y < taille; y += 1) {
            for (let x = 0; x < taille; x += 1) {
              const g = ((x - 1) % taille + taille) % taille, d = (x + 1) % taille;
              const o = (y * taille + x) * 3, og = (y * taille + g) * 3, od = (y * taille + d) * 3;
              for (let c = 0; c < 3; c += 1) {
                const a = cur[o + c], bb = cur[og + c], cc = cur[od + c];
                h[o + c] = prendreMax ? Math.max(a, bb, cc) : Math.min(a, bb, cc);
              }
            }
          }
          const out = new Float32Array(taille * taille * 3);
          for (let y = 0; y < taille; y += 1) {
            const hy = ((y - 1) % taille + taille) % taille, by = (y + 1) % taille;
            for (let x = 0; x < taille; x += 1) {
              const o = (y * taille + x) * 3, oh = (hy * taille + x) * 3, ob = (by * taille + x) * 3;
              for (let c = 0; c < 3; c += 1) {
                const a = h[o + c], bb = h[oh + c], cc = h[ob + c];
                out[o + c] = prendreMax ? Math.max(a, bb, cc) : Math.min(a, bb, cc);
              }
            }
          }
          cur = out;
        }
        return cur;
      }

      /** Min ou max sur une fenêtre `fenetre × fenetre` enroulée, canal unique, séparable. */
      function extremumFenetreEnroulee(src, taille, fenetre, prendreMax) {
        const demi = Math.floor(fenetre / 2);
        const h = new Float32Array(taille * taille);
        for (let y = 0; y < taille; y += 1) {
          for (let x = 0; x < taille; x += 1) {
            let v = prendreMax ? -Infinity : Infinity;
            for (let d = -demi; d < fenetre - demi; d += 1) {
              const sx = ((x + d) % taille + taille) % taille;
              const s = src[y * taille + sx];
              v = prendreMax ? Math.max(v, s) : Math.min(v, s);
            }
            h[y * taille + x] = v;
          }
        }
        const out = new Float32Array(taille * taille);
        for (let y = 0; y < taille; y += 1) {
          for (let x = 0; x < taille; x += 1) {
            let v = prendreMax ? -Infinity : Infinity;
            for (let d = -demi; d < fenetre - demi; d += 1) {
              const sy = ((y + d) % taille + taille) % taille;
              const s = h[sy * taille + x];
              v = prendreMax ? Math.max(v, s) : Math.min(v, s);
            }
            out[y * taille + x] = v;
          }
        }
        return out;
      }

      // Nombre de niveaux de l'histogramme glissant de la médiane. La médiane n'est pas
      // séparable : une fenêtre 8×8 par pixel, triée à chaque pixel, coûterait 64 tris par
      // pixel. Un histogramme glissant enroulé la rend quasi gratuite, au prix d'une
      // quantification de L — 64 niveaux, soit 1,5 point de L*, très en dessous de ce que
      // la sigmoïde qui suit peut distinguer.
      const MEDIANE_NIVEAUX = 64;

      /** Médiane (basse) sur une fenêtre `fenetre × fenetre` enroulée, par histogramme glissant. */
      function medianeFenetreEnroulee(bins, taille, fenetre) {
        const demi = Math.floor(fenetre / 2);
        const rang = Math.floor((fenetre * fenetre - 1) / 2);
        const out = new Uint8Array(taille * taille);
        const hist = new Int32Array(MEDIANE_NIVEAUX);
        for (let y = 0; y < taille; y += 1) {
          hist.fill(0);
          for (let dy = -demi; dy < fenetre - demi; dy += 1) {
            const sy = ((y + dy) % taille + taille) % taille;
            for (let dx = -demi; dx < fenetre - demi; dx += 1) {
              const sx = ((dx % taille) + taille) % taille;
              hist[bins[sy * taille + sx]] += 1;
            }
          }
          for (let x = 0; x < taille; x += 1) {
            if (x > 0) {
              const sortant = ((x - 1 - demi) % taille + taille) % taille;
              const entrant = ((x + fenetre - 1 - demi) % taille + taille) % taille;
              for (let dy = -demi; dy < fenetre - demi; dy += 1) {
                const sy = ((y + dy) % taille + taille) % taille;
                hist[bins[sy * taille + sortant]] -= 1;
                hist[bins[sy * taille + entrant]] += 1;
              }
            }
            let c = 0, v = 0;
            for (; v < MEDIANE_NIVEAUX; v += 1) { c += hist[v]; if (c > rang) break; }
            out[y * taille + x] = v >= MEDIANE_NIVEAUX ? MEDIANE_NIVEAUX - 1 : v;
          }
        }
        return out;
      }

      /**
       * `expansion_weight` de PixelOE : où faut-il ÉPAISSIR le sombre (poids → 1, érosion)
       * et où faut-il épaissir le clair (poids → 0, dilatation) ?
       * Médiane sur une fenêtre de 2k, min et max sur k, puis
       * `sigmoïde((médiane − 0,5)·10 − (distClair − distSombre)·3)`, enfin normalisé
       * min-max sur toute l'image comme dans l'original.
       */
      function poidsExpansion(lab, taille, k) {
        const n = taille * taille;
        const l = new Float32Array(n);
        const bins = new Uint8Array(n);
        for (let i = 0; i < n; i += 1) {
          const v = Math.min(1, Math.max(0, lab[i * 3] / 100));
          l[i] = v;
          bins[i] = Math.round(v * (MEDIANE_NIVEAUX - 1));
        }
        const med = medianeFenetreEnroulee(bins, taille, k * 2);
        const mini = extremumFenetreEnroulee(l, taille, k, false);
        const maxi = extremumFenetreEnroulee(l, taille, k, true);
        const poids = new Float32Array(n);
        let pmin = Infinity, pmax = -Infinity;
        for (let i = 0; i < n; i += 1) {
          const m = med[i] / (MEDIANE_NIVEAUX - 1);
          const distClair = maxi[i] - m, distSombre = m - mini[i];
          const w = 1 / (1 + Math.exp(-((m - 0.5) * 10 - (distClair - distSombre) * 3)));
          poids[i] = w;
          if (w < pmin) pmin = w;
          if (w > pmax) pmax = w;
        }
        // Normalisation min-max, comme l'original. Sur une image plate l'étendue est nulle :
        // PixelOE divise alors par 1e-8 et rend 0 partout, c'est-à-dire « dilate tout ».
        // On garde plutôt la sigmoïde brute — sur une image sans contraste, aucune des deux
        // opérations n'a de contour à épaissir, et la valeur brute est la seule honnête.
        const etendue = pmax - pmin;
        if (etendue > 1e-8) for (let i = 0; i < n; i += 1) poids[i] = (poids[i] - pmin) / etendue;
        return poids;
      }

      /**
       * Combien de passes de 3×3 valent le noyau de PixelOE pour une épaisseur donnée.
       *
       * Mesuré au banc, PAS déduit du nom du paramètre — et c'est la faute que la première
       * version du portage a commise : « épaisseur 3 » y valait trois passes de 3×3, donc un
       * disque de rayon 3, alors que la table `KERNELS` de `pixeloe/torch/minmax.py` rend un
       * noyau 3×3 (rayon 1) pour les épaisseurs 1 à 3, 5×5 (rayon 2) pour 4 et 5, 7×7
       * (rayon 3) pour 6 — appliqué UNE fois. Trois fois trop de portée : le mur sortait
       * empâté (écart-type de luminance 30,8 contre 48,2 pour l'oracle à 16 px, fidélité des
       * joints 56 % contre 74,7 %). L'épaisseur de PixelOE est un INDICE dans une table, pas
       * un nombre d'itérations.
       */
      function rayonNoyau(epaisseur) {
        return Math.max(1, Math.ceil((epaisseur - 1) / 2));
      }

      /**
       * `outline_expansion` de PixelOE : érosion et dilatation mélangées par le poids,
       * puis érode / dilate / érode pour refermer ce que le mélange a ouvert.
       * Toutes les fenêtres s'enroulent.
       */
      function expansionContours(rgb, taille, epaisseur, lab) {
        const poids = poidsExpansion(lab, taille, 4);
        const iterations = rayonNoyau(epaisseur);
        const erode = morpho3x3Enroule(rgb, taille, iterations, false);
        const dilate = morpho3x3Enroule(rgb, taille, iterations, true);
        let out = new Float32Array(taille * taille * 3);
        for (let i = 0; i < taille * taille; i += 1) {
          const w = poids[i], o = i * 3;
          out[o] = erode[o] * w + dilate[o] * (1 - w);
          out[o + 1] = erode[o + 1] * w + dilate[o + 1] * (1 - w);
          out[o + 2] = erode[o + 2] * w + dilate[o + 2] * (1 - w);
        }
        // `oc_iter = max(erode_iters − 1, dilate_iters − 1, 1)` dans l'original, et la
        // dilatation y tourne deux fois là où les deux érosions tournent une fois.
        const oc = rayonNoyau(Math.max(epaisseur - 1, 1));
        out = morpho3x3Enroule(out, taille, oc, false);
        out = morpho3x3Enroule(out, taille, 2 * oc, true);
        out = morpho3x3Enroule(out, taille, oc, false);
        return out;
      }

      /**
       * `contrast_downscale` de PixelOE : par bloc, en Lab, on ne MOYENNE pas — on CHOISIT.
       * L = médiane du bloc, sauf asymétrie franche : min quand la médiane est sous la
       * moyenne et que le côté clair s'écarte plus que le côté sombre (le bloc est
       * majoritairement sombre avec une éclaircie parasite → garder le sombre), max dans
       * le cas symétrique. a et b prennent la médiane, toujours : déplacer la teinte au
       * bout de sa plage ferait des franges colorées sur les contours.
       */
      function choixContraste(rgb, taille, bloc) {
        const cible = Math.floor(taille / bloc);
        const n = bloc * bloc;
        const out = new Float32Array(cible * cible * 3);
        const lab = new Float32Array(3);
        const Ls = new Float64Array(n), As = new Float64Array(n), Bs = new Float64Array(n);
        const triL = new Float64Array(n), triA = new Float64Array(n), triB = new Float64Array(n);
        const rang = Math.floor((n - 1) / 2);
        for (let by = 0; by < cible; by += 1) {
          for (let bx = 0; bx < cible; bx += 1) {
            let k = 0, somme = 0;
            for (let dy = 0; dy < bloc; dy += 1) {
              for (let dx = 0; dx < bloc; dx += 1) {
                const i = ((by * bloc + dy) * taille + (bx * bloc + dx)) * 3;
                rgbVersLab(rgb[i], rgb[i + 1], rgb[i + 2], lab, 0);
                Ls[k] = lab[0]; As[k] = lab[1]; Bs[k] = lab[2];
                somme += lab[0]; k += 1;
              }
            }
            triL.set(Ls); triL.sort();
            triA.set(As); triA.sort();
            triB.set(Bs); triB.sort();
            const medL = triL[rang], moyL = somme / n, minL = triL[0], maxL = triL[n - 1];
            let L = medL;
            if (medL < moyL && (maxL - medL) > (medL - minL)) L = minL;
            else if (medL > moyL && (maxL - medL) < (medL - minL)) L = maxL;
            labVersRgb(L, triA[rang], triB[rang], out, (by * cible + bx) * 3);
          }
        }
        return out;
      }

      /**
       * L'épaisseur de contour, par taille de tuile visée. **3 partout**, et c'est une
       * mesure, pas une simplification de confort.
       *
       * E3 (`docs/ETUDE-beau-mur-E3.md`) avait retenu 3 à 32 et 64, 4 à 128, 2 à 256.
       * Balayée au banc (`scripts/essai-reducteur.mjs`, épaisseurs 1 à 6, cibles 16 à 256),
       * cette table se révèle en partie illusoire et en partie contre-productive ici :
       *   · 1, 2 et 3 donnent le MÊME résultat au bit près — `KERNELS` de PixelOE range ces
       *     trois indices sur le même noyau 3×3. L'écart « 2 à 256 contre 3 à 64 » d'E3
       *     n'existait déjà pas dans l'outil qu'elle mesurait ;
       *   · 4 (noyau 5×5) dégrade la fidélité des joints du maître d'E2 partout où elle se
       *     mesure : 74,2 % contre 80,0 % à 32, 77,4 % contre 82,0 % à 64, 82,2 % contre
       *     85,5 % à 128. E3 relevait l'épaisseur à 128 pour que le joint SURVIVE À LA
       *     QUANTIFICATION qui suivait ; ici il n'y en a pas — la couleur est le travail de
       *     T31 — donc la raison de la relever a disparu avec elle ;
       *   · à 256, 4 rend 84,6 % contre 83,7 % : un gain dans le bruit, pour deux fois plus
       *     de portée morphologique.
       * La fonction reste une fonction de la cible : si une mesure future veut rouvrir le
       * sujet, c'est ici, et nulle part ailleurs.
       */
      // eslint-disable-next-line no-unused-vars -- la cible reste dans la signature : c'est
      // d'elle que dépendrait une table rouverte par une mesure future.
      function epaisseurContours(cible) {
        return 3;
      }

      /** Les trois modes de réduction. `undefined` compris — voir `resolveReductionMode`. */
      const REDUCTION_MODES = ["moyenne", "compensee", "contraste"];

      /**
       * Le mode de réduction effectif et la force de compensation qui va avec.
       *
       * `settings.reductionMode` ABSENT vaut `'moyenne'` : c'est cette convention, et elle
       * seule, qui garde vraies au bit près toutes les empreintes SHA-256 du dépôt — aucun
       * essai antérieur à cette tranche ne connaît ce champ. Même politique qu'en T13 et
       * T28 : le canal est branché, et il ne peut pas atteindre un rendu qui ne le demande pas.
       *
       * La seule exception est une rétro-compatibilité, pas une porte dérobée : un appelant
       * qui ne connaît que `reductionCompensation` (T28) et le règle à une force non nulle
       * demande bien la compensation — c'est le seul sens que ce champ ait jamais eu.
       */
      function resolveReductionMode(settings) {
        const compensation = settings.reductionCompensation ?? 0;
        const demande = REDUCTION_MODES.includes(settings.reductionMode)
          ? settings.reductionMode
          : (compensation > 0 ? "compensee" : "moyenne");
        // `'contraste'` force la compensation T28 à 0 : les deux rendent du contraste local,
        // les empiler ferait un halo sur chaque trait que le premier vient d'épaissir — le
        // liseré clair qu'on voit dans la colonne « compensee » de la planche du banc. La
        // garantie est double, et exprès : ce 0, et l'ordre des branches de `resampleTexture`,
        // où le chemin contraste rend la main avant d'avoir regardé `force`.
        const force = demande === "compensee" ? (settings.reductionCompensation ?? 1.2) : 0;
        return { mode: demande, force };
      }

      // =====================================================================
      // Tranche T31 — la palette de référence
      // =====================================================================
      //
      // LA FORME DE `settings.palette`. Deux écritures sont acceptées, et une seule est
      // canonique :
      //
      //   1. le DESCRIPTEUR, canonique — ce que rend `paletteDeReferenceLab`
      //      (`public/tile-palette.js`) et ce que l'atelier fait voyager dans
      //      `tileSettings()` :
      //
      //        {
      //          palette: [ { lab: [L, a, b], rgb: [r, g, b], poids }, … ],  // N entrées, N = 48
      //          stats:   { moyenne: [L, a, b], ecart: [L, a, b] },          // de la RÉFÉRENCE
      //        }
      //
      //      `rgb` n'est pas arrondi (c'est la sortie de `labVersRgb`) ; l'écriture dans un
      //      Uint8ClampedArray s'en charge. `poids` ne sert pas au rendu — il est là pour
      //      qu'un nuancier puisse trier la palette par part de surface.
      //
      //   2. un TABLEAU D'IMAGES `[{ width, height, data }]` — les références elles-mêmes,
      //      non encore réduites en palette. Le moteur appelle alors `paletteLabPonderee` et
      //      garde le résultat en cache (voir plus bas). C'est le chemin des scripts Node,
      //      qui ont un PNG sous la main et pas une palette :
      //
      //        import { decodePng } from './lib/png.mjs';
      //        import { readFileSync } from 'node:fs';
      //        const refs = ['a.png', 'b.png'].map((f) => decodePng(readFileSync(f)));
      //        renderLogical({ …, reductionMode: 'contraste', palette: refs });
      //
      //      (`scripts/preuve-map-godot.mjs`, la preuve de T32, passe exactement ça.)
      //
      // ABSENT — `undefined`, `null`, un tableau vide, un descripteur sans couleurs — RIEN NE
      // BOUGE, au bit près. Même politique qu'en T13, T28 et T30 : le canal est branché, et
      // il ne peut pas atteindre un rendu qui ne le demande pas.
      const CACHE_PALETTE = new WeakMap();

      /**
       * Le descripteur de palette effectif, ou `null`. Le cache tient à l'IDENTITÉ du tableau
       * d'images passé : `renderLogical` retourne à chaque frappe dans le panneau, et un
       * k-means sur des références de 512 px coûte bien plus qu'un atlas.
       */
      function resolvePalette(settings) {
        const brut = settings.palette;
        if (!brut) return null;
        if (Array.isArray(brut)) {
          if (!brut.length) return null;
          const connu = CACHE_PALETTE.get(brut);
          if (connu !== undefined) return connu;
          const calcule = paletteLabPonderee(brut, settings.paletteCouleurs ?? 48);
          const valide = calcule && calcule.palette && calcule.palette.length ? calcule : null;
          CACHE_PALETTE.set(brut, valide);
          return valide;
        }
        if (Array.isArray(brut.palette) && brut.palette.length) return brut;
        return null;
      }

      /**
       * La palette posée sur une texture DÉJÀ RÉDUITE (`{ data, size }`, la sortie de
       * `resampleTexture`). C'est le point d'application unique, et il est APRÈS la réduction
       * — jamais avant : une quantification suivie d'une moyenne d'aire est défaite par la
       * moyenne, qui recrée des couleurs intermédiaires entre celles qu'on venait de retenir.
       * C'est le défaut que T31 corrige aussi pour T26 bis, laquelle harmonisait les maîtres
       * de 512 px.
       *
       * L'alpha traverse intact, jusqu'aux valeurs intermédiaires : `rapprocherVersReference`
       * recopie le canal et ne touche pas non plus au RGB des pixels sous 128 — ce canal porte
       * la couverture de la silhouette, pas une couleur de matière à réindexer.
       */
      function appliquerPalette(texture, ref) {
        if (!texture || !ref) return texture;
        const vue = { width: texture.size, height: texture.size, data: texture.data };
        const sortie = rapprocherVersReference(vue, ref);
        return { data: sortie.data, size: texture.size };
      }

      // L'invariant de l'estampage : la période de la texture doit DIVISER la taille de
      // tuile. On la ramène donc à exactement `size × size` (P = T), une fois pour
      // toutes, avant la boucle de pixels.
      //
      // Le raisonnement, à ne pas inverser : une tuile posée en case `mx` sur la carte
      // couvre les pixels monde `mx·T + lx`. Pour qu'un art cuit une seule fois convienne
      // à toutes les positions de carte, il faut `mx·T ≡ 0 (mod P)` pour tout `mx`, donc
      // `P | T`. Chaque tuile échantillonne alors la texture en (lx, ly) — la même phase
      // pour toutes — et deux tuiles voisines se raccordent exactement.
      //
      // Conséquence assumée : le motif se répète à chaque tuile. Les variantes corrigeront
      // cela plus tard.
      //
      // Moyenne d'aire à la réduction, plus proche voisin à l'agrandissement.
      //
      // Le plus proche voisin seul était un piège grave : une texture d'IA fait 512 px,
      // une tuile en fait 32, et prendre un pixel sur 256 ne réduit pas une matière — ça
      // en tire un échantillon aléatoire. Une dalle de granit devenait des confettis.
      // Chaque pixel de sortie moyenne donc tout le rectangle source qu'il couvre : la
      // couleur moyenne de la matière est conservée, et le grain se lit encore.
      //
      // À l'agrandissement (texture plus petite que la tuile), le rectangle source se
      // réduit à un pixel et la moyenne redonne exactement le plus proche voisin — ce qui
      // doit rester le cas, sinon une matière en pixel art baverait entre ses couleurs.
      //
      // Tranche 28 — la réduction compensée. Mesuré sur `sol-mix` : une moyenne d'aire pure,
      // de 512 vers 64 px, ramène l'écart-type de luminance de 27,3 à 13,0 — la moitié du
      // contraste local disparaît, mangée par la moyenne. `scripts/essai-reduire.mjs` (section
      // « moyenne compensée ») et `scripts/essai-donjon-preparer.mjs` établissent le remède
      // hors moteur : après la moyenne, un masque flou ENROULÉ (modulo — la matière est
      // raccordable, un bord répliqué fabriquerait une bande de contraste sur les quatre
      // côtés) sert de pivot local, et chaque texel s'éloigne de ce pivot dans son propre
      // sens (`texel + (texel − flou) × force`), comme un masque flou classique mais dont le
      // flou boucle.
      //
      // L'invariant qui décide de tout : la compensation ne s'applique qu'en réduction
      // STRICTE (`texture.width > size`). À taille égale la moyenne d'aire est déjà
      // l'identité exacte (chaque pixel de sortie couvre exactement un pixel source, n=1,
      // r/n=r) ; ajouter du contraste inventerait un défaut que personne n'a perdu, et les
      // treize matières intégrées — rendues à la taille exacte de la tuile — sortiraient de
      // ce chemin. C'est cette condition, et elle seule, qui garde vraies au bit près toutes
      // les empreintes SHA-256 des essais existants : aucun n'est en réduction stricte avec
      // une compensation non nulle avant cette tranche.
      //
      // `force` (défaut 1,2, comme `essai-reduire.mjs`) et `rayon` (défaut 2) sont les mêmes
      // réglages que l'essai. `force = 0` désactive la compensation — moyenne d'aire pure,
      // au bit près. Seule `force` est exposée au panneau (voir `settings.reductionCompensation`
      // dans `renderLogical` plus bas) ; `rayon` reste la valeur mesurée.
      //
      // L'alpha n'est jamais compensé, seulement moyenné comme avant : ce canal porte la
      // couverture (la silhouette vient du masque SDF, pas de l'image fournie, voir plus
      // bas), pas un contraste de matière à rétablir — et le pousser hors de [0, 255] à un
      // bord de silhouette fabriquerait une frange. Même choix que `essai-reduire.mjs`.
      //
      // Tranche 30 — le mode `'contraste'`. Cinquième paramètre, `'compensee'` par défaut :
      // les appelants d'avant la tranche, essais compris, gardent très exactement le
      // comportement T28. Le mode n'agit qu'en réduction STRICTE, comme la compensation —
      // à taille égale ou en agrandissement, les trois modes rendent la même chose, et le
      // chemin est le même code. Voir `resolveReductionMode` plus haut pour la façon dont
      // `renderLogical` choisit ce paramètre.
      function resampleTexture(texture, size, force = 1.2, radius = 2, mode = "compensee") {
        if (!texture || !texture.data || !(texture.width > 0) || !(texture.height > 0)) return null;
        // 1. La moyenne d'aire, inchangée — gardée en flottant pour ne pas arrondir deux
        // fois (une fois ici, une fois après compensation) quand la réduction s'applique.
        const avg = new Float32Array(size * size * 4);
        for (let y = 0; y < size; y += 1) {
          const y0 = Math.floor((y * texture.height) / size);
          const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * texture.height) / size));
          for (let x = 0; x < size; x += 1) {
            const x0 = Math.floor((x * texture.width) / size);
            const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * texture.width) / size));
            let r = 0, g = 0, b = 0, a = 0, n = 0;
            for (let sy = y0; sy < y1 && sy < texture.height; sy += 1) {
              for (let sx = x0; sx < x1 && sx < texture.width; sx += 1) {
                const from = (sy * texture.width + sx) * 4;
                r += texture.data[from];
                g += texture.data[from + 1];
                b += texture.data[from + 2];
                a += texture.data[from + 3];
                n += 1;
              }
            }
            const to = (y * size + x) * 4;
            avg[to] = r / n;
            avg[to + 1] = g / n;
            avg[to + 2] = b / n;
            avg[to + 3] = a / n;
          }
        }

        const data = new Uint8ClampedArray(size * size * 4);
        const reducing = texture.width > size;

        // Le chemin « contraste » (T30) : intermédiaire à 4 × la cible, expansion des
        // contours, puis un pixel REPRÉSENTATIF par bloc de 4 au lieu d'une moyenne.
        // L'alpha ne traverse jamais ce chemin — il vient de la moyenne d'aire, comme en
        // T28 : ce canal porte la couverture, pas un contraste de matière à rétablir, et
        // le choisir « le plus sombre du bloc » découperait la silhouette au hasard.
        if (reducing && mode === "contraste") {
          const interm = size * 4;
          const rgb = moyenneAireEnroulee(texture, interm);
          const lab = new Float32Array(interm * interm * 3);
          for (let i = 0; i < interm * interm; i += 1) rgbVersLab(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], lab, i * 3);
          const etendu = expansionContours(rgb, interm, epaisseurContours(size), lab);
          const petit = choixContraste(etendu, interm, 4);
          for (let i = 0; i < size * size; i += 1) {
            const p = i * 4, q = i * 3;
            data[p] = Math.round(petit[q]);
            data[p + 1] = Math.round(petit[q + 1]);
            data[p + 2] = Math.round(petit[q + 2]);
            data[p + 3] = Math.round(avg[p + 3]);
          }
          return { data, size };
        }

        if (!reducing || !(force > 0)) {
          for (let i = 0; i < size * size; i += 1) {
            const p = i * 4;
            data[p] = Math.round(avg[p]);
            data[p + 1] = Math.round(avg[p + 1]);
            data[p + 2] = Math.round(avg[p + 2]);
            data[p + 3] = Math.round(avg[p + 3]);
          }
          return { data, size };
        }

        // 2. Masque flou enroulé — séparable (passe horizontale puis verticale), chaque
        // passe boucle sur les bords par modulo. RGB seulement (voir plus haut pour l'alpha).
        const win = radius * 2 + 1;
        const blurredH = new Float32Array(size * size * 3);
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            let r = 0, g = 0, b = 0;
            for (let d = -radius; d <= radius; d += 1) {
              const sx = ((x + d) % size + size) % size;
              const p = (y * size + sx) * 4;
              r += avg[p]; g += avg[p + 1]; b += avg[p + 2];
            }
            const t = (y * size + x) * 3;
            blurredH[t] = r / win; blurredH[t + 1] = g / win; blurredH[t + 2] = b / win;
          }
        }
        const blurred = new Float32Array(size * size * 3);
        for (let y = 0; y < size; y += 1) {
          for (let x = 0; x < size; x += 1) {
            let r = 0, g = 0, b = 0;
            for (let d = -radius; d <= radius; d += 1) {
              const sy = ((y + d) % size + size) % size;
              const t = (sy * size + x) * 3;
              r += blurredH[t]; g += blurredH[t + 1]; b += blurredH[t + 2];
            }
            const o = (y * size + x) * 3;
            blurred[o] = r / win; blurred[o + 1] = g / win; blurred[o + 2] = b / win;
          }
        }

        // 3. Chaque texel s'éloigne du flou local dans son propre sens : le contraste que
        // la moyenne d'aire a mangé revient, sans déplacer la couleur moyenne de la matière
        // (le flou d'un signal constant vaut le signal, donc la compensation y est nulle).
        for (let i = 0; i < size * size; i += 1) {
          const p = i * 4, f = i * 3;
          data[p] = Math.round(avg[p] + (avg[p] - blurred[f]) * force);
          data[p + 1] = Math.round(avg[p + 1] + (avg[p + 1] - blurred[f + 1]) * force);
          data[p + 2] = Math.round(avg[p + 2] + (avg[p + 2] - blurred[f + 2]) * force);
          data[p + 3] = Math.round(avg[p + 3]);
        }
        return { data, size };
      }

      // Texel à la position locale dans la tuile. Le modulo rend l'invariant explicite :
      // la phase ne dépend que de (lx, ly), jamais de la case d'atlas (cx, cy) — celles-ci
      // encodent la position dans l'atlas, pas la position sur la carte, et ne servent
      // qu'au bruit, qui n'a pas besoin de se raccorder. L'alpha de la texture est ignoré :
      // la silhouette vient du masque SDF, pas de l'image fournie.
      function texelAt(texture, lx, ly) {
        const i = ((ly % texture.size) * texture.size + (lx % texture.size)) * 4;
        return { r: texture.data[i], g: texture.data[i + 1], b: texture.data[i + 2] };
      }

      // ===========================================================================
      // Les matières, et le terrain inférieur — tranche T7
      // ===========================================================================
      //
      // Jusqu'ici une tuile portait UNE matière, et tout ce qui sortait du masque restait
      // transparent : l'herbe s'arrêtait sur du vide. C'est pour cela qu'un tileset
      // SpriteForge n'avait qu'un matériau. `settings.lowerTerrain` — optionnel, sur le
      // modèle de `surfaceTexture` / `edgeTexture` — pose une seconde matière sous la
      // première. Absent, RIEN ne bouge, au bit près : c'est la règle qui prime sur toutes
      // les autres de cette tranche, et l'empreinte SHA-256 du mode 15 en est le garde-fou.
      //
      //   settings.lowerTerrain = {
      //     baseColor,       // {r,g,b} — la surface du terrain du dessous
      //     edgeColor,       // {r,g,b} — vers quoi elle fonce en approchant de la frontière
      //     surfaceTexture,  // {data,width,height} ou absent — même forme que celles du dessus
      //     edgeTexture,     // idem
      //   }
      //
      // Ce que le terrain inférieur n'emprunte PAS au terrain supérieur : ses textures.
      // Sinon `{ baseColor: sable }` rendrait de l'herbe teintée sable et on ne verrait
      // jamais la couleur demandée. Sa couleur de surface, elle, doit bien valoir quelque
      // chose : à défaut, celle du dessus. Et sa couleur de contour vaut, à défaut, sa
      // propre couleur de surface — donc pas d'assombrissement qu'on n'aurait pas demandé.

      /** Normalise `settings.lowerTerrain`, ou `null` quand il n'y en a pas — le défaut. */
      function resolveLowerTerrain(settings) {
        const spec = settings.lowerTerrain;
        if (!spec) return null;
        const baseColor = spec.baseColor || settings.baseColor;
        return {
          baseColor,
          edgeColor: spec.edgeColor || baseColor,
          surfaceTexture: spec.surfaceTexture || null,
          edgeTexture: spec.edgeTexture || null,
        };
      }

      /**
       * Les terrains que l'atlas porte réellement, du dessous vers le dessus. C'est ce que
       * le moteur sait rendre, exposé sous une forme que l'export et l'interface peuvent
       * consommer sans le redeviner depuis les réglages : une `wangcolor` par entrée côté
       * Tiled, un index de terrain par entrée côté Godot, dans cet ordre. Sans terrain
       * inférieur, la liste a une seule entrée — exactement le tileset à un matériau
       * d'avant, et `paintedTerrain` reste 0.
       */
      function terrainLayers(settings) {
        const lower = resolveLowerTerrain(settings);
        const layers = [];
        if (lower) {
          layers.push({
            role: "lower",
            index: 0,
            baseColor: lower.baseColor,
            edgeColor: lower.edgeColor,
            textured: !!(lower.surfaceTexture || lower.edgeTexture),
          });
        }
        layers.push({
          role: "upper",
          index: layers.length,
          baseColor: settings.baseColor,
          edgeColor: settings.edgeColor,
          textured: !!(settings.surfaceTexture || settings.edgeTexture),
        });
        return layers;
      }

      // ===========================================================================
      // La case entièrement inférieure du blob — tranche 7 bis
      // ===========================================================================
      //
      // Le trou que cette tranche répare : à la différence de W16, dont le masque 0 dit
      // déjà « aucun coin du dessus » — la tuile est donc naturellement tout le dessous —
      // B47 n'a AUCUN masque qui veuille dire « rien de la matière du dessus ». Son masque
      // 0 est l'îlot isolé, où le dessus reste bien présent, en petit. Sans une case dédiée,
      // aucune tuile du blob ne sait peindre le sable loin de toute île : une carte de test
      // affichait un îlot répété sur chaque case hors de l'île elle-même.
      //
      // La disposition de B47 a justement une case qu'aucun des 47 masques n'occupe — 47
      // est premier, 48 cases n'en tombent jamais juste (voir tile-masks.js). C'est elle
      // qu'on affecte à ce rôle : lue sur `B47.layout.unusedCells`, jamais recopiée en dur,
      // pour qu'un changement de disposition côté tile-masks.js se répercute ici tout seul.
      //
      // Exposée pour `public/exports.js`, qui en a besoin pour déclarer, côté Godot comme
      // côté Tiled, une tuile dont TOUS les bits de peering pointent vers le terrain
      // inférieur — exactement ce que pose l'autotiler quand on peint le terrain du dessous.
      const BLOB_LOWER_CELL = { col: B47.layout.unusedCells[0].col, row: B47.layout.unusedCells[0].row };

      // Une « matière » : les deux extrémités du dégradé — surface d'un côté, contour de
      // l'autre — en couleurs et/ou en textures, plus la rampe précalculée.
      //
      // La rampe n'est pas un autre calcul, c'est le même : `ramp[i]` vaut exactement
      // `mixColor(base, edge, i / (shades - 1))`, ce que fait l'autre branche texel par
      // texel. On la garde parce qu'elle épargne un mélange par pixel sur le chemin sans
      // texture — celui du rendu par défaut — pas parce qu'elle rendrait autre chose.
      function makeMaterial(shades, baseColor, edgeColor, surface, edgeTex) {
        const ramp = [];
        for (let i = 0; i < shades; i += 1) ramp.push(mixColor(baseColor, edgeColor, i / (shades - 1)));
        return {
          baseColor,
          edgeColor,
          surface: surface || null,
          edgeTex: edgeTex || null,
          textured: (surface || null) !== null || (edgeTex || null) !== null,
          ramp,
        };
      }

      /**
       * Couleur d'une matière au niveau de nuance `shade`, à la position locale (lx, ly).
       *
       * `phase` (tranche T13, `NO_TEXTURE_PHASE` par défaut) décale la LECTURE de texture,
       * sans rien changer à la position du pixel écrit : c'est le seul canal par lequel
       * une variante montre un autre bout de la matière (voir `variantTexturePhase`). Il
       * est nul partout ailleurs — le chemin sans texture n'en dépend même pas, il rend sa
       * rampe précalculée —, donc aucun rendu existant ne bouge d'un octet.
       */
      function materialColor(material, shades, shade, lx, ly, phase = NO_TEXTURE_PHASE) {
        if (!material.textured) return material.ramp[shade];
        return mixColor(
          material.surface ? texelAt(material.surface, lx + phase.tx, ly + phase.ty) : material.baseColor,
          material.edgeTex ? texelAt(material.edgeTex, lx + phase.tx, ly + phase.ty) : material.edgeColor,
          shade / (shades - 1),
        );
      }

      function axisMapper(tile, g) {
        if (g === 0) return (o) => ({ cell: Math.floor(o / tile), local: o % tile });
        const period = tile + g;
        return (o) => {
          const m = o % period;
          if (m < g) return { cell: -1, local: 0 };
          return { cell: Math.floor(o / period), local: m - g };
        };
      }

      function renderLogical(settings) {
        const tile = settings.tileSize;
        const g = settings.showGrid ? 1 : 0;
        const topdown17 = settings.tilesetType === "topdown-17";
        const blob = settings.tilesetType === "blob-47";
        const edge = settings.tilesetType === "edge-16";
        const wall = settings.tilesetType === "wall";
        // Colonnes et lignes séparées : le blob tient en 8 × 6. Les deux dispositions
        // historiques retombent sur 4 × 4 et 5 × 5, donc leur atlas ne bouge pas.
        const { columns, rows } = atlasShape(
          settings.tilesetType,
          settings.variants,
          settings.animatedFrames,
          settings.animatedAtlasCopies,
          settings.decor,
        );

        // Décor organique (tranche T27) : `decorTarget` reste `null` dès que le réglage
        // est absent ou vaut « aucun » — `atlasShape` n'a alors compté aucune ligne de
        // décor, donc `ay.cell` ne peut jamais atteindre `decorFirstRow`, et rien de ce
        // qui suit n'est atteint. C'est le critère d'acceptation n°2 : à décor nul,
        // l'atlas est celui d'aujourd'hui au bit près.
        const decorTarget = decorAtlasDescriptor(
          settings.tilesetType,
          settings.decor,
          settings.variants,
          settings.animatedFrames,
          settings.animatedAtlasCopies,
        );
        const decorFirstRow = decorTarget ? decorTarget.firstRow : Infinity;

        // Le bloc en biais (T43). Deux lignes, toujours présentes en mode mur, toujours
        // aux mêmes indices — elles ne dépendent d'aucun réglage, contrairement au décor.
        const biaisTarget = biaisAtlasDescriptor(settings.tilesetType);

        // Copies de phase de l'atlas entier (tranche T10 bis). `atlasCopies` vaut 0 dès
        // que le réglage est absent, à 0 ou à 1 : `copyPhases` reste alors `null`, la
        // boucle de pixels ne remappe aucune ligne et ne déphase rien — le rendu par
        // défaut ne bouge pas d'un octet.
        const atlasCopies = clampAtlasCopies(settings.tilesetType, settings.animatedAtlasCopies);
        const copyRows = atlasCopies > 0 ? atlasCopyRows(settings.tilesetType, settings.variants) : 0;
        const copyPhases = atlasCopies > 0 ? Array.from({ length: atlasCopies }, (_, k) => atlasPhase(k, atlasCopies)) : null;

        // Variantes (tranche T8) : `variantTarget` reste `null` dès que `variants` vaut
        // 0 ou que la disposition n'a pas de tuile pleine identifiable — dans les deux
        // cas la ligne neuve n'existe même pas (atlasShape ne l'a pas comptée non plus),
        // donc rien dans la boucle de pixels ci-dessous ne peut la viser. C'est ce qui
        // garantit le critère d'acceptation n°1 : à 0, au bit près, rien ne change.
        const variantCount = clampVariants(settings.variants);
        const variantTarget = variantCount > 0 ? fullTileOfLayout(settings.tilesetType) : null;
        const variantRow = variantTarget ? TILESET_LAYOUTS[settings.tilesetType].rows : null;
        // Déphasage de texture par variante (tranche T13). `settings.texturePhase` est
        // l'AUTORISATION donnée par la matière, jamais une déduction du moteur : à défaut
        // — réglage absent, texture importée, matière à motif régulier — la table reste
        // `null` et chaque variante lit sa texture exactement là où l'originale la lit,
        // c'est-à-dire le comportement d'avant cette tranche, au bit près. Précalculée
        // hors de la boucle de pixels : elle ne dépend que de l'index de la variante.
        const variantTexPhases =
          variantTarget && settings.texturePhase
            ? Array.from({ length: variantCount }, (_, i) => variantTexturePhase(tile, i + 1, settings.seed))
            : null;

        // Images d'animation (tranche T10) : même garde qu'au-dessus, pour la même
        // raison — `animatedTarget` à `null` dès que `animatedFrames` vaut 0 ou que la
        // disposition n'a pas de tuile pleine, et alors aucune ligne neuve n'existe côté
        // atlasShape non plus. Les images descendent dans la COLONNE de la tuile pleine,
        // l'image 0 étant sa case même — contrainte du moteur, voir animationRowStride.
        // Les deux mécanismes ne cohabitent pas, et c'est une décision : ils ajoutent
        // tous deux des lignes sous l'atlas, et la garantie de non-recouvrement de
        // T10 bis (« le pas est le même pour toutes les tuiles ») cesserait d'être vraie
        // par construction s'il fallait en plus loger les images d'une tuile unique
        // DANS une copie. Les copies d'atlas priment ; l'écran désactive l'autre
        // réglage pour que ce ne soit pas un silence.
        const animatedFrameCount = atlasCopies > 0 ? 0 : clampAnimatedFrames(settings.tilesetType, settings.animatedFrames);
        const animatedTarget = animatedFrameCount > 0 ? fullTileOfLayout(settings.tilesetType) : null;
        const animatedStride = animatedTarget ? animationRowStride(settings.tilesetType, settings.variants) : 0;
        // Première ligne ajoutée sous la disposition (et sous les variantes) : au-delà,
        // une case qui n'est pas une image d'animation est du vide, pas un trou de
        // disposition — la chaîne de masques plus bas n'a rien à y lire.
        const animatedFirstAddedRow = animatedTarget
          ? TILESET_LAYOUTS[settings.tilesetType].rows + (variantTarget ? 1 : 0)
          : null;
        const width = tile * columns + g * (columns + 1);
        const height = tile * rows + g * (rows + 1);
        const logical = document.createElement("canvas");
        logical.width = width;
        logical.height = height;
        const logicalCtx = logical.getContext("2d");
        const image = logicalCtx.createImageData(width, height);
        const data = image.data;
        const roughness = settings.edgeStyle === "clean" ? 0 : settings.edgeRoughness;
        const noiseSize = Math.max(1, settings.edgeFrequency);
        const bg = settings.whiteBackground ? { r: 255, g: 255, b: 255, a: 255 } : { r: 0, g: 0, b: 0, a: 0 };
        const mapAxis = axisMapper(tile, g);

        // Limited palette: a ramp of N colours from base (lightest) to edge (darkest).
        // Every grass pixel snaps to one of these, so the tile reads as pixel art with a
        // fixed palette instead of a smooth gradient.
        const shades = Math.max(2, Math.round(settings.shades));

        // Textures optionnelles (`{data: Uint8ClampedArray RGBA, width, height}` ou null),
        // ramenées une seule fois à la taille de tuile. Quand elles sont absentes, la
        // matière garde sa rampe précalculée : le chemin par défaut reste identique au
        // pixel près.
        //
        // La réduction de texture (T28 puis T30) : `settings.reductionMode` choisit entre
        // la moyenne d'aire nue, la moyenne compensée et le réducteur conscient du
        // contraste ; absent, il vaut `'moyenne'` — c'est ce défaut moteur, et non celui du
        // panneau, qui garde les essais existants vrais au bit près. Voir
        // `resolveReductionMode`. C'est le SEUL point d'application de la réduction dans
        // tout le rendu : les cinq appels ci-dessous sont groupés exprès, et T31 s'y est
        // branchée — `reduire` réduit PUIS pose la palette, pour les cinq, dans cet ordre.
        const { mode: reductionMode, force: reductionForce } = resolveReductionMode(settings);
        // T31 — la palette de référence, juste APRÈS la réduction et sur les cinq textures.
        // `paletteRef` reste `null` tant que `settings.palette` est absent, et `reduire` est
        // alors très exactement l'appel de T30 : c'est ce qui garde les empreintes vraies au
        // bit près. Voir `resolvePalette` pour la forme attendue.
        const paletteRef = resolvePalette(settings);
        const reduire = (texture) =>
          appliquerPalette(resampleTexture(texture, tile, reductionForce, 2, reductionMode), paletteRef);
        const surfaceTexture = reduire(settings.surfaceTexture);
        const edgeTexture = reduire(settings.edgeTexture);
        const upperMaterial = makeMaterial(shades, settings.baseColor, settings.edgeColor, surfaceTexture, edgeTexture);

        // La bande face du mur peut recevoir sa propre texture, distincte de celle du
        // dessus — c'est le réglage que la tranche T3 demande. Tant qu'on ne lui en donne
        // pas, elle retombe sur `surfaceTexture` : le rendu par défaut reste cohérent avec
        // le dessus plutôt que de retomber sur un gris sans texture.
        const faceTexture = reduire(settings.faceTexture);
        const faceMaterial = makeMaterial(shades, settings.baseColor, settings.edgeColor, faceTexture || surfaceTexture, edgeTexture);

        // Le terrain inférieur — voir la section « Les matières » plus haut. `null` par
        // défaut, et c'est ce `null` qui fait que tout le reste du fichier se comporte
        // exactement comme avant : partout où le rendu écrivait `bg`, il continue de
        // l'écrire tant que cette matière n'existe pas.
        const lowerSpec = resolveLowerTerrain(settings);
        const lowerMaterial = lowerSpec
          ? makeMaterial(
              shades,
              lowerSpec.baseColor,
              lowerSpec.edgeColor,
              reduire(lowerSpec.surfaceTexture),
              reduire(lowerSpec.edgeTexture),
            )
          : null;

        // =====================================================================
        // Le relief — la lumière rasante sur la frontière
        // =====================================================================
        //
        // Ce qui manquait pour qu'une silhouette se lise comme un VOLUME et non
        // comme une découpe : jusqu'ici tous les bords s'assombrissaient de la même
        // façon, quelle que soit leur orientation. Un bord nord et un bord sud
        // rendaient le même liseré, donc rien ne disait de quel côté venait la
        // lumière, donc rien ne disait qu'il y avait une épaisseur.
        //
        // La normale de la frontière ne se devine pas depuis le masque : elle se LIT,
        // comme la pente du champ de distance signée en ce point. C'est gratuit — la
        // même fonction, évaluée en quatre points voisins.
        //
        // Deux décisions qui comptent :
        //
        //  * la pente se lit sur le SDF NU, sans le bruit de bord. Le bruit est une
        //    haute fréquence d'amplitude 3 px : sa dérivée domine complètement celle
        //    de la géométrie, et l'éclairage deviendrait un scintillement. La
        //    silhouette garde son bruit, sa lumière non.
        //  * le résultat est quantifié en crans d'un tiers. Un cosinus continu rend
        //    un dégradé mou sur trois pixels ; le pixel art veut des paliers.
        //
        // `relief` à 0 rend AO = 1 et lift = 0, donc très exactement le rendu
        // d'avant cette tranche, au bit près — c'est ce que vérifie
        // tests/tileset.test.mjs, et c'est ce qui permet de garder les empreintes
        // historiques comme point de comparaison plutôt que de les perdre.
        const relief = clamp(settings.relief ?? 0, 0, 1);
        // La lumière vient du haut, légèrement de la gauche : la convention des jeux
        // vus de dessus, et celle que l'œil lit sans y penser.
        const LIGHT_X = -0.38;
        const LIGHT_Y = -0.925;
        // Jusqu'où l'ombre de contact s'étend sur le terrain du dessous.
        const contactLength = Math.max(2, tile * 0.14);

        /** Le cosinus normale sortante × lumière, en crans d'un tiers. `geo` = le SDF nu. */
        function grazing(geo, lx, ly) {
          const gx = geo(lx + 1, ly) - geo(lx - 1, ly);
          const gy = geo(lx, ly + 1) - geo(lx, ly - 1);
          const length = Math.hypot(gx, gy);
          if (!(length > 1e-4)) return 0;
          return Math.round((((gx / length) * LIGHT_X + (gy / length) * LIGHT_Y) * 3)) / 3;
        }

        /**
         * Ce que la lumière fait d'un pixel de bord. `ao` multiplie l'assombrissement
         * de contour — un bord tourné vers la lumière le perd presque entièrement —
         * et `lift` s'ajoute ensuite à la couleur, en plus ou en moins. Les deux
         * ensemble, et pas l'un sans l'autre : `ao` seul ne peut pas monter au-dessus
         * de la couleur de surface (la rampe s'arrête là), `lift` seul laisserait le
         * bord nord aussi sombre qu'avant sous un reflet posé dessus.
         */
        function reliefOf(grazed, edgeAmount) {
          return {
            ao: 1 - relief * 0.8 * Math.max(0, grazed),
            lift: Math.round(relief * edgeAmount * grazed * 52),
          };
        }

        // Le masque de chaque case, résolu une fois : une recherche par case dans la
        // boucle de pixels ferait des millions d'appels pour un tableau de 48 entrées.
        // `null` = case volontairement vide — la 48e du blob, qu'on laisse transparente.
        const maskGrid = blob || edge
          ? Array.from({ length: rows }, (_, row) =>
              Array.from({ length: columns }, (_, col) => maskAtPosition(blob ? B47 : E16, col, row)))
          : null;

        // Dispositions raccordables : tout l'aléa se lit en coordonnées locales à la
        // tuile, et le bruit de bord reboucle sur la tuile. Voir seamlessFbm.
        //
        // Le mode 15 en fait partie, contrairement à ce que faisait la version d'origine.
        // On a longtemps cru que son bruit ne touchait que la silhouette intérieure : c'est
        // faux. Une tuile dont un seul des deux coins d'un bord est rempli porte, sur ce
        // bord, la transition plein/vide — et le bruit la déplace. Avec une graine par
        // masque, la tuile voisine déplaçait la sienne autrement : mesuré, 13 des 64 paires
        // compatibles s'écartaient jusqu'à 2 px en bordures organiques, avec les réglages
        // par défaut de l'atelier. seamlessFbm reboucle sur la tuile, donc les deux côtés
        // d'une couture lisent la même valeur et la transition tombe au même endroit.
        const seamless = blob || edge || !topdown17;
        const edgeLattice = Math.max(1, Math.round(tile / noiseSize));
        const shadeLattice = Math.max(1, Math.round(tile / 4.2));

        // -------------------------------------------------------------------------
        // L'assombrissement de bordure quand les deux côtés portent de la matière.
        //
        // Avec un seul terrain il n'y avait qu'UN versant : `edgeDepth` mesurait la
        // profondeur dans la matière et `edgeFade` faisait foncer les derniers pixels vers
        // `edgeColor`, de sorte que la silhouette se détachait du vide.
        //
        // (Note au passage, parce qu'elle change la façon de lire ce qui suit :
        // `maskVoidSdf`, écrit pour mesurer la distance au vide en mode 15, n'est plus
        // atteint depuis que ce mode est passé au bruit raccordable. `seamless` y vaut
        // désormais vrai, donc la branche `topdown17 || seamless` l'emporte toujours et
        // c'est `-adjusted` qui pilote le fondu PARTOUT. On laisse la fonction en place —
        // la retirer sort du périmètre de cette tranche — mais il n'y a plus qu'une seule
        // mesure de profondeur en service, ce qui rend son miroir évident.)
        //
        // Avec deux terrains, il n'y a plus un bord et du vide : il y a UNE frontière et
        // DEUX versants. Le choix retenu ici — c'est la décision de rendu de la tranche :
        // la frontière est la ligne `adjusted = 0`, et chaque versant lit sa distance à
        // cette même ligne, `-adjusted` au-dessus et `+adjusted` au-dessous, puis fonce
        // vers SA propre couleur de contour, sur la même largeur `edgeFade`.
        //
        // Pourquoi ce liseré symétrique plutôt qu'un liseré posé d'un seul côté :
        //  * il ne touche pas au versant du dessus, donc le rendu par défaut est intact et
        //    l'œil retrouve exactement la silhouette qu'il connaît ;
        //  * un liseré des deux côtés se lit comme un CONTACT — l'herbe s'assombrit en
        //    arrivant au sable, le sable s'assombrit sous l'herbe — là où un liseré d'un
        //    seul côté se lit comme un contour dessiné, c'est-à-dire comme la découpe aux
        //    ciseaux que cette tranche cherche justement à faire disparaître ;
        //  * il se raccorde gratuitement : `adjusted` est exactement la grandeur dont les
        //    essais de couture prouvent déjà qu'elle tombe au même endroit de part et
        //    d'autre d'une couture. Le versant du dessous hérite du raccord du dessus, sans
        //    seconde géométrie à faire coïncider ;
        //  * et il s'annule tout seul quand on n'en veut pas : un terrain inférieur qui ne
        //    déclare pas d'`edgeColor` prend sa propre couleur de surface, donc son versant
        //    reste plat et la frontière redevient une simple découpe nette.
        //
        // Couleur d'un pixel du terrain inférieur. `depth` est la distance DANS la matière
        // du dessous depuis la frontière, donc `+adjusted` ; `Infinity` là où il n'y a pas
        // de frontière de terrain à cet endroit (l'ombre portée du mur, qui est une tache
        // sur le sol et non un bord de matière) et où le fondu ne doit donc pas s'appliquer.
        //
        // Le reste suit le terrain du dessus pas à pas — fondu de bord, grain de matière,
        // taches — pour que le dessous soit un terrain et pas un aplat de fond. Deux écarts
        // délibérés :
        //  * ses graines de bruit lui sont propres (1607/1609/1613 au lieu de 17/809/421),
        //    sans quoi les deux matières partageraient le même grain à la maille près et
        //    l'on verrait que le même bruit court sous les deux côtés de la frontière ;
        //  * son grain se lit TOUJOURS en coordonnées locales, avec `seamlessFbm`, y compris
        //    en 17 pièces où le terrain du dessus garde son bruit continu d'atlas. Le
        //    terrain inférieur a ses propres bords à raccorder : on ne lui donne pas le
        //    choix.
        // -------------------------------------------------------------------------
        //
        // `phase` (tranche T10 bis, nul par défaut) : le déphasage de la copie d'atlas
        // courante. Le terrain inférieur est le premier des chemins de couleur à le
        // recevoir — sans quoi une carte à deux terrains verrait le dessus onduler
        // au-dessus d'un dessous figé, et l'animation se lirait comme un défaut.
        function lowerPixelColor(depth, ax, ay, grazed = 0, phase = NO_PHASE) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const fleckSeed = hash2(Math.floor(ax / 2 + phase.dx), Math.floor(ay / 2 + phase.dy), settings.seed + 1607);
          const fleckOn = settings.pixelFlecks && settings.fleckAmount > 0 && fleckSeed > 1 - settings.fleckAmount / 250;
          const edgeAmount = settings.edgeFade > 0 ? clamp(1 - depth / settings.edgeFade, 0, 1) : 0;
          let level = edgeAmount * (shades - 1);
          level +=
            (seamlessFbm((lx * shadeLattice) / tile + phase.dx, (ly * shadeLattice) / tile + phase.dy, settings.seed + 1609, shadeLattice) - 0.5) *
            (settings.textureNoise / 42) *
            4;
          if (fleckOn) level += hash2(ax, ay, settings.seed + 1613) > 0.6 ? 2 : 1;
          const shade = clamp(Math.round(level), 0, shades - 1);
          const color = materialColor(lowerMaterial, shades, shade, ax, ay);
          // L'ombre de contact : le terrain du dessus pose son ombre sur le dessous,
          // du côté opposé à la lumière et sur quelques pixels seulement. C'est elle
          // qui fait qu'une île se DÉTACHE du sable au lieu d'y être posée à plat —
          // la même chose qu'un liseré de contact, mais orientée, donc lue comme une
          // hauteur et non comme un trait de contour.
          //
          // Elle n'est jamais rendue sans terrain inférieur : sur du vide, il faudrait
          // écrire un alpha hors du masque, ce qui déplacerait la silhouette que tous
          // les contrôles de couture lisent. La règle de la maison tient donc : le
          // moteur ne peint QUE dans le masque et dans le terrain qu'on lui a donné.
          if (relief > 0 && grazed < 0 && depth < contactLength) {
            const amount = (1 - depth / contactLength) * -grazed * relief;
            const ombre = shadeColor(color, -Math.round(amount * 58));
            return { r: ombre.r, g: ombre.g, b: ombre.b, a: 255 };
          }
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        /** Ce qu'on écrit hors du masque : le terrain inférieur s'il existe, le fond sinon. */
        function outsideColor(depth, ax, ay, grazed = 0, phase = NO_PHASE) {
          return lowerMaterial ? lowerPixelColor(depth, ax, ay, grazed, phase) : bg;
        }

        // Couleur d'un pixel du dessus (blob 47), qu'on soit en mode `blob-47` ou dans
        // la bande dessus du mode `wall`. Verbatim entre les deux : mêmes formules, dans
        // le même ordre, que le chemin `blob` de la boucle ci-dessous — c'est ce qui
        // garantit que le dessus du mur est un calque exact du blob, jamais une resucée
        // qui pourrait diverger avec le temps. tests/tileset.test.mjs compare les deux
        // rendus au pixel près et casserait si l'un des deux chemins bougeait seul.
        function blobPixelColor(mask, ax, ay, phase = NO_PHASE) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const sdf = blobSdf(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding);
          // `phase.ex/ey` (T10 bis) déplace le bruit de bord, donc la SILHOUETTE. Le
          // bruit reste rebouclé sur la tuile — un décalage constant ne casse pas une
          // périodicité — et toutes les tuiles de la copie lisent le même décalage :
          // la couture reste exacte, c'est précisément ce qui autorise ce canal ici.
          const edgeNoise =
            (seamlessFbm((lx * edgeLattice) / tile + phase.ex, (ly * edgeLattice) / tile + phase.ey, settings.seed + 113, edgeLattice) - 0.5) *
            roughness;
          const adjusted = sdf + edgeNoise;
          // La pente ne se lit que dans la bande où elle sert : le liseré à l'intérieur,
          // l'ombre de contact à l'extérieur. Ailleurs, quatre évaluations de SDF par
          // pixel pour un résultat inutilisé.
          const grazed =
            relief > 0 && adjusted < contactLength && adjusted > -settings.edgeFade - 1
              ? grazing((x, y) => blobSdf(mask, x, y, tile, settings.cornerRadius, roughness, settings.edgePadding), lx, ly)
              : 0;
          if (adjusted > 0) return outsideColor(adjusted, ax, ay, grazed, phase);
          const fleckSeed = hash2(Math.floor(ax / 2 + phase.dx), Math.floor(ay / 2 + phase.dy), settings.seed); // pieceSeed = 0 en mode seamless
          const fleckOn = settings.pixelFlecks && settings.fleckAmount > 0 && fleckSeed > 1 - settings.fleckAmount / 250;
          const edgeDepth = -adjusted;
          const edgeAmount = settings.edgeFade > 0 ? clamp(1 - edgeDepth / settings.edgeFade, 0, 1) : 0;
          const { ao, lift } = reliefOf(grazed, edgeAmount);
          let level = edgeAmount * (shades - 1) * ao;
          // T38 : la pénombre des coins rentrants s'ajoute ICI, au niveau AVANT
          // quantification — jamais par shadeColor après coup, contrairement à la
          // pénombre d'angle des bandes basses (wallCornerOcclusionShade). Raison :
          // l'essai qui vérifie que chaque pixel du dessus n'emploie que les quatre
          // échelons de la palette (tests/tileset.test.mjs, « un terrain inférieur uni »)
          // passerait sur des RVB hors rampe si l'occlusion se composait en continu
          // après l'arrondi. Additionnée ici, elle se quantifie comme le reste du
          // dessus et cet essai reste vert sans y être touché.
          level += blobCornerOcclusionShade(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding, wallCornerOcclusion);
          level +=
            (seamlessFbm((lx * shadeLattice) / tile + phase.dx, (ly * shadeLattice) / tile + phase.dy, settings.seed + 809, shadeLattice) - 0.5) *
            (settings.textureNoise / 42) *
            4;
          if (fleckOn) level += hash2(ax, ay, settings.seed + 421) > 0.6 ? 2 : 1;
          const shade = clamp(Math.round(level), 0, shades - 1);
          const base = materialColor(upperMaterial, shades, shade, ax, ay);
          const color = lift ? shadeColor(base, lift) : base;
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        // Couleur d'un pixel de variante (tranche T8) OU d'image d'animation (tranche
        // T10) — voir « Variantes de la tuile pleine » et « Tuiles animées » plus haut
        // dans le fichier. Reprend très exactement la même géométrie (blobSdf / edgeSdf /
        // maskSdf) et le même bruit de bord — seamlessFbm à `settings.seed + 113`, LA
        // GRAINE DE L'ATLAS, jamais celle de la variante ni un déphasage — que le rendu
        // normal de la tuile pleine : `sdf + edgeNoise` est donc un calque bit à bit de
        // l'originale, ce qui est tout ce que garantit l'interchangeabilité (l'essai qui
        // compte, dans les deux tranches). Seuls `level` (le niveau de teinte) et le
        // placement des taches lisent `grainSeed` et `phase` : eux seuls dessinent le
        // grain et les taches, jamais le contour. L'échantillonnage de texture, lui, ne
        // lit ni l'une ni l'autre — seulement (ax, ay) — donc un damier y tombe
        // exactement comme sur la tuile d'origine.
        //
        // `phase` ({dx, dy}, nul par défaut) est le déphasage circulaire de T10 — voir
        // animationPhase. Un appel de variante ne le passe jamais : il reste (0, 0), donc
        // `ax/2 + 0`, `.../tile + 0`, etc. valent exactement ce qu'ils valaient avant
        // cette tranche — AUCUN octet ne bouge pour les variantes. C'est ce qui garantit
        // que cette fonction, partagée entre les deux tranches, ne fait bouger ni l'une ni
        // l'autre empreinte SHA-256 existante.
        // Ce que la tranche T10 bis y ajoute : `phase.ex/ey`, le déphasage du bruit de
        // BORD. Il vaut 0 pour une variante comme pour une image de T10 — l'invariant
        // d'interchangeabilité ci-dessus tient donc mot pour mot dans ces deux cas —
        // et il ne devient non nul que pour une copie d'atlas, où il n'y a plus de
        // tuile statique voisine avec qui rester interchangeable.
        function fullTilePixelColor(tilesetType, mask, ax, ay, grainSeed, phase = NO_PHASE, texPhase = NO_TEXTURE_PHASE) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const sdf =
            tilesetType === "blob-47"
              ? blobSdf(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding)
              : tilesetType === "edge-16"
                ? edgeSdf(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.strokeWidth)
                : maskSdf(mask, lx, ly, tile, settings.cornerRadius, roughness);
          const edgeNoise =
            (seamlessFbm((lx * edgeLattice) / tile + phase.ex, (ly * edgeLattice) / tile + phase.ey, settings.seed + 113, edgeLattice) -
              0.5) *
            roughness;
          const adjusted = sdf + edgeNoise;
          // La lumière lit la MÊME géométrie que la tuile d'origine, sans déphasage :
          // c'est ce qui garde une variante et une image d'animation interchangeables
          // avec elle — voir le commentaire d'en-tête de cette fonction.
          const geo =
            tilesetType === "blob-47"
              ? (x, y) => blobSdf(mask, x, y, tile, settings.cornerRadius, roughness, settings.edgePadding)
              : tilesetType === "edge-16"
                ? (x, y) => edgeSdf(mask, x, y, tile, settings.cornerRadius, roughness, settings.strokeWidth)
                : (x, y) => maskSdf(mask, x, y, tile, settings.cornerRadius, roughness);
          const grazed =
            relief > 0 && adjusted < contactLength && adjusted > -settings.edgeFade - 1 ? grazing(geo, lx, ly) : 0;
          if (adjusted > 0) return outsideColor(adjusted, ax, ay, grazed, phase);
          const fleckSeed = hash2(Math.floor(ax / 2 + phase.dx), Math.floor(ay / 2 + phase.dy), grainSeed);
          const fleckOn = settings.pixelFlecks && settings.fleckAmount > 0 && fleckSeed > 1 - settings.fleckAmount / 250;
          const edgeDepth = -adjusted;
          const edgeAmount = settings.edgeFade > 0 ? clamp(1 - edgeDepth / settings.edgeFade, 0, 1) : 0;
          const { ao, lift } = reliefOf(grazed, edgeAmount);
          let level = edgeAmount * (shades - 1) * ao;
          level +=
            (seamlessFbm((lx * shadeLattice) / tile + phase.dx, (ly * shadeLattice) / tile + phase.dy, grainSeed + 809, shadeLattice) -
              0.5) *
            (settings.textureNoise / 42) *
            4;
          if (fleckOn) level += hash2(ax, ay, grainSeed + 421) > 0.6 ? 2 : 1;
          const shade = clamp(Math.round(level), 0, shades - 1);
          // `texPhase` (T13) : la SEULE lecture déphasée de la fonction. La géométrie, le
          // bruit de bord et la lumière lisent tous (ax, ay) tels quels au-dessus — c'est ce
          // qui garde une variante interchangeable avec l'originale, alpha pour alpha,
          // pendant que sa matière montre un autre bout d'elle-même.
          const base = materialColor(upperMaterial, shades, shade, ax, ay, texPhase);
          const color = lift ? shadeColor(base, lift) : base;
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        // Couleur d'un pixel d'une bande basse (face, base, ombre). Même schéma que
        // blobPixelColor — géométrie (wallFootprintSdf / shadowSdf) puis bruit de bord
        // puis, hors ombre, dégradé de bord. T25 : la face et la base partagent
        // désormais EXACTEMENT le même chemin de couleur (même matière, même rampe de
        // nuances, même grain, même relief) — la base est la dernière rangée de la
        // face, pas une troisième matière. Seule l'ombre garde la sienne, à part : un
        // noir semi-transparent — posé sur le terrain inférieur quand il y en a un,
        // laissé à composer à l'appelant sinon.
        // T23 : l'ombre portée est refusable, mais sa GÉOMÉTRIE (shadowSdf, shadowRow)
        // ne bouge jamais — voir le commentaire au-dessus de shadowSdf. Seul son alpha
        // suit le réglage, avec le même défaut que le rendu d'avant cette tranche quand
        // il est absent (settings vient d'un test, d'un script, ou d'un panneau qui n'a
        // pas encore le curseur). À 0, la bande reste déclarée et exportée comme avant
        // — c'est son CONTENU qui devient entièrement transparent, ce qui suffit à faire
        // disparaître l'ombre partout où l'atlas est consommé (aperçu de jeu, export)
        // sans toucher un seul autre fichier.
        const wallShadowAlpha = settings.wallShadowAlpha ?? WALL_SHADOW_ALPHA;
        // T37 : la pénombre d'angle et son réglage. Absent, il vaut ZÉRO — et non la valeur
        // du panneau, contrairement à `wallShadowAlpha` juste au-dessus. Le défaut non nul
        // vit dans `tileSettings()` (public/tools.js) et nulle part ailleurs. Ce n'est pas
        // une incohérence mais une séparation des causes : cette tranche fait bouger les
        // trois empreintes du mode `wall` UNE fois, par la géométrie des deux colonnes
        // neuves, et T38 — qui rebranchera ce même réglage sur le DESSUS du mur — n'aura
        // plus à les faire bouger une seconde fois pour un dessin qu'elle ne change pas.
        // Conséquence utile et vérifiée par essai : à `wallCornerOcclusion: 0`, les six
        // colonnes historiques des trois bandes sont celles d'avant la tranche, au bit près.
        const wallCornerOcclusion = settings.wallCornerOcclusion ?? 0;
        // `biais` (T43) est `null` partout sauf pour les douze tuiles en biais — et c'est
        // ce qui garde les trois bandes historiques identiques AU BIT PRÈS : chaque lecture
        // ci-dessous retombe littéralement sur son expression d'avant quand il est absent.
        // Quand il est là, il porte les quatre seules choses que le cisaillement déplace :
        //   lecture  — la LIGNE de matière à lire, repliée sur la tuile (la matière a une
        //              période d'exactement une tuile : c'est toute la prémisse) ;
        //   ombreLy  — la ligne où évaluer la boîte d'ombre portée, NON repliée : c'est de
        //              la géométrie, elle doit descendre avec le pied du mur ;
        //   rampe    — la ligne où lire la pénombre de contact au sol, non repliée non
        //              plus, et pour la même raison.
        // Le bruit de BORD et le relief rasant, eux, lisent (lx, ly) tels quels : ils
        // décrivent la case, pas la matière, et bruiter la coupe ouvre 43 px de trous.
        function wallBandPixelColor(bandId, state, ax, ay, biais = null) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const lyMatiere = biais ? biais.lecture + 0.5 : ly;
          const sdf =
            bandId === "shadow"
              ? shadowSdf(state, lx, biais ? biais.ombreLy : ly, tile, settings.cornerRadius, roughness, settings.edgePadding)
              : wallFootprintSdf(state, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding);
          const edgeNoise =
            (seamlessFbm((lx * edgeLattice) / tile, (ly * edgeLattice) / tile, settings.seed + 113, edgeLattice) - 0.5) *
            roughness;
          const adjusted = sdf + edgeNoise;
          // La base lit le même relief que la face — voir le commentaire d'en-tête de
          // cette fonction : elle n'est plus une matière à part, donc plus une
          // géométrie à part pour la lumière rasante non plus.
          const grazed =
            (bandId === "face" || bandId === "base") &&
            relief > 0 &&
            adjusted < contactLength &&
            adjusted > -settings.edgeFade - 1
              ? grazing((x, y) => wallFootprintSdf(state, x, y, tile, settings.cornerRadius, roughness, settings.edgePadding), lx, ly)
              : 0;

          // L'ombre portée ne borde aucun terrain : c'est une tache SUR le sol, pas une
          // frontière de matière — d'où le `Infinity` passé au fondu. Sans terrain
          // inférieur elle reste ce qu'elle était, un noir semi-transparent que l'appelant
          // compose lui-même sur ce qu'il veut. Avec un terrain inférieur, le sol existe
          // pour de bon : on compose l'ombre dessus et la case devient opaque, sans quoi
          // le sol s'interromprait sous le pied du mur, exactement le trou que cette
          // tranche supprime partout ailleurs.
          if (bandId === "shadow") {
            if (!lowerMaterial) return adjusted > 0 ? bg : { r: 0, g: 0, b: 0, a: wallShadowAlpha };
            const ground = lowerPixelColor(Infinity, ax, ay);
            if (adjusted > 0) return ground;
            const shaded = mixColor(ground, { r: 0, g: 0, b: 0 }, wallShadowAlpha / 255);
            return { r: shaded.r, g: shaded.g, b: shaded.b, a: 255 };
          }

          if (adjusted > 0) return outsideColor(adjusted, ax, ay, grazed);

          // bandId === "face" ou "base" : à partir d'ici, LE MÊME calcul pour les
          // deux — même géométrie de bord (sdf ci-dessus vient déjà de
          // wallFootprintSdf dans les deux cas), même bruit de joint, même grain,
          // même relief. C'est ce qui fait que la base se lit comme la continuation
          // de la face plutôt que comme une matière posée à côté.
          //
          // La périodicité de seamlessFbm sur exactement une tuile pleine (voir son
          // commentaire d'en-tête, « bruit raccordable ») fait que ce calcul, rejoué
          // ici sur les coordonnées LOCALES de la base (0..tile, la même convention
          // que celles de la face), se raccorde sans couture au bas de la face qui
          // se répète juste au-dessus dans le mur assemblé — sans qu'aucun
          // déphasage n'y soit nécessaire : la ligne ay=0 de la base retombe très
          // exactement là où la ligne ay=tile d'une face aurait rebouclé.
          const edgeDepth = -adjusted;
          const edgeAmount = settings.edgeFade > 0 ? clamp(1 - edgeDepth / settings.edgeFade, 0, 1) : 0;
          const { ao, lift } = reliefOf(grazed, edgeAmount);
          let level = edgeAmount * (shades - 1) * ao;
          level +=
            (seamlessFbm((lx * shadeLattice) / tile, (lyMatiere * shadeLattice) / tile, settings.seed + 809, shadeLattice) - 0.5) *
            (settings.textureNoise / 42) *
            4;
          const shade = clamp(Math.round(level), 0, shades - 1);
          const faceBase = materialColor(faceMaterial, shades, shade, ax, biais ? biais.lecture : ay);
          const lit = lift ? shadeColor(faceBase, lift) : faceBase;

          // Les deux pénombres, additionnées puis appliquées EN UNE FOIS. Celle de
          // contact avec le sol ne concerne que la base (voir wallBaseContactShade) :
          // nulle sur ses deux premiers tiers, la base y reste un calque exact de ce
          // que la face aurait rendu, au pixel près. Celle d'angle ne concerne que les
          // deux états de coin, sur les deux bandes à la fois — la joue du mur qui
          // revient est visible sur toute sa hauteur, pas seulement à son pied.
          //
          // Additionner avant `shadeColor` plutôt qu'enchaîner deux appels : dans le
          // coin BAS d'un état de coin les deux rampes se superposent, et deux
          // arrondis successifs y feraient un palier d'une unité — visible, puisque
          // c'est exactement le pixel que l'œil va chercher pour lire l'angle.
          //
          // L'ombre portée, elle, n'en reçoit aucune des deux : elle est rendue plus
          // haut et sort avant ici. Une tache sur le sol n'a pas de joue.
          const assombrissement =
            (bandId === "base" ? wallBaseContactShade(biais ? biais.rampe : ay, tile) : 0) +
            wallCornerOcclusionShade(state, ax, tile, wallCornerOcclusion);
          const color = assombrissement > 0 ? shadeColor(lit, -assombrissement) : lit;
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        // ---------------------------------------------------------------------
        // Les douze tuiles en biais (T43)
        // ---------------------------------------------------------------------
        //
        // L'emprise d'une pièce en biais est celle d'un `middle` — les deux côtés
        // débordants, aucun bord libre dans la case — et ce n'est pas un raccourci :
        // c'est ce qui rend la face cisaillée PIXEL POUR PIXEL identique à la face droite
        // qu'elle remplace, à la seule ligne de lecture près. D'où une conséquence qu'il
        // faut dire, parce qu'elle se voit : LA COUPE EST UN MASQUE D'ALPHA, PAS UNE
        // GÉOMÉTRIE. Elle ne passe pas par le SDF. Si elle y passait, la diagonale
        // deviendrait un bord, donc recevrait le fondu de bord et le relief rasant — un
        // liseré sombre le long de la coupe, exactement là où l'œil cherche la continuité
        // entre les deux moitiés. Masquée, la moitié gardée est le morceau exact de la
        // tuile pleine, ce qu'un essai vérifie au bit près.
        const WALL_BIAIS_STATE = { id: "middle", west: true, east: true };
        // Factorisée de `wallBiaisPixelColor` (T45) : le corps ne dépendait déjà que de
        // `piece` et `sens`, jamais de l'entrée d'atlas elle-même — `wallRaccordBasePixelColor`
        // le réutilise mot pour mot avec une pièce hors de `WALL_BIAIS_PIECES`, ce qui
        // garantit que sa moitié `u > 0` est le même calcul, au bit près, que `base-haute`.
        function biaisPieceColor(piece, sens, ax, ay) {
          const u = biaisU(sens, ax, ay, tile);
          if (!biaisGarde(piece, u)) {
            // La moitié jetée du raccord haut n'est pas du vide : c'est le DESSUS de la
            // marche, qui descend en lobe sur cette moitié. Le masque plein (aucun bord
            // libre) et non le masque de la case : le bord AVANT d'un dessus de mur est
            // raccordé depuis T22 (bit sud forcé) — il n'y a rien sous lui que la face —
            // et `docs/reference/reference.png` le confirme, où le liseré clair court sur
            // les bords LIBRES et jamais sur l'arête dessus/face, qui n'est qu'un pli
            // d'ombre. Le contour irait donc contre la référence, pas seulement contre T22.
            return piece.dessus ? blobPixelColor(B47.fullMask, ax, ay) : bg;
          }
          const decalage = piece.decalage * tile;
          return wallBandPixelColor(piece.band, WALL_BIAIS_STATE, ax, ay, {
            // Repliée sur la tuile : c'est exactement ce que la mesure a validé au bit près.
            lecture: ((u % tile) + tile) % tile,
            ombreLy: u + 0.5 + decalage,
            // Bornée à la dernière ligne de la tuile : sur la diagonale elle-même,
            // `u + decalage` vaut `tile` pile, un cran au-delà de la rampe, et la pénombre
            // y dépasserait son maximum d'une unité — visible, puisque c'est le pixel du
            // pied du mur que l'œil suit le long de la pente.
            rampe: Math.min(u + decalage, tile - 1),
          });
        }
        function wallBiaisPixelColor(entry, ax, ay) {
          const piece = WALL_BIAIS_PIECES.find((p) => p.id === entry.piece);
          return biaisPieceColor(piece, entry.sens, ax, ay);
        }

        // ---------------------------------------------------------------------
        // La pièce RACCORD-BASE (T45) — mur d'une case de haut
        // ---------------------------------------------------------------------
        //
        // `coupe: "bas"` garde la moitié `u > 0` par `wallBandPixelColor`, avec la même
        // bande ("base") et le même décalage (0) que `base-haute` : c'est cette identité
        // de configuration, pas une coïncidence de rendu, qui rend les deux moitiés
        // identiques au bit près — voir l'essai qui le vérifie. `dessus: true` peint la
        // moitié `u ≤ 0` avec le dessus plein, comme la moitié jetée du raccord.
        const WALL_RACCORD_BASE_PIECE = { id: "raccord-base", band: "base", coupe: "bas", decalage: 0, dessus: true };
        function wallRaccordBasePixelColor(sens, ax, ay) {
          return biaisPieceColor(WALL_RACCORD_BASE_PIECE, sens, ax, ay);
        }

        // ---------------------------------------------------------------------
        // La tuile de PENTE du bord arrière du dessus (T44)
        // ---------------------------------------------------------------------
        //
        // La géométrie, mesurée (voir le commentaire de WALL_PENTE_COL) : les quatre
        // côtés cardinaux DÉBORDENT toujours — `box` reste profondément négatif sur
        // toute la case, exactement comme un état de bande `middle` — seule la
        // diagonale façonne. Un seul demi-plan, sans rentrée : `(lx − ly)/√2` pour une
        // pente qui descend à droite (matière = triangle inférieur-gauche, coin
        // haut-gauche → coin bas-droit), `(tile − lx − ly)/√2` pour l'autre sens
        // (miroir). AUCUN bruit de bord n'y est ajouté — c'est ce que la mesure exige,
        // toute perturbation y ouvrant des sauts (17 à 44 px selon sa forme) parce
        // qu'elle déplace la diagonale PERPENDICULAIREMENT là où elle déplace un bord
        // cardinal verticalement. Le contour et le relief rasant, eux, se lisent
        // normalement à partir de ce même SDF non bruité : la diagonale est un bord
        // LIBRE pour la couleur (c'est un bord extérieur, contrairement à celle de
        // T43), jamais pour la géométrie.
        function penteGeo(sens, x, y) {
          const ext = settings.cornerRadius + roughness + 1;
          const box = roundedBoxSdf(x, y, 0 - ext, 0 - ext, tile + ext, tile + ext, settings.cornerRadius);
          const demi = sens === "gauche" ? (tile - x - y) / Math.SQRT2 : (x - y) / Math.SQRT2;
          return Math.max(box, demi);
        }
        function wallPentePixelColor(sens, ax, ay) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const adjusted = penteGeo(sens, lx, ly);
          // Hors matière : transparent, jamais `outsideColor` — la case vide porte déjà
          // son sol (le chemin de T27, repris tel quel ici).
          if (adjusted > 0) return bg;
          const grazed =
            relief > 0 && adjusted > -settings.edgeFade - 1 ? grazing((x, y) => penteGeo(sens, x, y), lx, ly) : 0;
          const fleckSeed = hash2(Math.floor(ax / 2), Math.floor(ay / 2), settings.seed);
          const fleckOn = settings.pixelFlecks && settings.fleckAmount > 0 && fleckSeed > 1 - settings.fleckAmount / 250;
          const edgeDepth = -adjusted;
          const edgeAmount = settings.edgeFade > 0 ? clamp(1 - edgeDepth / settings.edgeFade, 0, 1) : 0;
          const { ao, lift } = reliefOf(grazed, edgeAmount);
          let level = edgeAmount * (shades - 1) * ao;
          level +=
            (seamlessFbm((lx * shadeLattice) / tile, (ly * shadeLattice) / tile, settings.seed + 809, shadeLattice) - 0.5) *
            (settings.textureNoise / 42) *
            4;
          if (fleckOn) level += hash2(ax, ay, settings.seed + 421) > 0.6 ? 2 : 1;
          const shade = clamp(Math.round(level), 0, shades - 1);
          const base = materialColor(upperMaterial, shades, shade, ax, ay);
          const color = lift ? shadeColor(base, lift) : base;
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        // ---------------------------------------------------------------------
        // Le décor organique (T27)
        // ---------------------------------------------------------------------
        //
        // Les douze formes sont calculées UNE fois, hors de la boucle de pixels :
        // elles ne dépendent que de (orientation, variante, graine), jamais du pixel.
        const decorShapes = decorTarget
          ? decorTarget.cells.map((c) => ({ ...c, shape: decorShape(c.orientation, c.variant, tile, settings.seed, settings.decorOptions || null) }))
          : null;

        /**
         * Couleur d'un pixel de pièce de décor. Même schéma que `blobPixelColor` —
         * géométrie, bruit de bord, fondu de contour, relief — avec la matière du
         * DESSUS (`upperMaterial`) : un gravat est un morceau du terrain, pas une
         * troisième matière (la leçon de T25, appliquée ici sans la rejouer).
         *
         * Un écart, et c'en est un de fond : hors de la masse, le décor est
         * TRANSPARENT, jamais `outsideColor`. Les autres chemins peuvent peindre le
         * terrain inférieur autour de leur silhouette parce qu'ils occupent une case
         * de terrain ; une pièce de décor, elle, se pose sur une case qui porte déjà
         * son sol — y écrire une seconde couche de sol recouvrirait ce sol d'un
         * rectangle, et le calque cesserait d'être un calque.
         */
        function decorPixelColor(entry, ax, ay) {
          const lx = ax + 0.5;
          const ly = ay + 0.5;
          const geo = (x, y) => decorSdf(entry.shape, entry.orientation, x, y, tile);
          const sdf = geo(lx, ly);
          // Les cailloux fins (Asset Kitchen) : le bruit de bord et le fondu de contour
          // suivent la taille du galet le plus proche. À pleine force, un bruit de 16 px
          // sur un galet de 3 le gonflait en tache ou l'effaçait, et un fondu de 6 px le
          // peignait tout entier de la couleur du contour.
          const rProche = entry.shape.fine ? decorRayonProche(entry.shape, entry.orientation, lx, ly, tile) : Infinity;
          const bruit = Math.min(roughness, rProche * 0.4);
          const fondu = Math.min(settings.edgeFade, Math.max(1, rProche * 0.45));
          const edgeNoise =
            (seamlessFbm((lx * edgeLattice) / tile, (ly * edgeLattice) / tile, settings.seed + 113, edgeLattice) - 0.5) *
            bruit;
          const adjusted = sdf + edgeNoise;
          if (adjusted > 0) return bg;
          const grazed =
            relief > 0 && adjusted > -fondu - 1 ? grazing(geo, lx, ly) : 0;
          const edgeDepth = -adjusted;
          const edgeAmount = fondu > 0 ? clamp(1 - edgeDepth / fondu, 0, 1) : 0;
          const { ao, lift } = reliefOf(grazed, edgeAmount);
          let level = edgeAmount * (shades - 1) * ao;
          level +=
            (seamlessFbm((lx * shadeLattice) / tile, (ly * shadeLattice) / tile, settings.seed + 809, shadeLattice) - 0.5) *
            (settings.textureNoise / 42) *
            4;
          const shade = clamp(Math.round(level), 0, shades - 1);
          const base = materialColor(upperMaterial, shades, shade, ax, ay);
          const color = lift ? shadeColor(base, lift) : base;
          return { r: color.r, g: color.g, b: color.b, a: 255 };
        }

        for (let py = 0; py < height; py += 1) {
          const ay = mapAxis(py);
          for (let px = 0; px < width; px += 1) {
            const ax = mapAxis(px);
            const i = (py * width + px) * 4;

            if (ax.cell < 0 || ay.cell < 0) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 255;
              continue;
            }

            const col = ax.cell;

            // Les lignes de décor (T27) passent AVANT le remappage des copies de phase :
            // elles sont ajoutées APRÈS la dernière copie, donc elles n'appartiennent à
            // aucune, et les ramener dans une copie les ferait rendre comme des cases
            // d'atlas ordinaires. Elles ne s'animent pas — un tas de gravats ne respire
            // pas — et c'est ce qui les rend compatibles avec les trois mécanismes
            // précédents sans arbitrage supplémentaire.
            // Les deux lignes en biais (T43), avant le décor : elles sont plus HAUT que
            // lui dans l'atlas, mais le test de décor (« au-delà de sa première ligne »)
            // les attraperait si on les laissait passer après, et les rendrait vides.
            if (biaisTarget && ay.cell >= biaisTarget.firstRow && ay.cell < biaisTarget.firstRow + biaisTarget.rows) {
              const entry = biaisTarget.cells.find((c) => c.row === ay.cell && c.col === col);
              const color = !entry
                ? bg
                : entry.piece === "pente"
                  ? wallPentePixelColor(entry.sens, ax.local, ay.local)
                  : entry.piece === "raccord-base"
                    ? wallRaccordBasePixelColor(entry.sens, ax.local, ay.local)
                    : wallBiaisPixelColor(entry, ax.local, ay.local);
              data[i] = color.r;
              data[i + 1] = color.g;
              data[i + 2] = color.b;
              data[i + 3] = color.a;
              continue;
            }

            if (decorShapes && ay.cell >= decorFirstRow) {
              const entry = decorShapes.find((c) => c.row === ay.cell && c.col === col);
              const color = entry ? decorPixelColor(entry, ax.local, ay.local) : bg;
              data[i] = color.r;
              data[i + 1] = color.g;
              data[i + 2] = color.b;
              data[i + 3] = color.a;
              continue;
            }

            // Copies de phase (T10 bis) : la ligne réelle se ramène à sa ligne DANS
            // l'atlas de base, et la copie d'où elle vient donne le déphasage. Tout ce
            // qui suit rend donc exactement l'atlas de base — à ceci près qu'il lit son
            // bruit ailleurs. C'est ce qui fait que les N copies sont N atlas complets
            // et non N cas particuliers.
            let row = ay.cell;
            let phase = NO_PHASE;
            if (copyPhases) {
              phase = copyPhases[Math.floor(row / copyRows)];
              row %= copyRows;
            }

            // Le mur est traité entièrement à part : sa disposition (dessus + trois
            // bandes basses) n'a rien de commun avec la grille de masques des autres
            // modes, et le mélanger à la chaîne de ternaires ci-dessous risquerait de
            // faire bouger leur rendu par une modification pensée pour le mur seul.
            if (wall) {
              const bandInfo = wallBandAt(row);
              let color;
              if (!bandInfo) {
                const mask = maskAtPosition(B47, col, row);
                color = mask === null ? bg : blobPixelColor(mask, ax.local, ay.local);
              } else {
                const state = wallBandStateAt(col);
                color = state ? wallBandPixelColor(bandInfo.id, state, ax.local, ay.local) : bg;
              }
              data[i] = color.r;
              data[i + 1] = color.g;
              data[i + 2] = color.b;
              data[i + 3] = color.a;
              continue;
            }

            // Ligne de variantes (tranche T8) : sous la grille de la disposition, elle
            // n'appartient à aucun jeu de public/tile-masks.js — même raison que le mur
            // juste au-dessus pour la traiter à part avant la chaîne de ternaires qui
            // suit. `variantTarget` est `null` dès que `settings.variants` vaut 0, donc
            // `row` ne peut alors jamais valoir `variantRow` : ce bloc ne s'exécute pas,
            // et rien ne change — le critère d'acceptation n°1.
            if (variantTarget && row === variantRow) {
              const color =
                col < variantCount
                  ? fullTilePixelColor(
                      settings.tilesetType,
                      variantTarget.mask,
                      ax.local,
                      ay.local,
                      variantGrainSeed(settings.seed, col + 1),
                      phase,
                      variantTexPhases ? variantTexPhases[col] : NO_TEXTURE_PHASE,
                    )
                  : bg;
              data[i] = color.r;
              data[i + 1] = color.g;
              data[i + 2] = color.b;
              data[i + 3] = color.a;
              continue;
            }

            // Ligne d'animation (tranche T10) : même traitement que la ligne de variantes
            // juste au-dessus, et pour la même raison — elle n'appartient à aucun jeu de
            // public/tile-masks.js. `animatedTarget` est `null` dès que
            // `settings.animatedFrames` vaut 0, donc `row` ne peut alors jamais valoir
            // `animatedRow` : ce bloc ne s'exécute pas, et rien ne change — le critère
            // d'acceptation n°1. Chaque image lit `settings.seed` TEL QUEL (jamais décalé,
            // contrairement à une variante) : c'est le déphasage `animationPhase`, une
            // coordonnée et non une graine, qui les différencie tout en bouclant proprement
            // — voir le commentaire de fullTilePixelColor et celui d'animationPhase.
            if (animatedTarget) {
              const delta = row - animatedTarget.row;
              const frameIndex =
                col === animatedTarget.col && delta >= 0 && delta % animatedStride === 0
                  ? delta / animatedStride
                  : -1;
              // L'image 0 retombe sur la case de la tuile pleine, DANS la grille de la
              // disposition : elle passe donc ici plutôt que par la chaîne de masques,
              // pour que les N images sortent toutes du même chemin de code. Comme
              // animationPhase(0, N) vaut exactement (0, 0), le pixel rendu est celui de
              // la tuile pleine au bit près — activer l'animation ne retouche pas la
              // tuile au repos.
              if (frameIndex >= 0 && frameIndex < animatedFrameCount) {
                const color = fullTilePixelColor(
                  settings.tilesetType,
                  animatedTarget.mask,
                  ax.local,
                  ay.local,
                  settings.seed,
                  animationPhase(frameIndex, animatedFrameCount),
                );
                data[i] = color.r;
                data[i + 1] = color.g;
                data[i + 2] = color.b;
                data[i + 3] = color.a;
                continue;
              }
              // Les lignes ajoutées pour l'animation n'appartiennent à aucune disposition :
              // hors image, elles restent vides.
              if (row >= animatedFirstAddedRow) {
                data[i] = bg.r;
                data[i + 1] = bg.g;
                data[i + 2] = bg.b;
                data[i + 3] = bg.a;
                continue;
              }
            }

            const piece = topdown17 ? topdown17Layout[row][col] : null;
            const mask = topdown17 ? 0 : maskGrid ? maskGrid[row][col] : layout[row][col];
            // La 48e case du blob (BLOB_LOWER_CELL, tranche 7 bis, plus haut) : sans masque,
            // donc un trou de disposition comme un autre — SAUF quand un terrain inférieur
            // existe, où elle devient la case entièrement couverte par le dessous. Traitée
            // à part, avant le reste de la boucle : elle ne porte aucune frontière à
            // dessiner (donc aucun SDF à évaluer), juste la matière pleine du dessous —
            // exactement le hors-masque loin de toute frontière, mais sur toute la case.
            if (blob && lowerMaterial && col === BLOB_LOWER_CELL.col && row === BLOB_LOWER_CELL.row) {
              const color = lowerPixelColor(Infinity, ax.local, ay.local, 0, phase);
              data[i] = color.r;
              data[i + 1] = color.g;
              data[i + 2] = color.b;
              data[i + 3] = color.a;
              continue;
            }
            // Ce qui fait une case vide n'est pas le même signal partout : une pièce
            // « empty » en 17, le masque 0 en 15 (la tuile sans terrain), mais pour le
            // blob et le bord le masque 0 est une tuile légitime — l'îlot isolé. Là,
            // seule une case sans masque du tout (`null`) reste transparente.
            //
            // Avec un terrain inférieur, la tuile de masque 0 du mode 15 cesse d'être un
            // trou : c'est la case entièrement couverte par le terrain du dessous, celle
            // que l'autotiler pose au milieu du sable — la 48e case du blob rejoint ce même
            // régime, traitée juste au-dessus. Les vrais trous de DISPOSITION restants — les
            // cases « empty » du 17 pièces, les colonnes libres du mur — restent
            // transparents quoi qu'il arrive : ils ne portent aucun masque, donc aucune
            // tuile, donc aucun terrain.
            const blank = topdown17
              ? !piece || piece.kind === "empty"
              : maskGrid
                ? mask === null
                : mask === 0 && lowerMaterial === null;
            if (blank) {
              data[i] = bg.r;
              data[i + 1] = bg.g;
              data[i + 2] = bg.b;
              data[i + 3] = bg.a;
              continue;
            }

            const lx = ax.local + 0.5;
            const ly = ay.local + 0.5;
            // Continuous content-space coordinates (ignore separators) so noise reads
            // smoothly tile-to-tile.
            const cx = col * tile + ax.local;
            const cy = row * tile + ay.local;
            // Coordonnées de l'aléa. Continues dans l'atlas pour les dispositions
            // historiques ; locales à la tuile pour les neuves, où deux tuiles voisines
            // sur la carte doivent lire la même phase de part et d'autre de la couture.
            const nx = seamless ? ax.local : cx;
            const ny = seamless ? ay.local : cy;
            const sdf = topdown17
              ? topdown17Sdf(piece, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding)
              : blob
                ? blobSdf(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.edgePadding)
                : edge
                  ? edgeSdf(mask, lx, ly, tile, settings.cornerRadius, roughness, settings.strokeWidth)
                  : maskSdf(mask, lx, ly, tile, settings.cornerRadius, roughness);
            // Une graine par pièce désolidarise le bruit d'une case à l'autre de l'atlas —
            // souhaitable en 15 et 17, où il ne touche que la silhouette. Interdit sur une
            // disposition raccordable : la graine y est commune à toutes les tuiles.
            const pieceSeed = topdown17 ? row * columns + col + 1 : seamless ? 0 : mask;
            // Le déphasage de bord (T10 bis) ne s'applique qu'à la branche raccordable :
            // l'autre lit un bruit continu d'ATLAS (17 pièces), qui n'a ni tuile pleine
            // ni copies de phase — clampAtlasCopies l'exclut, `phase` y est toujours nul.
            const edgeNoise = ((seamless
              ? seamlessFbm((lx * edgeLattice) / tile + phase.ex, (ly * edgeLattice) / tile + phase.ey, settings.seed + 113, edgeLattice)
              : fbm(cx / noiseSize, cy / noiseSize, settings.seed + pieceSeed * 113)) - 0.5) * roughness;
            const adjusted = sdf + edgeNoise;

            // Voir le bloc « Le relief » : la pente du SDF nu, lue seulement dans la
            // bande où elle sert.
            const grazed =
              relief > 0 && adjusted < contactLength && adjusted > -settings.edgeFade - 1
                ? grazing(
                    topdown17
                      ? (x, y) => topdown17Sdf(piece, x, y, tile, settings.cornerRadius, roughness, settings.edgePadding)
                      : blob
                        ? (x, y) => blobSdf(mask, x, y, tile, settings.cornerRadius, roughness, settings.edgePadding)
                        : edge
                          ? (x, y) => edgeSdf(mask, x, y, tile, settings.cornerRadius, roughness, settings.strokeWidth)
                          : (x, y) => maskSdf(mask, x, y, tile, settings.cornerRadius, roughness),
                    lx,
                    ly,
                  )
                : 0;

            if (adjusted > 0) {
              // Hors du masque : le terrain inférieur s'il existe, le fond sinon.
              const outside = outsideColor(adjusted, ax.local, ay.local, grazed, phase);
              data[i] = outside.r;
              data[i + 1] = outside.g;
              data[i + 2] = outside.b;
              data[i + 3] = outside.a;
              continue;
            }

            const fleckSeed = hash2(Math.floor(nx / 2 + phase.dx), Math.floor(ny / 2 + phase.dy), settings.seed + pieceSeed * 17);
            const fleckOn = settings.pixelFlecks && settings.fleckAmount > 0 && fleckSeed > 1 - settings.fleckAmount / 250;
            // Position along the ramp in whole shade steps. Edge fade pushes toward the
            // darker end, texture noise jitters by up to a step or so, and a fleck bumps
            // one or two steps darker. Rounding to an integer index keeps everything on
            // the palette, so transitions read as discrete pixel-art bands.
            // Le blob et le bord se mesurent comme les 17 pièces : la profondeur dans la
            // matière, c'est la distance signée elle-même. Sur un bord qui déborde, cette
            // distance vaut au moins `ext` dès le premier pixel de la tuile, donc le
            // liseré ne se pose jamais le long d'une couture — seulement sur la
            // silhouette et dans les encoches, qui sont les vraies frontières.
            const edgeDepth = topdown17 || seamless
              ? -(sdf + edgeNoise)
              : maskVoidSdf(mask, lx, ly, tile, settings.cornerRadius) - edgeNoise;
            const edgeAmount = settings.edgeFade > 0 ? clamp(1 - edgeDepth / settings.edgeFade, 0, 1) : 0;
            const { ao, lift } = reliefOf(grazed, edgeAmount);
            let level = edgeAmount * (shades - 1) * ao;
            level += ((seamless
              ? seamlessFbm((lx * shadeLattice) / tile + phase.dx, (ly * shadeLattice) / tile + phase.dy, settings.seed + 809, shadeLattice)
              : fbm(cx / 4.2, cy / 4.2, settings.seed + 809)) - 0.5) * (settings.textureNoise / 42) * 4;
            if (fleckOn) level += hash2(nx, ny, settings.seed + 421) > 0.6 ? 2 : 1;
            // `shades` quantifie toujours : la couleur tombe sur l'un des N niveaux de
            // luminance du dégradé surface → contour, que ses deux extrémités viennent des
            // couleurs de réglage ou des textures. `edgeAmount` reste le seul pilote du
            // mélange, donc le contour se fonce exactement comme avant.
            const shade = clamp(Math.round(level), 0, shades - 1);
            const flat = materialColor(upperMaterial, shades, shade, ax.local, ay.local);
            const color = lift ? shadeColor(flat, lift) : flat;

            data[i] = color.r;
            data[i + 1] = color.g;
            data[i + 2] = color.b;
            data[i + 3] = 255;
          }
        }

        logicalCtx.putImageData(image, 0, 0);
        return logical;
      }

      
export {
  renderLogical,
  resampleTexture,
  layout,
  hexToRgb,
  atlasShape,
  terrainLayers,
  TILESET_LAYOUTS,
  EDGE_STROKE_RATIO,
  WALL_TOP_ROWS,
  WALL_COLUMNS,
  BLOB_CORNERS,
  WALL_BAND_STATES,
  WALL_BANDS,
  wallAtlasDescriptor,
  WALL_UNPLACED_STATES,
  decorAtlasDescriptor,
  biaisAtlasDescriptor,
  WALL_BIAIS_SENS,
  WALL_BIAIS_PIECES,
  DECOR_ORIENTATIONS,
  DECOR_VARIANTS,
  DECOR_DENSITIES,
  variantAtlasDescriptor,
  variantTexturePhase,
  animationAtlasDescriptor,
  atlasAnimationDescriptor,
  atlasCopyRows,
  DEFAULT_ANIMATION_FRAME_DURATION_MS,
  BLOB_LOWER_CELL,
};
