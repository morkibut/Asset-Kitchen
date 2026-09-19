// @ts-nocheck — essai recopié tel quel depuis sc-clone (voir ../LISEZMOI.md) ; ce fichier
// reste un portage mécanique, pas du code TypeScript maison — vitest l'exécute sans que
// tsc doive typer chaque variable interne de sc-clone. Les modules importés, eux, sont
// typés honnêtement par les .d.ts du dossier parent.
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { installerBouchonCanvas } from './canvas-shim';
// renderLogical dessine dans un canvas : stub minimal, il n'utilise que createImageData et putImageData.
installerBouchonCanvas();
const {renderLogical,layout,atlasShape,terrainLayers,WALL_TOP_ROWS,WALL_BAND_STATES,BLOB_CORNERS,wallAtlasDescriptor,biaisAtlasDescriptor,WALL_BIAIS_PIECES,variantAtlasDescriptor,animationAtlasDescriptor,atlasAnimationDescriptor,atlasCopyRows,DEFAULT_ANIMATION_FRAME_DURATION_MS,BLOB_LOWER_CELL}=await import('../vendor/tileset-engine.js');
const {B47,E16,NEIGHBOUR_BITS,SIDE_BITS,atlasPosition}=await import('../tile-masks.js');
// Contrôle de couture (tranche T5) : extrait dans public/tile-check.js, partagé avec l'interface
// (public/tools.js, bouton « Vérifier le tileset ») — on ne le redéfinit plus ici.
const {alphaAt,rightColumn:rightCol,leftColumn:leftCol,bottomRow,topRow,identical,seamFault,compatibleHorizontal,compatibleVertical}=await import('../tile-check.js');

const hex=h=>({r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)});
// Calqué sur tileSettings() de public/tools.js, valeurs par défaut du panneau —
// SAUF `relief`, laissé absent (donc 0). Ce n'est pas un oubli : les empreintes de
// ce fichier figent le rendu SANS lumière rasante, celui d'avant cette tranche, et
// les garder comparables vaut mieux que de les remplacer. Le rendu par défaut du
// panneau, relief compris, a sa propre empreinte plus bas.
const settings=(over={})=>{const size=over.tileSize??32;return {tilesetType:'topdown-15',tileSize:size,cornerRadius:2*size/32,edgeStyle:'rough',edgeRoughness:3*size/32,edgeFrequency:5,edgePadding:2*size/16,baseColor:hex('#92af70'),edgeColor:hex('#43563d'),edgeFade:3*size/32,shades:4,textureNoise:12,fleckAmount:6,seed:31415,whiteBackground:false,showGrid:false,pixelFlecks:true,...over};};
const render=s=>renderLogical(s).imageData;
// Réglages « nus » : sans bruit ni assombrissement, un pixel de terrain vaut exactement le texel de surface.
const plain=over=>settings({textureNoise:0,fleckAmount:0,pixelFlecks:false,edgeFade:0,...over});
const damier=(size,cell,a=[220,40,40,255],b=[20,30,200,255])=>{const data=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.set((Math.floor(x/cell)+Math.floor(y/cell))%2?b:a,(y*size+x)*4);return {data,width:size,height:size};};
const uni=(size,rgba)=>{const data=new Uint8ClampedArray(size*size*4);for(let i=0;i<size*size;i++)data.set(rgba,i*4);return {data,width:size,height:size};};
const px=(img,x,y)=>[...img.data.slice((y*img.width+x)*4,(y*img.width+x)*4+4)];
// La tuile pleine (les quatre quadrants remplis) : masque 15 dans la disposition 4 × 4.
const fullTile=(()=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===15)return {col:c,row:r};throw new Error('masque plein absent de la disposition');})();

test('untextured rendering is byte-stable — guards the colour-ramp path against regressions', () => {
  // Empreinte de référence. Si un changement délibéré la fait bouger, la mettre à jour ici en connaissance de cause.
  // Mise à jour une fois, sciemment : le mode 15 est passé au bruit raccordable (seamlessFbm).
  // L'empreinte précédente (3436dc1f…) figeait un défaut de couture — voir l'essai suivant, qui
  // vérifie la propriété plutôt que les octets et vaut donc mieux que cette empreinte.
  const digest=createHash('sha256').update(Buffer.from(render(settings()).data.buffer)).digest('hex');
  assert.equal(digest,'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
});

test('corner-mask tiles meet cleanly on every compatible seam, organic borders included', () => {
  // Le défaut que cet essai empêche de revenir : avec une graine de bruit par masque, la
  // transition plein/vide portée par un bord de tuile tombait à un endroit différent de chaque
  // côté d'une couture. Mesuré avant correction : 13 des 64 paires compatibles, jusqu'à 2 px
  // d'écart, avec les réglages par défaut de l'atelier (bordures organiques, graine 31415).
  //
  // Portée volontairement bornée à une irrégularité de 5, et ce n'est pas une commodité :
  // seamlessFbm reboucle de façon *continue*, pas identique. Les deux points échantillonnés
  // de part et d'autre d'une couture sont voisins d'une fraction de maille, pas confondus —
  // au-delà de 5, une pente forte suffit à faire basculer le seuil d'un pixel. Mesuré sur six
  // graines : zéro défaut de 0 à 5 partout ; au-delà, une seule graine sur six en produit
  // (16 paires, à 6, 8 et 9). Le validateur de l'atelier signale le cas sur l'atlas réel.
  const T=32,pos=m=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===m)return{col:c,row:r};throw new Error('masque absent : '+m);};
  for(const seed of [31415,7,99999,12345,2718,161803])for(const edgeRoughness of [0,1,2,3,4,5]){
    const img=render(settings({seed,edgeRoughness,edgeStyle:'rough'}));
    const a=(m,x,y)=>{const p=pos(m);return img.data[(((p.row*T+y)*img.width)+p.col*T+x)*4+3]>0?1:0;};
    for(let A=0;A<16;A++)for(let B=0;B<16;B++){
      const ctx=`graine ${seed}, rugosité ${edgeRoughness}, masques ${A}|${B}`;
      // Voisins horizontaux : les coins droits de A sont les coins gauches de B.
      if(!!(A&2)===!!(B&1)&&!!(A&8)===!!(B&4)){
        const g=Array.from({length:T},(_,y)=>a(A,T-1,y)),d=Array.from({length:T},(_,y)=>a(B,0,y));
        assert.equal(seamFault(g,d),-1,`couture verticale rompue · ${ctx}`);
      }
      // Voisins verticaux : les coins bas de A sont les coins hauts de B.
      if(!!(A&4)===!!(B&1)&&!!(A&8)===!!(B&2)){
        const h=Array.from({length:T},(_,x)=>a(A,x,T-1)),b=Array.from({length:T},(_,x)=>a(B,x,0));
        assert.equal(seamFault(h,b),-1,`couture horizontale rompue · ${ctx}`);
      }
    }
  }
});

test('a solid texture paints terrain pixels with its exact colour and never bleeds outside', () => {
  const colour=[171,63,209,255];
  const bare=render(plain()),painted=render(plain({surfaceTexture:uni(32,colour)}));
  let terrain=0;
  for(let i=0;i<painted.data.length;i+=4){
    assert.equal(painted.data[i+3],bare.data[i+3]); // la silhouette vient du masque, jamais de l'image fournie
    if(painted.data[i+3]===255){terrain+=1;assert.deepEqual([...painted.data.slice(i,i+3)],colour.slice(0,3));}
  }
  assert.ok(terrain>2000,`trop peu de pixels de terrain peints : ${terrain}`);
});

test('texture period divides the tile size, so the pattern crosses seams unbroken', () => {
  // L'invariant de la tranche T1 : une tuile posée en case mx couvre les pixels monde mx·T + lx.
  // Il faut mx·T ≡ 0 (mod P) pour tout mx, donc P | T. La texture est ramenée à T avant estampage,
  // et chaque tuile lit (lx mod P, ly mod P) — la même phase pour toutes.
  const tile=32,cell=8;
  for(const source of [32,64,512]){ // rééchantillonnage ÷1, ÷2 et ÷16
    const scale=source/tile;
    const img=render(plain({tileSize:tile,surfaceTexture:damier(source,cell*scale)}));
    const ox=fullTile.col*tile,oy=fullTile.row*tile;
    for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      const attendu=(Math.floor(x/cell)+Math.floor(y/cell))%2?[20,30,200]:[220,40,40];
      assert.deepEqual(px(img,ox+x,oy+y).slice(0,3),attendu,`source ${source} px, pixel ${x},${y}`);
    }
  }
  // Conséquence directe : le motif d'une tuile se prolonge dans la suivante, puisque tile % cell === 0.
  assert.equal(tile%cell,0);
});

// ===========================================================================
// Tranche T2 — blob 47 et bord 16
// ===========================================================================

const B=NEIGHBOUR_BITS,S=SIDE_BITS;
const shot=(over={})=>{const s=settings(over),i=renderLogical(s).imageData;return {data:i.data,width:i.width,height:i.height,tile:s.tileSize};};
// compatibleH/compatibleV : les prédicats de voisinage réel du blob, désormais dans
// public/tile-check.js (compatibleHorizontal/compatibleVertical, jeu « B47 »).
const compatibleH=(L,R)=>compatibleHorizontal('B47',L,R);
const compatibleV=(T,U)=>compatibleVertical('B47',T,U);

test('le blob rend l’atlas annoncé par tile-masks : 8 × 6, les 47 masques placés, la 48e case transparente', () => {
  const img=shot({tilesetType:'blob-47'});
  assert.deepEqual(atlasShape('blob-47'),{columns:B47.layout.columns,rows:B47.layout.rows});
  assert.equal(img.width,img.tile*B47.layout.columns);
  assert.equal(img.height,img.tile*B47.layout.rows);
  // Chaque masque occupe sa case et y pose du terrain — une case restée vide par erreur
  // ne se verrait nulle part ailleurs.
  for(const mask of B47.masks){
    let terrain=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)terrain+=alphaAt(img,B47,mask,x,y);
    assert.ok(terrain>40,`masque ${mask} : ${terrain} pixels de terrain seulement`);
  }
  // 47 masques pour 48 cases : la case libre est voulue, et doit rester transparente.
  assert.equal(B47.layout.unusedCells.length,1);
  const {col,row}=B47.layout.unusedCells[0];
  assert.deepEqual([col,row],[7,5]);
  for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
    assert.equal(img.data[(((row*img.tile+y)*img.width)+col*img.tile+x)*4+3],0,`case libre peinte en ${x},${y}`);
  }
  // Le masque plein remplit sa tuile bord à bord, le masque 0 est un îlot qui ne la touche pas.
  let plein=0,ilot=0;
  for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){plein+=alphaAt(img,B47,255,x,y);ilot+=alphaAt(img,B47,0,x,y);}
  assert.equal(plein,img.tile*img.tile);
  assert.ok(ilot>0&&ilot<img.tile*img.tile*0.8,`masque 0 : ${ilot} pixels`);
});

test('l’essai qui compte — toute paire de masques blob compatibles se raccorde, sur les deux axes', () => {
  // Bords nets : la géométrie n'est plus brouillée par le bruit, la couture doit être
  // identique au pixel près. C'est la vérification de la construction elle-même.
  const net=shot({tilesetType:'blob-47',edgeStyle:'clean'});
  let paires=0;
  for(const L of B47.masks)for(const R of B47.masks){
    if(!compatibleH(L,R))continue;
    paires+=1;
    assert.ok(identical(rightCol(net,B47,L),leftCol(net,B47,R)),`couture verticale ${L} | ${R}`);
  }
  for(const T of B47.masks)for(const U of B47.masks){
    if(!compatibleV(T,U))continue;
    paires+=1;
    assert.ok(identical(bottomRow(net,B47,T),topRow(net,B47,U)),`couture horizontale ${T} / ${U}`);
  }
  assert.ok(paires>300,`trop peu de paires compatibles éprouvées : ${paires}`);

  // Bords organiques : le bruit de bord reboucle sur la tuile, donc les deux côtés d'une
  // couture lisent la même phase. Il reste l'écart d'un pixel de large entre les deux
  // colonnes voisines — exactement celui qu'on trouve entre deux colonnes d'une même
  // tuile. Un bord peut donc glisser d'un pixel ; rien ne peut s'ouvrir au milieu.
  const brut=shot({tilesetType:'blob-47',edgeStyle:'rough'});
  for(const L of B47.masks)for(const R of B47.masks){
    if(!compatibleH(L,R))continue;
    const i=seamFault(rightCol(brut,B47,L),leftCol(brut,B47,R));
    assert.equal(i,-1,`trou dans la couture verticale ${L} | ${R} à la ligne ${i}`);
  }
  for(const T of B47.masks)for(const U of B47.masks){
    if(!compatibleV(T,U))continue;
    const i=seamFault(bottomRow(brut,B47,T),topRow(brut,B47,U));
    assert.equal(i,-1,`trou dans la couture horizontale ${T} / ${U} à la colonne ${i}`);
  }
});

test('un coin blob à deux cardinaux et sans diagonale se creuse ; avec la diagonale, il reste plein', () => {
  const img=shot({tilesetType:'blob-47',edgeStyle:'clean'});
  const quart=Math.floor(img.tile/4);
  const creux=(mask,cx,cy)=>{let n=0;for(let y=0;y<quart;y++)for(let x=0;x<quart;x++)n+=1-alphaAt(img,B47,mask,cx?img.tile-1-x:x,cy?img.tile-1-y:y);return n;};
  // Les quatre coins, un par un : les quatre cardinaux posés, la diagonale seule change.
  const cotes=B.N|B.E|B.S|B.W;
  for(const [nom,diagonale,cx,cy] of [['NO',B.NW,0,0],['NE',B.NE,1,0],['SO',B.SW,0,1],['SE',B.SE,1,1]]){
    const sans=creux(cotes,cx,cy),avec=creux(cotes|diagonale,cx,cy);
    assert.ok(sans>0,`coin ${nom} : aucune encoche alors que la diagonale est absente`);
    assert.equal(avec,0,`coin ${nom} : encoche creusée alors que la diagonale est présente`);
  }
  // Et l'encoche est bien concave — elle mord le coin de la tuile, pas son milieu.
  assert.equal(alphaAt(img,B47,cotes,0,0),0);
  assert.equal(alphaAt(img,B47,cotes,Math.floor(img.tile/2),Math.floor(img.tile/2)),1);
});

test('la texture s’estampe sur le blob avec la continuité du mode 15', () => {
  // Même invariant, même code : la texture est ramenée à la taille de tuile et chaque
  // tuile lit (lx mod P, ly mod P). Sur la tuile pleine du blob, le damier doit donc
  // sortir exactement comme sur la tuile pleine des 15 pièces.
  const tile=32,cell=8;
  for(const source of [32,64,512]){
    const scale=source/tile;
    const s=plain({tilesetType:'blob-47',tileSize:tile,surfaceTexture:damier(source,cell*scale)});
    const i=renderLogical(s).imageData,img={data:i.data,width:i.width,height:i.height,tile};
    const p=atlasPosition(B47,255);
    for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      const attendu=(Math.floor(x/cell)+Math.floor(y/cell))%2?[20,30,200]:[220,40,40];
      assert.deepEqual(px(i,p.col*tile+x,p.row*tile+y).slice(0,3),attendu,`source ${source} px, pixel ${x},${y}`);
      assert.equal(alphaAt(img,B47,255,x,y),1);
    }
  }
});

test('le bord 16 pose un tronçon central et un bras par côté connecté, et ses coutures tiennent', () => {
  const net=shot({tilesetType:'edge-16',edgeStyle:'clean'});
  assert.deepEqual(atlasShape('edge-16'),{columns:4,rows:4});
  assert.equal(net.width,net.tile*4);
  // Un bras traverse toute la tuile quand les deux côtés opposés sont connectés.
  for(let x=0;x<net.tile;x++)assert.equal(alphaAt(net,E16,S.E|S.W,x,net.tile/2),1,`bras est-ouest interrompu en ${x}`);
  for(let y=0;y<net.tile;y++)assert.equal(alphaAt(net,E16,S.N|S.S,net.tile/2,y),1,`bras nord-sud interrompu en ${y}`);
  // Sans aucun côté connecté, il reste le tronçon central — ce que l'autotiler pose pour
  // une borne isolée — et il ne touche aucun bord.
  let seul=0;for(let y=0;y<net.tile;y++)for(let x=0;x<net.tile;x++)seul+=alphaAt(net,E16,0,x,y);
  assert.ok(seul>0&&seul<net.tile*net.tile*0.5,`tronçon isolé : ${seul} pixels`);
  for(let y=0;y<net.tile;y++)assert.equal(alphaAt(net,E16,0,0,y),0);
  // Les coutures : deux masques sont voisins possibles dès qu'ils s'accordent sur le côté partagé.
  const brut=shot({tilesetType:'edge-16',edgeStyle:'rough'});
  for(const L of E16.masks)for(const R of E16.masks){
    if(!compatibleHorizontal('E16',L,R))continue;
    assert.ok(identical(rightCol(net,E16,L),leftCol(net,E16,R)),`couture verticale ${L} | ${R}`);
    assert.equal(seamFault(rightCol(brut,E16,L),leftCol(brut,E16,R)),-1,`trou dans la couture verticale ${L} | ${R}`);
  }
  for(const T of E16.masks)for(const U of E16.masks){
    if(!compatibleVertical('E16',T,U))continue;
    assert.ok(identical(bottomRow(net,E16,T),topRow(net,E16,U)),`couture horizontale ${T} / ${U}`);
    assert.equal(seamFault(bottomRow(brut,E16,T),topRow(brut,E16,U)),-1,`trou dans la couture horizontale ${T} / ${U}`);
  }
});

test('les coutures tiennent aussi sous des réglages extrêmes, séparateurs compris', () => {
  // Deux bornes de la construction se sont révélées ici, et elles ne se voient dans aucun
  // rendu par défaut — d'où cet essai, qui les garde :
  //  * la rentrée du blob ne peut pas être plus fine que l'amplitude du bruit, sinon la
  //    frontière sort de la tuile et la couture ne se raccorde plus qu'à peu près ;
  //  * le congé qui unit les bras du bord 16 ne peut pas atteindre une couture, sinon la
  //    forme du bord dépend des autres bras — qui diffèrent d'une tuile à l'autre.
  const durs=[
    {tilesetType:'blob-47',tileSize:64,cornerRadius:0,edgePadding:1,edgeRoughness:6},
    {tilesetType:'blob-47',tileSize:32,cornerRadius:12,edgePadding:1},
    {tilesetType:'blob-47',tileSize:16,cornerRadius:12,edgePadding:11,showGrid:true},
    {tilesetType:'edge-16',tileSize:32,cornerRadius:12,strokeWidth:19.2},
    {tilesetType:'edge-16',tileSize:16,cornerRadius:6,strokeWidth:3,showGrid:true},
  ];
  // Plusieurs graines : sans ces bornes, l'écart n'apparaît pas à toutes les réalisations
  // du bruit — une seule graine laisserait passer la régression.
  for(const dur of durs.flatMap(d=>[7,2024,31415].map(seed=>({...d,seed})))){
    const s=settings(dur),i=renderLogical(s).imageData,t=s.tileSize,g=s.showGrid?1:0;
    const set=dur.tilesetType==='blob-47'?B47:E16;
    const at=(m,x,y)=>{const p=atlasPosition(set,m);return i.data[(((g+p.row*(t+g)+y)*i.width)+g+p.col*(t+g)+x)*4+3]>0?1:0;};
    const rc=m=>Array.from({length:t},(_,y)=>at(m,t-1,y)),lc=m=>Array.from({length:t},(_,y)=>at(m,0,y));
    const br=m=>Array.from({length:t},(_,x)=>at(m,x,t-1)),tr=m=>Array.from({length:t},(_,x)=>at(m,x,0));
    const nom=`${dur.tilesetType} t${t} r${dur.cornerRadius} graine ${dur.seed}`;
    const okH=(L,R)=>compatibleHorizontal(set.id,L,R);
    const okV=(T,U)=>compatibleVertical(set.id,T,U);
    for(const L of set.masks)for(const R of set.masks){
      if(!okH(L,R))continue;
      assert.equal(seamFault(rc(L),lc(R)),-1,`${nom} : couture verticale ${L} | ${R}`);
    }
    for(const T of set.masks)for(const U of set.masks){
      if(!okV(T,U))continue;
      assert.equal(seamFault(br(T),tr(U)),-1,`${nom} : couture horizontale ${T} / ${U}`);
    }
    // Et aucun masque ne disparaît en route.
    for(const m of set.masks){
      let n=0;for(let y=0;y<t;y++)for(let x=0;x<t;x++)n+=at(m,x,y);
      assert.ok(n>0,`${nom} : masque ${m} entièrement vide`);
    }
  }
});

// ===========================================================================
// Tranche T3 — le constructeur de murs en vue de dessus
// ===========================================================================
// Décision d'architecture (disposition d'atlas, ancrage collision/Y-sort) déjà
// tranchée par la session orchestratrice : 8 colonnes × 9 lignes, dessus = blob 47
// intact sur les 6 premières lignes, puis une ligne face / base / ombre sur 6 états
// utilisés sur 8 colonnes. Ces essais vérifient l'exécution, pas la décision.

const wallSettings=(over={})=>settings({tilesetType:'wall',...over});
const wallShot=(over={})=>{const s=wallSettings(over),i=renderLogical(s).imageData;return {data:i.data,width:i.width,height:i.height,tile:s.tileSize};};
// Adressage direct par (col, row) d'atlas, sans passer par atlasPosition : les bandes
// basses du mur n'appartiennent à aucun jeu de public/tile-masks.js — c'est tout
// l'objet de cette tranche, qui reste hors de ce fichier. Même formule que alphaAt.
const wallAlphaAt=(img,row,col,x,y)=>img.data[(((row*img.tile+y)*img.width)+col*img.tile+x)*4+3]>0?1:0;
const wallRightCol=(img,row,col)=>Array.from({length:img.tile},(_,y)=>wallAlphaAt(img,row,col,img.tile-1,y));
const wallLeftCol =(img,row,col)=>Array.from({length:img.tile},(_,y)=>wallAlphaAt(img,row,col,0,y));
const wallTopRow   =(img,row,col)=>Array.from({length:img.tile},(_,x)=>wallAlphaAt(img,row,col,x,0));
const wallBottomRow=(img,row,col)=>Array.from({length:img.tile},(_,x)=>wallAlphaAt(img,row,col,x,img.tile-1));
const wallStateCol=Object.fromEntries(WALL_BAND_STATES.map((s,i)=>[s.id,i]));
const FACE_ROW=WALL_TOP_ROWS,BASE_ROW=WALL_TOP_ROWS+1,SHADOW_ROW=WALL_TOP_ROWS+2;

test('les huit états d’une bande basse sont dans l’ordre imposé par les tranches', () => {
  // T37 : 6 → 8. Les deux coins sont ajoutés EN FIN de table, donc en colonnes 6 et 7 —
  // les deux qui étaient libres depuis T3 — et jamais intercalés : aucune case déjà peinte
  // ne se décale, aucun fichier déjà exporté ne devient faux.
  assert.equal(WALL_BAND_STATES.length,8);
  assert.deepEqual(WALL_BAND_STATES.map(s=>s.id),['isolated','left-end','middle','right-end','flank-left','flank-right','corner-left','corner-right']);
  // L'invariant de T37, lu sur la table elle-même : un état de coin dit son côté de coin,
  // et ce côté est CONTINU (la matière va jusqu'au bord), jamais libre. C'est ce qui
  // supprime le bord arrondi qui faisait la coupure droite dans l'angle.
  assert.deepEqual(WALL_BAND_STATES.filter(s=>s.corner).map(s=>[s.id,s.corner,s.west,s.east]),
    [['corner-left','west',true,true],['corner-right','east',true,true]]);
});

test('l’atlas mur fait 8 colonnes × 11 lignes, et les huit colonnes des trois bandes basses posent du terrain', () => {
  const img=wallShot();
  // Les deux garde-fous de T37 : la FORME de l'atlas ne bouge pas, alors même que deux
  // états s'y ajoutent. T43 la fait grandir DÉLIBÉRÉMENT de deux lignes — les douze tuiles
  // en biais, six par sens de pente — et c'est la seule chose qui change : les huit
  // colonnes des trois bandes restent aux mêmes indices et au même pixel (essai T43 plus
  // bas, « les deux colonnes libres des lignes en biais »).
  assert.deepEqual(atlasShape('wall'),{columns:8,rows:11});
  assert.equal(img.width,img.tile*8);
  assert.equal(img.height,img.tile*11);
  for(const row of [FACE_ROW,BASE_ROW,SHADOW_ROW]){
    // Les huit états posent du terrain — aucun n'est vide par erreur. Les colonnes 6 et 7
    // étaient vérifiées TRANSPARENTES jusqu'à T37 ; elles portent maintenant les deux
    // coins, et c'est le sens même de la tranche : la place existait déjà.
    for(let col=0;col<8;col++){
      let terrain=0;for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)terrain+=wallAlphaAt(img,row,col,x,y);
      assert.ok(terrain>0,`ligne ${row}, colonne ${col} : aucun terrain`);
    }
  }
});

test('le dessus du mur est identique au pixel près au rendu blob-47 — avec texture, sans, et bords nets', () => {
  // C'est la garantie que le mur réutilise le blob au lieu d'en refaire une variante :
  // mêmes réglages partagés, seul tilesetType change.
  for(const over of [{},{surfaceTexture:damier(32,8)},{edgeStyle:'clean'},{edgeColor:hex('#101010')}]){
    const wallImg=renderLogical(wallSettings(over)).imageData;
    const blobImg=renderLogical(settings({tilesetType:'blob-47',...over})).imageData;
    for(let row=0;row<WALL_TOP_ROWS;row++)for(let col=0;col<8;col++)for(let y=0;y<32;y++)for(let x=0;x<32;x++){
      const iw=(((row*32+y)*wallImg.width)+col*32+x)*4,ib=(((row*32+y)*blobImg.width)+col*32+x)*4;
      assert.deepEqual([...wallImg.data.slice(iw,iw+4)],[...blobImg.data.slice(ib,ib+4)],`dessus mur ≠ blob-47 en case (${col},${row}) pixel ${x},${y}`);
    }
  }
});

test('les trois bandes basses se raccordent horizontalement : milieu + milieu, puis gauche + milieu + droite', () => {
  // Mêmes utilitaires que l'essai de raccord du blob (identical, seamFault) : un bord
  // peut glisser d'un pixel sous bruit organique, jamais s'ouvrir au milieu d'une plage.
  for(const bandRow of [FACE_ROW,BASE_ROW,SHADOW_ROW]){
    const net=wallShot({edgeStyle:'clean'});
    const mid=wallStateCol['middle'],left=wallStateCol['left-end'],right=wallStateCol['right-end'],iso=wallStateCol['isolated'];
    assert.ok(identical(wallRightCol(net,bandRow,mid),wallLeftCol(net,bandRow,mid)),`ligne ${bandRow} : milieu ne se raccorde pas à lui-même`);
    assert.ok(identical(wallRightCol(net,bandRow,left),wallLeftCol(net,bandRow,mid)),`ligne ${bandRow} : gauche → milieu`);
    assert.ok(identical(wallRightCol(net,bandRow,mid),wallLeftCol(net,bandRow,right)),`ligne ${bandRow} : milieu → droite`);
    // Isolé ne déborde d'aucun côté : c'est un plot autonome, sans voisin.
    assert.ok(wallRightCol(net,bandRow,iso).every(v=>v===0),`ligne ${bandRow} : isolé déborde à droite`);
    assert.ok(wallLeftCol(net,bandRow,iso).every(v=>v===0),`ligne ${bandRow} : isolé déborde à gauche`);

    const brut=wallShot();
    assert.equal(seamFault(wallRightCol(brut,bandRow,mid),wallLeftCol(brut,bandRow,mid)),-1,`ligne ${bandRow} : trou milieu/milieu sous bruit`);
    assert.equal(seamFault(wallRightCol(brut,bandRow,left),wallLeftCol(brut,bandRow,mid)),-1,`ligne ${bandRow} : trou gauche/milieu sous bruit`);
    assert.equal(seamFault(wallRightCol(brut,bandRow,mid),wallLeftCol(brut,bandRow,right)),-1,`ligne ${bandRow} : trou milieu/droite sous bruit`);
  }
});

test('un flanc à 45° s’empile sans marche : le haut et le bas de sa case portent la même rentrée', () => {
  // La bande face est répétée verticalement au moment du placement pour construire la
  // hauteur du mur : si le haut et le bas de la case différaient, chaque raccord de
  // copie ferait apparaître une marche.
  const net=wallShot({edgeStyle:'clean'});
  for(const bandRow of [FACE_ROW,BASE_ROW]){
    for(const id of ['flank-left','flank-right']){
      const col=wallStateCol[id];
      assert.ok(identical(wallTopRow(net,bandRow,col),wallBottomRow(net,bandRow,col)),`ligne ${bandRow}, ${id} : le haut et le bas de la case diffèrent`);
    }
  }
});

test('le descripteur annonce exactement les 88 cases de l’atlas, et la collision ne porte que sur la base', () => {
  const d=wallAtlasDescriptor();
  assert.equal(d.columns,8);
  // T43 : onze lignes — 72 cases de bandes plus 12 cases en biais (deux lignes de six
  // colonnes ; les colonnes 6 et 7 de ces deux lignes ne sont pas décrites, comme les
  // colonnes libres d'une bande ne l'étaient pas avant T37). T44 : deux de plus — une
  // pente par ligne, dans l'une des deux colonnes que T43 laissait libres — d'où 84 → 86.
  // T45 : deux de plus encore — un raccord-base par ligne, dans la colonne que T44
  // laissait libre — d'où 86 → 88 ; il ne reste alors plus aucune case libre.
  assert.equal(d.rows,11);
  assert.equal(d.cells.length,88);
  assert.equal(d.baseRow,BASE_ROW);
  assert.equal(d.faceRow,FACE_ROW);
  assert.equal(d.shadowRow,SHADOW_ROW);

  const withCollision=d.cells.filter(c=>c.collision);
  const withYSort=d.cells.filter(c=>c.ySort);
  // Six depuis T37 : les quatre états orthogonaux de T3 plus les deux coins. Toujours pas
  // les deux flancs à 45°, qui restent PEINTS dans l'atlas depuis T27 (les retirer
  // déplacerait toutes les cases suivantes) mais ne sont plus des pièces à poser, donc
  // n'ont ni collision ni tri à porter. Collision et Y-sort suivent `placeable` seuls :
  // les deux coins n'ont rien eu à ajouter ici, et c'est la preuve que la ligne base est
  // bien le point unique où l'un et l'autre se décident.
  // Six depuis T37, DIX depuis T43, DOUZE depuis T45 : les quatre orthogonaux, les deux
  // coins, les deux bases coupées de chaque sens de pente, puis les deux raccord-base.
  // Une bande en biais porte sa collision sur DEUX cases parce que son pied descend d'une
  // case sur sa largeur — la case d'emprise (rectangle plein) et la moitié qui déborde en
  // dessous (triangle) ; le raccord-base, lui, EST la case d'emprise d'un mur d'une seule
  // case de haut, donc rectangle plein comme base-haute.
  assert.equal(withCollision.length,12,'six états posables sur la ligne base, plus quatre bases en biais, plus deux raccord-base');
  assert.deepEqual(withCollision,withYSort,'la ligne de tri (Y-sort) est la ligne base, comme la collision');
  assert.ok(withCollision.every(c=>c.band==='base'&&c.placeable));
  assert.equal(withCollision.filter(c=>c.row===BASE_ROW).length,6);
  assert.ok(withCollision.filter(c=>c.row===BASE_ROW).every(c=>c.state!==null));
  // Rien ailleurs : ni le dessus, ni la face, ni l'ombre — pas même les colonnes libres
  // de la bande base elle-même.
  assert.ok(d.cells.filter(c=>c.band!=='base').every(c=>!c.collision&&!c.ySort));
  assert.ok(d.cells.filter(c=>c.band==='base'&&c.state===null&&!c.sens).every(c=>!c.collision&&!c.ySort));

  // Chaque case de l'atlas est décrite une fois — ni case dupliquée, ni case oubliée.
  const seen=new Set(d.cells.map(c=>`${c.col},${c.row}`));
  assert.equal(seen.size,88);
});

// ===========================================================================
// T43 — la face en biais des jonctions en diagonale
// ===========================================================================

test('T43 · le bloc en biais : deux lignes de six pièces, à une ligne FIXE que le décor ne déplace pas', () => {
  const b=biaisAtlasDescriptor('wall');
  assert.equal(b.firstRow,WALL_TOP_ROWS+3,'juste après les trois bandes basses');
  assert.equal(b.rows,2);
  assert.equal(b.columns,6);
  assert.deepEqual(b.sens,['droite','gauche']);
  assert.deepEqual(b.pieces,['raccord','face','base-haute','base-basse','ombre-haute','ombre-basse']);
  // T44 : quatorze cases et non douze — une pente par ligne, ajoutée par
  // `biaisAtlasDescriptor` lui-même, dans l'une des deux colonnes libres. `b.pieces` ne
  // bouge pas : la pente n'est pas une septième pièce du même genre que les six autres
  // (elle n'a ni `coupe`, ni `decalage`, ni pile face/base/ombre), donc elle n'entre pas
  // dans la table que `wallBiaisPixelColor` parcourt.
  // T45 : seize cases et non quatorze — un raccord-base par ligne, dans la dernière
  // colonne libre. Lui non plus n'entre pas dans `b.pieces` : sa configuration
  // (`WALL_RACCORD_BASE_PIECE`) vit à côté de `WALL_BIAIS_PIECES`, jamais dedans, ce qui
  // aurait décalé `WALL_PENTE_COL`.
  assert.equal(b.cells.length,16);
  assert.equal(biaisAtlasDescriptor('blob-47'),null);
  // Le décor s'ajoute APRÈS et ne déplace donc aucune des quatorze : c'est ce qui permet à
  // `descripteurScene()` de les trouver sans connaître la densité de décor.
  for(const decor of ['aucun','leger','dense']){
    const d=wallAtlasDescriptor({decor});
    for(const c of b.cells){
      const t=d.cells.find(x=>x.sens===c.sens&&x.piece===c.piece);
      assert.deepEqual([t.col,t.row],[c.col,c.row],`${decor} : ${c.sens}/${c.piece} a bougé`);
    }
  }
});

test('T44 · la pente du bord arrière : une par ligne, dans l’une des deux colonnes que T43 laissait libres, sans collision ni Y-sort', () => {
  const b=biaisAtlasDescriptor('wall');
  const pentes=b.cells.filter(c=>c.piece==='pente');
  assert.equal(pentes.length,2);
  const parSens=Object.fromEntries(pentes.map(c=>[c.sens,c]));
  // Colonnes 6 et 7 — celles que le contrôle « deux colonnes libres » de T43 vérifiait
  // vides — une par ligne, jamais les deux dans la même : c'est ce qui suffit à ce que
  // les DEUX colonnes cessent d'être libres, sans peindre deux fois la même pièce.
  assert.equal(parSens.droite.col,6);
  assert.equal(parSens.droite.row,b.firstRow);
  assert.equal(parSens.gauche.col,7);
  assert.equal(parSens.gauche.row,b.firstRow+1);
  assert.notEqual(parSens.droite.col,parSens.gauche.col);
  // Ni collision, ni Y-sort, ni triangle de collision : c'est du dessus, immobile, jamais
  // recouvert — voir wallAtlasDescriptor et la mesure de couverture (T44).
  const d=wallAtlasDescriptor();
  for(const sens of ['droite','gauche']){
    const cell=d.cells.find(c=>c.piece==='pente'&&c.sens===sens);
    assert.equal(cell.band,'pente');
    assert.equal(cell.placeable,true);
    assert.equal(cell.collision,false);
    assert.equal(cell.ySort,false);
    assert.equal(cell.collisionPoints,null);
  }
});

// ===========================================================================
// T45 — la pièce RACCORD-BASE, mur d'une case de haut
// ===========================================================================

test('T45 · le raccord-base : une par ligne, dans l’unique colonne que T44 laissait libre, collision et Y-sort comme base-haute', () => {
  const b=biaisAtlasDescriptor('wall');
  const raccordsBase=b.cells.filter(c=>c.piece==='raccord-base');
  assert.equal(raccordsBase.length,2);
  const parSens=Object.fromEntries(raccordsBase.map(c=>[c.sens,c]));
  // La colonne que WALL_PENTE_COL n'a pas prise sur chaque ligne — l'inverse exact :
  // droite prend la colonne de la pente gauche (7), gauche prend celle de la pente
  // droite (6). Il ne reste alors plus aucune case libre dans les deux lignes en biais.
  assert.equal(parSens.droite.col,7);
  assert.equal(parSens.droite.row,b.firstRow);
  assert.equal(parSens.gauche.col,6);
  assert.equal(parSens.gauche.row,b.firstRow+1);
  assert.notEqual(parSens.droite.col,parSens.gauche.col);
  const d=wallAtlasDescriptor();
  for(const sens of ['droite','gauche']){
    const cell=d.cells.find(c=>c.piece==='raccord-base'&&c.sens===sens);
    const baseHaute=d.cells.find(c=>c.piece==='base-haute'&&c.sens===sens);
    assert.equal(cell.band,'base');
    assert.equal(cell.placeable,true);
    assert.equal(cell.collision,true);
    assert.equal(cell.ySort,true);
    assert.equal(cell.collisionPoints,null,'rectangle plein, pas un triangle');
    assert.equal(cell.ySortRows,baseHaute.ySortRows,'même origine de tri que base-haute');
  }
});

test('T45 · la moitié u > 0 du raccord-base est identique au pixel près à base-haute', () => {
  const img=wallShot();
  const d=wallAtlasDescriptor();
  const caseDe=(sens,piece)=>d.cells.find(c=>c.sens===sens&&c.piece===piece);
  const px=(cell,x,y)=>{const i=(((cell.row*img.tile+y)*img.width)+cell.col*img.tile+x)*4;return [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]].join(',');};
  for(const sens of ['droite','gauche']){
    const raccordBase=caseDe(sens,'raccord-base'),baseHaute=caseDe(sens,'base-haute');
    let compares=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
      const u=sens==='droite'?y-x:y+x-(img.tile-1);
      if(u<=0)continue; // moitié « dessus » : une autre matière, par construction
      assert.equal(px(raccordBase,x,y),px(baseHaute,x,y),`${sens} : pixel ${x},${y} du raccord-base diffère de base-haute`);
      compares+=1;
    }
    assert.ok(compares>(img.tile*img.tile)/4,'trop peu de pixels comparés');
  }
});

test('T45 · la moitié u ≤ 0 du raccord-base est le dessus plein, comme la moitié jetée du raccord', () => {
  const img=wallShot();
  const d=wallAtlasDescriptor();
  const caseDe=(sens,piece)=>d.cells.find(c=>c.sens===sens&&c.piece===piece);
  const px=(cell,x,y)=>{const i=(((cell.row*img.tile+y)*img.width)+cell.col*img.tile+x)*4;return [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]].join(',');};
  for(const sens of ['droite','gauche']){
    const raccordBase=caseDe(sens,'raccord-base'),raccord=caseDe(sens,'raccord');
    let compares=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
      const u=sens==='droite'?y-x:y+x-(img.tile-1);
      if(u>0)continue;
      assert.equal(px(raccordBase,x,y),px(raccord,x,y),`${sens} : pixel ${x},${y} du raccord-base diffère de la moitié dessus du raccord`);
      compares+=1;
    }
    assert.ok(compares>(img.tile*img.tile)/4,'trop peu de pixels comparés');
  }
});

test('T43 · la coupe partitionne la case — la base coupée et l’ombre coupée ne se recouvrent jamais, et la diagonale passe coin à coin', () => {
  // 64 px de recouvrement par case, c'est ce qu'une inégalité large des DEUX côtés
  // produisait sur le prototype : on exige donc zéro. Et la diagonale au pixel — décalée
  // d'un seul pixel, elle ouvrait 190 px de trous ou de recouvrement.
  const img=wallShot();
  const d=wallAtlasDescriptor();
  const caseDe=(sens,piece)=>d.cells.find(c=>c.sens===sens&&c.piece===piece);
  for(const sens of ['droite','gauche']){
    const bas=caseDe(sens,'base-basse'),ombre=caseDe(sens,'ombre-haute');
    let recouvrement=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
      if(wallAlphaRaw(img,bas.row,bas.col,x,y)>0&&wallAlphaRaw(img,ombre.row,ombre.col,x,y)>0)recouvrement+=1;
    }
    assert.equal(recouvrement,0,`${sens} : la base coupée et l’ombre coupée se recouvrent`);
    for(let x=0;x<img.tile;x++){
      const attendu=sens==='droite'?x+1:img.tile-x;
      let h=0;while(h<img.tile&&wallAlphaRaw(img,bas.row,bas.col,x,h)>0)h+=1;
      let total=0;for(let y=0;y<img.tile;y++)if(wallAlphaRaw(img,bas.row,bas.col,x,y)>0)total+=1;
      assert.equal(h,attendu,`${sens} : colonne ${x}, hauteur de la moitié gardée`);
      assert.equal(total,attendu,`${sens} : colonne ${x}, la moitié gardée n’est pas contiguë`);
    }
  }
});

test('T43 · la moitié gardée d’une tuile coupée est le morceau EXACT de la tuile pleine — la coupe masque, elle n’ombre pas', () => {
  // L'invariant qui interdit un liseré sombre le long de la diagonale : si la coupe
  // passait par le SDF, elle deviendrait un bord, donc recevrait le fondu de bord et le
  // relief rasant. Masquée, la moitié gardée est identique au pixel près.
  const img=wallShot();
  const d=wallAtlasDescriptor();
  const caseDe=(sens,piece)=>d.cells.find(c=>c.sens===sens&&c.piece===piece);
  const px=(cell,x,y)=>{const i=(((cell.row*img.tile+y)*img.width)+cell.col*img.tile+x)*4;return [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]].join(',');};
  for(const sens of ['droite','gauche']){
    const pleine=caseDe(sens,'face'),raccord=caseDe(sens,'raccord');
    let compares=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
      const u=sens==='droite'?y-x:y+x-(img.tile-1);
      if(u<=0)continue; // moitié « dessus » du raccord : une autre matière, par construction
      assert.equal(px(raccord,x,y),px(pleine,x,y),`${sens} : pixel ${x},${y} du raccord diffère de la face pleine`);
      compares+=1;
    }
    assert.ok(compares>(img.tile*img.tile)/4,'trop peu de pixels comparés');
  }
});

test('T43 · la face cisaillée EST la face droite, lue (y − x) lignes plus haut — au bit près', () => {
  // La prémisse, contrôlée sur le moteur LIVRÉ et non sur un prototype : pour tout pixel
  // (x, y) de la face en biais, la couleur est celle de la face droite `middle` lue en
  // (x, (y − x) mod t). C'est elle qui rend la tuile unique suffisante, verticalement
  // comme de marche en marche.
  const img=wallShot();
  const d=wallAtlasDescriptor();
  const middle=WALL_BAND_STATES.findIndex(s=>s.id==='middle');
  const px=(col,row,x,y)=>{const i=(((row*img.tile+y)*img.width)+col*img.tile+x)*4;return [img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]].join(',');};
  for(const sens of ['droite','gauche']){
    const face=d.cells.find(c=>c.sens===sens&&c.piece==='face');
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
      const u=sens==='droite'?y-x:y+x-(img.tile-1);
      const r=((u%img.tile)+img.tile)%img.tile;
      assert.equal(px(face.col,face.row,x,y),px(middle,FACE_ROW,x,r),`${sens} : pixel ${x},${y}`);
    }
  }
});

test('T43/T44/T45 · sur les deux colonnes que T43 laissait libres, plus aucune case ne reste transparente', () => {
  // T43 laissait les colonnes 6 et 7 des deux lignes en biais libres ; T44 y a posé une
  // pente par ligne, T45 y a posé le raccord-base restant — il n'y a donc plus une seule
  // case réellement libre à contrôler ici, seulement les quatre désormais peintes.
  const img=wallShot();
  const b=biaisAtlasDescriptor('wall');
  const peintAt=new Set([...b.cells.filter(c=>c.piece==='pente'),...b.cells.filter(c=>c.piece==='raccord-base')].map(c=>`${c.row},${c.col}`));
  assert.equal(img.height,11*img.tile);
  assert.equal(peintAt.size,4,'les quatre cases (2 pentes + 2 raccords-base) couvrent les deux colonnes des deux lignes');
  for(let row=9;row<11;row++)for(let col=6;col<8;col++){
    let peint=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)if(wallAlphaRaw(img,row,col,x,y)>0)peint+=1;
    assert.ok(peint>0,`case (${col}, ${row}) devrait être peinte`);
    assert.ok(peintAt.has(`${row},${col}`),`case (${col}, ${row}) inattendue — ni pente ni raccord-base`);
  }
});

test('une texture de face distincte de celle du dessus s’applique à la face, jamais au dessus', () => {
  const surface=[200,10,10,255],face=[10,10,200,255];
  const withFace=render(plain({tilesetType:'wall',surfaceTexture:uni(32,surface),faceTexture:uni(32,face)}));
  const top=atlasPosition(B47,255); // la tuile pleine du blob : terrain partout, simple à lire.
  const faceCol=wallStateCol['middle'];
  assert.deepEqual(px(withFace,top.col*32+16,top.row*32+16).slice(0,3),surface.slice(0,3),'le dessus doit garder la texture de surface, pas celle de la face');
  assert.deepEqual(px(withFace,faceCol*32+16,FACE_ROW*32+16).slice(0,3),face.slice(0,3),'la face doit prendre sa propre texture');

  // Sans texture de face fournie, la face retombe sur celle du dessus : le rendu par
  // défaut reste cohérent plutôt que de perdre toute texture.
  const withoutFace=render(plain({tilesetType:'wall',surfaceTexture:uni(32,surface)}));
  assert.deepEqual(px(withoutFace,faceCol*32+16,FACE_ROW*32+16).slice(0,3),surface.slice(0,3));
});

// ===========================================================================
// T23 — l'ombre portée, réglable (settings.wallShadowAlpha)
// ===========================================================================
// La contrainte du plan : la GÉOMÉTRIE de l'atlas ne bouge jamais (les cases
// gelées par les empreintes SHA-256 plus bas dépendent de sa stabilité), seul
// le CONTENU de la bande ombre suit le réglage — un noir semi-transparent qui
// devient entièrement transparent quand l'ombre est refusée.
const wallAlphaRaw=(img,row,col,x,y)=>img.data[(((row*img.tile+y)*img.width)+col*img.tile+x)*4+3];

test('T23 · l’ombre refusée (wallShadowAlpha à 0) ne laisse pas un seul pixel opaque dans sa bande', () => {
  const img=wallShot({wallShadowAlpha:0});
  for(let col=0;col<6;col++)for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
    assert.equal(wallAlphaRaw(img,SHADOW_ROW,col,x,y),0,`colonne ${col}, pixel ${x},${y} : encore opaque malgré le réglage à 0`);
  }
});

test('T23 · vérification à l’envers — l’ombre par défaut pose bien des pixels opaques, sinon l’essai précédent ne prouverait rien', () => {
  const img=wallShot();
  let opaques=0;
  for(let col=0;col<6;col++)for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
    if(wallAlphaRaw(img,SHADOW_ROW,col,x,y)>0)opaques+=1;
  }
  assert.ok(opaques>0,'le rendu par défaut doit encore poser une ombre — sans quoi « aucun pixel opaque » ne serait pas une propriété du réglage');
});

test('T23 · la géométrie de l’atlas ne dépend pas du réglage : mêmes dimensions, même empreinte de l’ombre, seul l’alpha change', () => {
  const faible=wallShot({wallShadowAlpha:40}),fort=wallShot({wallShadowAlpha:220}),refuse=wallShot({wallShadowAlpha:0});
  assert.equal(faible.width,fort.width);assert.equal(faible.height,fort.height);
  assert.equal(faible.width,refuse.width);assert.equal(faible.height,refuse.height);
  // L'empreinte (où l'ombre EST, indépendamment de sa force) ne bouge pas entre deux
  // niveaux non nuls : seul l'alpha stocké à l'intérieur diffère.
  for(let col=0;col<6;col++)for(let y=0;y<faible.tile;y++)for(let x=0;x<faible.tile;x++){
    const dedans=wallAlphaRaw(faible,SHADOW_ROW,col,x,y)>0;
    assert.equal(wallAlphaRaw(fort,SHADOW_ROW,col,x,y)>0,dedans,`colonne ${col}, pixel ${x},${y} : l’empreinte de l’ombre diffère selon l’alpha choisi`);
  }
  // Le descripteur, qui ignore le réglage, place toujours les trois bandes au même endroit.
  const d=wallAtlasDescriptor();
  assert.equal(d.shadowRow,SHADOW_ROW);assert.equal(d.baseRow,BASE_ROW);assert.equal(d.faceRow,FACE_ROW);
});

test('T23 · le réglage absent reproduit EXACTEMENT le comportement d’avant cette tranche (alpha 110), au bit près', () => {
  const defaut=wallShot();
  const explicite=wallShot({wallShadowAlpha:110});
  assert.deepEqual([...defaut.data],[...explicite.data]);
});

// ===========================================================================
// T25 — le pied de la face : la base n'est plus une troisième matière
// ===========================================================================
// Trois propriétés MESURÉES sur le rendu (renderLogical, lecture de pixels), jamais
// décrites : continuité en haut de bande, pénombre progressive en bas, grain
// conservé. Voir docs/PLAN-tilesets.md, « Tranches 25 à 27 » et « T25 », pour ce
// que les sources ont établi et ce que ces trois propriétés reprennent.

test('T25 · la base est un calque EXACT de la face jusqu’au début de la pénombre — même matière, même relief, aucune couture', () => {
  // Texture de face marquée (damier) et relief allumé : si la base retombait sur
  // une autre matière, perdait le relief, ou décalait ne serait-ce qu'un pixel,
  // cet essai le verrait immédiatement — pas une ressemblance, une égalité.
  const img=wallShot({faceTexture:damier(32,4),relief:0.5});
  const rampStart=Math.floor((2/3)*img.tile); // voir WALL_BASE_CONTACT_START dans le moteur
  for(const [id,col] of Object.entries(wallStateCol)){
    for(let y=0;y<rampStart;y++)for(let x=0;x<img.tile;x++){
      const face=px(img,col*img.tile+x,FACE_ROW*img.tile+y);
      const base=px(img,col*img.tile+x,BASE_ROW*img.tile+y);
      assert.deepEqual(base,face,`état ${id}, pixel ${x},${y} : la base diverge de la face avant même le début de la pénombre`);
    }
  }
});

test('T25 · la pénombre de contact est une rampe, pas une marche : nulle sur les deux premiers tiers, progressive puis franche au dernier pixel', () => {
  // Matière plate et sans bruit : à une colonne intérieure (loin des bords west/east
  // de l'état milieu), la face rend une couleur CONSTANTE — voir materialColor sans
  // texture. Toute variation verticale de la base à cette colonne vient alors
  // PUREMENT de la pénombre de contact, isolée de tout autre effet du moteur.
  const s=wallSettings({textureNoise:0,fleckAmount:0,pixelFlecks:false});
  const img=renderLogical(s).imageData;
  const t=s.tileSize,col=wallStateCol['middle'],x=Math.floor(t/2);
  const lum=y=>{const [r,g,b]=px(img,col*t+x,BASE_ROW*t+y);return r*0.3+g*0.59+b*0.11;};
  const values=Array.from({length:t},(_,y)=>lum(y));
  const rampStart=Math.floor((2/3)*t);
  for(let y=0;y<rampStart;y++)assert.equal(values[y],values[0],`ligne ${y} : la pénombre a démarré avant le dernier tiers`);
  // Progressive : jamais plus claire d'une ligne à la suivante...
  for(let y=rampStart+1;y<t;y++)assert.ok(values[y]<=values[y-1],`ligne ${y} plus claire que ${y-1} : la rampe n'est pas monotone`);
  // ...et un assombrissement FRANC à la toute dernière ligne.
  const chute=values[0]-values[t-1];
  assert.ok(chute>15,`assombrissement en bas trop faible (${chute.toFixed(1)}) pour se lire comme un contact avec le sol`);
  // Une rampe, pas une marche : aucune ligne ne concentre à elle seule plus de la
  // moitié de la chute totale.
  let pireMarche=0;
  for(let y=rampStart+1;y<t;y++)pireMarche=Math.max(pireMarche,values[y-1]-values[y]);
  assert.ok(pireMarche<chute*0.5,`une seule ligne concentre ${pireMarche.toFixed(1)} sur une chute de ${chute.toFixed(1)} : c'est une marche, pas une rampe`);
});

test('T25 · le grain de la base reste du même ordre que celui de la face — l’écart-type de luminance ne s’effondre pas', () => {
  const img=wallShot({faceTexture:damier(32,4),relief:0.5});
  const t=img.tile,col=wallStateCol['middle'];
  const std=row=>{
    const vals=[];
    for(let y=0;y<t;y++)for(let x=0;x<t;x++){
      const [r,g,b,a]=px(img,col*t+x,row*t+y);
      if(a===0)continue;
      vals.push(r*0.3+g*0.59+b*0.11);
    }
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    return Math.sqrt(vals.reduce((a,v)=>a+(v-mean)**2,0)/vals.length);
  };
  const faceStd=std(FACE_ROW),baseStd=std(BASE_ROW);
  assert.ok(baseStd>faceStd*0.5,`écart-type de la base (${baseStd.toFixed(1)}) trop faible face à celui de la face (${faceStd.toFixed(1)}) : la base s'aplatit`);
});

// ===========================================================================
// Tranche T7 — le terrain inférieur : le hors-masque porte une seconde matière
// ===========================================================================
// Le contrat de rendu change : ce qui sort du masque n'est plus forcément du vide, il
// peut porter la matière d'un second terrain — l'herbe s'arrête sur du sable, le sable
// entre dans l'eau. Le mode « un terrain sur fond transparent » reste le défaut, au bit
// près : c'est le premier essai ci-dessous qui le tient, et rien d'autre dans ce fichier
// ne passe `lowerTerrain`.

const HERBE=hex('#92af70'),CONTOUR=hex('#43563d'); // les deux couleurs par défaut du panneau
const SABLE={r:214,g:180,b:118},SABLE_SOMBRE={r:98,g:74,b:36};
const rgb=c=>[c.r,c.g,c.b];
// La rampe d'une matière, recalculée côté essai : N nuances de la surface au contour.
const rampe=(a,b,n=4)=>Array.from({length:n},(_,i)=>{const t=i/(n-1);return [Math.round(a.r+(b.r-a.r)*t),Math.round(a.g+(b.g-a.g)*t),Math.round(a.b+(b.b-a.b)*t)];});
const empreinte=s=>createHash('sha256').update(Buffer.from(render(s).data.buffer)).digest('hex');

test('sans terrain inférieur, chaque disposition du moteur rend au bit près comme avant', () => {
  // Le critère d'acceptation numéro un de la tranche, vérifié par empreinte et non à
  // l'œil : beaucoup d'essais dépendent du mode « un terrain sur fond transparent », dont
  // l'empreinte du mode 15 plus haut et tous les essais de couture. Une empreinte par
  // disposition que renderLogical sait rendre, plus trois variantes qui font passer les
  // chemins texture de surface, texture de bordure, grille, fond blanc, bords nets et
  // texture de face.
  //
  // La sixième disposition du panneau — l'isométrique — ne passe pas par renderLogical :
  // public/tools.js la confie à drawIso. Il n'y a donc rien à figer ici pour elle.
  const attendu={
    'topdown-15':['c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2',{}],
    'topdown-17':['b1223b13187083e2c1adf8981f0edcc1aa4a5436fd004362e2277bcb1f256498',{}],
    'blob-47':['47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52',{}],
    'edge-16':['95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593',{}],
    // Empreintes du mur mises à jour sciemment, en écrivant l'aperçu de jeu à chaque
    // fois : la tranche T23 avait déjà changé l'ombre portée (collée au HAUT de sa
    // case, posée sur le sol devant le pied du mur, pas une tuile plus bas — voir
    // shadowSdf). La tranche T25 change maintenant la bande base elle-même : elle
    // n'est plus un aplat sombre (« la matière de la face au plus sombre », l'ancien
    // correctif de T3) mais LE MÊME chemin de couleur que la face — mêmes nuances,
    // même grain, même relief — plus une pénombre de contact progressive sur son
    // dernier tiers. Voir wallBandPixelColor et wallBaseContactShade dans le moteur.
    // Aucune autre disposition ne bouge, et c'est la ligne suivante du tableau qui
    // le prouve.
    // T37 : régénérée une SEULE fois, et pour une seule cause — les colonnes 6 et 7 des
    // trois bandes, transparentes depuis T3, portent maintenant les deux états de coin.
    // Rien d'autre du mur n'a bougé : la pénombre d'angle est absente de ces réglages, et
    // `settings.wallCornerOcclusion` absent vaut ZÉRO côté moteur (le défaut non nul vit
    // dans tileSettings(), public/tools.js). Les six colonnes historiques sont donc au
    // bit près celles d'avant la tranche — c'est ce que vérifie l'essai de neutralité de
    // la section T37 plus bas, et c'est ce qui laissera T38 brancher le même réglage sur
    // le dessus du mur sans avoir à toucher une empreinte de plus.
    // T44 : régénérée une SEULE fois de plus, cause unique là encore — l'une des deux
    // colonnes libres de chaque ligne en biais (6 et 7) porte maintenant la pente du bord
    // arrière (voir WALL_PENTE_COL et biaisAtlasDescriptor). Rien d'autre ne bouge.
    // T45 : régénérée une dernière fois, même cause — l'unique colonne libre restante de
    // chaque ligne en biais porte maintenant le raccord-base (voir WALL_RACCORD_BASE_COL).
    // Il ne reste alors plus aucune case libre dans le bloc en biais.
    'wall':['7b8800cfd5e85c14ddb88ebb76850b60971eaa5fb73333de610e3c1a7a4bfdbf',{}],
    '15 texturé, grille et fond blanc':['31c6df5efba6f43f129c655820fd7995fd33af310d919b02a0570b30c5ce0e01',{tilesetType:'topdown-15',surfaceTexture:damier(64,16),edgeTexture:damier(32,4),showGrid:true,whiteBackground:true,tileSize:16}],
    'blob nets, 64 px':['5da3289f59b313b7c7699523bf4d453e571cc17a538b7390c08a840ad85ec8c5',{tilesetType:'blob-47',edgeStyle:'clean',tileSize:64}],
    // T37 : même cause unique que 'wall' ci-dessus — les deux colonnes de coin peintes.
    // T37 puis T44 puis T45 : même cause que 'wall' ci-dessus — la pente du bord arrière
    // (T44) puis le raccord-base (T45) dans les deux colonnes libres du bloc en biais.
    'mur avec texture de face':['288beebdd2ada4683b4a5e541ee4296f556bdc33b1630ad31f334b46c2d17c63',{tilesetType:'wall',surfaceTexture:damier(32,8),faceTexture:damier(32,4)}],
  };
  for(const [nom,[digest,over]] of Object.entries(attendu)){
    const s=settings({tilesetType:over.tilesetType??nom,...over});
    assert.equal(empreinte(s),digest,`${nom} : le chemin par défaut a bougé, ce qui est interdit dans cette tranche`);
  }
  // Et le contrat par défaut lui-même : sans lowerTerrain, l'atlas n'annonce qu'un terrain.
  assert.equal(terrainLayers(settings()).length,1);
});

// Les trous de DISPOSITION, qui restent des trous quoi qu'il arrive : ils ne portent
// aucun masque, donc aucune tuile, donc aucun terrain à peindre. La ligne de garde et la
// colonne partielle du 17 pièces, les deux colonnes libres de chaque bande basse du mur,
// et la 48e case du blob EN MODE MUR — son dessus est un calque verbatim du blob (voir
// blobPixelColor), mais la tranche 7 bis ne porte son correctif qu'au blob autonome : ce
// calque-là garde donc son trou. Le masque 0 du mode 15 et la 48e case du blob AUTONOME,
// eux, n'en sont PLUS un : avec un terrain inférieur ils deviennent la case entièrement
// couverte par le dessous — celle que l'autotiler pose au milieu du sable (tranches T7 et
// 7 bis).
const TROUS={
  'topdown-15':[],
  'topdown-17':[[0,0],[1,0],[2,0],[3,0],[4,0],[4,2],[4,3],[4,4]],
  'blob-47':[],
  'edge-16':[],
  // T37 : les six cases de bande qui figuraient ici — colonnes 6 et 7 des trois bandes —
  // n'en sont plus. Elles portent les deux états de coin, donc de la matière pleine ; il
  // ne reste comme trou de disposition que la 48e case du blob recopiée dans le dessus.
  'wall':[[7,5]],
};

test('un terrain inférieur uni : plus aucun pixel transparent dans les cases qui portent un masque, et exactement sa couleur hors masque', () => {
  // Sans grain ni tache, mais AVEC le fondu de bord par défaut. Le terrain inférieur ne
  // déclare pas de couleur de contour : il prend donc sa propre couleur de surface et
  // reste à plat jusque dans la zone de bordure. Cette règle-là est figée ici en même
  // temps que la couverture — un terrain du dessous ne s'assombrit pas sans qu'on l'ait
  // demandé.
  const nu=over=>settings({textureNoise:0,fleckAmount:0,pixelFlecks:false,lowerTerrain:{baseColor:SABLE},...over});
  const rampeHaut=rampe(HERBE,CONTOUR);
  for(const [type,trous] of Object.entries(TROUS)){
    const s=nu({tilesetType:type}),i=render(s),{columns,rows}=atlasShape(type),t=s.tileSize;
    const troue=(c,r)=>trous.some(([tc,tr])=>tc===c&&tr===r);
    let dessous=0;
    for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
      // Les trois bandes basses du mur ont chacune leur propre matière (face, jonction
      // sombre, ombre composée sur le sol) : on y contrôle l'opacité, pas la palette.
      const bandeBasse=type==='wall'&&r>=WALL_TOP_ROWS;
      // T43 : les deux lignes en biais ont leur propre règle d'opacité, et c'est leur
      // raison d'être — une tuile coupée est transparente sur la moitié qu'elle JETTE,
      // terrain inférieur ou non (c'est ce qui laisse voir l'ombre portée dessous, ou le
      // sol). On y contrôle donc l'opacité de la moitié GARDÉE, et la transparence de
      // l'autre : la même exigence, appliquée à la bonne géométrie.
      const biaisInfo=type==='wall'?biaisAtlasDescriptor('wall'):null;
      const cellBiais=biaisInfo&&r>=biaisInfo.firstRow?biaisInfo.cells.find(z=>z.row===r&&z.col===c):null;
      const pieceBiais=cellBiais?WALL_BIAIS_PIECES.find(z=>z.id===cellBiais.piece):null;
      const coupeDe=pieceBiais?pieceBiais.coupe:null;
      for(let y=0;y<t;y++)for(let x=0;x<t;x++){
        const p=px(i,c*t+x,r*t+y);
        if(biaisInfo&&r>=biaisInfo.firstRow){
          if(!cellBiais){assert.equal(p[3],0,`${type} : la case libre (${c},${r}) est peinte en ${x},${y}`);continue;}
          if(cellBiais.piece==='pente'){
            // T44 : ni une case pleine ni une coupe symétrique comme les six pièces de
            // T43 — un TRIANGLE ancré au bord BAS de la case. Largeur par colonne :
            // `tile − x` pour une pente qui descend à droite, `x + 1` en miroir — la
            // même géométrie que `checkWallAtlas` (public/tile-check.js).
            const attendu=cellBiais.sens==='droite'?t-x:x+1;
            const dansLaMatiere=y>=t-attendu;
            assert.equal(p[3],dansLaMatiere?255:0,`${type} : pente ${cellBiais.sens} (${c},${r}), pixel ${x},${y}`);
            continue;
          }
          const u=cellBiais.sens==='droite'?y-x:y+x-(t-1);
          const garde=coupeDe==='haut'?u<=0:coupeDe==='bas'?u>0:true;
          // Le raccord haut est le seul dont la moitié jetée n'est pas du vide : elle
          // porte la matière du DESSUS, le lobe de la marche qui descend.
          if(garde||pieceBiais.dessus)assert.equal(p[3],255,`${type} : pixel transparent dans la moitié gardée de (${c},${r}), pixel ${x},${y}`);
          else assert.equal(p[3],0,`${type} : pixel peint dans la moitié jetée de (${c},${r}), pixel ${x},${y}`);
          continue;
        }
        if(troue(c,r)){assert.equal(p[3],0,`${type} : la case libre (${c},${r}) est peinte en ${x},${y}`);continue;}
        assert.equal(p[3],255,`${type} : pixel transparent en case (${c},${r}), pixel ${x},${y}`);
        if(bandeBasse)continue;
        if(p[0]===SABLE.r&&p[1]===SABLE.g&&p[2]===SABLE.b){dessous+=1;continue;}
        assert.ok(rampeHaut.some(v=>v[0]===p[0]&&v[1]===p[1]&&v[2]===p[2]),`${type} : couleur étrangère aux deux matières en case (${c},${r}), pixel ${x},${y} → ${p}`);
      }
    }
    assert.ok(dessous>500,`${type} : ${dessous} pixels de terrain inférieur seulement`);
  }
});

test('l’essai qui compte — les coutures du terrain inférieur : la frontière entre les deux matières se raccorde d’une tuile à l’autre', () => {
  // Matière du dessous unie et réglages nus : un pixel vaut exactement la couleur du
  // dessus ou exactement celle du dessous. La frontière se lit donc comme un booléen,
  // exactement comme l'alpha se lisait du temps où le hors-masque était transparent — et
  // les utilitaires de public/tile-check.js s'y appliquent tels quels, avec la même
  // tolérance : sous bruit organique un bord peut glisser d'un pixel (seamFault), rien ne
  // peut s'ouvrir au milieu d'une plage ; bords nets, la couture doit être identique.
  for(const [setId,type,set] of [['B47','blob-47',B47],['E16','edge-16',E16]]){
    for(const {edgeStyle,graines} of [{edgeStyle:'clean',graines:[31415]},{edgeStyle:'rough',graines:[31415,7,2718]}]){
      for(const seed of graines){
        const base={tilesetType:type,edgeStyle,seed};
        const s=plain({...base,lowerTerrain:{baseColor:SABLE}});
        const i=render(s),t=s.tileSize;
        // Le même rendu SANS terrain inférieur : sa silhouette en alpha doit être le
        // complément exact de la frontière ci-dessous. C'est ce qui rattache le raccord du
        // dessous à celui du dessus, déjà éprouvé par les essais de la tranche T2, au lieu
        // d'en refaire une démonstration parallèle.
        const seul=render(plain(base));
        const seulImg={data:seul.data,width:seul.width,height:seul.height,tile:t};
        const bas=(m,x,y)=>{const p=atlasPosition(set,m),k=(((p.row*t+y)*i.width)+p.col*t+x)*4;return i.data[k]===SABLE.r&&i.data[k+1]===SABLE.g&&i.data[k+2]===SABLE.b?1:0;};
        const nom=`${setId} ${edgeStyle} graine ${seed}`;
        for(const m of set.masks)for(let y=0;y<t;y++)for(let x=0;x<t;x++){
          assert.equal(bas(m,x,y),1-alphaAt(seulImg,set,m,x,y),`${nom} : le terrain inférieur ne couvre pas exactement le hors-masque, masque ${m} pixel ${x},${y}`);
        }
        // Les profils de couture de la frontière, au même format que ceux de tile-check.js.
        const rc=m=>Array.from({length:t},(_,y)=>bas(m,t-1,y)),lc=m=>Array.from({length:t},(_,y)=>bas(m,0,y));
        const br=m=>Array.from({length:t},(_,x)=>bas(m,x,t-1)),tr=m=>Array.from({length:t},(_,x)=>bas(m,x,0));
        let paires=0;
        for(const L of set.masks)for(const R of set.masks){
          if(!compatibleHorizontal(setId,L,R))continue;
          paires+=1;
          if(edgeStyle==='clean')assert.ok(identical(rc(L),lc(R)),`${nom} : frontière verticale ${L} | ${R}`);
          assert.equal(seamFault(rc(L),lc(R)),-1,`${nom} : trou dans la frontière verticale ${L} | ${R}`);
        }
        for(const T of set.masks)for(const U of set.masks){
          if(!compatibleVertical(setId,T,U))continue;
          paires+=1;
          if(edgeStyle==='clean')assert.ok(identical(br(T),tr(U)),`${nom} : frontière horizontale ${T} / ${U}`);
          assert.equal(seamFault(br(T),tr(U)),-1,`${nom} : trou dans la frontière horizontale ${T} / ${U}`);
        }
        assert.ok(paires>30,`${nom} : trop peu de paires compatibles éprouvées (${paires})`);
      }
    }
  }
});

test('un damier posé sur le terrain inférieur traverse les coutures, comme celui du terrain supérieur', () => {
  // Même invariant que la tranche T1, appliqué au dessous : la texture est ramenée à la
  // taille de tuile, chaque tuile lit (lx mod P, ly mod P), la phase ne dépend donc jamais
  // de la case. Comme tile % (2 × cell) === 0, la parité du damier se prolonge d'une tuile
  // à la suivante : le motif traverse les coutures sans rupture.
  const tile=32,cell=8;
  const attendu=(x,y)=>(Math.floor(x/cell)+Math.floor(y/cell))%2?[20,30,200]:[220,40,40];
  const zero=(()=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===0)return {col:c,row:r};throw new Error('masque 0 absent de la disposition');})();
  for(const source of [32,64,512]){ // rééchantillonnage ÷1, ÷2 et ÷16, comme pour le dessus
    const bas={surfaceTexture:damier(source,cell*(source/tile))};
    // Mode 15 : avec un terrain inférieur, la case du masque 0 est entièrement couverte
    // par le dessous. Le damier doit y sortir exactement comme sur la tuile pleine du
    // dessus, pixel pour pixel.
    const quinze=render(plain({tileSize:tile,lowerTerrain:bas}));
    for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      assert.deepEqual(px(quinze,zero.col*tile+x,zero.row*tile+y),[...attendu(x,y),255],`source ${source} px, pixel ${x},${y}`);
    }
    // Blob 47 : chaque pixel est soit exactement la surface du dessus, soit exactement le
    // texel de damier de sa position LOCALE. Rien qui dépende de la case, donc rien qui se
    // décale d'une tuile à l'autre.
    const blob=render(plain({tilesetType:'blob-47',tileSize:tile,lowerTerrain:bas}));
    let dessous=0;
    for(const m of B47.masks){
      const p=atlasPosition(B47,m);
      for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
        const c=px(blob,p.col*tile+x,p.row*tile+y).slice(0,3);
        if(c[0]===HERBE.r&&c[1]===HERBE.g&&c[2]===HERBE.b)continue;
        dessous+=1;
        assert.deepEqual(c,attendu(x,y),`source ${source} px, masque ${m}, pixel ${x},${y}`);
      }
    }
    assert.ok(dessous>2000,`source ${source} px : ${dessous} pixels de terrain inférieur seulement`);
  }
  assert.equal(tile%(2*cell),0);
});

test('la bordure se traite entre les deux matières : un versant de chaque côté de la frontière, de même largeur', () => {
  // La décision de rendu de la tranche. La frontière est la ligne où la distance signée
  // change de signe ; chaque versant lit sa distance à CETTE MÊME ligne et fonce vers SA
  // propre couleur de contour, sur la même largeur `edgeFade`. Un liseré des deux côtés se
  // lit comme un contact ; un liseré d'un seul côté se lirait comme un contour dessiné,
  // c'est-à-dire comme la découpe aux ciseaux que la tranche cherche à faire disparaître.
  const s=settings({tilesetType:'topdown-15',edgeStyle:'clean',textureNoise:0,fleckAmount:0,pixelFlecks:false,
    lowerTerrain:{baseColor:SABLE,edgeColor:SABLE_SOMBRE}});
  const img=render(s),haut=rampe(HERBE,CONTOUR),bas=rampe(SABLE,SABLE_SOMBRE);
  // Le masque 3 : les deux quadrants du haut remplis, les deux du bas vides. Une frontière
  // horizontale franche, qu'une colonne de pixels traverse une fois et une seule.
  const p=(()=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===3)return {col:c,row:r};throw new Error('masque 3 absent');})();
  const rang=(r,c)=>r.findIndex(v=>v[0]===c[0]&&v[1]===c[1]&&v[2]===c[2]);
  const colonne=Array.from({length:32},(_,y)=>{
    const c=px(img,p.col*32+16,p.row*32+y).slice(0,3);
    const h=rang(haut,c);if(h>=0)return {cote:'haut',n:h};
    const b=rang(bas,c);if(b>=0)return {cote:'bas',n:b};
    throw new Error(`couleur hors des deux rampes en y=${y} : ${c}`);
  });
  const frontiere=colonne.findIndex(l=>l.cote==='bas');
  assert.ok(frontiere>0&&frontiere<32,`frontière introuvable dans la colonne (${frontiere})`);
  assert.ok(colonne.slice(0,frontiere).every(l=>l.cote==='haut'),'le terrain supérieur est interrompu au-dessus de la frontière');
  assert.ok(colonne.slice(frontiere).every(l=>l.cote==='bas'),'le terrain inférieur est interrompu au-dessous de la frontière');
  // Deux versants, et le plus foncé de chacun touche la frontière.
  const versantHaut=colonne.slice(0,frontiere).filter(l=>l.n>0).length;
  const versantBas=colonne.slice(frontiere).filter(l=>l.n>0).length;
  assert.ok(versantHaut>0,'aucun assombrissement du côté du terrain supérieur');
  assert.ok(versantBas>0,'aucun assombrissement du côté du terrain inférieur');
  // Un pixel d'écart au plus : la frontière ne tombe pas sur une limite de pixel, donc les
  // deux versants ne s'échantillonnent pas au même endroit de la rampe. Au-delà, ce serait
  // que les deux côtés ne lisent plus la même largeur de fondu.
  assert.ok(Math.abs(versantHaut-versantBas)<=1,`versants dissymétriques : ${versantHaut} contre ${versantBas}`);
  assert.equal(colonne[frontiere-1].n,Math.max(...colonne.slice(0,frontiere).map(l=>l.n)),'le pixel du dessus qui touche la frontière n’est pas le plus foncé de son versant');
  assert.equal(colonne[frontiere].n,Math.max(...colonne.slice(frontiere).map(l=>l.n)),'le pixel du dessous qui touche la frontière n’est pas le plus foncé de son versant');
  // Et loin de la frontière, chaque terrain est à plat sur sa couleur de surface.
  assert.deepEqual(px(img,p.col*32+16,p.row*32+0).slice(0,3),rgb(HERBE));
  assert.deepEqual(px(img,p.col*32+16,p.row*32+31).slice(0,3),rgb(SABLE));
});

test('terrainLayers dit ce que l’atlas porte, du dessous vers le dessus', () => {
  // Ce que le moteur sait rendre, exposé pour l'export et l'interface — une wangcolor par
  // entrée côté Tiled, un index de terrain par entrée côté Godot, dans cet ordre.
  const seul=terrainLayers(settings());
  assert.deepEqual(seul.map(l=>[l.role,l.index,l.textured]),[['upper',0,false]]);
  assert.deepEqual(seul[0].baseColor,HERBE);
  assert.deepEqual(seul[0].edgeColor,CONTOUR);

  const deux=terrainLayers(settings({surfaceTexture:uni(32,[1,2,3,255]),lowerTerrain:{baseColor:SABLE,edgeColor:SABLE_SOMBRE,surfaceTexture:uni(32,[4,5,6,255])}}));
  assert.deepEqual(deux.map(l=>[l.role,l.index,l.textured]),[['lower',0,true],['upper',1,true]]);
  assert.deepEqual(deux[0].baseColor,SABLE);
  assert.deepEqual(deux[0].edgeColor,SABLE_SOMBRE);

  // Ce que le terrain inférieur emprunte au supérieur, et ce qu'il n'emprunte pas : sa
  // couleur de surface à défaut (il faut bien une couleur), sa couleur de contour à défaut
  // vaut sa PROPRE surface, et ses textures ne sont jamais celles du dessus — sinon
  // « juste une couleur » rendrait la texture du dessus teintée, et on ne verrait jamais
  // la couleur demandée.
  const defauts=terrainLayers(settings({surfaceTexture:uni(32,[1,2,3,255]),lowerTerrain:{baseColor:SABLE}}))[0];
  assert.deepEqual(defauts.edgeColor,SABLE);
  assert.equal(defauts.textured,false);
  const vide=terrainLayers(settings({lowerTerrain:{}}))[0];
  assert.deepEqual(vide.baseColor,HERBE);
  assert.deepEqual(vide.edgeColor,HERBE);
});

// ===========================================================================
// Tranche 7 bis — la case « entièrement le terrain du dessous » du blob
// ===========================================================================
// Le trou que T7 laissait ouvert : B47 n'a aucun masque qui dise « rien du dessus »,
// contrairement à W16 (masque 0). Sans la 48e case — celle qu'aucun des 47 masques
// n'occupe (47 est premier, 48 cases n'en tombent jamais juste) — aucune tuile ne pouvait
// peindre le sable loin de toute île. BLOB_LOWER_CELL est cette case-là.

test('tranche 7 bis : sans terrain inférieur, la 48e case du blob reste transparente comme avant', () => {
  assert.deepEqual(BLOB_LOWER_CELL,{col:7,row:5});
  const img=render(plain({tilesetType:'blob-47'})),t=32;
  for(let y=0;y<t;y++)for(let x=0;x<t;x++){
    assert.equal(px(img,BLOB_LOWER_CELL.col*t+x,BLOB_LOWER_CELL.row*t+y)[3],0,`case libre peinte en ${x},${y} sans terrain inférieur`);
  }
});

test('tranche 7 bis : avec un terrain inférieur, la 48e case du blob est exactement sa couleur — aucun pixel transparent, aucun pixel du dessus', () => {
  const s=plain({tilesetType:'blob-47',lowerTerrain:{baseColor:SABLE}}),img=render(s),t=s.tileSize;
  const rampeHaut=rampe(HERBE,CONTOUR);
  let sable=0;
  for(let y=0;y<t;y++)for(let x=0;x<t;x++){
    const p=px(img,BLOB_LOWER_CELL.col*t+x,BLOB_LOWER_CELL.row*t+y);
    assert.equal(p[3],255,`pixel transparent en ${x},${y}`);
    assert.ok(!rampeHaut.some(v=>v[0]===p[0]&&v[1]===p[1]&&v[2]===p[2]),`pixel du terrain supérieur trouvé en ${x},${y} : ${p}`);
    if(p[0]===SABLE.r&&p[1]===SABLE.g&&p[2]===SABLE.b)sable+=1;
  }
  assert.equal(sable,t*t,'la case entière devrait être exactement la couleur du terrain inférieur');
});

test('l’essai qui compte — la 48e case du blob se raccorde à une case voisine portant le terrain inférieur, sur ses quatre bords', () => {
  // Le masque 0 (îlot isolé) ne touche aucun bord de sa tuile : ses quatre bords sont donc
  // entièrement le terrain inférieur — une vraie voisine possible, sur la carte, pour
  // chacun des quatre côtés de la 48e case, qui elle est entièrement inférieure. Bords
  // nets et sans fondu (plain()) : les deux profils doivent être identiques au pixel près,
  // pas seulement sans trou.
  const s=plain({tilesetType:'blob-47',edgeStyle:'clean',lowerTerrain:{baseColor:SABLE}}),img=render(s),t=s.tileSize;
  const bas=(col,row,x,y)=>{const k=(((row*t+y)*img.width)+col*t+x)*4;return img.data[k]===SABLE.r&&img.data[k+1]===SABLE.g&&img.data[k+2]===SABLE.b?1:0;};
  const right=(col,row)=>Array.from({length:t},(_,y)=>bas(col,row,t-1,y)),left=(col,row)=>Array.from({length:t},(_,y)=>bas(col,row,0,y));
  const top=(col,row)=>Array.from({length:t},(_,x)=>bas(col,row,x,0)),bottom=(col,row)=>Array.from({length:t},(_,x)=>bas(col,row,x,t-1));
  const {col:lc,row:lr}=BLOB_LOWER_CELL,p0=atlasPosition(B47,0);
  assert.ok(identical(right(lc,lr),left(p0.col,p0.row)),'bord droit de la 48e case vers le masque 0');
  assert.ok(identical(left(lc,lr),right(p0.col,p0.row)),'bord gauche de la 48e case vers le masque 0');
  assert.ok(identical(bottom(lc,lr),top(p0.col,p0.row)),'bord bas de la 48e case vers le masque 0');
  assert.ok(identical(top(lc,lr),bottom(p0.col,p0.row)),'bord haut de la 48e case vers le masque 0');
  assert.equal(seamFault(right(lc,lr),left(p0.col,p0.row)),-1);
  assert.equal(seamFault(bottom(lc,lr),top(p0.col,p0.row)),-1);
});

// ===========================================================================
// Tranche T8 — variantes du centre
// ===========================================================================
// Décision d'architecture déjà tranchée par la session orchestratrice : une
// variante n'est pas une « alternative tile » Godot mais une case d'atlas à
// part, portant EXACTEMENT les mêmes bits de peering que la tuile pleine du jeu
// courant, sous la grille publiée par tile-masks.js. Ces essais vérifient
// l'exécution (la géométrie tient, le grain varie, rien d'autre ne bouge), pas
// la décision elle-même.

// La tuile pleine de chaque disposition concernée, et la ligne où atterrissent
// ses variantes — calculées ici comme dans le moteur, jamais recopiées en dur :
// un futur décalage de disposition casserait ces essais au lieu de les laisser
// mentir.
const fullTileOf={
  'topdown-15':(()=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===15)return{col:c,row:r,mask:15};throw new Error('masque 15 absent');})(),
  'blob-47':(()=>{const p=atlasPosition(B47,255);return{col:p.col,row:p.row,mask:255};})(),
  'edge-16':(()=>{const p=atlasPosition(E16,15);return{col:p.col,row:p.row,mask:15};})(),
};
const VARIANT_TYPES=['topdown-15','blob-47','edge-16'];

// Adressage direct par (col, row) d'atlas : les cases de variante n'appartiennent
// à aucun jeu de public/tile-masks.js, exactement comme les bandes basses du mur
// (wallAlphaAt plus haut) — même formule, reprise telle quelle.
const cellAlpha=(img,col,row,x,y)=>img.data[(((row*img.tile+y)*img.width)+col*img.tile+x)*4+3]>0?1:0;
const cellPixel=(img,col,row,x,y)=>{const k=(((row*img.tile+y)*img.width)+col*img.tile+x)*4;return[img.data[k],img.data[k+1],img.data[k+2],img.data[k+3]];};
const cellRightCol=(img,col,row)=>Array.from({length:img.tile},(_,y)=>cellAlpha(img,col,row,img.tile-1,y));
const cellLeftCol=(img,col,row)=>Array.from({length:img.tile},(_,y)=>cellAlpha(img,col,row,0,y));
const cellTopRow=(img,col,row)=>Array.from({length:img.tile},(_,x)=>cellAlpha(img,col,row,x,0));
const cellBottomRow=(img,col,row)=>Array.from({length:img.tile},(_,x)=>cellAlpha(img,col,row,x,img.tile-1));
const asImg=(imageData,tile)=>({data:imageData.data,width:imageData.width,height:imageData.height,tile});

test('à variants: 0, l’atlas garde sa taille et son contenu au bit près — les empreintes existantes ne bougent pas', () => {
  for(const type of VARIANT_TYPES)assert.deepEqual(atlasShape(type,0),atlasShape(type));
  // Les empreintes de la tranche T7 sont rendues avec des réglages sans `variants`,
  // donc `variants: undefined` — qui doit se comporter exactement comme `variants: 0`,
  // pas seulement « par supposition ».
  assert.equal(empreinte(settings({variants:0})),'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
  assert.equal(empreinte(settings({tilesetType:'blob-47',variants:0})),'47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52');
  assert.equal(empreinte(settings({tilesetType:'edge-16',variants:0})),'95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593');
});

test('à variants: 2, l’atlas gagne exactement une ligne et le reste est identique au bit près à variants: 0', () => {
  for(const type of VARIANT_TYPES){
    const base=atlasShape(type,0),grown=atlasShape(type,2);
    assert.equal(grown.columns,base.columns,`${type} : les colonnes ne devraient pas bouger`);
    assert.equal(grown.rows,base.rows+1,`${type} : une seule ligne devrait s’ajouter`);
    const s0=settings({tilesetType:type,variants:0}),s2=settings({tilesetType:type,variants:2});
    const i0=renderLogical(s0).imageData,i2=renderLogical(s2).imageData;
    assert.equal(i2.width,i0.width,`${type} : la largeur a bougé`);
    assert.equal(i2.height,i0.height+s0.tileSize,`${type} : la hauteur n’a pas gagné exactement une ligne`);
    // La grille de base occupe exactement les premiers octets du buffer, dans les deux
    // rendus : les comparer octet à octet suffit à prouver qu’elle n’a pas bougé.
    for(let k=0;k<i0.data.length;k++)assert.equal(i2.data[k],i0.data[k],`${type} : octet ${k} de la grille de base a bougé`);
  }
});

test('l’essai qui compte — une variante est interchangeable avec l’originale : ses quatre profils de bord sont identiques, bords nets et organiques, plusieurs graines', () => {
  for(const type of VARIANT_TYPES){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    for(const edgeStyle of ['clean','rough'])for(const seed of [31415,7,2718]){
      const s=settings({tilesetType:type,variants:3,edgeStyle,seed});
      const img=asImg(renderLogical(s).imageData,s.tileSize);
      for(let v=0;v<3;v++){
        const nom=`${type} variante ${v}, ${edgeStyle}, graine ${seed}`;
        assert.deepEqual(cellTopRow(img,v,vRow),cellTopRow(img,full.col,full.row),`${nom} : ligne du haut`);
        assert.deepEqual(cellBottomRow(img,v,vRow),cellBottomRow(img,full.col,full.row),`${nom} : ligne du bas`);
        assert.deepEqual(cellLeftCol(img,v,vRow),cellLeftCol(img,full.col,full.row),`${nom} : colonne de gauche`);
        assert.deepEqual(cellRightCol(img,v,vRow),cellRightCol(img,full.col,full.row),`${nom} : colonne de droite`);
      }
    }
  }
});

test('une variante diffère réellement de l’originale à l’intérieur de la tuile', () => {
  for(const type of VARIANT_TYPES){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    // Réglages par défaut : grain (textureNoise) et taches (fleckAmount) actifs, comme
    // dans l’atelier — c’est ce canal-là, et lui seul, que la graine de variante fait
    // bouger (voir fullTilePixelColor).
    const s=settings({tilesetType:type,variants:3});
    const img=asImg(renderLogical(s).imageData,s.tileSize);
    for(let v=0;v<3;v++){
      let diff=0;
      for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
        const a=cellPixel(img,v,vRow,x,y),b=cellPixel(img,full.col,full.row,x,y);
        if(a[0]!==b[0]||a[1]!==b[1]||a[2]!==b[2])diff+=1;
      }
      assert.ok(diff>20,`${type} variante ${v} : seulement ${diff} pixels différents de l’originale`);
    }
  }
});

test('avec une texture de surface, une variante lit la texture aux mêmes coordonnées locales que l’originale', () => {
  const tile=32,cell=8;
  for(const type of VARIANT_TYPES){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    const s=plain({tilesetType:type,tileSize:tile,variants:3,surfaceTexture:damier(64,cell*2)});
    const img=asImg(renderLogical(s).imageData,tile);
    for(let v=0;v<3;v++)for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      assert.deepEqual(cellPixel(img,v,vRow,x,y),cellPixel(img,full.col,full.row,x,y),`${type} variante ${v}, pixel ${x},${y}`);
    }
  }
});

test('au-delà de variants, les colonnes restantes de la ligne neuve restent transparentes', () => {
  for(const type of VARIANT_TYPES){
    const vRow=atlasShape(type,0).rows,columns=atlasShape(type,0).columns;
    const s=settings({tilesetType:type,variants:1});
    const img=asImg(renderLogical(s).imageData,s.tileSize);
    for(let col=1;col<columns;col++){
      let peint=0;
      for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)peint+=cellAlpha(img,col,vRow,x,y);
      assert.equal(peint,0,`${type} : colonne ${col} de la ligne de variantes peinte alors que variants=1`);
    }
  }
});

test('variantAtlasDescriptor décrit position, masque et probabilité de chaque variante, et vaut null quand il n’y a rien à décrire', () => {
  assert.equal(variantAtlasDescriptor('topdown-15',0),null);
  assert.equal(variantAtlasDescriptor('topdown-17',2),null,'17 pièces n’a pas de jeu de masques : pas de variantes');
  assert.equal(variantAtlasDescriptor('wall',2),null,'le mur n’a pas de jeu de masques : pas de variantes');

  for(const [type,count] of [['topdown-15',2],['blob-47',3],['edge-16',1]]){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    const d=variantAtlasDescriptor(type,count);
    assert.equal(d.tilesetType,type);
    assert.equal(d.mask,full.mask);
    assert.deepEqual(d.original,{col:full.col,row:full.row,probability:1/(count+1)});
    assert.equal(d.variants.length,count);
    d.variants.forEach((v,i)=>assert.deepEqual(v,{col:i,row:vRow,mask:full.mask,probability:1/(count+1)}));
    // Convention documentée : l’originale et ses variantes se partagent une masse de 1.
    const total=d.original.probability+d.variants.reduce((a,v)=>a+v.probability,0);
    assert.ok(Math.abs(total-1)<1e-9,`${type} : masse de probabilité ${total}`);
  }

  // Bornée à 3, silencieusement : au-delà, une variante sortirait de l’atlas (voir
  // clampVariants dans le moteur).
  assert.equal(variantAtlasDescriptor('blob-47',7).variants.length,3);
});

// ===========================================================================
// Tranche T10 — tuiles animées
// ===========================================================================
//
// Même cible que les variantes (fullTileOf, VARIANT_TYPES ci-dessus) : la tuile pleine
// du jeu courant. On réutilise donc les mêmes dispositions et les mêmes petits outils
// d'adressage par (col, row) d'atlas.
const ANIMATION_TYPES=VARIANT_TYPES;

// Distance honnête entre deux images d'un même atlas : la moyenne, sur tous les pixels
// de la case, de l'écart de canal au carré (RGBA). Pas la couleur moyenne de chaque
// case : le bruit de teinte est PÉRIODIQUE sur une tuile (seamlessFbm, voir plus haut
// dans le moteur) et l'intégrale d'une fonction périodique sur un tour complet ne bouge
// pas quand on la déphase — la couleur moyenne d'une case entière est donc, par
// construction, quasiment INSENSIBLE à la phase, et n'aurait rien mesuré. Un écart
// pixel à pixel, lui, capture le vrai déplacement du bruit à chaque position, même si
// la moyenne globale reste stable.
function frameDistance(img,colA,rowA,colB,rowB){
  let total=0;
  for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
    const a=cellPixel(img,colA,rowA,x,y),b=cellPixel(img,colB,rowB,x,y);
    for(let c=0;c<4;c++){const d=a[c]-b[c];total+=d*d;}
  }
  return total/(img.tile*img.tile);
}

test('à animatedFrames: 0, l’atlas garde sa taille et son contenu au bit près — les mêmes empreintes que sans le réglage', () => {
  for(const type of ANIMATION_TYPES)assert.deepEqual(atlasShape(type,0,0),atlasShape(type));
  // Mêmes empreintes que le témoin « variants: 0 » : les deux réglages partagent le
  // même défaut (0), donc `animatedFrames: 0` seul doit retomber sur l'atlas historique.
  assert.equal(empreinte(settings({animatedFrames:0})),'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
  assert.equal(empreinte(settings({tilesetType:'blob-47',animatedFrames:0})),'47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52');
  assert.equal(empreinte(settings({tilesetType:'edge-16',animatedFrames:0})),'95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593');
});

test('à animatedFrames: 4, la grille de base est identique au bit près — image 0 comprise, puisqu’elle EST la case de la tuile pleine — et toute case ajoutée qui n’est pas une image reste transparente', () => {
  for(const type of ANIMATION_TYPES){
    const base=atlasShape(type,0,0),grown=atlasShape(type,0,4),d=animationAtlasDescriptor(type,4);
    assert.equal(grown.columns,base.columns,`${type} : la largeur ne doit pas bouger — les tileid Tiled des tuiles existantes sont calculés dessus`);
    assert.equal(grown.rows,d.frames[3].row+1,`${type} : l’atlas doit s’arrêter juste après la dernière image`);
    const s0=settings({tilesetType:type,animatedFrames:0}),s4=settings({tilesetType:type,animatedFrames:4});
    const i0=renderLogical(s0).imageData,i4=renderLogical(s4).imageData;
    assert.equal(i4.width,i0.width,`${type} : la largeur a bougé`);
    assert.equal(i4.height,grown.rows*s0.tileSize,`${type} : hauteur inattendue`);
    // La grille de base occupe les premières lignes, à largeur égale : ses octets sont
    // donc le préfixe du tampon. L'image 0 y est comprise — c'est tout l'intérêt du
    // cercle translaté d'animationPhase : activer l'animation ne retouche pas la tuile
    // au repos, alors même que cette case est désormais rendue par le chemin des images.
    for(let k=0;k<i0.data.length;k++)assert.equal(i4.data[k],i0.data[k],`${type} : octet ${k} de la grille de base a bougé`);
    const img=asImg(i4,s0.tileSize);
    const images=new Set(d.frames.map((f)=>`${f.col}:${f.row}`));
    for(let row=base.rows;row<grown.rows;row++)for(let col=0;col<grown.columns;col++){
      let peint=0;
      for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)peint+=cellAlpha(img,col,row,x,y);
      if(images.has(`${col}:${row}`))assert.ok(peint>0,`${type} : la case ${col}:${row} devrait porter une image`);
      else assert.equal(peint,0,`${type} : la case ajoutée ${col}:${row} est peinte alors qu’elle ne porte aucune image`);
    }
  }
});

test('l’image 0 est la case de la tuile pleine elle-même — la contrainte que Godot impose, vérifiée sur l’atlas rendu', () => {
  // Ce n'est pas un choix de disposition : Godot déduit la case de chaque image de la
  // case de la tuile, et il n'existe aucun réglage pour placer l'image 0 ailleurs.
  // Mesuré sur Godot 4.7.2 headless — voir animationRowStride dans le moteur.
  for(const type of ANIMATION_TYPES){
    const full=fullTileOf[type],d=animationAtlasDescriptor(type,4);
    assert.deepEqual(d.frames[0],{col:full.col,row:full.row},`${type} : l’image 0 doit être la case de la tuile pleine`);
    // Et les suivantes tombent toutes hors de la grille de la disposition, donc sur
    // aucune case déjà peinte — sans quoi Godot refuse l’animation entière, en silence.
    const base=atlasShape(type,0,0);
    for(let i=1;i<d.frames.length;i++){
      assert.equal(d.frames[i].col,full.col,`${type} : l’image ${i} doit rester dans la colonne de la tuile`);
      assert.ok(d.frames[i].row>=base.rows,`${type} : l’image ${i} tombe sur la ligne ${d.frames[i].row}, dans la grille de la disposition`);
    }
  }
});

test('l’essai qui compte — une image d’animation est interchangeable avec la tuile pleine statique : ses quatre profils de bord sont identiques, bords nets et organiques, plusieurs graines', () => {
  for(const type of ANIMATION_TYPES){
    const full=fullTileOf[type],frames=animationAtlasDescriptor(type,4).frames;
    for(const edgeStyle of ['clean','rough'])for(const seed of [31415,7,2718]){
      const s=settings({tilesetType:type,animatedFrames:4,edgeStyle,seed});
      const img=asImg(renderLogical(s).imageData,s.tileSize);
      frames.forEach((f,k)=>{
        const nom=`${type} image ${k}, ${edgeStyle}, graine ${seed}`;
        assert.deepEqual(cellTopRow(img,f.col,f.row),cellTopRow(img,full.col,full.row),`${nom} : ligne du haut`);
        assert.deepEqual(cellBottomRow(img,f.col,f.row),cellBottomRow(img,full.col,full.row),`${nom} : ligne du bas`);
        assert.deepEqual(cellLeftCol(img,f.col,f.row),cellLeftCol(img,full.col,full.row),`${nom} : colonne de gauche`);
        assert.deepEqual(cellRightCol(img,f.col,f.row),cellRightCol(img,full.col,full.row),`${nom} : colonne de droite`);
      });
    }
  }
});

test('les images d’une animation diffèrent réellement entre elles à l’intérieur de la tuile', () => {
  for(const type of ANIMATION_TYPES){
    const frames=animationAtlasDescriptor(type,4).frames;
    // Réglages par défaut : grain (textureNoise) et taches (fleckAmount) actifs, comme
    // dans l’atelier — c’est ce canal-là, et lui seul, que le déphasage fait bouger.
    const s=settings({tilesetType:type,animatedFrames:4});
    const img=asImg(renderLogical(s).imageData,s.tileSize);
    for(let k=0;k<4;k++){
      const a0=frames[k],b0=frames[(k+1)%4];
      let diff=0;
      for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
        const a=cellPixel(img,a0.col,a0.row,x,y),b=cellPixel(img,b0.col,b0.row,x,y);
        if(a[0]!==b[0]||a[1]!==b[1]||a[2]!==b[2])diff+=1;
      }
      assert.ok(diff>20,`${type} image ${k}→${(k+1)%4} : seulement ${diff} pixels différents`);
    }
  }
});

test('la boucle est propre : la dernière image est plus proche de la première que deux images opposées du cycle — mesuré par l’écart quadratique moyen par pixel, moyenné sur dix graines', () => {
  // N = 4 : la plus grande valeur commune aux trois dispositions (W16 et E16 plafonnent
  // à 4 colonnes, voir clampAnimatedFrames) — écart angulaire net entre consécutives
  // (90°, corde ∝ sin 45°) et opposées (180°, corde ∝ sin 90°, environ 1,4 fois plus
  // grande) — voir animationPhase pour la preuve géométrique que cette propriété tient,
  // dans l'espace de la PHASE, pour tout N ≥ 2 et tout rayon > 0.
  //
  // Ce que devient cette distance de phase une fois passée par le bruit haché puis
  // arrondie en nuances n'a plus cette garantie exacte pixel par pixel (voir le
  // commentaire d'ANIMATION_PHASE_RADIUS dans le moteur) : une graine isolée peut
  // ponctuellement tomber sur une pente locale irrégulière du bruit. Moyenné sur dix
  // graines plutôt que vérifié graine par graine, la tendance est nette et régulière —
  // c'est elle qui rend l'animation lisible comme une boucle plutôt que comme un
  // clignotement, ce que confirme aussi l'oeil sur l'atlas rendu.
  const N=4;
  const SEEDS=[31415,7,2718,99999,12345,55555,1,2,3,4];
  for(const type of ANIMATION_TYPES){
    const f=animationAtlasDescriptor(type,N).frames;
    let lastFirstTotal=0,oppositeTotal=0;
    for(const seed of SEEDS){
      const s=settings({tilesetType:type,animatedFrames:N,seed});
      const img=asImg(renderLogical(s).imageData,s.tileSize);
      lastFirstTotal+=frameDistance(img,f[N-1].col,f[N-1].row,f[0].col,f[0].row);
      for(let i=0;i<N;i++){const o=f[(i+N/2)%N];oppositeTotal+=frameDistance(img,f[i].col,f[i].row,o.col,o.row);}
    }
    const lastFirstAvg=lastFirstTotal/SEEDS.length,oppositeAvg=oppositeTotal/(SEEDS.length*N);
    assert.ok(lastFirstAvg<oppositeAvg,`${type} : dernière↔première (${lastFirstAvg.toFixed(2)}) devrait être < moyenne des opposées (${oppositeAvg.toFixed(2)})`);
  }
});

test('avec une texture de surface, une image d’animation lit la texture aux mêmes coordonnées locales que la tuile pleine statique — jamais de décalage de phase sur l’échantillonnage', () => {
  const tile=32,cell=8;
  for(const type of ANIMATION_TYPES){
    const full=fullTileOf[type],frames=animationAtlasDescriptor(type,4).frames;
    const s=plain({tilesetType:type,tileSize:tile,animatedFrames:4,surfaceTexture:damier(64,cell*2)});
    const img=asImg(renderLogical(s).imageData,tile);
    frames.forEach((f,k)=>{for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
      assert.deepEqual(cellPixel(img,f.col,f.row,x,y),cellPixel(img,full.col,full.row,x,y),`${type} image ${k}, pixel ${x},${y}`);
    }});
  }
});

test('animationAtlasDescriptor décrit la case de base, le pas vertical, animation_columns, separation et la durée — et vaut null quand il n’y a rien à décrire', () => {
  assert.equal(animationAtlasDescriptor('topdown-15',0),null);
  assert.equal(animationAtlasDescriptor('topdown-17',4),null,'17 pièces n’a pas de jeu de masques : pas d’animation');
  assert.equal(animationAtlasDescriptor('wall',4),null,'le mur n’a pas de jeu de masques : pas d’animation');

  for(const [type,count] of [['topdown-15',2],['blob-47',6],['edge-16',3]]){
    const full=fullTileOf[type],base=atlasShape(type,0,0);
    const d=animationAtlasDescriptor(type,count);
    assert.equal(d.tilesetType,type);
    assert.equal(d.mask,full.mask);
    assert.equal(d.col,full.col);
    assert.equal(d.row,full.row,'la case de base est celle de la tuile pleine — Godot n’en accepte pas d’autre');
    assert.equal(d.count,count);
    assert.equal(d.animationColumns,1,'animation_columns = 1 : les images descendent, mesuré sur Godot 4.7.2');
    assert.equal(d.rowStride,base.rows-full.row,'le pas doit faire tomber l’image 1 sur la première ligne ajoutée');
    assert.deepEqual(d.separation,[0,d.rowStride-1],'separation se compte en cases, et vaut le pas moins la case de la tuile');
    assert.equal(d.frameDurationMs,DEFAULT_ANIMATION_FRAME_DURATION_MS);
    assert.equal(d.frames.length,count);
    d.frames.forEach((f,i)=>assert.deepEqual(f,{col:full.col,row:full.row+i*d.rowStride}));
  }

  // Bornée à 8 seulement : les images descendent, donc la largeur de la disposition
  // n’est plus une limite (voir clampAnimatedFrames).
  for(const type of ANIMATION_TYPES){
    assert.equal(animationAtlasDescriptor(type,8).count,8,`${type} : 8 images doivent tenir`);
    assert.equal(animationAtlasDescriptor(type,20).count,8,`${type} : au-delà de 8, on coupe`);
  }

  // La ligne de variantes, quand elle existe, occupe la première ligne libre : elle
  // allonge donc le pas d’un cran, pour que l’image 1 tombe en dessous d’elle.
  for(const type of ANIMATION_TYPES){
    const sans=animationAtlasDescriptor(type,3,0),avec=animationAtlasDescriptor(type,3,2);
    assert.equal(avec.rowStride,sans.rowStride+1,`${type} : les variantes allongent le pas d’un cran`);
    assert.ok(avec.frames[1].row>atlasShape(type,2,0).rows-1,`${type} : l’image 1 doit tomber sous la ligne des variantes`);
  }
});

test('aucune image d’animation ne tombe sur une case déjà peinte — la condition exacte sous laquelle Godot accepte l’animation', () => {
  // Vérifié sur Godot 4.7.2 headless : si une image recouvre une case déjà déclarée, le
  // moteur refuse TOUT le réglage et laisse la tuile à une seule image, sans erreur
  // visible au rendu. Le défaut serait donc muet — d’où cet essai, qui rejoue la règle
  // du moteur sur les cases réellement occupées de chaque disposition.
  for(const type of ANIMATION_TYPES)for(const variants of [0,2,3])for(const count of [2,4,8]){
    const base=atlasShape(type,0,0),d=animationAtlasDescriptor(type,count,variants);
    const occupees=new Set();
    // La grille de la disposition, telle que le rendu la peint…
    for(let row=0;row<base.rows;row++)for(let col=0;col<base.columns;col++)occupees.add(`${col}:${row}`);
    // …plus la ligne des variantes, qui occupe ses `variants` premières colonnes.
    for(let col=0;col<variants;col++)occupees.add(`${col}:${base.rows}`);
    d.frames.forEach((f,i)=>{
      if(i===0)return; // l'image 0 EST la tuile pleine : elle doit recouvrir sa case
      assert.ok(!occupees.has(`${f.col}:${f.row}`),`${type} (variantes ${variants}, ${count} images) : l’image ${i} tombe sur la case occupée ${f.col}:${f.row} — Godot refuserait l’animation`);
    });
    const shape=atlasShape(type,variants,count);
    assert.ok(d.frames[count-1].row<shape.rows,`${type} : la dernière image sort de l’atlas`);
  }
});

test('variantes et animation cohabitent : la ligne de variantes garde son contenu, les images descendent en dessous, aucune ne recouvre l’autre', () => {
  for(const type of ANIMATION_TYPES){
    const base=atlasShape(type,0,0),full=fullTileOf[type];
    const d=animationAtlasDescriptor(type,3,2);
    const s=settings({tilesetType:type,variants:2,animatedFrames:3});
    const img=asImg(renderLogical(s).imageData,s.tileSize);
    const variantRow=base.rows;
    // La ligne de variantes garde sa place et son contenu habituel.
    assert.deepEqual(cellTopRow(img,0,variantRow),cellTopRow(img,full.col,full.row),`${type} : variante 0, ligne du haut`);
    // Les images sont interchangeables avec l’originale, où qu’elles soient tombées.
    d.frames.forEach((f,k)=>assert.deepEqual(cellTopRow(img,f.col,f.row),cellTopRow(img,full.col,full.row),`${type} : image ${k}, ligne du haut`));
    // Et aucune image ne recouvre une variante : c’est la condition que Godot exige.
    const variantes=new Set([0,1].map((c)=>`${c}:${variantRow}`));
    d.frames.forEach((f,k)=>assert.ok(!variantes.has(`${f.col}:${f.row}`),`${type} : l’image ${k} recouvre une variante`));
    // Colonne au-delà du compte de variantes : toujours transparente sur leur ligne.
    let peintVariant3=0;
    for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)peintVariant3+=cellAlpha(img,2,variantRow,x,y);
    assert.equal(peintVariant3,0,`${type} : colonne 2 de la ligne de variantes peinte alors que variants=2`);
  }
});

// ===========================================================================
// Tranche T10 bis — animer l'atlas entier
// ===========================================================================
//
// Le mécanisme de T10 anime UNE tuile ; celui-ci répète l'atlas ENTIER en N copies,
// une par phase. Ce que ces essais doivent tenir, dans l'ordre d'importance :
//
//  1. désactivé (absent, 0 ou 1), rien ne bouge — empreintes comprises ;
//  2. la copie 0 est l'atlas de base AU BIT PRÈS, donc activer l'animation ne
//     retouche pas la tuile au repos, comme en T10 (cercle de phase translaté) ;
//  3. la couture tient DANS chaque copie — c'est la seule couture qui existe sur
//     une carte, puisque deux copies ne sont jamais voisines dans l'espace : elles
//     sont la même tuile à deux instants. C'est précisément ce que T10 ne pouvait
//     pas obtenir, sa tuile animée touchant des tuiles statiques ;
//  4. aucune image ne recouvre une autre — la condition sous laquelle Godot accepte
//     le réglage, et sous laquelle il ne se contente PAS de refuser l'animation :
//     mesuré sur Godot 4.7.2, un pas faux fait DISPARAÎTRE des tuiles (16 sur 47
//     retenues), voir scripts/godot-validation.mjs ;
//  5. la boucle ne saute pas au raccord ;
//  6. et ça se voit.
const ATLAS_COPY_TYPES=ANIMATION_TYPES;

// La case (col, row) de la copie k, dans l'atlas rendu.
const copyCell=(type,copies,variants,k,col,row)=>({col,row:row+k*atlasCopyRows(type,variants)});

test('sans le réglage, ou à 0 et 1 copie, l’atlas garde sa taille et son contenu au bit près — les empreintes existantes ne bougent pas', () => {
  for(const type of ATLAS_COPY_TYPES)for(const copies of [undefined,0,1]){
    assert.deepEqual(atlasShape(type,0,0,copies),atlasShape(type),`${type} à ${copies} copie(s) : la forme a bougé`);
  }
  // Une seule copie n’est pas une animation, c’est l’atlas : 1 vaut « désactivé », et
  // c’est ce qui permet au réglage de n’avoir qu’un seul état neutre côté écran.
  for(const copies of [0,1]){
    assert.equal(empreinte(settings({animatedAtlasCopies:copies})),'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
    assert.equal(empreinte(settings({tilesetType:'blob-47',animatedAtlasCopies:copies})),'47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52');
    assert.equal(empreinte(settings({tilesetType:'edge-16',animatedAtlasCopies:copies})),'95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593');
  }
  // Le mur et le 17 pièces n’ont pas de tuile pleine identifiable : le réglage n’y
  // existe pas, à n’importe quelle valeur — même porte que T10 et T8.
  for(const type of ['topdown-17','wall'])for(const copies of [2,4,8])assert.deepEqual(atlasShape(type,0,0,copies),atlasShape(type),`${type} : le réglage ne devrait pas s’y appliquer`);
});

test('à N copies, l’atlas fait exactement N fois la hauteur de sa disposition, et la copie 0 est l’atlas de base au bit près', () => {
  for(const type of ATLAS_COPY_TYPES)for(const copies of [2,4]){
    const base=atlasShape(type,0,0),grown=atlasShape(type,0,0,copies);
    assert.equal(grown.columns,base.columns,`${type} : la largeur ne doit pas bouger`);
    assert.equal(grown.rows,base.rows*copies,`${type} : la hauteur doit valoir ${copies} × ${base.rows}`);
    const s0=settings({tilesetType:type}),sN=settings({tilesetType:type,animatedAtlasCopies:copies});
    const i0=renderLogical(s0).imageData,iN=renderLogical(sN).imageData;
    assert.equal(iN.width,i0.width,`${type} : la largeur a bougé`);
    assert.equal(iN.height,i0.height*copies,`${type} : la hauteur a bougé`);
    // À largeur égale, la copie 0 occupe les premiers octets du tampon.
    for(let k=0;k<i0.data.length;k++)assert.equal(iN.data[k],i0.data[k],`${type} : octet ${k} de la copie 0 a bougé`);
  }
  // Avec une ligne de variantes, la copie inclut cette ligne : le pas reste le même
  // pour TOUTES les tuiles, ce qui est exactement l’argument de non-recouvrement.
  for(const type of ATLAS_COPY_TYPES){
    const s=settings({tilesetType:type,variants:2,animatedAtlasCopies:3});
    const img=renderLogical(s).imageData;
    assert.equal(img.height,(atlasShape(type,2).rows*3)*s.tileSize,`${type} : la ligne de variantes doit être répétée avec le reste`);
  }
});

test('l’essai qui compte — la couture tient DANS chaque copie de phase, sur plusieurs graines : c’est ce que T10 ne pouvait pas obtenir', () => {
  // Le défaut que cet essai empêche : le déphasage porte ici sur le bruit de BORD,
  // donc sur la silhouette. Il ne reste raccordable que parce que seamlessFbm reboucle
  // sur la tuile (un décalage constant laisse une fonction périodique périodique) ET
  // que toutes les tuiles d’une copie lisent le MÊME décalage. Qu’un seul de ces deux
  // points cède — un déphasage qui dépendrait de la case, par exemple — et la couture
  // se rompt ici.
  const T=32,COPIES=4;
  const pos=m=>{for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(layout[r][c]===m)return{col:c,row:r};throw new Error('masque absent : '+m);};
  for(const seed of [31415,7,2718])for(const edgeRoughness of [0,3,5]){
    const s=settings({seed,edgeRoughness,edgeStyle:'rough',animatedAtlasCopies:COPIES});
    const img=renderLogical(s).imageData;
    const a=(k,m,x,y)=>{const p=pos(m),cell=copyCell('topdown-15',COPIES,0,k,p.col,p.row);return img.data[(((cell.row*T+y)*img.width)+cell.col*T+x)*4+3]>0?1:0;};
    for(let k=0;k<COPIES;k++)for(let A=0;A<16;A++)for(let B=0;B<16;B++){
      const ctx=`graine ${seed}, rugosité ${edgeRoughness}, copie ${k}, masques ${A}|${B}`;
      if(!!(A&2)===!!(B&1)&&!!(A&8)===!!(B&4)){
        const g=Array.from({length:T},(_,y)=>a(k,A,T-1,y)),d=Array.from({length:T},(_,y)=>a(k,B,0,y));
        assert.equal(seamFault(g,d),-1,`couture verticale rompue · ${ctx}`);
      }
      if(!!(A&4)===!!(B&1)&&!!(A&8)===!!(B&2)){
        const h=Array.from({length:T},(_,x)=>a(k,A,x,T-1)),b=Array.from({length:T},(_,x)=>a(k,B,x,0));
        assert.equal(seamFault(h,b),-1,`couture horizontale rompue · ${ctx}`);
      }
    }
  }
});

test('aucune image ne recouvre une autre, quelle que soit la tuile — la condition exacte sous laquelle Godot accepte le réglage', () => {
  // Rejoué ici sur TOUTES les tuiles à la fois, ce qu’aucune version de T10 n’avait à
  // faire : c’est la propriété qui justifie la forme même de cette tranche. Mesuré sur
  // Godot 4.7.2, la sanction d’un pas faux n’est pas « l’animation ne joue pas » mais
  // « la tuile n’existe plus » — voir scripts/godot-validation.mjs.
  for(const type of ATLAS_COPY_TYPES)for(const variants of [0,2])for(const copies of [2,4,8]){
    const d=atlasAnimationDescriptor(type,copies,variants);
    const shape=atlasShape(type,variants,0,copies);
    const base=atlasShape(type,variants);
    const occupees=new Map();
    for(let row=0;row<base.rows;row++)for(let col=0;col<base.columns;col++)
      for(let k=0;k<copies;k++){
        const cle=`${col}:${row+k*d.copyRows}`;
        assert.ok(!occupees.has(cle),`${type} (${copies} copies, ${variants} variantes) : l’image ${k} de ${col}:${row} tombe sur ${cle}, déjà pris par ${occupees.get(cle)}`);
        occupees.set(cle,`l’image de ${col}:${row}`);
        assert.ok(row+k*d.copyRows<shape.rows,`${type} : l’image ${k} de ${col}:${row} sort de l’atlas`);
      }
    assert.equal(occupees.size,base.columns*shape.rows,`${type} : les images devraient couvrir exactement l’atlas`);
  }
});

test('la boucle ne saute pas au raccord : les N pas entre images consécutives sont du même ordre, celui qui referme le cycle compris', () => {
  // La formulation de T10 (« la dernière image est plus proche de la première que deux
  // images opposées ») n’est PAS reprise ici, et c’est une correction mesurée : elle
  // n’est vraie que tant que le bruit reste dans le régime lisse, donc à amplitude
  // invisible. La bonne propriété est l’uniformité du pas — vraie par symétrie du
  // cercle quel que soit le rayon, et c’est elle qui dit que la boucle ne saute pas.
  // Mesuré sur l'atlas ENTIER, pas sur une tuile : c'est l'atlas entier qui s'anime,
  // et la variance d'une seule case est trop grande pour dire quoi que ce soit (relevé :
  // sur la seule tuile pleine du 15 pièces à 8 copies, le pas de raccord monte à 1,6
  // fois la moyenne, alors que sur l'atlas complet il reste à 1,14 au pire — c'est du
  // bruit d'échantillon, pas un saut de boucle).
  for(const type of ATLAS_COPY_TYPES)for(const copies of [2,3,4,8]){
    const s=settings({tilesetType:type,animatedAtlasCopies:copies});
    const img=renderLogical(s).imageData;
    const H=atlasCopyRows(type,0)*s.tileSize,W=img.width;
    const pas=Array.from({length:copies},(_,k)=>{
      let total=0;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const i=((k*H+y)*W+x)*4,j=((((k+1)%copies)*H+y)*W+x)*4;
        for(let c=0;c<4;c++){const d=img.data[i+c]-img.data[j+c];total+=d*d;}
      }
      return Math.sqrt(total/(H*W));
    });
    const moyen=pas.reduce((a,b)=>a+b,0)/copies,raccord=pas[copies-1];
    assert.ok(raccord<moyen*1.25,`${type} (${copies} copies) : le pas de raccord ${raccord.toFixed(1)} dépasse la moyenne ${moyen.toFixed(1)}`);
    assert.ok(raccord>moyen*0.75,`${type} (${copies} copies) : le pas de raccord ${raccord.toFixed(1)} est anormalement petit devant ${moyen.toFixed(1)}`);
  }
});

test('et ça se voit — le déphasage bouge la teinte ET la silhouette, là où T10 ne bougeait que la teinte', () => {
  // Chiffres mesurés sur cet atlas, avec les réglages par défaut de l’atelier. T10 :
  // 4 % des pixels changent d’un cran entre deux images, écart moyen 1/255, et pas UN
  // pixel d’alpha — l’animation était invisible, et le plan le disait. Ici le bruit de
  // bord est déphasé aussi, donc la frontière elle-même respire.
  for(const type of ATLAS_COPY_TYPES){
    const s=settings({tilesetType:type,animatedAtlasCopies:4});
    const img=renderLogical(s).imageData;
    const S=atlasCopyRows(type,0)*s.tileSize,W=img.width;
    let diff=0,alpha=0,total=0;
    for(let y=0;y<S;y++)for(let x=0;x<W;x++){
      const i=(y*W+x)*4,j=((y+S)*W+x)*4;
      if(img.data[i+3]||img.data[j+3])total+=1;
      if(img.data[i]!==img.data[j]||img.data[i+1]!==img.data[j+1]||img.data[i+2]!==img.data[j+2]||img.data[i+3]!==img.data[j+3])diff+=1;
      if(img.data[i+3]!==img.data[j+3])alpha+=1;
    }
    assert.ok(diff/total>0.05,`${type} : seulement ${(100*diff/total).toFixed(1)} % des pixels bougent d’une image à l’autre`);
    assert.ok(alpha/total>0.004,`${type} : la silhouette ne bouge pas (${(100*alpha/total).toFixed(2)} % d’alpha)`);
  }
});

test('les copies d’atlas priment sur l’animation d’une seule tuile : les deux réglages ne se superposent jamais', () => {
  // Décision de la tranche, et elle est mécanique : les deux mécanismes ajoutent des
  // lignes sous l’atlas, et la garantie de non-recouvrement ci-dessus cesserait d’être
  // vraie par construction s’il fallait loger les images d’une tuile DANS une copie.
  for(const type of ATLAS_COPY_TYPES){
    const avec=settings({tilesetType:type,animatedAtlasCopies:3,animatedFrames:4});
    const sans=settings({tilesetType:type,animatedAtlasCopies:3});
    assert.deepEqual(atlasShape(type,0,4,3),atlasShape(type,0,0,3),`${type} : animatedFrames ne doit rien ajouter`);
    const a=renderLogical(avec).imageData,b=renderLogical(sans).imageData;
    assert.equal(a.height,b.height);
    for(let k=0;k<b.data.length;k++)assert.equal(a.data[k],b.data[k],`${type} : octet ${k} — animatedFrames a changé le rendu`);
  }
});

test('atlasAnimationDescriptor décrit le pas, animation_columns, separation, la hauteur de l’atlas et la durée — et vaut null quand il n’y a rien à décrire', () => {
  for(const type of ATLAS_COPY_TYPES){
    const d=atlasAnimationDescriptor(type,4);
    const base=atlasShape(type,0,0);
    assert.equal(d.count,4);
    assert.equal(d.copyRows,base.rows,`${type} : le pas vaut la hauteur de la disposition`);
    assert.equal(d.rows,base.rows*4,`${type} : hauteur d’atlas à déclarer`);
    assert.equal(d.animationColumns,1,`${type} : 1 empile vers le bas — mesuré sur Godot 4.7.2`);
    // separation se compte en CASES, et vaut le pas MOINS la case de la tuile.
    assert.deepEqual(d.separation,[0,base.rows-1],`${type} : separation`);
    assert.equal(d.frames.length,4);
    d.frames.forEach((f)=>assert.equal(f,DEFAULT_ANIMATION_FRAME_DURATION_MS/1000));
    // Avec une ligne de variantes, le pas l’englobe.
    assert.equal(atlasAnimationDescriptor(type,4,2).copyRows,base.rows+1,`${type} : le pas doit englober la ligne de variantes`);
    // Désactivé sous 2 copies, borné à 8 au-dessus.
    for(const n of [undefined,0,1,-3])assert.equal(atlasAnimationDescriptor(type,n),null,`${type} : ${n} copie(s) n’est pas une animation`);
    assert.equal(atlasAnimationDescriptor(type,99).count,8,`${type} : borné à 8`);
  }
  // Dispositions sans tuile pleine : rien à décrire, comme en T8 et T10.
  for(const type of ['topdown-17','wall'])assert.equal(atlasAnimationDescriptor(type,4),null);
});

// Une texture d'IA arrive en 512 px et une tuile en fait 32 : sans moyenne d'aire, le
// rééchantillonnage garde un pixel sur 256 et transforme une matière en confettis. Le
// damier des essais ci-dessus ne l'aurait jamais montré — sa période tombe pile sur la
// grille, la moyenne y redonne exactement le plus proche voisin. Il faut une matière
// dont le motif est PLUS FIN que le pas de réduction pour que la différence existe.
test('réduire une matière fine conserve sa couleur moyenne au lieu d’en tirer un échantillon',()=>{
 const source=512,tile=32;
 // Rayures d'un pixel : la moitié rouge, la moitié verte. Un point unique par bloc de
 // 16 × 16 rendrait une tuile entièrement rouge ou entièrement verte selon la parité.
 const rayures=new Uint8ClampedArray(source*source*4);
 for(let y=0;y<source;y++)for(let x=0;x<source;x++)rayures.set(x%2?[0,200,0,255]:[200,0,0,255],(y*source+x)*4);
 const image=render(plain({tileSize:tile,surfaceTexture:{data:rayures,width:source,height:source}}));
 // On lit la tuile pleine du jeu 15 pièces : la case (3,3), entièrement de la matière.
 let rouge=0,vert=0,n=0;
 for(let y=tile*3+8;y<tile*3+tile-8;y++)for(let x=tile*3+8;x<tile*3+tile-8;x++){
  const i=(y*image.width+x)*4;rouge+=image.data[i];vert+=image.data[i+1];n++;
 }
 rouge/=n;vert/=n;
 // Les deux canaux doivent se valoir : la moyenne des rayures, pas l'une des deux.
 assert.ok(Math.abs(rouge-vert)<25,`les deux couleurs de la matière doivent survivre à la réduction (rouge ${rouge.toFixed(0)}, vert ${vert.toFixed(0)})`);
 assert.ok(rouge>40&&vert>40,'la matière ne doit pas disparaître à la réduction');
});


// ===========================================================================
// Le relief — la lumière rasante sur la frontière
// ===========================================================================
// Deux propriétés, et une empreinte. Les propriétés comptent plus : c'est elles
// qui disent pourquoi les 40 essais qui précèdent restent valables alors que le
// rendu par défaut du panneau a changé d'aspect.

test('le relief ne touche QUE la couleur : à silhouette égale, pas un pixel d’alpha ne bouge', () => {
  // L'invariant qui porte tout le reste de ce fichier. Les contrôles de couture
  // lisent l'alpha et rien d'autre (public/tile-check.js, alphaAt) : tant que le
  // relief laisse l'alpha intact, aucun essai de raccord n'a besoin d'être rejoué
  // sous éclairage, et les 47 masques restent interchangeables. C'est aussi la
  // raison pour laquelle l'ombre de contact n'existe QUE sur un terrain inférieur
  // — la peindre sur du vide écrirait de l'alpha hors du masque et casserait
  // précisément ce que cet essai protège.
  for (const tilesetType of ['topdown-15','topdown-17','blob-47','edge-16','wall']) {
    const nu=render(settings({tilesetType})), eclaire=render(settings({tilesetType,relief:1}));
    let differents=0;
    for(let i=3;i<nu.data.length;i+=4){
      assert.equal(nu.data[i],eclaire.data[i],`${tilesetType} : l’alpha du pixel ${(i-3)/4} a bougé sous le relief`);
      if(nu.data[i-3]!==eclaire.data[i-3])differents++;
    }
    // Et il fait bien quelque chose : un relief qui ne changerait aucune couleur
    // passerait l'assertion ci-dessus sans rien prouver.
    assert.ok(differents>200,`${tilesetType} : le relief n’a presque rien éclairé (${differents} pixels)`);
  }
});

test('la lumière vient du haut : le bord nord s’éclaircit, le bord sud s’assombrit', () => {
  // La propriété qui fait qu'une silhouette se lit comme un volume. Mesurée sur la
  // tuile pleine du blob, dont les quatre bords sont des coutures — non : dont les
  // quatre bords débordent. On prend donc la tuile ISOLÉE (masque 0), la seule qui
  // porte une silhouette fermée, et on compare la luminance de sa bande haute à
  // celle de sa bande basse, relief éteint puis allumé.
  const T=32,p=atlasPosition('B47',0);
  const luminance=(img,y0,y1)=>{let somme=0,n=0;
    for(let y=y0;y<y1;y++)for(let x=8;x<T-8;x++){
      const i=(((p.row*T+y)*img.width)+p.col*T+x)*4;
      if(img.data[i+3]===0)continue;
      somme+=img.data[i]*0.3+img.data[i+1]*0.59+img.data[i+2]*0.11;n++;}
    return n?somme/n:0;};
  const nu=render(settings({tilesetType:'blob-47'})),eclaire=render(settings({tilesetType:'blob-47',relief:1}));
  const hautNu=luminance(nu,3,8),basNu=luminance(nu,T-8,T-3);
  const hautEclaire=luminance(eclaire,3,8),basEclaire=luminance(eclaire,T-8,T-3);
  // Sans relief, les deux bords sont traités pareil : leur écart est du bruit.
  assert.ok(Math.abs(hautNu-basNu)<6,`sans relief, haut et bas devraient se ressembler (${hautNu.toFixed(1)} contre ${basNu.toFixed(1)})`);
  // Avec relief, le haut passe nettement devant le bas.
  assert.ok(hautEclaire-basEclaire>12,`sous la lumière, le bord nord doit être plus clair que le bord sud (${hautEclaire.toFixed(1)} contre ${basEclaire.toFixed(1)})`);
});

test('le rendu par défaut du panneau — relief compris — est stable au bit près', () => {
  // L'empreinte de ce que l'utilisateur voit réellement en ouvrant l'atelier,
  // distincte des empreintes sans relief plus haut. Si un changement délibéré la
  // fait bouger, la mettre à jour ici en connaissance de cause.
  // T25 : 'wall' régénérée — la base porte désormais le relief comme la face (même
  // condition de `grazed`), là où elle n'en recevait aucun avant cette tranche.
  const attendu={
    'topdown-15':'9f6307c9cac148a01ff1035d08a509642bfd5b83cc88a2e07837463658d7e440',
    'topdown-17':'4d62eb979de29d6102bed226371527062022d45980424f34cf3b58c9dd53a6cb',
    'blob-47':'0653da36590a1d00f24fbb40e3bbb00ad018ec519a633c130e49d65dd0d73f38',
    'edge-16':'01e9072ab4fadf95f53b7ab077fdd14db630f9c94b70ad9f3b6452ce7b3cf689',
    // T37 puis T44 puis T45 : régénérée pour la même unique raison que les deux empreintes
    // de mur plus haut — T37 a peint les deux colonnes de coin, T44 pose la pente du bord
    // arrière puis T45 le raccord-base dans les deux colonnes libres du bloc en biais. Les
    // quatre autres dispositions ne bougent pas d'un bit, et c'est ce que cette ligne prouve
    // en restant entourée d'elles.
    'wall':'c34ce03e67559cd18fbe0931e61b3b2bf1a1b89ed4d74a045cb06569d5e87152',
  };
  for(const [tilesetType,digest] of Object.entries(attendu))
    assert.equal(empreinte(settings({tilesetType,relief:0.4})),digest,`${tilesetType} : le défaut du panneau a bougé`);
});

// ===========================================================================
// Tranche T13 — le déphasage de texture d'une variante
// ===========================================================================
// Le défaut que cette tranche corrige, et que les essais de T8 ci-dessus figeaient
// sans le dire : une variante ne rejouait que sa graine de GRAIN, donc son niveau de
// teinte. L'échantillonnage de texture, lui, ne lit que (lx, ly) — c'est l'invariant
// de l'estampage — et retombait donc texel pour texel sur le même motif. Sur une
// matière texturée (le cas par défaut depuis les matières intégrées), une variante
// était quasiment indiscernable de l'originale : exactement ce qu'elle devait éviter.
//
// Le canal neuf est `settings.texturePhase`, et c'est une AUTORISATION, pas un
// réglage d'intensité : le moteur ne déphase jamais de lui-même, c'est la matière qui
// déclare si elle le tolère (`dephasable`, public/tile-materials.js).
const {tolerePhase,rendreMatiere,MATIERES}=await import('../tile-materials.js');
const {variantTexturePhase}=await import('../vendor/tileset-engine.js');

// Combien de pixels diffèrent entre deux cases d'atlas, sur la partie opaque.
// Une texture dont CHAQUE texel a une couleur unique : un damier ne convenait pas ici,
// et c’est ce que la mesure a montré — sa période propre (8 px après rééchantillonnage) fait
// retomber certains décalages sur le motif d’origine, et l’essai mesurait alors l’accident
// arithmétique plutôt que le déphasage. Avec un motif injectif, tout décalage non nul change
// tous les texels, et le JEU de couleurs rendu est exactement conservé — une rotation
// circulaire ne crée ni ne perd aucune couleur. Les deux moitiés de l’essai deviennent nettes.
const motifUnique=(size)=>{const data=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.set([x*(256/size),y*(256/size),128,255],(y*size+x)*4);return {data,width:size,height:size};};
const opaques=(img,c)=>{let n=0;for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)if(cellAlpha(img,c.col,c.row,x,y))n++;return n;};
const diffCellules=(img,a,b)=>{
  let n=0;
  for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){
    const p=cellPixel(img,a.col,a.row,x,y),q=cellPixel(img,b.col,b.row,x,y);
    if(p[0]!==q[0]||p[1]!==q[1]||p[2]!==q[2]||p[3]!==q[3])n++;
  }
  return n;
};

test('T13 · `texturePhase` ne peut rien changer tant qu’aucune variante n’est demandée : les trois empreintes de T8 tiennent mot pour mot', () => {
  // La contrainte dure de la tranche, et elle se vérifie avec le réglage ACTIVÉ : ce
  // n’est pas « on ne l’a pas branché », c’est « il est branché et il ne peut pas
  // atteindre un atlas sans ligne de variantes ».
  assert.equal(empreinte(settings({variants:0,texturePhase:true})),'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
  assert.equal(empreinte(settings({tilesetType:'blob-47',variants:0,texturePhase:true})),'47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52');
  assert.equal(empreinte(settings({tilesetType:'edge-16',variants:0,texturePhase:true})),'95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593');
});

test('T13 · le déphasage garanti : chaque axe tombe entre un quart et trois quarts de tuile, jamais sur un décalage insignifiant', () => {
  // Ce que la mesure a corrigé. Un hachage laissé libre rendait, sur certaines graines,
  // un décalage de 1 ou 2 px — c’est-à-dire une variante visuellement identique à
  // l’originale, le défaut même que la tranche corrige. La borne n’est donc pas une
  // commodité : sans elle, la fonctionnalité rate silencieusement une fois sur dix.
  for(const size of [16,32,48,64])for(const seed of [1,31415,7,2718,99999])for(let v=1;v<=3;v++){
    const {tx,ty}=variantTexturePhase(size,v,seed);
    const quart=Math.max(1,Math.round(size/4));
    for(const [axe,val] of [['tx',tx],['ty',ty]]){
      assert.ok(Number.isInteger(val),`taille ${size}, graine ${seed}, variante ${v} : ${axe} non entier`);
      assert.ok(val>=quart&&val<=size-quart,`taille ${size}, graine ${seed}, variante ${v} : ${axe} = ${val}, hors de [${quart}, ${size-quart}]`);
    }
  }
  // Déterministe, et différent d’une variante à l’autre.
  assert.deepEqual(variantTexturePhase(32,1,31415),variantTexturePhase(32,1,31415));
  const phases=new Set([1,2,3].map((v)=>JSON.stringify(variantTexturePhase(32,v,31415))));
  assert.equal(phases.size,3,'deux variantes partagent la même phase : elles rendraient le même motif');
});

test('T13 · l’essai qui compte — une variante déphasée montre un AUTRE bout de la matière, pas une autre teinte', () => {
  const tile=32,cell=8;
  for(const type of VARIANT_TYPES){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    // Réglages nus (ni bruit, ni taches, ni fondu de bord) : un pixel de terrain vaut
    // exactement le texel lu. Ce qui diffère ici ne PEUT donc pas venir de la teinte.
    const commun={tilesetType:type,tileSize:tile,variants:3,surfaceTexture:motifUnique(tile)};
    const sans=asImg(renderLogical(plain(commun)).imageData,tile);
    const avec=asImg(renderLogical(plain({...commun,texturePhase:true})).imageData,tile);
    for(let v=0;v<3;v++){
      const variante={col:v,row:vRow},originale={col:full.col,row:full.row};
      // Sans autorisation : le texel est lu aux mêmes coordonnées, au bit près (c’est
      // l’essai de T8 juste au-dessus, redit ici comme témoin de la comparaison).
      assert.equal(diffCellules(sans,variante,originale),0,`${type} variante ${v} : déphasée sans autorisation`);
      // Avec : sur un motif injectif, un décalage non nul doit changer TOUS les texels du
      // masque. On exige donc la quasi-totalité, pas un frémissement. Compté sur les pixels
      // OPAQUES et non sur l’aire de la tuile : le jeu 16 bords ne peint qu’une bande, et
      // le vide autour est identique des deux côtés par construction — le mesurer aurait
      // fait échouer l’essai sur un succès.
      const n=diffCellules(avec,variante,originale),peints=opaques(avec,originale);
      assert.ok(n>peints*0.9,`${type} variante ${v} : seulement ${n} pixels diffèrent sur ${peints} peints`);
    }
    // Et ce n’est PAS une teinte, au sens fort : chaque pixel peint d’une variante vaut
    // exactement le texel de la MÊME texture, lu à la position décalée de la phase. Une
    // variante qui se contenterait d’assombrir, ou qui mélangerait deux texels, échouerait
    // ici ; une variante qui lit ailleurs dans la matière passe, pixel par pixel.
    const motif=motifUnique(tile);
    const texel=(x,y)=>{const k=((y%tile)*tile+(x%tile))*4;return [motif.data[k],motif.data[k+1],motif.data[k+2]];};
    for(let v=0;v<3;v++){
      const {tx,ty}=variantTexturePhase(tile,v+1,plain(commun).seed);
      for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
        if(!cellAlpha(avec,v,vRow,x,y))continue;
        assert.deepEqual(cellPixel(avec,v,vRow,x,y).slice(0,3),texel(x+tx,y+ty),`${type} variante ${v}, pixel ${x},${y} : ce n’est pas le texel décalé de la phase`);
      }
    }
  }
});

test('T13 · l’invariant par matière, de bout en bout : une matière organique se déphase, une matière à motif régulier jamais', () => {
  // Le contrat ne se lit pas dans le moteur mais dans la matière. On le joue donc comme
  // l’atelier le joue : la matière rend sa texture, elle DIT si elle tolère la phase, et
  // c’est cette déclaration — jamais un booléen écrit à la main ici — qui pilote le rendu.
  const tile=32,type='blob-47',full=fullTileOf[type],vRow=atlasShape(type,0).rows;
  const rendu=(id)=>{
    const {surface,contour}=rendreMatiere(id,tile,31415);
    const s=plain({tilesetType:type,tileSize:tile,variants:3,surfaceTexture:surface,edgeTexture:contour,texturePhase:tolerePhase(id)});
    return asImg(renderLogical(s).imageData,tile);
  };
  for(const id of ['brique','bois','carrelage']){
    assert.equal(tolerePhase(id),false,`${id} : une matière dont le motif EST une grille ne doit jamais tolérer la phase`);
    const img=rendu(id);
    for(let v=0;v<3;v++)assert.equal(diffCellules(img,{col:v,row:vRow},{col:full.col,row:full.row}),0,
      `${id} variante ${v} : la texture a été déphasée — l’appareillage sauterait à la couture avec la tuile voisine`);
  }
  for(const id of ['herbe','pierre','sable']){
    assert.equal(tolerePhase(id),true,`${id} : une matière organique devrait tolérer la phase`);
    const img=rendu(id);
    for(let v=0;v<3;v++)assert.ok(diffCellules(img,{col:v,row:vRow},{col:full.col,row:full.row})>tile*tile*0.1,
      `${id} variante ${v} : la texture n’a pas bougé alors que la matière l’autorise`);
  }
  // Les treize matières déclarent, aucune ne laisse deviner — et une matière importée ou
  // générée par l'IA, qui n'a rien à déclarer, retombe sur le défaut sûr.
  for(const [id,m] of Object.entries(MATIERES))assert.equal(typeof m.dephasable,'boolean',`${id} : `+'`dephasable` manquant');
  assert.equal(tolerePhase(''),false);
  assert.equal(tolerePhase('une-texture-importee'),false);
});

test('T13 · le déphasage ne touche QUE la matière : la silhouette d’une variante reste un calque exact de l’originale', () => {
  // C’est l’invariant d’interchangeabilité de T8, reposé ici : si la phase avait fui vers
  // la géométrie ou le bruit de bord, une variante cesserait de se raccorder à ses voisines
  // et toute la fonctionnalité deviendrait un défaut de couture.
  const tile=32;
  for(const type of VARIANT_TYPES)for(const edgeStyle of ['clean','rough']){
    const full=fullTileOf[type],vRow=atlasShape(type,0).rows;
    const s=settings({tilesetType:type,tileSize:tile,variants:3,edgeStyle,texturePhase:true,surfaceTexture:damier(64,16)});
    const img=asImg(renderLogical(s).imageData,tile);
    for(let v=0;v<3;v++){
      const nom=`${type} variante ${v}, ${edgeStyle}`;
      assert.deepEqual(cellTopRow(img,v,vRow),cellTopRow(img,full.col,full.row),`${nom} : ligne du haut`);
      assert.deepEqual(cellBottomRow(img,v,vRow),cellBottomRow(img,full.col,full.row),`${nom} : ligne du bas`);
      assert.deepEqual(cellLeftCol(img,v,vRow),cellLeftCol(img,full.col,full.row),`${nom} : colonne de gauche`);
      assert.deepEqual(cellRightCol(img,v,vRow),cellRightCol(img,full.col,full.row),`${nom} : colonne de droite`);
    }
  }
});

// ===========================================================================
// T27 — le calque de décor organique
// ===========================================================================
// Ce que la tranche doit prouver, et que rien d'autre ne prouve : à décor nul l'atlas
// ne bouge pas d'un bit ; les lignes de décor s'ajoutent APRÈS tout le reste (variantes,
// images d'animation, copies de phase) et n'entrent donc en conflit avec aucun des trois ;
// et une pièce déborde réellement depuis son bord d'appui, sinon elle ne casse rien.
const {decorAtlasDescriptor,DECOR_ORIENTATIONS,DECOR_VARIANTS,WALL_UNPLACED_STATES}=await import('../vendor/tileset-engine.js');

test('T27 · à décor « aucun », l’atlas garde sa taille et son contenu au bit près — les empreintes existantes ne bougent pas', () => {
  // Mêmes empreintes que les témoins « variants: 0 » et « animatedFrames: 0 » : les quatre
  // réglages partagent le même chemin par défaut, et c'est ce qui se vérifie ici.
  assert.equal(empreinte(settings({decor:'aucun'})),'c7ce146832183a84adc7b7969f2c8107ade81d796158b4f1f5bf89fe375555d2');
  assert.equal(empreinte(settings({tilesetType:'blob-47',decor:'aucun'})),'47d46571fce281df816191af6c205c2aed3c195040abfaefe2f2fef368b9bc52');
  assert.equal(empreinte(settings({tilesetType:'edge-16',decor:'aucun'})),'95b0562ef40eb2f7268b997d588853d0e45c9a0781bd873ebe61fddf2183a593');
  // Et une valeur inconnue retombe sur « aucun » plutôt que d'allonger l'atlas en silence.
  assert.equal(empreinte(settings({decor:'nimporte-quoi'})),empreinte(settings()));
  assert.equal(decorAtlasDescriptor('blob-47','aucun'),null);
  assert.equal(decorAtlasDescriptor('blob-47',undefined),null);
  // Le mur aussi : sa géométrie ne bouge pas d'une case.
  // T43 : onze lignes et non plus neuf — les deux lignes en biais font partie de la
  // DISPOSITION du mur, pas d'un calque. Ce que cet essai contrôle reste le même : le
  // décor n'y ajoute rien tant qu'il vaut « aucun ».
  assert.deepEqual(atlasShape('wall'),{columns:8,rows:11});
  assert.deepEqual(atlasShape('wall',0,0,0,'aucun'),{columns:8,rows:11});
  assert.deepEqual([...wallShot().data],[...wallShot({decor:'aucun'}).data]);
});

test('T27 · le décor ajoute ses lignes APRÈS tout le reste, et ce qui est au-dessus reste identique au bit près', () => {
  // Les quatre combinaisons qui pouvaient se marcher dessus. `firstRow` doit valoir, à
  // chaque fois, la hauteur de l'atlas SANS décor — c'est la propriété qui fait cohabiter
  // le décor avec les variantes (T13), les images d'animation (T10) et les copies de
  // phase (T10 bis) sans qu'aucun mécanisme ne réclame la ligne d'un autre.
  const cas=[
    {nom:'blob nu',           over:{tilesetType:'blob-47'}},
    {nom:'blob + variantes',  over:{tilesetType:'blob-47',variants:3}},
    {nom:'blob + animation',  over:{tilesetType:'blob-47',animatedFrames:4}},
    {nom:'blob + copies',     over:{tilesetType:'blob-47',variants:2,animatedAtlasCopies:4}},
    {nom:'chemin + variantes',over:{tilesetType:'edge-16',variants:1}},
    {nom:'mur',               over:{tilesetType:'wall'}},
  ];
  for(const {nom,over} of cas){
    const sans=render(settings({...over,decor:'aucun'}));
    const avec=render(settings({...over,decor:'dense'}));
    const formeSans=atlasShape(over.tilesetType,over.variants,over.animatedFrames,over.animatedAtlasCopies,'aucun');
    const formeAvec=atlasShape(over.tilesetType,over.variants,over.animatedFrames,over.animatedAtlasCopies,'dense');
    assert.equal(formeAvec.columns,formeSans.columns,`${nom} : la largeur de l’atlas a bougé`);
    assert.equal(formeAvec.rows,formeSans.rows+DECOR_ORIENTATIONS.length,`${nom} : mauvais nombre de lignes de décor`);
    assert.equal(avec.width,sans.width,`${nom} : largeur en pixels`);
    assert.equal(avec.height,sans.height+DECOR_ORIENTATIONS.length*32,`${nom} : hauteur en pixels`);
    // Tout ce qui existait avant, octet pour octet.
    assert.deepEqual([...avec.data.slice(0,sans.data.length)],[...sans.data],`${nom} : le décor a déplacé ou modifié une case existante`);
    const d=decorAtlasDescriptor(over.tilesetType,'dense',over.variants,over.animatedFrames,over.animatedAtlasCopies);
    assert.equal(d.firstRow,formeSans.rows,`${nom} : le décor ne commence pas juste après le reste`);
    assert.equal(d.cells.length,DECOR_ORIENTATIONS.length*DECOR_VARIANTS,`${nom} : mauvais nombre de pièces`);
    for(const c of d.cells)assert.ok(c.col<formeSans.columns,`${nom} : une pièce sort de la largeur`);
    // Et « léger » décrit exactement le même atlas que « dense » : la densité est une règle
    // de POSE, pas une forme d'atlas — c'est ce qui permet d'en changer sans réexporter.
    const leger=decorAtlasDescriptor(over.tilesetType,'leger',over.variants,over.animatedFrames,over.animatedAtlasCopies);
    assert.deepEqual(leger.cells,d.cells,`${nom} : léger et dense ne décrivent pas le même atlas`);
    assert.deepEqual([...render(settings({...over,decor:'leger'})).data],[...avec.data],`${nom} : léger et dense ne rendent pas le même atlas`);
  }
});

test('T27 · une pièce de décor déborde vraiment : elle touche son bord d’appui sur toute la largeur et descend d’au moins un tiers de tuile', () => {
  // Les deux moitiés de la propriété, et il faut les deux. « Touche le bord » : sans ça il
  // resterait un liseré de fond entre la matière et son gravat. « Descend » : sans ça la
  // pièce ne serait qu'un liseré de plus, posé sur la frontière — donc une grille.
  const tile=32;
  const img=wallShot({tileSize:tile,decor:'dense'});
  const d=decorAtlasDescriptor('wall','dense');
  // Repère canonique : `u` court le long du bord d'appui, `v` s'enfonce dans la case.
  const canon=(orientation,u,v)=>orientation==='n'?[u,v]:orientation==='s'?[u,tile-1-v]:orientation==='w'?[v,u]:[tile-1-v,u];
  for(const c of d.cells){
    let touche=0,profondeurMax=0,aire=0;
    for(let u=0;u<tile;u++){
      let profondeur=0;
      for(let v=0;v<tile;v++){
        const [x,y]=canon(c.orientation,u,v);
        if(wallAlphaAt(img,c.row,c.col,x,y)){profondeur=v+1;aire+=1;}
      }
      const [bx,by]=canon(c.orientation,u,0);
      if(wallAlphaAt(img,c.row,c.col,bx,by))touche+=1;
      if(profondeur>profondeurMax)profondeurMax=profondeur;
    }
    const nom=`décor ${c.orientation}${c.variant}`;
    assert.ok(touche>=tile*0.75,`${nom} : ne touche son bord d’appui que sur ${touche}/${tile} colonnes`);
    assert.ok(profondeurMax>=tile/3,`${nom} : ne déborde que de ${profondeurMax} px, moins d’un tiers de tuile`);
    // Mais elle ne remplit pas sa case : un gravat qui couvre tout n'est plus un gravat,
    // c'est un second terrain — et il rendrait la grille PIRE, pas meilleure.
    assert.ok(aire<tile*tile*0.75,`${nom} : couvre ${aire} px sur ${tile*tile}, ce n’est plus du décor`);
    // Le bord opposé reste vide : la pièce déborde d'un côté, jamais des deux.
    for(let u=0;u<tile;u++){
      const [x,y]=canon(c.orientation,u,tile-1);
      assert.equal(wallAlphaAt(img,c.row,c.col,x,y),0,`${nom} : peinte jusqu’au bord opposé en u=${u}`);
    }
  }
});

test('T27 · les deux flancs à 45° restent PEINTS dans l’atlas, mais ne sont plus des pièces à poser', () => {
  // La moitié « restent peints » compte autant que l'autre : les retirer déplacerait
  // toutes les cases suivantes et casserait les empreintes comme les fichiers déjà
  // exportés. C'est pour ça que le retrait passe par `placeable` et non par la géométrie.
  const img=wallShot();
  const d=wallAtlasDescriptor();
  assert.deepEqual(WALL_UNPLACED_STATES,['flank-left','flank-right']);
  for(const id of WALL_UNPLACED_STATES){
    const col=wallStateCol[id];
    for(const row of [FACE_ROW,BASE_ROW]){
      let peint=0;for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++)peint+=wallAlphaAt(img,row,col,x,y);
      assert.ok(peint>0,`${id} ligne ${row} : la case a été vidée, ce qui n’était pas demandé`);
      const cell=d.cells.find(c=>c.col===col&&c.row===row);
      assert.equal(cell.placeable,false,`${id} ligne ${row} : encore déclaré comme pièce à poser`);
    }
  }
  // Les quatre états orthogonaux, eux, restent posables — sinon l'essai ci-dessus
  // passerait aussi sur un descripteur qui aurait tout marqué non posable.
  for(const id of ['isolated','left-end','middle','right-end']){
    const cell=d.cells.find(c=>c.col===wallStateCol[id]&&c.row===FACE_ROW);
    assert.equal(cell.placeable,true,`${id} : devenu non posable par accident`);
  }
});

// ===========================================================================
// Tranche T37 — les deux états de coin des bandes
// ===========================================================================
// Le défaut, nommé : quand un mur top-down tourne, on accolait deux dessins à bord libre
// arrondi qui n'avaient jamais été faits pour se rencontrer, d'où une coupure droite dans
// l'angle. Mesuré avant de coder, sur une scène en L (mur horizontal de 6 cases tournant
// au nord sur 4, hauteur 3, tuile de 32 px), en comptant les pixels de fond des deux
// colonnes d'angle sur les trois tuiles qui y portent une bande : 828 px de fond, coupure
// la plus large 5 px — contre 0 et 0 une fois les deux états posés.
//
// L'invariant de la tranche, et ce que ces essais en figent : *une extrémité de course qui
// tourne n'est pas une extrémité libre.* Côté atlas, cela se traduit par UNE seule chose —
// du côté du coin, la matière va jusqu'au bord de la case, exactement comme un `middle`.

// La case (col, row) d'une bande, en RVB, sous forme de tableau plat comparable.
const wallCell=(img,row,col)=>{const out=[];for(let y=0;y<img.tile;y++)for(let x=0;x<img.tile;x++){const i=(((row*img.tile+y)*img.width)+col*img.tile+x)*4;out.push(img.data[i],img.data[i+1],img.data[i+2],img.data[i+3]);}return out;};

test('T37 · à pénombre nulle, un coin EST un milieu — au pixel près, sur les trois bandes', () => {
  // L'essai de neutralité de la tranche, et celui qui prouve la géométrie du même coup.
  // Un coin a ses deux côtés débordants, donc la MÊME emprise qu'un milieu : à occlusion
  // nulle il ne reste plus rien pour les distinguer, et les deux cases doivent être
  // identiques octet pour octet. S'il subsistait le moindre bord libre arrondi du côté du
  // coin — le défaut que la tranche supprime — cette comparaison tomberait.
  //
  // C'est aussi la preuve que le réglage est neutre : `middle` n'a pas changé depuis T25,
  // donc « coin à 0 = milieu » vaut « coin à 0 = rendu d'avant la tranche ».
  for(const occlusion of [0,undefined]){
    const img=wallShot(occlusion===undefined?{}:{wallCornerOcclusion:0});
    for(const row of [FACE_ROW,BASE_ROW,SHADOW_ROW]){
      const milieu=wallCell(img,row,wallStateCol['middle']);
      for(const id of ['corner-left','corner-right']){
        assert.deepEqual(wallCell(img,row,wallStateCol[id]),milieu,`ligne ${row}, ${id} : diffère du milieu à pénombre nulle (réglage ${occlusion===undefined?'absent':'à 0'})`);
      }
    }
  }
});

test('T37 · la pénombre d’angle est une RAMPE sur le dernier tiers du côté du coin, et ne touche rien d’autre', () => {
  // Une rampe, jamais une marche : une marche remettrait exactement la coupure droite que
  // la tranche supprime, déplacée de dix pixels. On la lit en différence avec le milieu,
  // qui est le même dessin sans pénombre — donc l'écart EST la pénombre, sans avoir à
  // démêler la matière.
  const img=wallShot({wallCornerOcclusion:80});
  const tile=img.tile;
  const canalRouge=(row,col,x,y)=>img.data[(((row*tile+y)*img.width)+col*tile+x)*4];
  const ecart=(row,col,x)=>{let s=0;for(let y=0;y<tile;y++)s+=canalRouge(row,wallStateCol['middle'],x,y)-canalRouge(row,col,x,y);return s/tile;};

  for(const [id,bord] of [['corner-left','ouest'],['corner-right','est']]){
    const col=wallStateCol[id];
    // Lu depuis le bord du coin vers l'intérieur, quel que soit le côté.
    const profil=Array.from({length:tile},(_,k)=>ecart(FACE_ROW,col,bord==='ouest'?k:tile-1-k));
    assert.ok(profil[0]>10,`${id} : aucune pénombre sur le bord du coin (${profil[0].toFixed(1)})`);
    // Nulle au-delà du tiers : le reste de la face est celui d'un milieu, intact.
    for(let k=Math.ceil(tile/3);k<tile;k++)assert.equal(profil[k],0,`${id} : la pénombre déborde du tiers, en ${k}`);
    // Décroissante, à l'arrondi près — c'est ce qui fait une rampe et non une marche.
    for(let k=1;k<Math.ceil(tile/3);k++)assert.ok(profil[k]<=profil[k-1]+1,`${id} : la pénombre remonte en ${k}`);
    // Et aucune marche : la plus grande chute d'un pixel au suivant reste petite devant
    // l'amplitude totale. Une marche donnerait une chute unique égale à tout le reste.
    let chute=0;for(let k=1;k<Math.ceil(tile/3);k++)chute=Math.max(chute,profil[k-1]-profil[k]);
    assert.ok(chute<profil[0]/2,`${id} : chute de ${chute.toFixed(1)} sur une amplitude de ${profil[0].toFixed(1)} — c'est une marche, pas une rampe`);
  }

  // Le réglage ne fuit pas sur les colonnes des bandes basses qui ne sont pas des coins :
  // les six colonnes historiques sont les mêmes à 0 et à 80. Corrigé par T38 : le DESSUS,
  // lui, N'EST PLUS attendu identique — c'est justement lui que T38 vient brancher sur ce
  // même réglage (voir la section « Tranche T38 » plus bas, qui vérifie cette branche-là
  // avec sa propre mesure, plutôt que de la laisser à une égalité qu'elle rend fausse).
  const nul=wallShot({wallCornerOcclusion:0});
  for(const row of [FACE_ROW,BASE_ROW,SHADOW_ROW])for(let col=0;col<6;col++)
    assert.deepEqual(wallCell(img,row,col),wallCell(nul,row,col),`la pénombre d'angle a touché la colonne ${col} de la ligne ${row}`);
});

test('T37 · un coin se raccorde à un milieu sans couture, comme tout état débordant', () => {
  // Le contrôle que checkWallAtlas fait désormais aussi sur ces deux colonnes. Il vaut la
  // peine ici : la pénombre ne touche que la couleur, donc une couture qui s'ouvrirait ne
  // pourrait venir que d'une erreur de géométrie.
  const net=wallShot({edgeStyle:'clean',wallCornerOcclusion:80});
  const brut=wallShot({wallCornerOcclusion:80});
  for(const bandRow of [FACE_ROW,BASE_ROW,SHADOW_ROW]){
    const mid=wallStateCol['middle'],cl=wallStateCol['corner-left'],cr=wallStateCol['corner-right'];
    assert.ok(identical(wallRightCol(net,bandRow,cl),wallLeftCol(net,bandRow,mid)),`ligne ${bandRow} : coin gauche → milieu`);
    assert.ok(identical(wallRightCol(net,bandRow,mid),wallLeftCol(net,bandRow,cr)),`ligne ${bandRow} : milieu → coin droit`);
    assert.equal(seamFault(wallRightCol(brut,bandRow,cl),wallLeftCol(brut,bandRow,cr)),-1,`ligne ${bandRow} : trou coin/coin sous bruit`);
  }
});

// ===========================================================================
// Tranche T38 — l'occlusion des coins intérieurs du dessus
// ===========================================================================
// Le dessus du mur EST le blob 47 (voir « le dessus du mur est identique au pixel
// près au rendu blob-47 » plus haut) : ses coins rentrants existent déjà comme
// formes — l'encoche que blobSdf creuse — mais rien n'assombrissait l'angle avant
// cette tranche, qui se lisait comme un pli de papier plutôt que comme un creux.
// Cette tranche branche le MÊME réglage que T37 (`settings.wallCornerOcclusion`,
// un seul curseur pour un seul phénomène) sur le dessus, en dérivant les masques
// à coin rentrant de BLOB_CORNERS — jamais en les recopiant, pour ne pas ouvrir
// une troisième source de vérité sur la géométrie que blobSdf porte déjà.

test('T38 · comptage — les masques à coin rentrant du blob 47, dérivés de BLOB_CORNERS', () => {
  // Le point dur de la tranche, tranché en amont sur le code réel, RE-dérivé ici pour
  // qu'il se recompte à chaque exécution des essais plutôt que de se figer dans un
  // commentaire. Prédicat exactement celui de blobSdf : les deux côtés adjacents du
  // coin posés, la diagonale entre eux à zéro.
  const parCompte = {};
  let masquesTouches = 0, coinsTotal = 0;
  for (const mask of B47.masks) {
    let n = 0;
    for (const corner of BLOB_CORNERS) {
      if ((mask & corner.sides) !== corner.sides) continue;
      if (mask & corner.diagonal) continue;
      n += 1;
    }
    parCompte[n] = (parCompte[n] || 0) + 1;
    if (n > 0) masquesTouches += 1;
    coinsTotal += n;
  }
  assert.equal(B47.masks.length, 47);
  assert.equal(masquesTouches, 31, 'masques à au moins un coin rentrant');
  assert.equal(parCompte[0], 16, 'masques sans coin rentrant');
  assert.equal(parCompte[1], 16, 'masques à un coin');
  assert.equal(parCompte[2], 10, 'masques à deux coins');
  assert.equal(parCompte[3], 4, 'masques à trois coins');
  assert.equal(parCompte[4], 1, 'masques à quatre coins (la croix, masque 85)');
  // Démenti du plan, vérifié plutôt que cru (la consigne même de cette tranche) :
  // 16×1 + 10×2 + 4×3 + 1×4 = 52, pas 50. Le détail par compte que le plan donne
  // (16/10/4/1) est exact ; c'est sa somme finale qui est fausse. C'est ce compte-ci,
  // recalculé sur BLOB_CORNERS, qui fait foi pour la tranche.
  assert.equal(coinsTotal, 52, 'total des coins rentrants du blob 47 (le plan annonçait 50 par erreur de somme)');
  // La croix nommée par le plan : masque 85 = N|E|S|W, sans diagonale — ses quatre
  // coins doivent être actifs.
  assert.equal(85, NEIGHBOUR_BITS.N | NEIGHBOUR_BITS.E | NEIGHBOUR_BITS.S | NEIGHBOUR_BITS.W);
  assert.ok(
    BLOB_CORNERS.every((c) => (85 & c.sides) === c.sides && !(85 & c.diagonal)),
    'masque 85 : les quatre coins doivent être actifs',
  );
});

test('T38 · neutralité — wallCornerOcclusion à 0 ou absent laisse le dessus identique au blob 47 autonome', () => {
  // Même contrôle que l'essai « le dessus du mur est identique au pixel près au rendu
  // blob-47 » plus haut, mais avec le réglage de cette tranche rendu EXPLICITE — c'est
  // la preuve de neutralité que le plan demande, reçue avec son zéro écrit en toutes
  // lettres plutôt que laissée à un défaut implicite.
  for (const over of [{}, { wallCornerOcclusion: 0 }]) {
    const wallImg = renderLogical(wallSettings(over)).imageData;
    const blobImg = renderLogical(settings({ tilesetType: 'blob-47' })).imageData;
    for (let row = 0; row < WALL_TOP_ROWS; row++)
      for (let col = 0; col < 8; col++)
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 32; x++) {
            const iw = ((row * 32 + y) * wallImg.width + col * 32 + x) * 4;
            const ib = ((row * 32 + y) * blobImg.width + col * 32 + x) * 4;
            assert.deepEqual(
              [...wallImg.data.slice(iw, iw + 4)],
              [...blobImg.data.slice(ib, ib + 4)],
              `occlusion ${JSON.stringify(over)} : dessus mur ≠ blob-47 en case (${col},${row}) pixel ${x},${y}`,
            );
          }
  }
});

test('T38 · l’occlusion des coins reste confinée aux coins rentrants actifs — aucun bord plat, aucun des 16 masques sans coin', () => {
  const zero = renderLogical(wallSettings({ wallCornerOcclusion: 0 })).imageData;
  const brut = renderLogical(wallSettings({ wallCornerOcclusion: 80 })).imageData;
  const tile = 32;
  const pixelAt = (img, row, col, x, y) => {
    const i = ((row * tile + y) * img.width + col * tile + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  };
  // Marge de sécurité autour de chaque coin actif — en L, pas en carré : la boîte
  // d'encoche déborde du bord de tuile de `ext` (radius + roughness + 1) dans l'axe
  // PERPENDICULAIRE à son côté, donc à l'intérieur de la tuile la rampe reste proche
  // du bord tant qu'on est proche EN X *OU* en Y du coin, jamais seulement quand les
  // deux le sont à la fois. Mesuré aux réglages par défaut de cet essai (inset = 4,
  // rampe = inset − 1 = 3) : le pixel le plus loin encore touché est à 5 px d'un des
  // deux bords du coin. 8 px de marge est donc large devant la mesure, jamais un
  // effet de bord de la marge elle-même.
  const MARGE = 8;
  let masquesACoin = 0;
  for (let row = 0; row < WALL_TOP_ROWS; row++)
    for (let col = 0; col < 8; col++) {
      const mask = B47.layout.grid[row][col];
      if (mask === null) continue; // la 48e case, vide par construction (47 est premier)
      const actifs = BLOB_CORNERS.filter((c) => (mask & c.sides) === c.sides && !(mask & c.diagonal));
      let bouge = false;
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          const a = pixelAt(zero, row, col, x, y);
          const b = pixelAt(brut, row, col, x, y);
          // L'alpha ne bouge jamais : l'occlusion est une couleur, jamais une
          // géométrie — aucune couture ne peut s'ouvrir par ce chemin.
          assert.equal(a[3], b[3], `masque ${mask} (case ${col},${row}) pixel ${x},${y} : l'alpha a bougé`);
          if (a[3] === 0) continue;
          const rgbEgal = a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
          if (actifs.length === 0) {
            assert.ok(rgbEgal, `masque ${mask} (case ${col},${row}) pixel ${x},${y} : sans coin rentrant, ne devrait pas bouger`);
            continue;
          }
          if (!rgbEgal) bouge = true;
          const loinDeTout = actifs.every((c) => {
            const prochesX = c.col === 0 ? x < MARGE : x >= tile - MARGE;
            const prochesY = c.row === 0 ? y < MARGE : y >= tile - MARGE;
            return !(prochesX || prochesY);
          });
          if (loinDeTout) assert.ok(rgbEgal, `masque ${mask} (case ${col},${row}) pixel ${x},${y} : la pénombre déborde loin de tout coin actif`);
        }
      if (actifs.length > 0) {
        // Preuve positive : chaque masque à coin rentrant est RÉELLEMENT assombri
        // quelque part — sans quoi les essais ci-dessus passeraient aussi sur un
        // réglage mort.
        assert.ok(bouge, `masque ${mask} (case ${col},${row}) : coin rentrant actif mais aucun pixel assombri`);
        masquesACoin += 1;
      }
    }
  assert.equal(masquesACoin, 31, 'masques à coin rentrant effectivement vérifiés');
});
