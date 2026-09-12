/* Parcours de source 3D : handlers et vues réels, stockage et pixels doublés.
   Ces essais vérifient les contrats de travail/reprise, pas la qualité du rendu. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../docs/maquettes-atelier-unifie/sources-3d.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
let identity = 0;

function atelier(initial) {
  const state = initial ? clone(initial) : {subjects:[{
    id:'hero', name:'Gardien', description:'Gardien des marais',
    movements:['Repos','Marche'], directions:['Sud','Ouest'], results:[]
  }]};
  let reviewCount = 0, saved = '', fields = new Map(), emitted = 0;
  const context = new Proxy({}, {get:(_,key)=>key==='measureText' ? ()=>({width:1}) : ()=>{}});
  const document = {
    querySelector: selector => selector === '#dialog' ? {close(){ fields.clear(); }} : fields.get(selector) || null,
    querySelectorAll: () => [],
    createElement(tag) {
      assert.equal(tag, 'canvas');
      return {width:0,height:0,getContext:()=>context,toDataURL:()=>`data:image/png;test-frame=${++emitted}`};
    }
  };
  const scope = {window:{},document,clearInterval(){},setInterval(){throw Error('Aucun lecteur ne doit tourner dans cet essai');}};
  scope.window.creerRelectureMaquette = () => ({open(){ reviewCount++; fields.clear(); }});
  vm.runInNewContext(code, scope);
  const button = (label, action, attributes='') => `<button data-action="${action}" ${attributes}>${label}</button>`;
  const api = {
    state:()=>state, subject:()=>state.subjects[0], clone,
    id:()=>`test-${++identity}`, esc:value=>String(value??''), button,
    field:(label,html)=>`<label>${label}${html}</label>`, input:()=>'', select:()=>'', heading:()=>'',
    modal(){fields.clear();}, save(){saved=JSON.stringify(state);return true;}, render(){}, toast(){}, navigate(){},
    image:'data:image/png;image-exemple',
    result:(title,animated)=>({id:`result-${++identity}`,title,animated,frames:[],recipe:{fps:8,loop:true},revision:1,chosen:false}),
    openResult(){},openSubject(){},setSubject(){}
  };
  const app = scope.window.creerSources3DMaquette(api);
  const action = (name,dataset={}) => app.handlers[name]({dataset});
  const change = (name,value,type='text') => app.change({name:'s3-'+name,value:String(value),checked:!!value,type,dataset:{}});
  const checkModel = (key,checked) => app.change({checked,dataset:{s3ModelCheck:key}});
  const field = (name,value) => fields.set(`[name="s3-${name}"]`,{value:String(value)});
  const source = () => state.sources3D.find(s=>s.id===state.workspace.source3D.source);
  const lastJob = () => state.source3DJobs.at(-1);
  const queue = kind => {action('s3-review-'+kind);action('s3-confirm-review');return lastJob();};
  const complete = kind => {const job=queue(kind);action('s3-job-success',{id:job.id});return job;};
  return {app,state,action,change,checkModel,field,source,lastJob,queue,complete,
    reviews:()=>reviewCount, persisted:()=>JSON.parse(saved)};
}

function ready() {
  const h=atelier();
  h.action('s3-new',{subject:'hero'});
  h.action('s3-example-image');
  h.change('imageBackground',true,'checkbox');h.change('imageComplete',true,'checkbox');
  h.complete('model');
  for(const key of ['silhouette','separation','scale'])h.checkModel(key,true);
  h.action('s3-validate-model');
  h.complete('rig');h.change('rigCheck',true,'checkbox');h.action('s3-validate-rig');
  h.field('attach-file','Marche · exemple FBX');h.field('attach-movement','Marche');h.field('attach-name','Marche prudente');
  h.action('s3-attach-motion');h.change('motion-inspected',true,'checkbox');h.action('s3-validate-motion');
  return h;
}

function renderButton(h) {
  h.action('s3-step',{step:'5'});
  const match=h.app.views.source3d().match(/<button\b[^>]*data-action="s3-review-render"[^>]*>/);
  assert.ok(match,'La production garde un chemin visible');
  return match[0];
}

for(const [label,invalidate] of [
  ['du modèle',h=>h.checkModel('silhouette',false)],
  ['du squelette',h=>h.change('rigCheck',false,'checkbox')],
  ['du mouvement',h=>h.change('motion-inspected',false,'checkbox')]
]) {
  test(`décocher le contrôle ${label} empêche de relire les rendus`,()=>{
    const h=ready();
    assert.doesNotMatch(renderButton(h),/\bdisabled\b/,'Le parcours contrôlé doit initialement autoriser le rendu');
    invalidate(h);
    assert.match(renderButton(h),/\bdisabled\b/,'La vue rend le contrôle manquant visible avant l’envoi');
    const count=h.reviews();h.action('s3-review-render');
    assert.equal(h.reviews(),count,'Le handler refuse aussi une relecture dont une étape amont n’est plus contrôlée');
  });
}

test('un rendu reprend les paramètres relus et reste intact après réouverture et nouveau rendu',()=>{
  const h=ready();
  h.change('azimuth',37);h.change('motion-fps',11);
  h.change('motion-inspected',true,'checkbox');h.action('s3-validate-motion');
  const job=h.queue('render'), expected=clone(job.payload);
  h.change('azimuth',121);h.change('rig-bend',33);h.change('motion-fps',7);
  h.action('s3-job-success',{id:job.id});
  const old=h.state.subjects[0].results[0];
  assert.equal(old.recipe.fps,11);
  assert.deepEqual(clone(old.source3D.snapshot.camera),expected.camera);
  assert.deepEqual(clone(old.source3D.snapshot.rig),expected.rig);
  assert.deepEqual(clone(old.source3D.snapshot.animation),expected.animations[0]);
  const preserved=clone(old), reopened=atelier(h.persisted());
  reopened.app.ouvrir('hero',reopened.state.workspace.source3D.source);
  reopened.change('rigCheck',true,'checkbox');reopened.action('s3-validate-rig');
  reopened.change('motion-inspected',true,'checkbox');reopened.action('s3-validate-motion');
  reopened.complete('render');
  assert.equal(reopened.state.subjects[0].results.length,2);
  assert.deepEqual(clone(reopened.state.subjects[0].results[0]),preserved,'Anciennes frames, recette et provenance restent inchangées');
  assert.equal(reopened.state.subjects[0].results[1].source3D.snapshot.camera.azimuth,121);
  assert.equal(reopened.state.subjects[0].results[1].recipe.fps,7);
});

test('le nombre de frames reste entier et le pivot accompagne les images vers la retouche',()=>{
  const h=ready();
  h.change('frames',2.5);h.change('pivotX',25);h.change('pivotY',75);
  assert.ok(Number.isInteger(h.source().camera.frames),'Le formulaire normalise les fractions de frame');
  h.action('s3-review-render');h.field('review-frames',7.4);h.action('s3-confirm-review');
  const job=h.lastJob();
  assert.ok(Number.isInteger(job.payload.camera.frames),'La modification dans la relecture garde la même règle');
  h.action('s3-job-success',{id:job.id});
  const result=h.state.subjects[0].results[0];
  assert.equal(result.frames.length,job.payload.camera.frames,'Le travail annoncé produit exactement ce nombre de frames');
  assert.deepEqual(clone(result.recipe.commonFrame),{x:0,y:0,width:64,height:64,pivotX:16,pivotY:48});
  assert.equal(result.source3D.snapshot.camera.pivotX,25);
  assert.equal(result.source3D.snapshot.camera.pivotY,75);
});

test('un travail échoué reprend son instantané sans doubler le travail ni ses résultats',()=>{
  const h=ready(), job=h.queue('render'), payload=clone(job.payload), before=h.state.source3DJobs.length;
  h.action('s3-job-fail',{id:job.id});h.change('azimuth',209);
  h.action('s3-job-retry',{id:job.id});
  assert.equal(h.state.source3DJobs.length,before);
  assert.equal(job.attempts,2);
  assert.deepEqual(clone(job.payload),payload);
  h.action('s3-job-success',{id:job.id});h.action('s3-job-success',{id:job.id});
  assert.equal(h.state.subjects[0].results.length,1,'Un succès déjà enregistré ne produit pas deux animations');
  assert.equal(h.app.consumptionRows().filter(row=>row.id===job.id).length,1);
});
