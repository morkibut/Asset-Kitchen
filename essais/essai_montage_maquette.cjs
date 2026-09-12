/* Contrat de reprise des occurrences du montage autonome, sans DOM ni fournisseur. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../docs/maquettes-atelier-unifie/parcours.js'), 'utf8'), scope);
const clone = value => JSON.parse(JSON.stringify(value));
const source = () => ({ frames: [{ id: 'source-a', source: 0, strokes: [] }, { id: 'source-b', source: 1, strokes: [] }] });
const brush = [{ layer: 'paint', points: [{ x: 13, y: 17 }], colour: '#a8492c', size: 2 }];
function contract() { let next = 0; return scope.window.creerSelectionMontage(() => 'occurrence-' + ++next, clone); }

test('une copie retouchée garde son identité et ses traits après fermeture, déplacement et nouvelle sauvegarde', () => {
  const selection = contract(), montage = { source: source(), selected: [0, 1] };
  selection.preparer(montage);
  selection.dupliquer(montage, 0);
  const saved = { frames: selection.frames(montage), montage: { selected: montage.selected, frameIds: montage.frameIds } };
  const copyId = saved.frames[1].id, originalId = saved.frames[0].id;
  saved.frames[1].strokes = clone(brush);
  const layer = { frameId: copyId, image: 'calque-propre-a-la-copie' };
  const reopened = clone({ source: montage.source, selected: saved.montage.selected, frameIds: saved.montage.frameIds });
  selection.preparer(reopened, clone(saved));
  selection.deplacer(reopened, 1, 2);
  const resaved = clone(selection.frames(reopened, clone(saved.frames)));
  assert.equal(resaved[2].id, copyId);
  assert.deepEqual(resaved[2].strokes, brush);
  assert.deepEqual(resaved.find(f => f.id === originalId).strokes, []);
  assert.ok(resaved.some(f => f.id === layer.frameId), 'Le calque attaché à la copie garde sa frame');
  assert.deepEqual(montage.source.frames[0].strokes, [], 'La source reste intacte');
});

test('un ancien montage sans identifiants d’occurrence conserve les copies déjà retouchées', () => {
  const selection = contract(), saved = {
    frames: [{ id: 'source-a', source: 0, strokes: [] }, { id: 'ancienne-copie', source: 0, strokes: clone(brush) }, { id: 'source-b', source: 1, strokes: [] }],
    montage: { selected: [0, 0, 1] }
  };
  const reopened = clone({ source: source(), selected: saved.montage.selected });
  selection.preparer(reopened, clone(saved));
  selection.inverser(reopened);
  const resaved = clone(selection.frames(reopened, clone(saved.frames)));
  assert.deepEqual(resaved.map(f => f.id), ['source-b', 'ancienne-copie', 'source-a']);
  assert.deepEqual(resaved[1].strokes, brush);
  assert.deepEqual(resaved[2].strokes, []);
});

test('le passage prend son temps sur les frames disponibles, jamais sur la durée demandée au modèle', () => {
  const clip = {frames: Array.from({length:5}, (_,i) => ({id:'f'+i})), recipe:{fps:8}, request:{duration:5}};
  const range = scope.window.parametresTempsMontage(clip, .125, .5, 1);
  assert.equal(range.duration, .625, 'Cinq frames à huit images/s représentent .625 s, pas les cinq secondes demandées');
  assert.deepEqual(clone(range.indices), [1,2,3]);
  assert.deepEqual(clone(scope.window.parametresTempsMontage(clip, .13, .5, 1).indices), [2,3], 'Une frame antérieure au début ne rentre pas dans le passage');
});

test('échantillonner un passage conserve les identités et les retouches des occurrences gardées', () => {
  const selection = contract(), clip = {frames: Array.from({length:5}, (_,i) => ({id:'f'+i,strokes:[]})), videoMeta:{fps:10}, recipe:{fps:8}};
  const montage = {source:clip,selected:[0,1,2,3,4]};
  selection.preparer(montage);
  const saved = selection.frames(montage);saved[3].strokes=clone(brush);
  const range = scope.window.parametresTempsMontage(clip,.1,.5,2);
  selection.choisir(montage,range.indices);
  const output=clone(selection.frames(montage,saved));
  assert.deepEqual(output.map(f=>f.id), ['f1','f3']);
  assert.deepEqual(output[1].strokes,brush);
  assert.deepEqual(clip.frames[3].strokes,[], 'Le clip brut est conservé');
});

test('un clip hérite du mouvement et de la direction demandés, puis rouvre le choix modifié par l’auteur', () => {
  const state = {cleanup2256:true,subjects:[{id:'hero',name:'Héros',movements:['Repos','Marche'],directions:['Sud','Ouest'],results:[]}],media:[{id:'clip',type:'Vidéo',title:'Clip demandé',request:{movement:'Marche',direction:'Ouest'},frames:source().frames,recipe:{fps:8,loop:true}}],employments:[],collections:[],freeJobs:[],remarks:[]};
  let next=0,page='source';
  scope.document={querySelector:()=>({close(){}})};
  scope.window.creerEquipementsMaquette=()=>({views:{},handlers:{}});
  scope.window.creerRelectureMaquette=()=>({});
  const parcours=scope.window.creerParcoursMaquette({state:()=>state,id:()=>''+(++next),clone,save(){},navigate:p=>page=p,result(){throw Error('La source existante doit être retrouvée');}});
  parcours.openMontage('clip','hero');
  assert.equal(page,'montage');
  assert.equal(state.montageDrafts['clip:new'].movement,'Marche');
  assert.equal(state.montageDrafts['clip:new'].direction,'Ouest');
  assert.equal(state.montageDrafts['clip:new'].name,'Marche · Ouest');
  state.montageDrafts['clip:new'].movement='Repos';
  state.montageDrafts['clip:new'].name='Attente hésitante';
  parcours.openMontage('clip','hero');
  assert.equal(state.montageDrafts['clip:new'].movement,'Repos','Une reprise garde le choix explicite du brouillon');
  assert.equal(state.montageDrafts['clip:new'].name,'Attente hésitante');
});
