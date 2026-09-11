/* Associer le rendu courant à une pièce sans déplacer ni détruire sa source. */
window.creerAttributionEquipement=(api,context)=>{
  const {esc,button,field,input,select,modal,save,render,toast,id,clone}=api;
  const {assure,targets,freshLayer,openEmployment,raster}=context;
  const st=api.state,$=s=>document.querySelector(s),val=n=>$(`[name="${n}"]`)?.value||'';
  let draft=null;
  const roles=['Référence de la pièce','Personnage portant la pièce','Calque transparent de la pièce'];
  function capture(){if(!draft||!$('[name="ea-role"]'))return;Object.assign(draft,{role:val('ea-role'),piece:val('ea-piece'),name:val('ea-name'),person:val('ea-person'),key:val('ea-target')});}
  function form(){
    const people=st().subjects.filter(s=>['Personnages','Monstres'].includes(s.family)),pieces=st().subjects.filter(s=>s.family==='Équipement');
    if(!people.some(s=>s.id===draft.person))draft.person=people[0]?.id||'';
    const ts=draft.person?targets({subject:draft.person}):[];
    if(!ts.some(t=>t.key===draft.key))draft.key=ts[0]?.key||'';
    modal('Utiliser cette image comme équipement',`<p>La frame affichée, avec ses retouches, sera associée à la pièce. L’image d’origine reste à sa place.</p>${field('Ce que contient cette image',select('ea-role',roles,draft.role))}<p>${draft.role===roles[0]?'Une image de référence décrit l’épée, le casque ou le sac ; elle ne compte pas comme calque porté.':draft.role===roles[1]?'Le personnage et son équipement sont encore réunis : cette image servira à extraire le calque.':'L’image contient seulement la pièce sur fond transparent : vous pourrez ajuster sa superposition.'}</p>${field('Équipement',`<select name="ea-piece"><option value="new">Créer une nouvelle pièce</option>${pieces.map(p=>`<option value="${p.id}" ${draft.piece===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`)}${draft.piece==='new'?field('Nom de la nouvelle pièce',input('ea-name',draft.name)):''}${draft.role!==roles[0]?`${field('Personnage qui la porte',`<select name="ea-person">${people.map(p=>`<option value="${p.id}" ${draft.person===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>`)}${field('Pose, direction et frame de base',`<select name="ea-target">${ts.map(t=>`<option value="${esc(t.key)}" ${draft.key===t.key?'selected':''}>${esc(t.m+' · '+t.d+(t.r.animated?' · frame '+(t.i+1):' · image fixe'))}</option>`).join('')}</select>`)}${!ts.length?'<p>Aucune base pour ce personnage : préparez son image ou son animation avant de lui associer un calque.</p>':''}`:''}`,button('Annuler','close')+button('Garder les retouches et associer','ea-confirm',draft.role!==roles[0]&&!ts.length?'disabled':'class="rust"'));
  }
  const handlers={
    'eq-assign-image':()=>{const source=api.editorSnapshot();if(!source){toast('Ouvrez une image ou une frame à retoucher.');return;}draft={source,role:roles[0],piece:'new',name:'Nouvel équipement',person:source.subjectId,key:source.r.id+':'+source.r.frames[source.index].id};form();},
    'ea-confirm':async()=>{
      capture();if(draft.piece==='new'&&!draft.name.trim()){toast('Nommez la nouvelle pièce.');return;}
      const c=document.createElement('canvas');c.width=c.height=64;await raster.paint(c,draft.source.r,draft.source.index,[]);const image=c.toDataURL();
      let target=draft.role===roles[0]?null:targets({subject:draft.person}).find(t=>t.key===draft.key);if(draft.role!==roles[0]&&!target){toast('Choisissez une frame de base existante.');return;}
      api.saveEditor();
      if(target)target=targets({subject:draft.person}).find(t=>t.key===draft.key);
      let p=st().subjects.find(s=>s.id===draft.piece);
      if(!p){p={id:id(),name:draft.name.trim(),family:'Équipement',description:'Pièce définie depuis une image existante.',equipmentKind:'Autre',goal:'Images fixes',movements:['Référence'],directions:[],results:[],equipment:[]};st().subjects.push(p);}
      let e=null;
      if(draft.role===roles[0]){const r=api.result('Référence de '+p.name,false);r.frames[0].image=image;r.provenance='Copie du rendu de '+draft.source.r.title;p.results.push(r);}
      else{e=assure(p.id,draft.person);const base=document.createElement('canvas');base.width=base.height=64;await raster.paint(base,target.r,target.i,[]);const old=e.layers[target.key],history=old?clone(old.history||[]):[];if(old){const previous=clone(old);delete previous.history;history.push(previous);}const l=freshLayer(e,target,{base:base.toDataURL(),source:draft.role===roles[1]?image:null});if(draft.role===roles[2]){l.image=image;l.status='À vérifier';}l.history=history;e.layers[target.key]=l;}
      const original=st().subjects.flatMap(s=>s.results).find(r=>r.id===draft.source.r.id);if(original){original.equipmentLinks??=[];original.equipmentLinks.push({piece:p.id,employment:e?.id||null,role:draft.role,frame:draft.source.r.frames[draft.source.index].id});}
      save();$('#dialog').close();if(e)openEmployment(p.id,e.subject);else api.openSubject(p.id,'equipment');toast('Image associée à l’équipement ; source conservée.');
    }
  };
  function change(el){if(!el.name?.startsWith('ea-'))return false;if(['ea-role','ea-piece','ea-person'].includes(el.name)){capture();form();}return true;}
  return {handlers,change};
};
