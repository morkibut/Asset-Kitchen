// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { installerBouchonCanvas } from './canvas-shim';
const {etatsDeBande,coursesHorizontales,placerMur,placerMurBiais,placerOmbreBiais,jonctionsDiagonales,remplisseur,dessinerScene,peintrePixels,descripteurScene,masqueDessusMur,penteVoisinsDessus,caseMurPente,NEIGHBOUR_BITS}=await import('../tile-scene.js');
// `renderLogical` peint dans un canevas DOM ; hors navigateur on lui donne le même mock
// minimal que scripts/apercu-tileset.mjs et tests/tileset.test.mjs.
installerBouchonCanvas();
const {wallAtlasDescriptor,WALL_BAND_STATES,renderLogical,variantAtlasDescriptor}=await import('../vendor/tileset-engine.js');
const {rendreMatiere,couleurMoyenne}=await import('../tile-materials.js');
const {atlasPosition:positionBrute}=await import('../tile-masks.js');
// atlasPosition rend aussi le masque et l'index ; ici seule la case nous intéresse.
const atlasPosition=(set,masque)=>{const p=positionBrute(set,masque);return {col:p.col,row:p.row};};
const {cellMaskAt}=await import('../tile-check.js');

const D=descripteurScene(wallAtlasDescriptor,WALL_BAND_STATES);
const grille=(lignes)=>lignes.map(l=>[...l].map(c=>c==='#'));

// Un atlas d'essai où CHAQUE case porte une couleur qui l'identifie : le rouge
// dit la colonne, le vert la ligne. Il suffit alors de lire un pixel de la scène
// pour savoir quelle case d'atlas y a été posée — et donc pour éprouver le
// placement sans rien dessiner de joli.
const TILE=8;
function atlasTemoin(colonnes,lignes){
  const image={data:new Uint8ClampedArray(colonnes*TILE*lignes*TILE*4),width:colonnes*TILE,height:lignes*TILE};
  for(let row=0;row<lignes;row+=1)for(let col=0;col<colonnes;col+=1)
    for(let y=0;y<TILE;y+=1)for(let x=0;x<TILE;x+=1){
      const i=(((row*TILE+y)*image.width)+col*TILE+x)*4;
      image.data.set([col*8+1,row*8+1,7,255],i);
    }
  return image;
}
/** La case d'atlas lue au centre de la case de carte (x, y) — ou null si rien n'y est posé. */
const caseLue=(img,zoom,x,y)=>{
  const px=Math.round((x+0.5)*TILE*zoom),py=Math.round((y+0.5)*TILE*zoom);
  if(px<0||py<0||px>=img.width||py>=img.height)return null;
  const i=(py*img.width+px)*4;
  if(img.data[i+2]!==7)return null; // pas un pixel d'atlas : sol, personnage, ombre composée
  return {col:(img.data[i]-1)/8,row:(img.data[i+1]-1)/8};
};
function scene(options,colonnes,lignes,zoom=1){
  const atlas=atlasTemoin(D.etats.length+2,D.shadowRow+1);
  const img={data:new Uint8ClampedArray(colonnes*TILE*zoom*lignes*TILE*zoom*4),width:colonnes*TILE*zoom,height:lignes*TILE*zoom};
  dessinerScene(peintrePixels(img,atlas,zoom),{tile:TILE,colonnes,lignes,set:null,masqueDe:()=>null,
    sol:{couleur:'#000000'},...options});
  return img;
}

test('les courses horizontales maximales sont l’unité du placeur', () => {
  const c=coursesHorizontales(grille(['.###.','#..##','.....','#####']));
  assert.deepEqual(c,[{y:0,x0:1,x1:3},{y:1,x0:0,x1:0},{y:1,x0:3,x1:4},{y:3,x0:0,x1:4}]);
});

test('à l’intérieur d’une course, l’état reste celui des voisins est et ouest', () => {
  // La non-régression de T24 : sans décrochement, rien ne change par rapport au
  // placeur d'avant, qui ne lisait que les deux voisins de rangée.
  const e=etatsDeBande(grille(['.....','.###.','.....','..#..']));
  assert.equal(e(1,1),'left-end');
  assert.equal(e(2,1),'middle');
  assert.equal(e(3,1),'right-end');
  assert.equal(e(2,3),'isolated');
});

test('T24 : une jonction en diagonale raccorde les deux moitiés — jamais une seule', () => {
  // Deux courses de rangées voisines dont l'une commence exactement une colonne
  // après la fin de l'autre : c'est ça, un décrochement. Les deux bouts qui se
  // font face sont les deux MOITIÉS d'une même jonction.
  const g=grille(['......','.###..','....##','......']);
  const e=etatsDeBande(g);
  // T41, effet de bord attendu et voulu : le voisin sud-ouest/sud-est d'`etatsDeBande` voit
  // la moitié basse de LA MÊME jonction comme un montant en diagonale, donc la moitié haute
  // du raccord porte désormais sa pénombre — « juste », dit la tranche, silhouette `middle`
  // inchangée (west/east restent tous les deux à `true`), seule la couleur s'y ajoute.
  assert.equal(e(3,1),'corner-right','le bout est de la course haute se raccorde vers l’est ET porte la pénombre de la moitié basse');
  assert.equal(e(4,2),'middle','le bout ouest de la course basse se raccorde vers l’ouest, sans montant sous lui');
  // Et l'autre sens du décrochement, en miroir.
  const m=etatsDeBande(grille(['......','..###.','.#....','......']));
  assert.equal(m(2,1),'corner-left','même effet de bord, en miroir : la moitié basse fait montant sous la moitié haute');
  assert.equal(m(1,2),'left-end'); // course d'une case : raccordée vers l'est seulement, rien sous elle
  // L'invariant, vérifié case par case : un bout ne gagne un raccord en diagonale
  // que si son jumeau de l'autre côté le gagne aussi. On l'éprouve en retirant la
  // course basse — les deux raccords doivent disparaître ENSEMBLE.
  const seule=etatsDeBande(grille(['......','.###..','......','......']));
  assert.equal(seule(3,1),'right-end','sans course en face, le bout redevient un bout');
});

test('T24 : jamais de raccord au milieu d’un mur vertical — la règle réfutée en tranche 12', () => {
  // Le défaut exact de « la case en diagonale porte un mur » : elle raccordait au
  // milieu d'un mur vertical. Ici la règle est structurellement incapable de le
  // faire, puisque deux courses d'une case empilées dans la MÊME colonne ne
  // remplissent jamais « l'une commence une colonne après la fin de l'autre ».
  const e=etatsDeBande(grille(['.....','..#..','..#..','..#..','.....']));
  // Ce que la règle réfutée produisait, et qui reste interdit : UN SEUL côté raccordé au
  // milieu d'un mur vertical — donc un bout, ou un coin, c'est-à-dire tout état qui
  // distingue sa gauche de sa droite. La vérification porte là-dessus, pas sur une
  // étiquette : c'est l'asymétrie qui trahissait la demi-jonction.
  for(let y=1;y<=3;y+=1)assert.ok(['isolated','middle'].includes(e(2,y)),`un raccord d'un seul côté posé au milieu du mur vertical en y=${y} : ${e(2,y)}`);
  // T41 : la règle du coin ne regarde plus le nord (T37), mais les deux diagonales sud.
  // Un mur vertical isolé n'a de montant ni au sud-ouest ni au sud-est d'aucune de ses
  // cases — chacune reste donc « isolated » du haut en bas, comme avant T37. Le pied d'un
  // mur vertical redevient donc plus étroit que la face qui le surmonte.
  assert.equal(e(2,1),'isolated','la tête du montant n’a rien en diagonale sud');
  assert.equal(e(2,2),'isolated','aucun montant en diagonale sud de cette case non plus');
  assert.equal(e(2,3),'isolated','ni de celle-ci : le mur vertical est bordé de vide des deux côtés');
});

test('T24 : aucun flanc n’est jamais posé automatiquement', () => {
  // Mesuré en T24, pas supposé : `flankSdf` rend un CHEVRON symétrique (même rentrée
  // en haut et en bas, creux maximal à mi-hauteur), pas une rampe à 45°. Deux chevrons
  // côte à côte ne forment donc pas le « losange plein » que le plan leur prêtait :
  // empilés sur la hauteur du mur ils donnent une chaîne de pincements — le sablier.
  // Les deux pièces restent dans l'atlas, posables à la main.
  const cartes=[['.....','.###.','..#..','.....'],['......','.###..','....##','......'],
    ['.....','..#..','..#..','..#..','.....'],['......','.#....','..#...','...#..','......']];
  for(const c of cartes){
    const g=grille(c),e=etatsDeBande(g);
    for(let y=0;y<g.length;y+=1)for(let x=0;x<g[y].length;x+=1)
      assert.ok(!e(x,y).startsWith('flank'),`un flanc posé automatiquement en (${x}, ${y})`);
  }
});

test('un mur s’empile : la base sur son emprise, les faces au-dessus, le dessus tout en haut', () => {
  const g=grille(['.....','.....','.###.','.....']);
  for(const hauteur of [1,2,3]){
    const pieces=placerMur(D,g,2,2,hauteur);
    assert.equal(pieces.length,hauteur+1,`hauteur ${hauteur} : une base, ${hauteur-1} face(s), un dessus`);
    // La base est sur la case d'emprise — c'est elle qui porte la collision et le tri.
    assert.deepEqual({row:pieces[0].row,dy:pieces[0].dy},{row:D.baseRow,dy:2});
    // Les faces montent, une par case, sans trou.
    for(let k=1;k<hauteur;k+=1)
      assert.deepEqual({row:pieces[k].row,dy:pieces[k].dy},{row:D.faceRow,dy:2-k},`hauteur ${hauteur}, face ${k}`);
    // Le dessus est `hauteur` cases plus haut, et porte le masque blob de l'emprise —
    // avec le bit sud forcé (T22) : voir `masqueDessusMur`, jamais le masque brut.
    const dessus=pieces[pieces.length-1];
    assert.equal(dessus.dy,2-hauteur);
    assert.deepEqual({col:dessus.col,row:dessus.row},atlasPosition('B47',masqueDessusMur(g,2,2)));
    // Toutes les pièces restent dans la colonne de l'emprise.
    for(const piece of pieces)assert.equal(piece.dx,2);
  }
});

test('l’ombre portée tombe sur la case DEVANT le pied du mur, et nulle part ailleurs', () => {
  // La règle que l'aperçu a fait apparaître : sans elle, l'ombre se posait une
  // tuile trop bas (voir shadowSdf dans le moteur, corrigé en même temps).
  const g=grille(['......','......','.####.','......','......']);
  const img=scene({mur:{hauteur:1,grille:g,descripteur:D}},6,5);
  for(let x=1;x<=4;x+=1){
    assert.equal(caseLue(img,1,x,3).row,D.shadowRow,`pas d’ombre devant le pied en x=${x}`);
    assert.equal(caseLue(img,1,x,2).row,D.baseRow,`la base devrait occuper l’emprise en x=${x}`);
    assert.equal(caseLue(img,1,x,4),null,`une ombre deux cases sous le mur en x=${x}`);
  }
});

test('une ombre ne se pose jamais sur le mur d’en dessous', () => {
  // Deux courses collées : celle du haut ne doit pas ombrer celle du bas. Seule
  // la rangée qui n'a rien devant elle projette son ombre.
  const g=grille(['.....','.###.','.###.','.....']);
  const img=scene({mur:{hauteur:1,grille:g,descripteur:D}},5,4);
  for(let x=1;x<=3;x+=1){
    assert.notEqual(caseLue(img,1,x,1).row,D.shadowRow,`une ombre posée sur le mur du dessous en x=${x}`);
    assert.equal(caseLue(img,1,x,2).row,D.baseRow,`la rangée de devant doit montrer sa base en x=${x}`);
    assert.equal(caseLue(img,1,x,3).row,D.shadowRow,`l’ombre de la rangée de devant manque en x=${x}`);
  }
  // Et le mur de derrière est bel et bien recouvert par celui de devant : c'est
  // le dessus de la course du bas qu'on voit sur la rangée du haut, pas sa base.
  assert.ok(caseLue(img,1,2,1).row<D.faceRow,'le dessus de la course de devant devrait recouvrir la base de celle de derrière');
});

test('le tri en profondeur : le personnage passe derrière le mur du dessous, devant celui du dessus', () => {
  // La propriété que l'aperçu existe pour montrer, et la seule qu'une planche
  // d'atlas ne peut pas montrer du tout. Un mur d'une case, et le héros posé une
  // fois au-dessus de sa ligne de pieds, une fois en dessous.
  const g=grille(['.....','.....','..#..','.....','.....']);
  const pixelsHeros=img=>{
    let n=0;
    for(let i=0;i<img.data.length;i+=4)if(img.data[i+2]!==7&&img.data[i+2]!==0)n+=1; // ni atlas, ni fond
    return n;
  };
  const devant=scene({mur:{hauteur:3,grille:g,descripteur:D},heros:{x:2.5,y:4,image:0}},5,5);
  const derriere=scene({mur:{hauteur:3,grille:g,descripteur:D},heros:{x:2.5,y:0.9,image:0}},5,5);
  // Devant le mur (ligne de pieds plus bas), le héros est peint en entier.
  // Derrière (ligne de pieds plus haut), le mur lui passe dessus et le recouvre
  // en partie : il en reste donc strictement moins à l'écran.
  assert.ok(pixelsHeros(devant)>0,'le héros n’a pas été peint du tout');
  assert.ok(pixelsHeros(derriere)<pixelsHeros(devant),
    `le mur devrait recouvrir une partie du héros placé derrière lui (${pixelsHeros(derriere)} contre ${pixelsHeros(devant)} pixels)`);
});

test('une tuile animée joue ses images, et seule la tuile animée bouge', () => {
  // L'aperçu lit la même disposition d'images que l'export : elles descendent dans
  // la COLONNE de la tuile pleine, par pas de `pas` lignes. On vérifie qu'il va
  // bien les chercher là, et qu'une tuile qui n'est pas la tuile animée ne suit
  // pas le compteur d'images.
  const masques={'0-0':255,'1-0':0};
  const animation={col:atlasPosition('B47',255).col,row:atlasPosition('B47',255).row,pas:1,images:3};
  const lire=image=>scene({set:'B47',masqueDe:(x,y)=>masques[`${x}-${y}`]??null,animation,image},2,1);
  const pleine=atlasPosition('B47',255),isolee=atlasPosition('B47',0);
  for(const k of [0,1,2]){
    const img=lire(k);
    assert.deepEqual(caseLue(img,1,0,0),{col:pleine.col,row:pleine.row+k},`image ${k} : la tuile animée`);
    assert.deepEqual(caseLue(img,1,1,0),isolee,`image ${k} : une tuile non animée ne devrait pas bouger`);
  }
});

test('T22 : le dessus d’un mur ne laisse plus voir le fond entre lui et la face', () => {
  // Mesuré sur la scène réelle, pas décrit : une course horizontale (état « middle »,
  // voisins est et ouest tous les deux remplis) prend en atlas B47 le masque E|W, dont
  // les dernières lignes sont transparentes (la rentrée `blobInset`) — correct pour un
  // terrain vu de dessus, faux pour un mur, où la face occupe exactement cette bande.
  // Fond magenta : aucune matière du dépôt ne le produit. On ne compte, comme le
  // diagnostic, que les pixels de fond TRAVERSANTS — un mur opaque à moins de 8 px
  // au-dessus ET en dessous dans la même colonne — pour ne pas confondre la vraie
  // couture avec le haut légitimement ouvert du mur (rien au-dessus de la course).
  const TILE = 16, FENETRE = 8;
  const pierre = rendreMatiere('pierre', TILE, 31415);
  const settings = {
    tilesetType: 'wall', tileSize: TILE, cornerRadius: 2, edgeStyle: 'rough', edgeRoughness: 3, edgeFrequency: 5, edgePadding: 4,
    baseColor: couleurMoyenne('pierre'), edgeColor: couleurMoyenne('pierre'), edgeFade: 4, shades: 6, textureNoise: 12, fleckAmount: 6,
    seed: 31415, relief: 0.45, whiteBackground: false, showGrid: false, pixelFlecks: true,
    surfaceTexture: pierre.surface, edgeTexture: pierre.contour, faceTexture: rendreMatiere('brique', TILE, 31415).surface,
  };
  const atlas = renderLogical(settings).imageData;
  const COLS = 8, ROWS = 7, RANGEE = 4, HAUTEUR = 3;
  const g = grille(Array.from({ length: ROWS }, (_, y) => (y === RANGEE ? '.######.' : '........')));
  const img = { data: new Uint8ClampedArray(COLS * TILE * ROWS * TILE * 4), width: COLS * TILE, height: ROWS * TILE };
  dessinerScene(peintrePixels(img, atlas, 1), {
    tile: TILE, colonnes: COLS, lignes: ROWS, set: null, masqueDe: () => null,
    mur: { hauteur: HAUTEUR, grille: g, descripteur: D }, sol: { couleur: '#ff00ff' },
  });
  const estFond = (px, py) => {
    const i = (py * img.width + px) * 4;
    return img.data[i] === 255 && img.data[i + 1] === 0 && img.data[i + 2] === 255;
  };
  let trous = 0;
  const dessusRow = RANGEE - HAUTEUR;
  for (let x = 2; x <= 5; x += 1) { // colonnes en état « middle », loin des bouts de course
    for (let py = dessusRow * TILE; py < (dessusRow + 1) * TILE; py += 1) {
      for (let px = x * TILE; px < (x + 1) * TILE; px += 1) {
        if (!estFond(px, py)) continue;
        let opaqueAvant = false, opaqueApres = false;
        for (let k = 1; k <= FENETRE && !opaqueAvant; k += 1) if (py - k >= 0 && !estFond(px, py - k)) opaqueAvant = true;
        for (let k = 1; k <= FENETRE && !opaqueApres; k += 1) if (py + k < img.height && !estFond(px, py + k)) opaqueApres = true;
        if (opaqueAvant && opaqueApres) trous += 1;
      }
    }
  }
  assert.equal(trous, 0, `${trous} pixel(s) de fond traversant le mur entre le dessus et la face`);
});

test('T24 : la jonction en diagonale referme la fente, mesuré en pixels', () => {
  // La preuve qui compte : un escalier — cinq courses d'une case, décalées d'une
  // rangée et d'une colonne — rendu sur la vraie matière, fond magenta. On compte
  // les pixels de fond TRAVERSANTS (du mur opaque à moins de 16 px à gauche ET à
  // droite sur la même ligne) : c'est la fente entre deux marches qui se touchent
  // pourtant en diagonale, pas le bord légitime de la silhouette.
  const TL=32, F=16;
  const pierre=rendreMatiere('pierre',TL,31415);
  const atlas=renderLogical({tilesetType:'wall',tileSize:TL,cornerRadius:2,edgeStyle:'rough',edgeRoughness:3,edgeFrequency:5,edgePadding:4,
    baseColor:couleurMoyenne('pierre'),edgeColor:couleurMoyenne('pierre'),edgeFade:4,shades:6,textureNoise:12,fleckAmount:6,seed:31415,
    relief:0.45,whiteBackground:false,showGrid:false,pixelFlecks:true,surfaceTexture:pierre.surface,edgeTexture:pierre.contour,
    faceTexture:rendreMatiere('brique',TL,31415).surface}).imageData;
  const COLS=12,ROWS=9,H=3;
  const g=grille(['............','............','............','.#..........','..#.........','...#........','....#.......','.....#......','............']);
  const estFond=(img,px,py)=>{const i=(py*img.width+px)*4;return img.data[i]===255&&img.data[i+1]===0&&img.data[i+2]===255;};
  const fente=img=>{let n=0;
    for(let py=0;py<img.height;py+=1)for(let px=TL;px<TL*7;px+=1){
      if(!estFond(img,px,py))continue;
      let gche=false,drte=false;
      for(let k=1;k<=F&&!gche;k+=1)if(px-k>=0&&!estFond(img,px-k,py))gche=true;
      if(!gche)continue;
      for(let k=1;k<=F&&!drte;k+=1)if(px+k<img.width&&!estFond(img,px+k,py))drte=true;
      if(drte)n+=1;
    }
    return n;};
  const vide=()=>({data:new Uint8ClampedArray(COLS*TL*ROWS*TL*4),width:COLS*TL,height:ROWS*TL});
  const avec=vide();
  dessinerScene(peintrePixels(avec,atlas,1),{tile:TL,colonnes:COLS,lignes:ROWS,set:null,masqueDe:()=>null,
    mur:{hauteur:H,grille:g,descripteur:D},sol:{couleur:'#ff00ff'}});
  // Le placeur débranché : chaque case reprend l'état orthogonal seul, celui d'avant
  // T24 — c'est la vérification à l'envers, sans laquelle le compte ci-dessus ne
  // prouverait rien. `placerMur` accepte l'état en argument, on n'a rien à simuler.
  const rempli=remplisseur(g);
  const sans=vide(), p=peintrePixels(sans,atlas,1);
  p.fond('#ff00ff');
  const ortho=(x,y)=>{const w=rempli(x-1,y),e=rempli(x+1,y);return w&&e?'middle':w?'right-end':e?'left-end':'isolated';};
  for(let y=0;y<ROWS;y+=1)for(let x=0;x<COLS;x+=1){
    if(!rempli(x,y)||rempli(x,y+1))continue;
    p.tuile(D.etats.indexOf(ortho(x,y))*TL,D.shadowRow*TL,TL,x*TL,(y+1)*TL);
  }
  for(let y=0;y<ROWS;y+=1)for(let x=0;x<COLS;x+=1){
    if(!rempli(x,y))continue;
    for(const piece of placerMur(D,g,x,y,H,ortho(x,y)))p.tuile(piece.col*TL,piece.row*TL,TL,piece.dx*TL,piece.dy*TL);
  }
  const a=fente(sans), b=fente(avec);
  assert.ok(a>2000,`le placeur débranché devrait laisser la fente béante, mesuré ${a} px`);
  assert.ok(b<a/4,`la jonction devrait refermer l’essentiel de la fente : ${a} px avant, ${b} px après`);
});

// --- T19 : l'aperçu de jeu tire au sort les variantes ----------------------
// Le jeu de masques choisi n'importe pas pour ces essais — ils portent sur le tirage,
// pas sur l'autotile — mais il faut une disposition à tuile pleine identifiable
// (`variantAtlasDescriptor`) : blob 47, comme dans le reste du dépôt.
const VD3 = variantAtlasDescriptor('blob-47', 3);
const ATLAS_VARIANTES = atlasTemoin(VD3.variants.length + 5, VD3.original.row + 2);
function sceneVariantes(seed, colonnes, lignes, masqueDe) {
  const variants = { mask: VD3.mask, count: VD3.variants.length, list: VD3.variants, seed };
  const img = { data: new Uint8ClampedArray(colonnes * TILE * lignes * TILE * 4), width: colonnes * TILE, height: lignes * TILE };
  dessinerScene(peintrePixels(img, ATLAS_VARIANTES, 1), {
    tile: TILE, colonnes, lignes, set: 'B47', masqueDe: masqueDe || (() => VD3.mask), sol: { couleur: '#000000' }, variants,
  });
  return img;
}
/** L'indice tiré à (x, y) — 0 pour l'originale, 1..count pour les variantes — lu sur l'image. */
function indiceLu(img, x, y) {
  const c = caseLue(img, 1, x, y);
  if (!c) return null;
  if (c.col === VD3.original.col && c.row === VD3.original.row) return 0;
  const i = VD3.variants.findIndex(v => v.col === c.col && v.row === c.row);
  return i === -1 ? null : i + 1;
}

test('T19 : le tirage de variante est déterministe, au bit près', () => {
  const a = sceneVariantes(7, 12, 8);
  const b = sceneVariantes(7, 12, 8);
  assert.deepEqual([...a.data], [...b.data], 'deux rendus à graine égale devraient être identiques au bit près');
});

test('T19 : une autre graine redistribue le tirage', () => {
  const W = 12, H = 8;
  const relever = seed => { const img = sceneVariantes(seed, W, H); const l = []; for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) l.push(indiceLu(img, x, y)); return l; };
  const a = relever(7), b = relever(99);
  assert.ok(a.some((v, i) => v !== b[i]), 'deux graines différentes ne devraient pas tirer exactement la même distribution');
});

test('T19 : une scène avec variantes diffère réellement d’une scène sans (mesuré en pixels)', () => {
  const W = 12, H = 8;
  const avec = sceneVariantes(7, W, H);
  const img = { data: new Uint8ClampedArray(W * TILE * H * TILE * 4), width: W * TILE, height: H * TILE };
  dessinerScene(peintrePixels(img, ATLAS_VARIANTES, 1), { tile: TILE, colonnes: W, lignes: H, set: 'B47', masqueDe: () => VD3.mask, sol: { couleur: '#000000' }, variants: null });
  let diff = 0;
  for (let i = 0; i < avec.data.length; i += 1) if (avec.data[i] !== img.data[i]) diff += 1;
  assert.ok(diff > 0, 'aucun pixel ne change entre une scène avec variantes et une scène sans : le tirage ne semble pas appliqué');
  // Vérifié à l'envers : à 0 variante réglée (même graine), tout retombe exactement sur la
  // scène sans réglage — ce qui exclut que le diff mesuré ci-dessus vienne d'autre chose que
  // du tirage (un bruit du peintre, par exemple, romprait cette égalité aussi).
  const zero = { mask: VD3.mask, count: 0, list: [], seed: 7 };
  const img0 = { data: new Uint8ClampedArray(W * TILE * H * TILE * 4), width: W * TILE, height: H * TILE };
  dessinerScene(peintrePixels(img0, ATLAS_VARIANTES, 1), { tile: TILE, colonnes: W, lignes: H, set: 'B47', masqueDe: () => VD3.mask, sol: { couleur: '#000000' }, variants: zero });
  assert.deepEqual([...img0.data], [...img.data], 'à 0 variante réglée, la scène devrait retomber exactement sur la scène sans réglage');
});

test('T19 : le tirage tombe dans [0, count] et n’oublie ni l’originale ni aucune variante sur un lot assez grand', () => {
  const W = 16, H = 16; // 256 cases, largement assez pour voir les 4 issues avec count = 3
  const img = sceneVariantes(1234, W, H);
  const vus = new Set();
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const idx = indiceLu(img, x, y);
    assert.ok(idx !== null && idx >= 0 && idx <= 3, `case (${x}, ${y}) : indice hors borne ou case non reconnue`);
    vus.add(idx);
  }
  assert.equal(vus.size, 4, `les 4 issues (originale + 3 variantes) devraient toutes apparaître sur 256 cases, vu : ${[...vus].sort()}`);
});

test('T19 : peindre une case ailleurs ne redistribue pas les variantes des autres', () => {
  // Le tirage dépend de (x, y, graine) et de rien d'autre : deux cartes qui ne diffèrent
  // qu'à un endroit doivent tirer la même chose partout ailleurs.
  const W = 10, H = 6, seed = 42;
  const masqueA = () => VD3.mask;
  const masqueB = (x, y) => (x === 3 && y === 2 ? null : VD3.mask); // une case en moins, ailleurs sur la carte
  const a = sceneVariantes(seed, W, H, masqueA);
  const b = sceneVariantes(seed, W, H, masqueB);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (x === 3 && y === 2) continue;
    assert.equal(indiceLu(a, x, y), indiceLu(b, x, y), `la case (${x}, ${y}) a changé de variante alors qu'une AUTRE case a changé de contenu`);
  }
});

test('T19 : seule la tuile pleine tire une variante — une case hors masque plein n’en reçoit jamais', () => {
  // Ici toutes les cases valent le masque isolé (0), jamais la tuile pleine : aucune ne
  // devrait jamais s'écarter de sa position d'atlas normale, quelle que soit la graine.
  const W = 8, H = 8;
  const variants = { mask: VD3.mask, count: VD3.variants.length, list: VD3.variants, seed: 7 };
  const img = { data: new Uint8ClampedArray(W * TILE * H * TILE * 4), width: W * TILE, height: H * TILE };
  dessinerScene(peintrePixels(img, ATLAS_VARIANTES, 1), { tile: TILE, colonnes: W, lignes: H, set: 'B47', masqueDe: () => 0, sol: { couleur: '#000000' }, variants });
  const isolee = atlasPosition('B47', 0);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1)
    assert.deepEqual(caseLue(img, 1, x, y), isolee, `la case (${x}, ${y}) n'est pas la tuile pleine et ne devrait jamais porter une variante`);
});

test('le sol se pose sous tout le reste, et un motif le recouvre entièrement', () => {
  const motif={data:new Uint8ClampedArray(TILE*TILE*4),width:TILE,height:TILE};
  for(let i=0;i<motif.data.length;i+=4)motif.data.set([9,9,200,255],i);
  const img=scene({sol:{couleur:'#000000',motif}},4,3);
  for(let i=0;i<img.data.length;i+=4)
    assert.equal(img.data[i+2],200,`un pixel de fond a échappé au motif de sol (offset ${i})`);
});

// ===========================================================================
// T27 — le calque de décor : où les pièces se posent, et ce qu'elles cassent
// ===========================================================================
const {emplacementsDecor,occupationMur,caseDecor}=await import('../tile-scene.js');
const {decorAtlasDescriptor}=await import('../vendor/tileset-engine.js');

const DECOR=decorAtlasDescriptor('wall','dense');
const OPPOSE={n:'s',e:'w',s:'n',w:'e'};
const VECTEUR={n:[0,-1],e:[1,0],s:[0,1],w:[-1,0]};
// La carte de l'utilisateur : deux courses de mur décalées d'une colonne à chaque rangée.
// C'est devant elle qu'il a écrit « ça ne crée pas du tout un visuel cohérent et ça crée
// des escaliers ».
const ESCALIER=grille(['................','................','................','..#.............','...#............','....#...........','.....#..........','......#.........','........#####...','...#####........','................','................']);
const occupeEscalier=(hauteur=3)=>occupationMur(ESCALIER,hauteur);
const opts=(over={})=>({colonnes:16,lignes:12,densite:'dense',graine:31415,variantes:DECOR.variants,orientations:DECOR.orientations,...over});

test('T27 · à densité « aucun », le calque ne pose rien du tout', () => {
  assert.deepEqual(emplacementsDecor(occupeEscalier(),opts({densite:'aucun'})),[]);
  assert.deepEqual(emplacementsDecor(occupeEscalier(),opts({densite:undefined})),[]);
  // Et à l'envers : aux deux densités qui posent, il y a bien quelque chose à poser —
  // sans quoi l'essai ci-dessus passerait sur un mécanisme entièrement mort.
  assert.ok(emplacementsDecor(occupeEscalier(),opts({densite:'leger'})).length>0);
  assert.ok(emplacementsDecor(occupeEscalier(),opts()).length>emplacementsDecor(occupeEscalier(),opts({densite:'leger'})).length);
});

test('T27 · le tirage est déterministe, et une case ne change pas quand une autre change ailleurs', () => {
  const a=emplacementsDecor(occupeEscalier(),opts());
  const b=emplacementsDecor(occupeEscalier(),opts());
  assert.deepEqual(a,b,'deux appels identiques ne rendent pas le même calque');
  // Une graine différente redistribue : sinon « déterministe » voudrait dire « figé ».
  const c=emplacementsDecor(occupeEscalier(),opts({graine:7}));
  assert.notDeepEqual(a,c,'changer la graine ne change rien au tirage');
  // Le point qui compte : peindre une case LOIN d'une pièce ne la déplace pas. Le tirage
  // ne lit que (x, y, graine) — aucun compteur, aucun état partagé.
  const ailleurs=ESCALIER.map((l)=>[...l]);
  ailleurs[1][14]=true;
  const d=emplacementsDecor(occupationMur(ailleurs,3),opts());
  const loin=(p)=>Math.abs(p.x-14)>3||Math.abs(p.y-1)>5;
  assert.deepEqual(a.filter(loin),d.filter(loin),'une pièce éloignée a bougé parce qu’une autre case a changé');
});

test('T27 · une pièce est la MOITIÉ d’une jonction : la moitié intérieure couvre la rentrée de bord, sinon il reste une fente droite', () => {
  // C'est la leçon de T24 (« un flanc n'est pas un bout de course, c'est la moitié d'une
  // jonction ») appliquée ici. Sans la moitié intérieure, le moteur laisse entre le gravat
  // et la maçonnerie une fente de fond parfaitement droite — mesurée à 140 px de long sur
  // cette carte, contre 32 px pour le plus long segment sans décor du tout.
  const pieces=emplacementsDecor(occupeEscalier(),opts());
  const occupe=occupeEscalier();
  const par=new Map(pieces.map((p)=>[`${p.x},${p.y}`,p]));
  const exterieures=pieces.filter((p)=>p.moitie==='exterieure');
  const interieures=pieces.filter((p)=>p.moitie==='interieure');
  assert.ok(exterieures.length>0&&interieures.length>0);
  // Une seule pièce par case : une couche de tuiles n'en porte pas deux.
  assert.equal(par.size,pieces.length,'deux pièces posées sur la même case');
  let appariees=0;
  for(const p of exterieures){
    assert.equal(occupe(p.x,p.y),false,'une moitié extérieure est posée sur de la matière');
    const [dx,dy]=VECTEUR[p.orientation];
    assert.equal(occupe(p.x+dx,p.y+dy),true,'une moitié extérieure ne s’appuie sur rien');
    const face=par.get(`${p.x+dx},${p.y+dy}`);
    assert.ok(face,`la case d’en face de (${p.x}, ${p.y}) ne porte aucune moitié intérieure`);
    assert.equal(face.moitie,'interieure','la case d’en face porte une moitié extérieure, ce qui est impossible');
    if(face.orientation===OPPOSE[p.orientation])appariees+=1;
  }
  // La frontière du mécanisme, écrite plutôt que tue : une case de matière déjà réclamée
  // par une autre jonction garde sa pièce, et la seconde jonction reste à une moitié — une
  // couche de tuiles ne porte qu'une tuile par case. Mesuré sur cette carte : 28 des 33
  // jonctions sont complètes. Le seuil vérifie que c'est bien l'exception et non la règle.
  assert.ok(appariees>=exterieures.length*0.75,`seulement ${appariees} jonctions complètes sur ${exterieures.length}`);
  for(const p of interieures)assert.equal(occupe(p.x,p.y),true,'une moitié intérieure n’est pas posée sur de la matière');
});

test('T27 · le calque casse la grille : la silhouette perd ses longs segments droits sur l’escalier de l’utilisateur', () => {
  // Le chiffre qui objective « ça crée des escaliers » : la part des pixels de silhouette
  // (transition opaque/transparent) qui appartiennent à un segment RECTILIGNE d'au moins
  // une demi-tuile. Un mur en escalier n'est que ça ; un bord de rochers n'en a presque
  // plus. Mesuré sur la scène NUE, sans sol : un sol opaque partout masquerait toute
  // silhouette et la mesure ne dirait plus rien.
  const TUILE=32,DC=16,DR=12,DH=3;
  const scene=(densite)=>{
    const s={tilesetType:'wall',tileSize:TUILE,cornerRadius:2,edgeStyle:'rough',edgeRoughness:3,edgeFrequency:5,edgePadding:4,
      baseColor:couleurMoyenne('pierre'),edgeColor:couleurMoyenne('pierre'),edgeFade:4,shades:6,textureNoise:12,fleckAmount:6,seed:31415,
      relief:0.45,whiteBackground:false,showGrid:false,pixelFlecks:true,
      surfaceTexture:rendreMatiere('pierre',TUILE,31415).surface,edgeTexture:rendreMatiere('pierre',TUILE,31415).contour,
      faceTexture:rendreMatiere('brique',TUILE,31415).surface,decor:densite};
    const atlas=renderLogical(s).imageData;
    const dd=decorAtlasDescriptor('wall',densite);
    const img={data:new Uint8ClampedArray(DC*TUILE*DR*TUILE*4),width:DC*TUILE,height:DR*TUILE};
    const p=peintrePixels(img,atlas,1);p.fond=()=>{};p.fondMotif=()=>{};
    dessinerScene(p,{tile:TUILE,colonnes:DC,lignes:DR,set:null,masqueDe:()=>null,
      mur:{hauteur:DH,grille:ESCALIER,descripteur:D},sol:{couleur:'#2a2622'},
      decor:dd?{descripteur:dd,densite,graine:31415}:null});
    return img;
  };
  const mesure=(img)=>{
    const a=(x,y)=>x>=0&&y>=0&&x<img.width&&y<img.height&&img.data[(y*img.width+x)*4+3]>0;
    const minimum=TUILE/2;let total=0,droits=0,plusLong=0;
    const compter=(t,fin)=>{let run=0;for(let i=0;i<=fin;i+=1){const v=t(i);if(v){run+=1;total+=1;}else{if(run>=minimum)droits+=run;if(run>plusLong)plusLong=run;run=0;}}};
    for(let x=1;x<img.width;x+=1)compter((y)=>y<img.height&&a(x-1,y)!==a(x,y),img.height);
    for(let y=1;y<img.height;y+=1)compter((x)=>x<img.width&&a(x,y-1)!==a(x,y),img.width);
    return {part:total?droits/total:0,plusLong};
  };
  const sans=mesure(scene('aucun')),leger=mesure(scene('leger')),dense=mesure(scene('dense'));
  // Vérifié à l'envers d'abord : sans décor, la silhouette EST faite de segments droits.
  // Sans ce plancher, la chute mesurée ensuite ne prouverait rien. Plancher abaissé de
  // 0,2 à 0,1 quand les fentes de sol du dessus en biais ont été bouchées : elles
  // faisaient à elles seules près de la moitié des segments droits (20,3 % → 11,5 %).
  assert.ok(sans.part>0.1,`sans décor, seulement ${(sans.part*100).toFixed(1)} % de segments droits — la mesure ne mesure rien`);
  assert.ok(leger.part<sans.part*0.75,`léger : ${(leger.part*100).toFixed(1)} % contre ${(sans.part*100).toFixed(1)} % sans décor`);
  assert.ok(dense.part<sans.part*0.55,`dense : ${(dense.part*100).toFixed(1)} % contre ${(sans.part*100).toFixed(1)} % sans décor`);
  // Et le calque ne doit jamais DESSINER une grille à son tour : c'est le défaut exact que
  // la moitié intérieure corrige, et il se voyait ici à 140 px de segment.
  assert.ok(dense.plusLong<=2*TUILE,`le décor a créé un segment droit de ${dense.plusLong} px`);
});

test('T27 · le calque se pose aussi sur un terrain, pas seulement sur un mur, et lit la case d’atlas du descripteur', () => {
  // L'aperçu de terrain passe par `masqueDe`, pas par `occupationMur` : le chemin est
  // distinct et il doit marcher aussi, sinon le réglage mentirait en mode blob.
  const ile=grille(['.....','.###.','.###.','.###.','.....']);
  const occupe=(x,y)=>y>=0&&y<ile.length&&x>=0&&x<ile[y].length&&ile[y][x];
  const pieces=emplacementsDecor(occupe,opts({colonnes:5,lignes:5}));
  assert.ok(pieces.length>0,'aucune pièce posée autour d’une île pourtant bordée de vide');
  for(const p of pieces){
    const c=caseDecor(DECOR,p.orientation,p.variant);
    assert.ok(c,`aucune case d’atlas pour ${p.orientation}/${p.variant}`);
    assert.equal(c.row,DECOR.firstRow+DECOR.orientations.indexOf(p.orientation));
    assert.equal(c.col,p.variant);
  }
});
// ===========================================================================
// Tranche T41 — le déclencheur du coin, corrigé : le sud en diagonale, plus le nord
// ===========================================================================
// T37 regardait (x, y − 1), le nord. Diagnostic vérifié dans le moteur (voir le
// commentaire d'en-tête d'`etatsDeBande`) : un mur qui tourne au nord fait, pour une face
// qui regarde le sud, un coin EXTÉRIEUR — rien à ombrer — et `left-end`/`right-end`
// avaient déjà le bon bord rentré. Le vrai cas, une coupure nette observée sur la scène
// réelle du jeu, est un montant qui descend au SUD : son dessus passe devant la face de la
// course du dessus et la coupe. Ces essais figent les cas que le nouveau voisin distingue :
// le bout qui tourne au nord (n'est plus un coin), le montant en diagonale sud (en devient
// un, y compris depuis un état déjà « middle »), le montant tout droit sous un bout (ne
// déclenche rien, seule la diagonale compte), la jonction en diagonale de T24 (garde sa
// forme, gagne la pénombre si un montant la touche), et les deux diagonales à la fois.

test('T41 : un bout dont le mur tourne au nord redevient un bout libre, jamais un coin', () => {
  // Le L de T37, rejoué : une course horizontale, un montant au nord de son bout DROIT,
  // puis de son bout GAUCHE. Les deux restent `right-end`/`left-end` — le nord ne compte
  // plus pour rien dans `etatsDeBande`.
  const droite=etatsDeBande(grille(['....#.','....#.','.####.','......']));
  assert.equal(droite(4,2),'right-end','le bout droit surmonté d’un mur au nord reste un bout libre');
  assert.equal(droite(1,2),'left-end','le bout gauche, en l’air, reste aussi un bout');
  assert.equal(droite(2,2),'middle');

  const gauche=etatsDeBande(grille(['.#....','.#....','.####.','......']));
  assert.equal(gauche(1,2),'left-end','le bout gauche surmonté d’un mur au nord reste un bout libre');
  assert.equal(gauche(4,2),'right-end');
});

test('T41 : un montant en diagonale sud fait un coin — à gauche ou à droite, même depuis un état middle', () => {
  // La figure de la pièce fermée : une course horizontale, deux montants qui descendent
  // exactement sous ses deux bouts (colonnes 1 et 4). Les bouts eux-mêmes n'ont rien en
  // diagonale sud (le montant est droit dessous, pas en biais) et restent des bouts ; ce
  // sont les cases VOISINES, déjà « middle » par la course, qui reçoivent la pénombre —
  // exactement « la première case visible de la face, juste à côté du montant qui
  // descend » de la tranche.
  const e=etatsDeBande(grille(['......','.####.','.#..#.']));
  assert.equal(e(1,1),'left-end','le bout gauche : montant droit dessous, rien en diagonale');
  assert.equal(e(4,1),'right-end','le bout droit : montant droit dessous, rien en diagonale');
  assert.equal(e(2,1),'corner-left','montant sud-ouest en (1,2) : la pénombre est à l’ouest');
  assert.equal(e(3,1),'corner-right','montant sud-est en (4,2) : la pénombre est à l’est');
});

test('T41 : un montant droit dessous un bout, sans décalage, ne déclenche rien', () => {
  // Seule la diagonale compte, jamais la case directement sous la bande — c'est elle où
  // tombe l'ombre portée, jamais où le mur continue à l'identique.
  const e=etatsDeBande(grille(['......','.####.','.#....','.#....']));
  assert.equal(e(1,1),'left-end','un montant droit dessous ne fait pas un coin');
  assert.equal(e(4,1),'right-end');
});

test('T41 : une jonction en diagonale (T24) garde sa silhouette, et porte la pénombre du côté où la moitié basse la touche', () => {
  // Effet de bord vérifié, pas supposé : la moitié BASSE d'une jonction en diagonale est,
  // par construction, le voisin sud-ouest ou sud-est de sa moitié HAUTE — c'est la même
  // règle « haut.x1 + 1 === bas.x0 » qui fait la jonction (T24) qui fait aussi le montant
  // (T41) vu d'en haut. La moitié haute porte donc TOUJOURS la pénombre de son propre
  // raccord ; la moitié basse, elle, ne la porte que si quelque chose descend sous ELLE.
  const e=etatsDeBande(grille(['.#.#..','.###..','....##','......']));
  assert.equal(e(3,1),'corner-right','la moitié haute voit sa propre moitié basse comme un montant sud-est');
  assert.equal(e(4,2),'middle','la moitié basse, elle, n’a rien sous elle : simple middle');
  // La tête isolée du haut (colonne 1) n'est raccordée à rien et n'a rien en diagonale sud :
  // elle reste un bout, comme avant T37.
  assert.equal(e(1,1),'left-end','la tête isolée n’a rien en diagonale sud : elle reste un bout');
});

test('T41 : la moitié basse d’une jonction en diagonale gagne aussi sa pénombre si un montant descend sous elle', () => {
  // Même figure, avec un montant ajouté sous le bout de la moitié basse : sa silhouette ne
  // change pas (déjà middle par la jonction), seule la pénombre s'y ajoute.
  const e=etatsDeBande(grille(['.#.#..','.###..','....##','...#..']));
  assert.equal(e(4,2),'corner-left','le montant ajouté en (3,3) est au sud-ouest de (4,2)');
});

test('T41 : les deux diagonales sud à la fois retombent sur middle — la limite assumée', () => {
  const e=etatsDeBande(grille(['..#..','..#..','.#.#.']));
  assert.equal(e(2,0),'isolated','rien en diagonale sud de la tête du montant');
  assert.equal(e(2,1),'middle','un montant de chaque côté en diagonale : deux joues opposées se liraient comme un pilier');
});

test('T41 : placerMur va chercher la colonne 6 pour corner-left et la 7 pour corner-right', () => {
  // Le sens, vérifié là où il se paie : la colonne d'atlas. Une inversion ici donnerait un
  // mur dont la pénombre est du mauvais côté de chaque virage, et rien d'autre ne
  // l'attraperait — les deux pièces ont la même silhouette.
  assert.equal(D.etats.indexOf('corner-left'),6);
  assert.equal(D.etats.indexOf('corner-right'),7);
  const g=grille(['.####.','.#..#.']);
  assert.equal(etatsDeBande(g)(3,0),'corner-right');
  for(const piece of placerMur(D,g,3,0,2,'corner-right')){
    if(piece.row===D.baseRow||piece.row===D.faceRow)assert.equal(piece.col,7,'la case d’angle droite ne pointe pas la colonne 7');
  }
  assert.equal(etatsDeBande(g)(2,0),'corner-left');
  for(const piece of placerMur(D,g,2,0,2,'corner-left')){
    if(piece.row===D.baseRow||piece.row===D.faceRow)assert.equal(piece.col,6,'la case d’angle gauche ne pointe pas la colonne 6');
  }
});

// ===========================================================================
// T43 — les jonctions en diagonale, exposées puis posées en biais
// ===========================================================================

test('T43 : jonctionsDiagonales expose ce qu’etatsDeBande calculait puis jetait — les deux sens, et la DERNIÈRE case d’une course', () => {
  // Descend à droite : la course du bas commence une colonne après la fin de celle du haut.
  const droite=grille(['.###....','....###.']);
  assert.deepEqual(jonctionsDiagonales(droite),[{xHaut:3,yHaut:0,xBas:4,yBas:1,sens:'droite'}]);
  // Descend à gauche : miroir exact.
  const gauche=grille(['....###.','.###....']);
  assert.deepEqual(jonctionsDiagonales(gauche),[{xHaut:4,yHaut:0,xBas:3,yBas:1,sens:'gauche'}]);
  // L'escalier de cinq marches : quatre jonctions, la cinquième marche n'ayant rien sous
  // elle. C'est la carte sur laquelle la tranche est mesurée.
  const escalier=grille(['#.....','.#....','..#...','...#..','....#.']);
  const j=jonctionsDiagonales(escalier);
  assert.equal(j.length,4);
  assert.ok(j.every(x=>x.sens==='droite'));
  assert.deepEqual(j.map(x=>[x.xHaut,x.yHaut]),[[0,0],[1,1],[2,2],[3,3]]);
  // Deux courses empilées dans la MÊME colonne ne sont jamais une jonction — l'invariant
  // que T24 a posé, et qui interdit de raccorder au milieu d'un mur vertical.
  assert.deepEqual(jonctionsDiagonales(grille(['.#.','.#.'])),[]);
  // Et une jonction en X : les deux sens sur la même paire de rangées.
  assert.equal(jonctionsDiagonales(grille(['.##..##.','...##...'])).length,2);
});

test('T43 : la bande en biais occupe une rangée de PLUS, et seule la case de jonction la prend', () => {
  const g=grille(['.###....','....###.']);
  const j=jonctionsDiagonales(g)[0];
  const pieces=placerMurBiais(D,g,j.xHaut,j.yHaut,3,j.sens);
  const b=D.biais.droite;
  // De bas en haut : base coupée (une rangée SOUS l'emprise), base haute, une face, le
  // raccord, puis le dessus — cinq pièces pour une face de trois rangées, et non quatre.
  assert.deepEqual(pieces.slice(0,4).map(p=>[p.col,p.row,p.dx,p.dy]),[
    [b['base-basse'].col,b['base-basse'].row,3,1],
    [b['base-haute'].col,b['base-haute'].row,3,0],
    [b.face.col,b.face.row,3,-1],
    [b.raccord.col,b.raccord.row,3,-2],
  ]);
  assert.equal(pieces.length,5);
  assert.deepEqual([pieces[4].dx,pieces[4].dy],[3,-3],'le dessus reste à sa place, inchangé');
  // La rangée la plus basse de la bande est bien une rangée de plus que celle d'un mur
  // droit de même hauteur.
  const droit=placerMur(D,g,j.xHaut,j.yHaut,3,etatsDeBande(g)(j.xHaut,j.yHaut));
  assert.equal(Math.max(...pieces.map(p=>p.dy)),Math.max(...droit.map(p=>p.dy))+1);
  // Les deux autres cases de la course gardent leur face droite : ce sont des `middle`.
  assert.equal(etatsDeBande(g)(1,0),'left-end');
  assert.equal(etatsDeBande(g)(2,0),'middle');
});

// ===========================================================================
// T45 — la face en biais sur un mur d'une case de haut
// ===========================================================================

test('T45 : un mur d’une case de haut pose trois pièces — base-basse, raccord-base, le dessus — et non plus null', () => {
  const g=grille(['.###....','....###.']);
  const j=jonctionsDiagonales(g)[0];
  const pieces=placerMurBiais(D,g,j.xHaut,j.yHaut,1,j.sens);
  const b=D.biais.droite;
  assert.equal(pieces.length,3);
  assert.deepEqual(pieces.slice(0,2).map(p=>[p.col,p.row,p.dx,p.dy]),[
    [b['base-basse'].col,b['base-basse'].row,3,1],
    [b['raccord-base'].col,b['raccord-base'].row,3,0],
  ]);
  assert.deepEqual([pieces[2].dx,pieces[2].dy],[3,-1],'le dessus reste à sa place attendue, une rangée au-dessus de l’emprise');
  // `hauteur < 1` reste `null` : aucune case d'emprise à peindre.
  assert.equal(placerMurBiais(D,g,j.xHaut,j.yHaut,0,j.sens),null);
});

test('T43 : l’ombre en biais prend deux cases — le pied du mur descend, son ombre avec lui', () => {
  const g=grille(['.###....','....###.']);
  const b=D.biais.droite;
  assert.deepEqual(placerOmbreBiais(D,3,0,'droite'),[
    {col:b['ombre-haute'].col,row:b['ombre-haute'].row,dx:3,dy:1},
    {col:b['ombre-basse'].col,row:b['ombre-basse'].row,dx:3,dy:2},
  ]);
  assert.deepEqual(placerOmbreBiais({...D,biais:null},3,0,'droite'),[]);
});

test('T43 : la scène pose la bande en biais sur la case de jonction, et rien d’autre ne la recouvre', () => {
  // Atlas témoin : chaque case porte sa propre couleur, donc lire un pixel dit quelle case
  // d'atlas a été posée. C'est l'ordre de peinture qu'on vérifie — la pièce la plus basse
  // de la bande tombe en (x, y + 1), une colonne que la course du dessous n'occupe jamais.
  const dc=8,dr=8;
  const g=grille(['........','........','........','........','.###....','....###.','........','........']);
  const image={data:new Uint8ClampedArray(dc*TILE*dr*TILE*4),width:dc*TILE,height:dr*TILE};
  const atlas=atlasTemoin(8,11);
  dessinerScene(peintrePixels(image,atlas,1),{
    tile:TILE,colonnes:dc,lignes:dr,set:null,masqueDe:()=>null,
    mur:{hauteur:3,grille:g,descripteur:D},sol:{couleur:'#000000'},
  });
  const caseEn=(cx,cy)=>{const i=(((cy*TILE+3)*image.width)+cx*TILE+3)*4;return [(image.data[i]-1)/8,(image.data[i+1]-1)/8];};
  const b=D.biais.droite;
  // La colonne 3 : la bande en biais, de son raccord à sa base coupée.
  assert.deepEqual(caseEn(3,2),[b.raccord.col,b.raccord.row]);
  assert.deepEqual(caseEn(3,3),[b.face.col,b.face.row]);
  assert.deepEqual(caseEn(3,4),[b['base-haute'].col,b['base-haute'].row]);
  assert.deepEqual(caseEn(3,5),[b['base-basse'].col,b['base-basse'].row]);
  // La colonne 2, voisine dans la même course, garde sa face droite.
  const middle=D.etats.indexOf('middle');
  assert.deepEqual(caseEn(2,3),[middle,D.faceRow]);
  assert.deepEqual(caseEn(2,4),[middle,D.baseRow]);
  // Et la case basse de la jonction (colonne 4) n'est pas touchée : sa face reste droite.
  assert.equal(caseEn(4,4)[1],D.faceRow);
});

test('T45 : la scène pose le raccord-base sur la case de jonction d’un mur d’une case de haut', () => {
  // Même montage que l'essai T43 équivalent, hauteur 1 au lieu de 3 : la case haute de
  // la jonction ne porte plus qu'une base-basse (dy + 1) et un raccord-base (dy même
  // rangée que l'emprise) — plus de face intermédiaire ni de raccord séparé.
  const dc=8,dr=8;
  const g=grille(['........','........','........','........','.###....','....###.','........','........']);
  const image={data:new Uint8ClampedArray(dc*TILE*dr*TILE*4),width:dc*TILE,height:dr*TILE};
  const atlas=atlasTemoin(8,11);
  dessinerScene(peintrePixels(image,atlas,1),{
    tile:TILE,colonnes:dc,lignes:dr,set:null,masqueDe:()=>null,
    mur:{hauteur:1,grille:g,descripteur:D},sol:{couleur:'#000000'},
  });
  const caseEn=(cx,cy)=>{const i=(((cy*TILE+3)*image.width)+cx*TILE+3)*4;return [(image.data[i]-1)/8,(image.data[i+1]-1)/8];};
  const b=D.biais.droite;
  // La colonne 3 : le raccord-base à la rangée d'emprise, la base-basse une rangée plus bas.
  assert.deepEqual(caseEn(3,4),[b['raccord-base'].col,b['raccord-base'].row]);
  assert.deepEqual(caseEn(3,5),[b['base-basse'].col,b['base-basse'].row]);
  // La colonne 2, voisine dans la même course, garde sa base droite.
  const middle=D.etats.indexOf('middle');
  assert.deepEqual(caseEn(2,4),[middle,D.baseRow]);
  // Et la case basse de la jonction (colonne 4) n'est pas touchée : à hauteur 1, elle n'a
  // pas de face (seulement une base et son dessus), donc c'est sa BASE, à l'état que
  // `etatsDeBande` lui donne (bout gauche de la course du bas), qu'on retrouve ici.
  const basseEtat=D.etats.indexOf(etatsDeBande(g)(4,5));
  assert.deepEqual(caseEn(4,5),[basseEtat,D.baseRow]);
});

// ===========================================================================
// T44 — la pente du bord arrière du dessus
// ===========================================================================

test('T44 : penteVoisinsDessus — la case basse d’une jonction porte N, la case haute porte E (droite) ou W (gauche)', () => {
  const droite=grille(['.###....','....###.']);
  const jd=jonctionsDiagonales(droite)[0];
  const infoD=penteVoisinsDessus(droite);
  assert.ok(infoD.nord.has(`${jd.xBas},${jd.yBas}`));
  assert.equal(infoD.lateral.get(`${jd.xHaut},${jd.yHaut}`),'E');
  assert.equal(infoD.nord.has(`${jd.xHaut},${jd.yHaut}`),false,'la case HAUTE ne porte pas N pour cette seule jonction');
  assert.equal(infoD.lateral.get(`${jd.xBas},${jd.yBas}`),undefined,'la case BASSE ne porte pas de latéral pour cette seule jonction');

  const gauche=grille(['....###.','.###....']);
  const jg=jonctionsDiagonales(gauche)[0];
  assert.equal(jg.sens,'gauche');
  const infoG=penteVoisinsDessus(gauche);
  assert.ok(infoG.nord.has(`${jg.xBas},${jg.yBas}`));
  assert.equal(infoG.lateral.get(`${jg.xHaut},${jg.yHaut}`),'W');
});

test('T44 : une marche intermédiaire d’un escalier de plusieurs jonctions porte les DEUX forçages à la fois', () => {
  // Trois marches qui descendent à droite : la marche du milieu est la case BASSE de la
  // première jonction et la case HAUTE de la seconde — c'est elle, et elle seule, qui
  // réclame le bit NE.
  const g=grille(['.#......','..#.....','...#....']);
  const info=penteVoisinsDessus(g);
  assert.ok(info.nord.has('2,1'));
  assert.equal(info.lateral.get('2,1'),'E');
  assert.equal(info.nord.has('1,0'),false);
  assert.equal(info.lateral.get('3,2'),undefined);
});

test('T44 : masqueDessusMur force N/E/SE sur les deux cases d’une jonction, et NE sur celle qui cumule les deux', () => {
  const g=grille(['.#......','..#.....','...#....']);
  const B=NEIGHBOUR_BITS;
  const info=penteVoisinsDessus(g);
  // La case (1,0) : latéral E forcé (pente à côté), pas de N (rien au-dessus).
  const m1=masqueDessusMur(g,1,0,info);
  assert.ok(m1&B.E); assert.ok(m1&B.SE); assert.ok(!(m1&B.N)); assert.ok(!(m1&B.NE));
  // La case (2,1) : N ET E forcés, donc NE aussi — le point dur mesuré.
  const m2=masqueDessusMur(g,2,1,info);
  assert.ok(m2&B.N); assert.ok(m2&B.E); assert.ok(m2&B.SE); assert.ok(m2&B.NE);
  // La case (3,2) : seulement N (dernière marche, rien à côté).
  const m3=masqueDessusMur(g,3,2,info);
  assert.ok(m3&B.N); assert.ok(!(m3&B.E)); assert.ok(!(m3&B.NE));
  // Sans `penteInfo`, la fonction le recalcule elle-même — même résultat.
  assert.equal(masqueDessusMur(g,2,1),m2);
  // Une case hors de toute jonction ne gagne toujours que S (T22), comme avant T44.
  const seul=grille(['.#.']);
  assert.equal(masqueDessusMur(seul,1,0),NEIGHBOUR_BITS.S);
});

test('T44 : caseMurPente pose sur la case vide (xHaut ± 1, yHaut − hauteur), miroir selon le sens', () => {
  const droite=grille(['.###....','....###.']);
  const jd=jonctionsDiagonales(droite)[0];
  const pd=caseMurPente(D,jd,3);
  const bd=D.biais.droite.pente;
  assert.deepEqual(pd,{col:bd.col,row:bd.row,dx:jd.xHaut+1,dy:jd.yHaut-3});

  const gauche=grille(['....###.','.###....']);
  const jg=jonctionsDiagonales(gauche)[0];
  const pg=caseMurPente(D,jg,3);
  const bg=D.biais.gauche.pente;
  assert.deepEqual(pg,{col:bg.col,row:bg.row,dx:jg.xHaut-1,dy:jg.yHaut-3});

  // Sans bloc en biais (descripteur d'une autre disposition), rien à poser.
  assert.equal(caseMurPente({...D,biais:null},jd,3),null);
});

test('T44 : la scène pose la pente sur la case vide du décrochement, sur sa propre rangée, sans rien recouvrir', () => {
  const dc=8,dr=8;
  const g=grille(['........','........','........','........','.###....','....###.','........','........']);
  const image={data:new Uint8ClampedArray(dc*TILE*dr*TILE*4),width:dc*TILE,height:dr*TILE};
  const atlas=atlasTemoin(8,11);
  dessinerScene(peintrePixels(image,atlas,1),{
    tile:TILE,colonnes:dc,lignes:dr,set:null,masqueDe:()=>null,
    mur:{hauteur:3,grille:g,descripteur:D},sol:{couleur:'#000000'},
  });
  const caseEn=(cx,cy)=>{const i=(((cy*TILE+3)*image.width)+cx*TILE+3)*4;return [(image.data[i]-1)/8,(image.data[i+1]-1)/8];};
  const b=D.biais.droite.pente;
  // La jonction est en (3,4) → (4,5) (h=3 : dessus en rangée 1) ; la case vide est (4,1).
  assert.deepEqual(caseEn(4,1),[b.col,b.row]);
  // Rien d'autre n'a bougé : le dessus des deux marches garde sa propre case (un masque
  // du blob, jamais la pente elle-même).
  assert.notDeepEqual(caseEn(3,1),[b.col,b.row]);
  assert.notDeepEqual(caseEn(4,2),[b.col,b.row]);
});

test('T44 : le décor n’ajoute rien sur la case qu’une pente occupe déjà', () => {
  // `emplacementsDecor` verrait, sans le savoir, une case vide bordée de matière —
  // exactement la condition qui lui fait poser un gravat. `dessinerScene` doit donc
  // compter cette case comme occupée pour le calque de décor.
  const dc=8,dr=8,hauteur=3;
  const g=grille(['........','........','........','........','.###....','....###.','........','........']);
  const j=jonctionsDiagonales(g)[0];
  const px=j.xHaut+1,py=j.yHaut-hauteur;
  const occupeSansPente=occupationMur(g,hauteur);
  // Sans tenir compte de la pente, la case est vue comme LIBRE par le décor (c'est le
  // défaut que la tranche corrige) : elle apparaîtrait dans `emplacementsDecor`.
  assert.equal(occupeSansPente(px,py),false);
  // dessinerScene doit donc composer occupationMur avec les cases de pente — vérifié
  // indirectement : aucune pièce de décor n'atterrit sur cette case précise quand on
  // laisse tourner le calque de décor sur la scène réelle.
  const atlas=atlasTemoin(8,15);
  const image={data:new Uint8ClampedArray(dc*TILE*dr*TILE*4),width:dc*TILE,height:dr*TILE};
  const descDecor={variants:1,orientations:['n','e','s','w'],cells:[{col:7,row:11,orientation:'n',variant:0},{col:7,row:12,orientation:'e',variant:0},{col:7,row:13,orientation:'s',variant:0},{col:7,row:14,orientation:'w',variant:0}]};
  dessinerScene(peintrePixels(image,atlas,1),{
    tile:TILE,colonnes:dc,lignes:dr,set:null,masqueDe:()=>null,
    mur:{hauteur,grille:g,descripteur:D},decor:{descripteur:descDecor,densite:'dense',graine:1},sol:{couleur:'#000000'},
  });
  const caseEn=(cx,cy)=>{const i=(((cy*TILE+3)*image.width)+cx*TILE+3)*4;return [(image.data[i]-1)/8,(image.data[i+1]-1)/8];};
  const bp=D.biais.droite.pente;
  assert.deepEqual(caseEn(px,py),[bp.col,bp.row],'la case de pente garde sa pente, aucun gravat par-dessus');
});

test('Fentes du biais : la case basse d’une jonction a son dessus fermé du côté du raccord (W à droite, E à gauche, avec NW/NE)', () => {
  const g=grille(['......','.#....','..#...','...#..','......']);
  const info=penteVoisinsDessus(g);
  assert.equal(info.arriere.get('2,2'),'W');
  const m=masqueDessusMur(g,2,2,info);
  assert.ok(m&NEIGHBOUR_BITS.W&&m&NEIGHBOUR_BITS.NW&&m&NEIGHBOUR_BITS.N);
  const miroir=grille(['......','...#..','..#...','.#....','......']);
  assert.equal(penteVoisinsDessus(miroir).arriere.get('2,2'),'E');
});

test('Liserés : une case couverte par sa voisine du sud ne peint que son dessus, sauf si elle continue seule sur le côté', () => {
  const vertical=grille(['...','.#.','.#.','...']);
  assert.equal(placerMur(D,vertical,1,1,3).length,1,'mur vertical : dessus seul');
  assert.equal(placerMur(D,vertical,1,2,3).length,4,'la case du bas garde sa pile');
  const bout=grille(['....','.##.','.#..','....']);
  assert.equal(placerMur(D,bout,1,1,3).length,4,'continue à l’est sans la voisine du sud : pile gardée');
});

test('Trou en V : le bout d’un mur vertical qui touche une marche en diagonale ne crée pas de second escalier', () => {
  const g=grille(['...#..','...#..','#..#..','.#.#..','..#...','...###','......']);
  const js=jonctionsDiagonales(g);
  assert.ok(js.every((j)=>j.sens==='droite'),'aucune jonction gauche depuis la colonne');
  assert.equal(js.length,3);
  // Un V symétrique garde les deux côtés forcés sur la case basse commune.
  const v=grille(['......','.#...#','..#.#.','...#..','......']);
  const info=penteVoisinsDessus(v);
  const cotes=info.arriere.get('3,3');
  assert.ok(cotes.includes('W')&&cotes.includes('E'));
});
