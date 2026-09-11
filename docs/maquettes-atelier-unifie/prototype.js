/* Maquette autonome. Les données réelles, l'API et les fournisseurs ne sont jamais ouverts. */
(() => {
  'use strict';
  const KEY = 'asset-kitchen-prototype-02-v1';
  const IMAGE = '../../interface/public/vignettes/taille-64.png';
  const FAMILIES = ['Personnages', 'Objets', 'Décors', 'Interface', 'Équipement'];
  const DIRECTIONS = ['Sud', 'Ouest', 'Est', 'Nord'];
  const TOOLS = ['Main', 'Détourage', 'Recadrage', 'Grille', 'Couleurs', 'Nettoyage', 'Contour', 'Retourner', 'Calques', 'Découpe', 'Différence'];
  const NAMES = {home:'Le jeu', universe:'Univers & toile', library:'Les assets', subject:'Fiche de l’asset', editor:'Retouche', jobs:'Fabrications', delivery:'Livrer au jeu', settings:'Réglages', guide:'Essayer la maquette', compare:'Comparer', source:'Source 3D', remarks:'Vos remarques'};
  const clone = x => JSON.parse(JSON.stringify(x));
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const freshRecipe = () => ({fps:8,loop:true,brightness:100,saturation:100,flip:false,grid:false,size:64,brush:2,colour:'#a8492c',erase:false,opacity:100,background:'Conserver',crop:0,clean:0,outline:0,layer:'Retouche',settings:{}});
  const result = (title, animated=true) => ({id:id(),title,animated,frames:Array.from({length:animated?5:1},(_,i)=>({id:id(),source:i,strokes:[]})),recipe:freshRecipe(),favorite:false,chosen:false,revision:1,provenance:'Exemple préparé pour la maquette',savedAt:null});
  function seed() {
    const walk=result('Marche · Sud'); walk.chosen=true;
    const portrait=result('Référence',false);
    return {version:1,game:{name:'Les marais d’ambre',description:'Un pèlerin traverse des marais habités. La lumière des lanternes révèle les chemins.',style:'Pixel art lisible, silhouettes simples, verts sourds et lumière ambrée.',size:64,directions:DIRECTIONS.slice()},
      subjects:[{id:'pelerin',name:'Le pèlerin',family:'Personnages',goal:'Animations',description:'Petit voyageur encapuchonné. Sa lanterne reste visible pendant la marche.',movements:['Repos','Marche'],directions:DIRECTIONS.slice(),results:[walk,portrait],equipment:[]},
        {id:'lanterne',name:'La lanterne',family:'Équipement',goal:'Images fixes',description:'Lanterne portée, posée au sol et icône d’inventaire.',movements:['Repos'],directions:['Sud'],results:[result('Icône',false)],equipment:[]}],
      jobs:[],deliveries:[],recipes:[],remarks:[],checks:{},policy:{local:true,paid:false,budget:1,attempts:2,provisional:true},providers:{local:true,api:false},destination:'res://assets/atelier/',
      canvas:{zoom:100,islands:[{id:'ile1',title:'Ambiance des marais',x:45,y:40},{id:'ile2',title:'Habitants & histoires',x:700,y:90}],links:[['note1','note3']],cards:[
        {id:'note1',kind:'note',title:'Une lumière qui guide',text:'La lanterne donne une direction. Éviter les grandes zones lumineuses.',x:80,y:110,island:'ile1'},
        {id:'note2',kind:'image',title:'Le voyageur',text:'Silhouette de départ, à éprouver en mouvement.',image:IMAGE,x:330,y:110,island:'ile1'},
        {id:'note3',kind:'note',title:'Le passeur',text:'Un personnage qui échange des souvenirs contre un passage.',x:740,y:160,island:'ile2'}]}};
  }
  let state;
  try { const saved=JSON.parse(localStorage.getItem(KEY)); state=saved?.version===1?saved:seed(); } catch {state=seed();}
  let page='home', subjectId='pelerin', tab='animations', settingsTab='universe', resultId=null;
  let draft=null, dirty=false, selectedFrames=[0], cursor=0, tool='Main', scope='frame', playing=null, undo=[], redo=[];
  let filter='', family='', favoriteOnly=false, canvasSelected=null, linkFrom=null, compareIds=[];
  let request=null, feedbackContext=null, confirmAction=null, messageTimer=null, storageWarned=false;
  const $ = (selector,base=document) => base.querySelector(selector);
  const $$ = (selector,base=document) => [...base.querySelectorAll(selector)];
  const main=$('#main'), dialog=$('#dialog');
  const spriteSheet=new Image(); spriteSheet.src='marche-demo.png';
  const reference=new Image(); reference.src=IMAGE;
  spriteSheet.onload=()=>drawAll(); reference.onload=()=>drawAll();
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(state));}
    catch {if(!storageWarned){storageWarned=true; toast('Stockage du navigateur indisponible ou plein : cette séance reste en mémoire. Exportez vos remarques avant de fermer.');}}
  }
  function toast(text) { $('#message').textContent=text; clearTimeout(messageTimer); messageTimer=setTimeout(()=>$('#message').textContent='',6500); }
  const currentSubject = () => state.subjects.find(s=>s.id===subjectId) || state.subjects[0];
  const currentResult = () => currentSubject().results.find(r=>r.id===resultId);
  const button=(label,action,attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`;
  const go=(label,target,attrs='')=>`<button data-page="${target}" ${attrs}>${label}</button>`;
  const option=(values,value)=>values.map(x=>`<option ${x===value?'selected':''}>${esc(x)}</option>`).join('');
  const field=(label,input)=>`<label class="field">${label}${input}</label>`;
  const input=(name,value,type='text',attrs='')=>`<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}>`;
  const select=(name,values,value)=>`<select name="${name}">${option(values,value)}</select>`;
  const demo=text=>`<p class="demo">${text}</p>`;
  const heading=(title,description,actions='')=>`<div class="heading"><div><h1>${esc(title)}</h1><p class="muted">${description}</p></div><div class="row wrap">${actions}</div></div>`;
  function modal(title,body,actions='') {
    dialog.innerHTML=`<div class="row between"><h2 id="dialog-title">${title}</h2>${button('Fermer','close','aria-label="Fermer la fenêtre"')}</div>${body}<footer>${actions}</footer>`;
    if(!dialog.open) dialog.showModal();
  }
  function stop() { clearInterval(playing); playing=null; }
  function leave(action) {
    if(dirty){confirmAction=action; modal('Garder les retouches ?', '<p>La version de démonstration ouverte a des modifications. Vous pourrez la rouvrir avec ses réglages.</p>',button('Continuer à retoucher','close')+button('Quitter sans garder','discard-leave')+button('Garder et continuer','save-leave'));}
    else action();
  }
  function navigate(target) {leave(()=>{stop();page=target;render();main.focus({preventScroll:true});});}
  function render() {
    const pending=state.jobs.filter(j=>j.status==='En attente').length;
    $('#sidebar').innerHTML=`<div class="brand">Asset Kitchen</div><div class="game"><div class="label">Le jeu ouvert</div><h3>${esc(state.game.name)}</h3><small>Pixel art · ${state.game.size} px · ${state.subjects.length} assets</small></div>
      <nav aria-label="Atelier">${[['home','Le jeu'],['universe','Univers & toile'],['library','Les assets'],['jobs',`Fabrications${pending?' · '+pending:''}`],['delivery','Livrer au jeu']].map(([p,n])=>go(n,p,page===p?'aria-current="page"':'')).join('')}</nav>
      <nav aria-label="Préférences">${go('Réglages', 'settings',page==='settings'?'aria-current="page"':'')}${go('Essayer la maquette','guide',page==='guide'?'aria-current="page"':'')}${go(`Vos remarques · ${state.remarks.length}`,'remarks')}</nav>
      <div class="sidefoot"><p class="small">Vos essais restent dans ce navigateur. Les images sont des exemples du dépôt. Polices de repli si absentes.</p><a href="couverture.md">Couverture et limites</a><br><a href="../pistes-2026-09-04/carnet/Sommaire.html">Planches de référence</a></div>`;
    const views={home,universe,library,subject,editor,jobs,delivery,settings,guide,compare,source,remarks};
    main.innerHTML=`<div class="crumb">${esc(state.game.name)} / ${esc(NAMES[page])}</div>${views[page]()}`;
    if(page==='editor') {
      $$('[name]', $('#tool-content')).forEach(el=>{const v=draft.recipe.settings[`${tool}:${el.name}`];if(v!==undefined&&!el.dataset.recipe&&!el.dataset.setting)el.value=v;});
      if(!draft.animated){$$('[data-action="duplicate"],[data-action="move-frame"],[data-action="select-all"],[data-action="remove-frame"]').forEach(b=>b.disabled=true);$('#scope').disabled=true;}
      drawAll();
    }
    if(page==='universe') wireCanvas();
    if(page==='compare') drawComparisons();
  }
  function home() {
    const total=state.subjects.reduce((n,s)=>n+s.results.length,0), chosen=state.subjects.flatMap(s=>s.results).filter(r=>r.chosen).length;
    return heading(state.game.name,'Imaginer le monde, fabriquer ce qui lui appartient, puis le voir dans le jeu.',button('Créer un asset','new-subject'))+
      `<div class="two"><section class="surface"><div class="label">Créer librement</div><h2>L’univers commence sur la toile</h2><p>Références, notes et îlots restent à portée de main. Les règles de génération se préparent à côté.</p>${go('Ouvrir la toile','universe')}</section><section class="surface"><div class="label">À fabriquer</div><h2>Un personnage en mouvement</h2><p>Le pèlerin a une marche. Choisissez les autres mouvements et les directions utiles à votre jeu.</p>${button('Ouvrir le pèlerin','subject','data-id="pelerin"')}</section></div>
      <div class="three space"><div class="surface"><h2>${state.subjects.length} assets</h2><p>${total} résultats, tous conservés dans la bibliothèque.</p>${go('Parcourir les assets','library')}</div><div class="surface"><h2>${chosen} retenu${chosen>1?'s':''}</h2><p>Le choix pour le jeu est distinct du favori.</p>${go('Préparer la livraison','delivery')}</div><div class="surface"><h2>Un essai guidé</h2><p>Testez sans MCP, déplacez les notes, corrigez une frame et notez les frictions.</p>${go('Commencer la visite','guide')}</div></div>
      ${demo('Le prototype teste l’organisation et les manipulations. Les services IA, le traitement fidèle des pixels et l’écriture Godot appartiennent à l’application à construire.')}`;
  }
  function library() {
    const subjects=state.subjects.filter(s=>(!family||s.family===family)&&(!favoriteOnly||s.results.some(r=>r.favorite))&&`${s.name} ${s.description}`.toLowerCase().includes(filter.toLowerCase()));
    return heading('Les assets','Personnages, objets, décors, interface et équipements partagent la même bibliothèque.',button('Créer un asset','new-subject'))+
      `<div class="toolbar"><label>Rechercher <input id="search" value="${esc(filter)}" placeholder="Nom ou description"></label><label>Famille <select id="family"><option value="">Toutes</option>${option(FAMILIES,family)}</select></label><label><input id="favorites" type="checkbox" ${favoriteOnly?'checked':''}> Avec un favori</label></div>
      <div class="three">${subjects.map(s=>`<article class="surface asset-card"><div class="sprite"><img src="${esc(s.image||IMAGE)}" alt="Exemple visuel — ${esc(s.name)}"></div><div><div class="label">${esc(s.family)} · ${esc(s.goal)}</div><h2>${esc(s.name)}</h2><p class="small">${s.results.length} résultats · ${s.results.filter(r=>r.chosen).length} retenus pour le jeu</p></div><div class="row">${button('Ouvrir','subject',`data-id="${s.id}"`)}</div></article>`).join('')}</div>
      ${!subjects.length?`<div class="empty"><h2>Aucun asset ici</h2><p>Essayez une autre recherche ou créez le premier.</p>${button('Créer un asset','new-subject')}</div>`:''}
      <details class="space"><summary>À venir : tuiles et son</summary><p>Ces deux familles restent dans la feuille de route. Leur atelier spécialisé sera maquetté à partir de vrais cas d’usage ; il n’existe pas encore dans cette proposition.</p></details>`;
  }
  function subject() {
    const s=currentSubject();
    return heading(s.name,`${esc(s.family)} · ${esc(s.goal)}`,button('Importer','import')+button('Fabriquer…','request','class="rust"'))+
      `<div class="subject"><div class="sprite">${s.image||s.results.some(r=>!r.animated)?`<img src="${esc(s.image||IMAGE)}" alt="Référence du sujet">`:'<small>Référence<br>à créer</small>'}</div><div><p>${esc(s.description)}</p><div class="row wrap"><span class="tag">${s.results.length} résultats</span><span class="tag">${s.results.filter(r=>r.chosen).length} pour le jeu</span>${button('Modifier la fiche','edit-subject')}</div></div></div>
      <div class="tabs">${[['animations','Animations'],['images','Images fixes'],['sources','Sources & clips'],['equipment','Équipement'],['brief','Objectif & règles']].map(([t,n])=>button(n,'tab',`data-tab="${t}" aria-pressed="${tab===t}"`)).join('')}</div>${subjectTab(s)}`;
  }
  function resultCard(r) {
    return `<article class="surface asset-card"><div class="row between"><h3>${esc(r.title)}</h3><span class="tag">v${r.revision}</span></div><div class="sprite"><img src="${esc(r.image||IMAGE)}" alt="${r.image?'Image importée':'Exemple du résultat'}"></div><p class="small">${r.animated?r.frames.length+' frames · '+r.recipe.fps+' i/s':'Image fixe'} · ${esc(r.provenance)}</p><div class="row wrap">${button('Retoucher','edit-result',`data-id="${r.id}"`)}${button(r.favorite?'★ Favori':'☆ Favori','favorite',`data-id="${r.id}" aria-pressed="${r.favorite}"`)}${button(r.chosen?'Retenu pour le jeu':'Choisir pour le jeu','choose',`data-id="${r.id}" aria-pressed="${r.chosen}"`)}</div><div class="row wrap">${button('Comparer','compare-add',`data-id="${r.id}"`)}${button('Écarter','discard-result',`data-id="${r.id}" class="quiet"`)}</div></article>`;
  }
  function subjectTab(s) {
    if(tab==='animations') return `<div class="row between"><h2>Les mouvements utiles au jeu</h2>${button('Choisir mouvements & directions','objectives')}</div><div class="table-wrap"><table class="matrix"><thead><tr><th>Mouvement</th>${s.directions.map(d=>`<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${s.movements.map(m=>`<tr><td>${esc(m)}</td>${s.directions.map(d=>{const r=s.results.find(r=>r.animated&&r.title===`${m} · ${d}`);return `<td>${r?button(r.chosen?'Retenu · ouvrir':'À regarder','edit-result',`data-id="${r.id}"`):button('À créer','request',`data-movement="${esc(m)}" data-direction="${esc(d)}" class="missing"`)}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div><p class="note">Une image fixe ne remplit jamais une case d’animation. Créez seulement les mouvements utiles.</p><div class="two">${s.results.filter(r=>r.animated).map(resultCard).join('')}</div>`;
    if(tab==='images') return `<div class="row between"><div><h2>Images fixes & références</h2><p>Portrait, illustration, objet ou pose isolée : ce sont des sorties à part entière.</p></div>${button('Fabriquer une image','request','data-kind="image"')}</div><div class="two">${s.results.filter(r=>!r.animated).map(resultCard).join('')}</div>`;
    if(tab==='sources') return `<div class="two"><section class="surface"><h2>Images et clips</h2><p>Une source reste disponible après les retouches. Importez une image réelle pour tester le parcours ; le clip ci-dessous est représenté par une séquence de démonstration.</p>${button('Importer une image ou un clip','import')}<div class="line"><strong>Clip de marche · exemple</strong><p class="small">Séquence préparée depuis un banc existant du dépôt.</p>${button('Découper en animation','sample-clip')}</div></section><section class="surface"><h2>Modèle 3D réutilisable</h2><p>Un modèle, son rig, ses mouvements et plusieurs rendus vers les sprites.</p>${go('Explorer le parcours 3D','source')}</section></div>`;
    if(tab==='equipment') return `<div class="surface"><h2>Ce que le personnage porte</h2><p>Un équipement garde ses emplois : porté, au sol, icône. Le calque porté s’attache à un corps et à une animation.</p>${button('Associer une pièce','equipment')}<div class="space">${s.equipment.length?s.equipment.map((e,i)=>`<div class="line row between"><span>${esc(e)} · main droite · emploi porté</span>${button('Retirer','remove-equipment',`data-index="${i}"`)}</div>`).join(''):'<p class="muted">Aucune pièce associée à ce sujet.</p>'}</div>${demo('L’association et sa relecture fonctionnent. Le calage visuel, l’extraction par différence et les calques animés complexes restent à détailler ; leurs outils actuels doivent être conservés.')}</div>`;
    return `<div class="two"><section class="surface"><h2>Ce que je veux obtenir</h2><p>${esc(s.goal)} · ${s.movements.map(esc).join(', ')} · ${s.directions.map(esc).join(', ')}</p>${button('Modifier l’objectif','objectives')}<h3 class="space">Consignes du sujet</h3><p>${esc(s.description)}</p>${button('Modifier la fiche','edit-subject')}</section><section class="surface"><h2>Hérité de l’univers</h2><p>${esc(state.game.style)}</p><p>Grille : ${state.game.size} px. Les références choisies seront relues avant chaque envoi.</p>${go('Règles du jeu','settings')}</section></div>`;
  }
  function universe() {
    const c=state.canvas;
    return heading('Univers & toile','Réunissez images, textes et idées. Déplacez une carte par son titre, un îlot par son nom.',go('Règles de l’univers','settings'))+
      `<div class="toolbar">${button('+ Note','canvas-note')}${button('+ Image','canvas-image')}${button('+ Îlot','canvas-island')}${button(linkFrom?'Annuler le lien':'Relier deux cartes','canvas-link')}<label>Zoom <select id="canvas-zoom">${[60,80,100,120].map(v=>`<option value="${v}" ${c.zoom===v?'selected':''}>${v} %</option>`).join('')}</select></label>${button('Modifier la carte choisie','canvas-edit',canvasSelected?'':'disabled')}${button('Supprimer la carte','canvas-delete',canvasSelected?'':'disabled')}</div>
      <p class="canvas-help">${linkFrom==='pick'?'Choisissez la première carte.':linkFrom?'Choisissez la carte à relier.':'Double-cliquez une carte pour l’annoter. Les barres de défilement déplacent le regard. Les positions sont gardées.'}</p>
      <div class="canvas-view"><div class="canvas-size" style="width:${1400*c.zoom/100}px;height:${900*c.zoom/100}px"><div class="world" style="transform:scale(${c.zoom/100})">${c.islands.map(i=>`<section class="island" data-island="${i.id}" style="left:${i.x}px;top:${i.y}px"><button class="island-handle" data-drag-island="${i.id}" aria-label="Déplacer l’îlot ${esc(i.title)}">${esc(i.title)}</button></section>`).join('')}<svg aria-hidden="true">${canvasLines()}</svg>${c.cards.map(card=>`<article tabindex="0" aria-label="Carte ${esc(card.title)}" class="canvas-card ${canvasSelected===card.id?'selected':''}" data-card="${card.id}" style="left:${card.x}px;top:${card.y}px"><header data-drag-card="${card.id}">${esc(card.title)}</header>${card.kind==='image'?`<img draggable="false" src="${esc(card.image||IMAGE)}" alt="${esc(card.title)}">`:''}<p>${esc(card.text)}</p>${button('Annoter','canvas-edit',`data-id="${card.id}" class="quiet"`)}</article>`).join('')}</div></div></div>
      <div class="two space"><section><h3>Le monde que l’on imagine</h3><p>${esc(state.game.description)}</p></section><section><h3>Des idées aux règles</h3><p>Une note libre ne devient pas une consigne de génération sans votre choix. Les règles du jeu restent lisibles à côté de cette exploration.</p></section></div>`;
  }
  function canvasLines() {
    return state.canvas.links.map(([a,b])=>{const x=state.canvas.cards.find(c=>c.id===a),y=state.canvas.cards.find(c=>c.id===b);return x&&y?`<line x1="${x.x+100}" y1="${x.y+70}" x2="${y.x+100}" y2="${y.y+70}" stroke="var(--muted)" stroke-width="2"/>`:'';}).join('');
  }
  function wireCanvas() {
    $$('[data-drag-card],[data-drag-island]').forEach(el=>el.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const island=el.dataset.dragIsland, target=island?state.canvas.islands.find(i=>i.id===island):state.canvas.cards.find(c=>c.id===el.dataset.dragCard);
      const targets=[target,...(island?state.canvas.cards.filter(c=>c.island===island):[])];
      const start=targets.map(t=>({x:t.x,y:t.y})),x=e.clientX,y=e.clientY,z=state.canvas.zoom/100;
      let moved=false; el.setPointerCapture(e.pointerId);
      function move(ev){let dx=(ev.clientX-x)/z,dy=(ev.clientY-y)/z; if(Math.abs(dx)+Math.abs(dy)<3&&!moved)return;moved=true;
        const width=island?580:200,height=island?410:260;
        dx=Math.max(-targetStart.x,Math.min(1400-width-targetStart.x,dx));dy=Math.max(-targetStart.y,Math.min(900-height-targetStart.y,dy));
        targets.forEach((t,i)=>{t.x=start[i].x+dx;t.y=start[i].y+dy; const node=$(`[data-${i===0&&island?'island':'card'}="${t.id}"]`);node.style.left=t.x+'px';node.style.top=t.y+'px';});
        $('.world svg').innerHTML=canvasLines();}
      const targetStart=start[0];
      function end(){el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);save();if(moved){el.dataset.moved='yes';setTimeout(()=>delete el.dataset.moved,0);}}
      el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
    }));
    $$('[data-card]').forEach(el=>{el.addEventListener('click',e=>{if(e.target.closest('button')||e.target.dataset.moved)return;canvasSelected=el.dataset.card;
      if(linkFrom==='pick'){linkFrom=canvasSelected;render();}else if(linkFrom){if(linkFrom!==canvasSelected){state.canvas.links.push([linkFrom,canvasSelected]);save();}linkFrom=null;render();}else{$$('.canvas-card').forEach(c=>c.classList.toggle('selected',c===el));$$('[data-action="canvas-edit"],[data-action="canvas-delete"]',main).forEach(b=>b.disabled=false);}});
      el.addEventListener('dblclick',e=>{if(!e.target.closest('button'))editCard(el.dataset.card);});
      el.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target===el)editCard(el.dataset.card);});});
  }
  function editor() {
    if(!draft) return '<p>Aucun résultat ouvert.</p>'+go('Revenir aux assets','library');
    return heading(draft.title,`${esc(currentSubject().name)} · version ${draft.revision} · <span id="dirty" class="${dirty?'dirty':''}">${dirty?'Modifications à garder':'Version gardée'}</span>`,go('Retour à l’asset','subject')+button('Garder les retouches','save-editor'))+
      `<div class="editor"><section><div class="toolbar">${button(playing?'Pause':'Lire','play',draft.animated?'':'disabled')}${button('Annuler','undo',undo.length?'':'disabled')}${button('Rétablir','redo',redo.length?'':'disabled')}${button('Comparer à la source','compare-source')}</div><div class="sprite editor-preview ${draft.recipe.grid?'grid':''}"><canvas id="pixels" width="64" height="64" aria-label="Image à retoucher, peindre avec la souris"></canvas></div>
      <p class="small" id="frame-status">Frame ${cursor+1} / ${draft.frames.length} · ${draft.animated?'clic : choisir · Ctrl ou ⌘ + clic : sélection multiple':'image fixe'}</p><div class="timeline" aria-label="Frames">${draft.frames.map((f,i)=>`<button class="frame" data-action="frame" data-index="${i}" aria-label="Frame ${i+1}" aria-pressed="${selectedFrames.includes(i)}"><canvas width="64" height="64" data-frame="${i}"></canvas><span>${i+1}</span></button>`).join('')}</div>
      <div class="toolbar">${button('Tout sélectionner','select-all')}${button('Dupliquer','duplicate')}${button('← Avancer','move-frame','data-delta="-1"')}${button('Reculer →','move-frame','data-delta="1"')}${button('Retirer','remove-frame',draft.frames.length>selectedFrames.length?'':'disabled')}${button('Extraire une image','extract-frame',draft.animated?'':'disabled')}</div>
      ${draft.animated?`<div class="two">${field('Vitesse (images/s)',input('fps',draft.recipe.fps,'number','min="1" max="60" data-recipe="fps"'))}<label class="row"><input type="checkbox" data-recipe="loop" ${draft.recipe.loop?'checked':''}> Boucler</label></div>`:''}
      ${demo('Lecture, ordre des frames, peinture, annulation et sauvegarde fonctionnent. La séquence visuelle est un exemple. Les filtres sont des aperçus simplifiés, pas les moteurs de retouche de l’app.')}</section>
      <section class="surface"><div class="label">Les tables de retouche</div><h2>Corriger le résultat</h2><div class="tool-tabs">${TOOLS.map(t=>button(t,'tool',`data-tool="${t}" aria-pressed="${tool===t}" class="${tool===t?'chosen':''}"`)).join('')}</div>
      ${field('Appliquer les prochains gestes à',`<select id="scope">${option(['Cette frame','Les frames sélectionnées','Toute l’animation'],{frame:'Cette frame',selection:'Les frames sélectionnées',all:'Toute l’animation'}[scope])}</select>`)}<p class="small">La peinture suit cette portée. Vitesse, boucle et aperçu des filtres concernent le résultat entier dans cette version de la maquette.</p>
      <div id="tool-content">${toolPanel()}</div><hr><div class="row wrap">${button('Nommer une recette','save-recipe')}${button('Réappliquer une recette','load-recipe')}</div></section></div>`;
  }
  const range=(label,key,min,max)=>field(`${label} · ${draft.recipe[key]}`,input(key,draft.recipe[key],'range',`min="${min}" max="${max}" data-recipe="${key}"`));
  function toolPanel() {
    if(tool==='Main') return `<h3 class="space">La main</h3><p class="small">Peignez directement dans l’aperçu. Chaque geste se garde sur un calque séparé de la source.</p>${range('Taille du pinceau','brush',1,8)}${field('Couleur du pinceau',input('colour',draft.recipe.colour,'color','data-recipe="colour"'))}<label class="row"><input type="checkbox" data-recipe="erase" ${draft.recipe.erase?'checked':''}> Gomme du calque peint</label>${button('Effacer les traits de la portée','clear-strokes','class="space"')}`;
    if(tool==='Détourage') return `<h3 class="space">Détourage</h3>${field('Méthode',select('background',['Conserver','Couleur du fond','Modèle CPU'],draft.recipe.background).replace('<select','<select data-recipe="background"'))}${draft.recipe.background==='Couleur du fond'?genericRange('Tolérance',0,100,20):'<p class="small">La tolérance de couleur ne s’applique pas à cette méthode.</p>'}${draft.recipe.background==='Modèle CPU'?field('Moteur',select('engine',['isnet-general-use','u2net'],'isnet-general-use')):''}${demo('La disposition et la disponibilité des réglages sont testables. Aucun modèle de détourage ne tourne dans cette maquette ; l’image de départ reste identique.')}`;
    if(tool==='Recadrage') return `<h3 class="space">Cadre commun</h3>${range('Marge dans l’aperçu','crop',0,16)}${field('Ancrage',select('anchor',['Centre','Pieds','Origine commune'],'Pieds'))}${demo('La marge modifie l’aperçu. Le cadre commun, la boîte de sélection et le pivot doivent être éprouvés avec les vrais clips pendant AU4/AU5.')}`;
    if(tool==='Grille') return `<h3 class="space">Grille & réduction</h3>${field('Taille de sortie',select('size',[16,32,48,64,96,128].map(String),String(draft.recipe.size)).replace('<select','<select data-recipe="size"'))}<label class="row"><input type="checkbox" data-recipe="grid" ${draft.recipe.grid?'checked':''}> Montrer les repères</label>${demo('Le choix de taille est gardé. L’aperçu reste sur une toile de 64 px pour tester les gestes ; pas de conversion exportable.')}`;
    if(tool==='Couleurs') return `<h3 class="space">Palette</h3>${range('Lumière','brightness',40,160)}${range('Saturation','saturation',0,200)}${field('Palette',select('palette',['Univers','Image','Palette personnalisée'],'Univers'))}<div class="swatches">${['#221f1b','#5c7a52','#a8492c','#f7f3ec'].map(c=>`<span class="swatch" style="background:${c}"></span>`).join('')}</div>${demo('Lumière et saturation changent l’aperçu. La quantification exacte, la pipette et la substitution de teinte restent celles des tables existantes.')}`;
    if(tool==='Nettoyage') return `<h3 class="space">Nettoyer les pixels</h3>${genericRange('Îlots isolés',0,8,1)}${genericRange('Grésil temporel',0,100,20)}${demo('Réglages mémorisés pour évaluer leur place. Aucun nettoyage n’est appliqué aux pixels du prototype.')}`;
    if(tool==='Contour') return `<h3 class="space">Contour</h3>${genericRange('Épaisseur',0,4,1)}${field('Placement',select('placement',['Intérieur','Extérieur'],'Extérieur'))}${demo('Réglages mémorisés ; le contour final n’est pas calculé dans cette maquette.')}`;
    if(tool==='Retourner') return `<h3 class="space">Orientation</h3><label class="row"><input type="checkbox" data-recipe="flip" ${draft.recipe.flip?'checked':''}> Miroir horizontal</label><p class="note">Le miroir s’applique au rendu et au calque peint. Il ne crée pas une nouvelle direction dans le plan du sujet.</p>`;
    if(tool==='Calques') return `<h3 class="space">Calques</h3><div class="line">Source · conservée</div><div class="line">Retouche peinte · ${draft.frames.reduce((n,f)=>n+f.strokes.length,0)} traits</div>${range('Opacité de la retouche','opacity',0,100)}${demo('Source et peinture sont séparées. Pile arbitraire, sélection, masques et calques d’équipement restent à détailler ; ils ne sont pas supprimés du produit.')}`;
    if(tool==='Découpe') return `<h3 class="space">Prélever et monter</h3><p>Utilisez la bande sous l’image : sélectionner, dupliquer, déplacer, retirer ou extraire une frame fixe.</p>${button('Extraire la frame ouverte','extract-frame',draft.animated?'':'disabled')}${demo('La sélection temporelle est manipulable. Le découpage d’une planche en cellules et le découpage libre d’image nécessitent encore leur maquette détaillée.')}`;
    return `<h3 class="space">Différence & équipement</h3><p>Comparer l’image de base et sa variante, puis corriger à la main la pièce extraite.</p>${button('Comparer à la source','compare-source')}${demo('La comparaison s’ouvre. L’extraction et ses masques ne sont pas simulés par un faux résultat : leur interaction reste à reprendre depuis les tables actuelles.')}`;
  }
  function genericRange(name,min,max,value) {const key=`${tool}:${name}`;return field(name,input(name,draft.recipe.settings[key]??value,'range',`min="${min}" max="${max}" data-setting="${esc(key)}"`));}
  function openEditor(r) {stop();resultId=r.id;draft=clone(r);dirty=false;cursor=0;selectedFrames=[0];undo=[];redo=[];page='editor';render();}
  function snapshot() {undo.push(clone(draft));if(undo.length>40)undo.shift();redo=[];}
  function changed() {dirty=true;const n=$('#dirty');if(n){n.textContent='Modifications à garder';n.className='dirty';}}
  function targetFrames() {return scope==='all'?draft.frames:scope==='selection'?selectedFrames.map(i=>draft.frames[i]):[draft.frames[cursor]];}
  function saveEditor() {
    if(!draft||!dirty)return;
    draft.revision+=1;draft.savedAt=new Date().toISOString();
    const s=currentSubject(),index=s.results.findIndex(r=>r.id===draft.id);if(index>=0)s.results[index]=clone(draft);
    save();dirty=false;toast('Retouches gardées. Refermez puis rouvrez ce résultat pour les retrouver.');
  }
  function drawFrame(canvas,r,index,raw=false) {
    if(!canvas||!r)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,64,64);ctx.imageSmoothingEnabled=false;
    const f=r.frames[Math.min(index,r.frames.length-1)],rec=raw?freshRecipe():r.recipe;
    ctx.save();if(rec.flip){ctx.translate(64,0);ctx.scale(-1,1);}ctx.filter=`brightness(${rec.brightness}%) saturate(${rec.saturation}%)`;
    const inset=Number(rec.crop)||0;
    if((r.animated||r.sourceAnimation)&&spriteSheet.complete&&spriteSheet.naturalWidth){const w=spriteSheet.naturalWidth/5,h=spriteSheet.naturalHeight;ctx.drawImage(spriteSheet,f.source%5*w,0,w,h,12+inset/2,inset,40-inset,64-2*inset);}
    else {const im=r.image?cachedImage(r.image):reference;if(im.complete&&im.naturalWidth)ctx.drawImage(im,inset,inset,64-2*inset,64-2*inset);}
    ctx.filter='none';
    if(!raw){const layer=document.createElement('canvas');layer.width=layer.height=64;const pen=layer.getContext('2d');
      f.strokes.forEach(s=>{pen.globalCompositeOperation=s.erase?'destination-out':'source-over';pen.fillStyle=s.colour;s.points.forEach(p=>pen.fillRect(p.x-Math.floor(s.size/2),p.y-Math.floor(s.size/2),s.size,s.size));});
      ctx.globalAlpha=rec.opacity/100;ctx.drawImage(layer,0,0);}
    ctx.restore();
    if(rec.grid&&!raw){ctx.strokeStyle='#6d675e';ctx.globalAlpha=.4;ctx.lineWidth=.2;for(let p=8;p<64;p+=8){ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,64);ctx.moveTo(0,p);ctx.lineTo(64,p);ctx.stroke();}ctx.globalAlpha=1;}
  }
  const imageCache=new Map();
  function cachedImage(url){if(!imageCache.has(url)){const im=new Image();im.onload=()=>{drawAll();if(page==='compare')drawComparisons();};im.src=url;imageCache.set(url,im);}return imageCache.get(url);}
  function drawAll() {if(page==='editor'&&draft){drawFrame($('#pixels'),draft,cursor);$$('[data-frame]').forEach(c=>drawFrame(c,draft,Number(c.dataset.frame)));wirePaint();}}
  function wirePaint() {
    const canvas=$('#pixels');if(!canvas||canvas.dataset.wired)return;canvas.dataset.wired='yes';
    canvas.addEventListener('pointerdown',e=>{if(tool!=='Main'||e.button!==0){toast('Choisissez la table « Main » pour peindre.');return;}stop();if(scope==='frame')selectedFrames=[cursor];snapshot();
      const rect=canvas.getBoundingClientRect(),frames=targetFrames();const stroke={colour:draft.recipe.colour,size:Number(draft.recipe.brush),erase:draft.recipe.erase,points:[]};
      frames.forEach(f=>f.strokes.push(clone(stroke)));canvas.setPointerCapture(e.pointerId);
      const point=ev=>{let x=Math.floor((ev.clientX-rect.left)/rect.width*64),y=Math.floor((ev.clientY-rect.top)/rect.height*64);if(draft.recipe.flip)x=63-x;
        if(x<0||x>=64||y<0||y>=64)return;frames.forEach(f=>f.strokes[f.strokes.length-1].points.push({x,y}));changed();drawAll();};
      const end=()=>{canvas.removeEventListener('pointermove',point);canvas.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);render();};
      point(e);canvas.addEventListener('pointermove',point);canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    });
  }
  function play() {
    if(playing){stop();render();return;}
    playing=setInterval(()=>{if(!draft)return;cursor=(cursor+1)%draft.frames.length;drawFrame($('#pixels'),draft,cursor);$('#frame-status').textContent=`Frame ${cursor+1} / ${draft.frames.length} · lecture`;
      if(cursor===draft.frames.length-1&&!draft.recipe.loop){stop();render();}
    },1000/draft.recipe.fps);render();
  }
  function jobs() {
    return heading('Fabrications','Les demandes manuelles et celles de l’agent se retrouvent au même endroit.',button('Simuler une demande de l’agent','agent-request'))+
      demo('Les boutons ci-dessous font avancer ou échouer des travaux fictifs. Rien n’est envoyé à un fournisseur et les montants affichés ne sont pas des tarifs.')+
      (state.jobs.length?state.jobs.slice().reverse().map(j=>`<section class="surface space"><div class="row between"><h2>${esc(j.title)}</h2><span class="tag">${esc(j.status)}</span></div><p>${esc(j.subjectName)} · ${esc(j.origin)} · ${esc(j.method)}</p><p class="small">${esc(j.brief)} · ${esc(j.estimate)}</p><div class="bar"><span style="width:${j.status==='Terminé'?100:j.status==='En attente'?35:0}%"></span></div><div class="row wrap space">${j.status==='En attente'?button('Simuler le résultat','job-finish',`data-id="${j.id}"`)+button('Simuler un échec','job-fail',`data-id="${j.id}"`)+button('Interrompre','job-cancel',`data-id="${j.id}"`):j.status==='Terminé'?button('Voir le résultat','job-open',`data-id="${j.id}"`):button('Reprendre explicitement','job-retry',`data-id="${j.id}"`)}</div>${j.status==='Échec'?'<p class="error space">Le moteur est devenu indisponible. Aucune relance automatique ; les sources et réglages sont conservés.</p>':''}</section>`).join(''):`<div class="empty"><h2>Aucune fabrication en cours</h2><p>Créez un asset à la main ou essayez la demande d’un agent.</p>${go('Ouvrir les assets','library')}</div>`);
  }
  function delivery() {
    const chosen=state.subjects.flatMap(s=>s.results.filter(r=>r.chosen).map(r=>({s,r})));
    return heading('Livrer au jeu','Voir ce qui part, garder des noms stables, remplacer les versions choisies.')+
      `<div class="two"><section class="surface"><h2>1. Destination</h2><p>Projet Godot de démonstration · mode développement</p>${field('Dossier dans le jeu',input('destination',state.destination))}${button('Garder la destination','destination')}<p class="small space">Ce champ décrit la destination proposée. La maquette n’ouvre et n’écrit aucun projet Godot.</p></section><section class="surface"><h2>2. Résultats retenus</h2><p>${chosen.length} résultats à livrer. Les favoris ne sont pas ajoutés automatiquement.</p>${go('Choisir dans les assets','library')}<p class="small space">Une livraison partielle est possible ; les cases absentes restent signalées.</p></section></div>
      <section class="surface space"><h2>3. Relire les fichiers prévus</h2>${chosen.length?`<table class="matrix"><thead><tr><th>Résultat</th><th>Sortie proposée</th><th>Version</th></tr></thead><tbody>${chosen.map(({s,r})=>`<tr><td>${esc(s.name)} / ${esc(r.title)}</td><td>${r.animated?'Planche PNG · JSON Aseprite · SpriteFrames':'Image PNG'}<br><small>Provenance dans un descriptif séparé</small></td><td>v${r.revision}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">Choisissez au moins un résultat pour le jeu.</p>'}<div class="row wrap space">${button('Simuler la livraison','deliver',chosen.length?'':'disabled')}${button('Tester un conflit de fichier','conflict',chosen.length?'':'disabled')}</div>${demo('La prévisualisation et l’historique se mettent à jour. Aucun fichier Godot n’est généré : un vrai import et la lecture dans le moteur seront prouvés par AU1.')}</section>
      <section class="space"><h2>Historique des livraisons</h2>${state.deliveries.length?state.deliveries.slice().reverse().map(d=>`<div class="line"><strong>${d.items.length} résultats · livraison simulée</strong><p class="small">${esc(d.destination)} · ${new Date(d.date).toLocaleString('fr-FR')} · versions ${d.items.map(i=>'v'+i.revision).join(', ')}</p></div>`).join(''):'<p class="muted">Aucune livraison.</p>'}</section>`;
  }
  function settings() {
    return heading('Réglages','Les choix de l’univers, les moyens de fabrication et les droits de l’agent restent distincts.')+
      `<div class="tabs">${[['universe','Univers'],['engines','Moteurs & workflows'],['agent','Agent MCP'],['expenses','Consommations']].map(([t,n])=>button(n,'settings-tab',`data-tab="${t}" aria-pressed="${settingsTab===t}"`)).join('')}</div>${settingsContent()}`;
  }
  function settingsContent() {
    if(settingsTab==='universe')return `<section class="surface"><h2>Règles communes</h2>${field('Nom du jeu',input('game-name',state.game.name))}${field('Description du monde',`<textarea name="game-description">${esc(state.game.description)}</textarea>`)}${field('Direction artistique',`<textarea name="game-style">${esc(state.game.style)}</textarea>`)}${field('Taille de référence',select('game-size',[32,48,64,96,128].map(String),String(state.game.size)))}${button('Garder les règles','save-game')}<p class="note">Les notes de la toile restent libres. Les assets héritent de ces règles ; les détails propres au sujet se lisent dans sa fiche.</p></section>`;
    if(settingsTab==='engines')return `<div class="two"><section class="surface"><h2>Fournisseur par API</h2><label class="row"><input id="api-ready" type="checkbox" ${state.providers.api?'checked':''}> Simuler une connexion disponible</label><p class="small space">Aucune clé demandée dans la maquette. Un fournisseur indisponible ne bloque pas les autres.</p></section><section class="surface"><h2>Moteurs locaux</h2><label class="row"><input id="local-ready" type="checkbox" ${state.providers.local?'checked':''}> Simuler un moteur local disponible</label><p class="small space">ComfyUI image, vidéo et asset3d apparaissent comme des capacités différentes.</p></section></div><section class="surface space"><h2>Profils de workflow</h2><table class="matrix"><thead><tr><th>Profil d’exemple</th><th>Entrée</th><th>Sortie</th></tr></thead><tbody><tr><td>Image locale · v1</td><td>Texte, références optionnelles</td><td>Images</td></tr><tr><td>Animation locale · v1</td><td>Image de départ obligatoire, mouvement</td><td>Clip</td></tr><tr><td>asset3d · rendu v1</td><td>Modèle, rig, mouvement, vues</td><td>Source 3D et frames</td></tr></tbody></table>${demo('Ces profils sont descriptifs. Import de workflow, validation des entrées, installation et gestion fine des ressources restent à maqueter à partir des adaptateurs réels.')}</section>`;
    if(settingsTab==='agent')return `<section class="surface"><h2>L’agent qui développe le jeu</h2><p>Le MCP lui permet de demander les assets pendant le développement Godot. Vous pouvez accomplir le même parcours dans l’interface sans le connecter.</p><div class="stack"><label><input name="policy-local" type="checkbox" ${state.policy.local?'checked':''}> Autoriser les méthodes locales disponibles</label><label><input name="policy-paid" type="checkbox" ${state.policy.paid?'checked':''}> Autoriser les appels payants dans une limite</label><label><input name="policy-provisional" type="checkbox" ${state.policy.provisional?'checked':''}> Permettre une livraison provisoire pour tester le jeu</label></div><div class="two">${field('Plafond fictif par demande ($)',input('policy-budget',state.policy.budget,'number','min="0" step="0.1"'))}${field('Nombre maximal de tentatives',input('policy-attempts',state.policy.attempts,'number','min="1" max="10"'))}</div>${button('Garder le cadre de l’agent','save-policy')}${demo('Les choix sont mémorisés et filtrent les méthodes du scénario agent. Le serveur MCP réel n’est pas contacté.')}</section>`;
    return `<section class="surface"><h2>Consommations des essais</h2><p>Aucune dépense réelle dans ce prototype.</p><table class="matrix"><thead><tr><th>Demande</th><th>Moyen</th><th>Annonce fictive</th></tr></thead><tbody>${state.jobs.map(j=>`<tr><td>${esc(j.title)}</td><td>${esc(j.method)}</td><td>${esc(j.estimate)}</td></tr>`).join('')}</tbody></table><p class="note">Les dollars, unités du fournisseur et temps local restent séparés. Aucune estimation locale n’est présentée comme une mesure de votre machine.</p></section>`;
  }
  function source() {
    const s=currentSubject(), model=s.model3d;
    return heading('Du modèle 3D aux sprites','Parcours futur avec asset3d : conserver une source, l’animer, puis choisir ses rendus.',go('Retour à l’asset','subject'))+
      demo('Tout ce parcours 3D est simulé. Aucun modèle téléchargé, aucun rig calculé, aucun GPU utilisé.')+
      `<div class="three"><section class="surface"><div class="label">01 · Source</div><h2>${model?'Modèle conservé':'Créer ou importer'}</h2><p>Texte, image ou fichier existant. La source ne disparaît pas après le rendu.</p>${button(model?'Remplacer l’exemple':'Simuler un modèle','create-model')}</section><section class="surface"><div class="label">02 · Animation</div><h2>${model?.rig?'Rig prêt':'Préparer le rig'}</h2><p>Choisir des mouvements adaptés au squelette, inspecter et reprendre.</p>${button('Simuler le rig','rig-model',model?'':'disabled')}</section><section class="surface"><div class="label">03 · Rendu</div><h2>Des vues réutilisables</h2><p>Changer caméra, mouvement ou lumière sans regénérer le personnage.</p>${button('Préparer des sprites','render-model',model?.rig?'':'disabled')}</section></div>${model?`<div class="surface space"><h2>Source conservée</h2><p>Modèle d’exemple · ${model.rig?'rig d’exemple associé':'rig à préparer'} · ${model.renders||0} rendus simulés</p><p class="small">Une sortie 3D doit rester reliée à la version de sa source et à ses réglages de rendu.</p></div>`:''}`;
  }
  const SCENARIOS=[['manual','library','Créer sans MCP','Créez un personnage, choisissez un mouvement, fabriquez une référence puis une animation simulée.'],['canvas','universe','Composer un univers','Ajoutez une note et un îlot, associez-les, déplacez l’îlot et rouvrez la toile.'],['retouch','subject','Corriger une animation','Ouvrez la marche du pèlerin, dupliquez une frame, peignez, changez la vitesse, gardez puis rouvrez.'],['deliver','delivery','Livrer et remplacer','Retenez un résultat, simulez une livraison, puis testez un conflit.'],['agent','jobs','Déléguer à l’agent','Simulez une demande, un échec et une reprise. Vérifiez que tout reste retrouvable.'],['local','settings','Choisir un moyen de fabrication','Rendez un moteur indisponible et vérifiez les choix proposés avant l’envoi.']];
  function guide() {return heading('Essayer avant de construire','Une visite par gestes. Cochez ce que vous avez essayé et notez ce qui vous gêne.')+
    `<div class="two">${SCENARIOS.map(([key,target,title,desc])=>`<section class="surface"><h2>${title}</h2><p>${desc}</p><div class="row between">${go('Essayer',target)}<label><input type="checkbox" data-check="${key}" ${state.checks[key]?'checked':''}> Essayé</label></div></section>`).join('')}</div><section class="surface space"><h2>La limite de cette version</h2><p>Les grandes zones sont navigables, les parcours centraux se manipulent. Cela ne signifie pas que toutes les tables avancées ont déjà leur détail complet.</p><p>Sélections et masques avancés, calage d’équipement, découpe libre, installation détaillée, tuiles et son restent explicitement à compléter.</p><a href="couverture.md">Lire l’inventaire de couverture</a> · ${button('Exporter mes remarques','export-feedback')}</section>`;}
  function remarks() {return heading('Vos remarques','Décrivez ce que vous vouliez faire et ce qui vous a empêché de le faire.',button('Ajouter une remarque','feedback')+button('Exporter les remarques','export-feedback'))+
    (state.remarks.length?state.remarks.slice().reverse().map(r=>`<section class="surface space"><div class="row between"><strong>${esc(r.context)}</strong><span class="tag">${esc(r.kind)}</span></div><p class="space">${esc(r.text)}</p><small>${new Date(r.date).toLocaleString('fr-FR')}</small></section>`).join(''):'<div class="empty"><h2>Rien de noté pour l’instant</h2><p>Le bouton « Noter une remarque » reste disponible en haut de chaque écran.</p></div>')+`<details class="space"><summary>Recommencer les essais</summary><p>Cette action efface uniquement les données fictives de cette maquette dans ce navigateur. Exportez vos remarques avant.</p>${button('Réinitialiser la démonstration','reset')}</details>`;}
  function compare() {
    const s=currentSubject(),rs=compareIds.map(i=>s.results.find(r=>r.id===i)).filter(Boolean);
    if(!rs.length&&s.results[0])rs.push(s.results[0]);
    return heading('Comparer les versions','Regarder côte à côte ; choisir pour le jeu reste un geste explicite.',go('Retour à l’asset','subject'))+
      `<div class="two">${rs.map(r=>`<section class="surface"><h2>${esc(r.title)} · v${r.revision}</h2><div class="sprite compare-preview"><canvas width="64" height="64" data-compare="${r.id}"></canvas></div><div class="row wrap space">${button('Retoucher','edit-result',`data-id="${r.id}"`)}${button(r.chosen?'Retenu':'Choisir pour le jeu','choose',`data-id="${r.id}"`)}</div></section>`).join('')}${rs.length===1?'<section class="surface"><h2>Ajouter une autre version</h2><p>Revenez à l’asset et appuyez sur « Comparer » sous un autre résultat.</p></section>':''}</div>`;
  }
  function drawComparisons() {$$('[data-compare]').forEach(c=>drawFrame(c,currentSubject().results.find(r=>r.id===c.dataset.compare),0));}
  function subjectForm(existing=false) {
    const s=existing?currentSubject():{name:'',family:'Personnages',goal:'Animations',description:''};
    modal(existing?'La fiche de l’asset':'Créer un asset',`${field('Nom',input('subject-name',s.name,'text','maxlength="80" placeholder="Ex. Gardienne du marais"'))}<div class="two">${field('Famille',select('subject-family',FAMILIES,s.family))}${field('Sorties souhaitées',select('subject-goal',['Animations','Images fixes','Images & animations'],s.goal))}</div>${field('Ce qui le caractérise',`<textarea name="subject-description">${esc(s.description)}</textarea>`)}<p class="small">Une animation peut demander une image de départ technique. Cela ne vous oblige pas à produire une collection de poses fixes.</p>`,button('Annuler','close')+button(existing?'Garder la fiche':'Créer et ouvrir',existing?'save-subject':'create-subject'));
  }
  function objectivesForm() {
    const s=currentSubject();modal('Ce qui doit exister dans le jeu',`${field('Sorties souhaitées',select('objective-goal',['Animations','Images fixes','Images & animations'],s.goal))}${field('Mouvements (séparés par une virgule)',input('movements',s.movements.join(', '),'text','maxlength="200"'))}<p>Directions nécessaires</p><div class="checks">${DIRECTIONS.map(d=>`<label><input type="checkbox" name="direction" value="${d}" ${s.directions.includes(d)?'checked':''}> ${d}</label>`).join('')}</div><p class="note">Retirer une direction de l’objectif ne supprime aucun résultat déjà produit.</p>`,button('Garder l’objectif','save-objectives'));
  }
  const value=(name,base=dialog)=>$(`[name="${name}"]`,base)?.value ?? '';
  const checked=(name,base=dialog)=>$(`[name="${name}"]`,base)?.checked || false;
  function requestForm(attrs={},origin='Vous, dans l’interface') {
    const s=currentSubject();
    request={origin,kind:attrs.kind||(s.goal==='Images fixes'?'image':'animation'),movement:attrs.movement||s.movements[0]||'Marche',direction:attrs.direction||s.directions[0]||'Sud',method:attrs.method||'',brief:s.description};
    showRequest();
  }
  function showRequest() {
    const s=currentSubject(),agent=request.origin.startsWith('Agent'),hasReference=!!s.image||s.results.some(r=>!r.animated);
    const choices=[['Local · workflow de démonstration',state.providers.local&&(!agent||state.policy.local),agent?'Moteur local indisponible ou non autorisé':'Moteur local indisponible'],['API · modèle de démonstration',state.providers.api&&(!agent||state.policy.paid&&state.policy.budget>=0.2),agent?'Connexion ou budget de l’agent insuffisant':'Connexion API indisponible']];
    if(request.method==='3D · rendu de démonstration')choices.unshift([request.method,!!s.model3d?.rig,'Rig à préparer']);
    const available=choices.filter(c=>c[1]);if(!available.some(c=>c[0]===request.method))request.method=available[0]?.[0]||'';
    modal('Préparer une fabrication',`<p class="small">Origine : ${esc(request.origin)} · ${esc(s.name)}</p>${field('Que fabriquer ?',select('request-kind',['Animation','Image fixe'],request.kind==='image'?'Image fixe':'Animation'))}<div class="two">${field('Mouvement / nom du résultat',input('request-movement',request.movement,'text','maxlength="80"'))}${field('Direction',select('request-direction',s.directions,request.direction))}</div>${field('Description du résultat',`<textarea name="request-brief">${esc(request.brief)}</textarea>`)}${field('Moyen de fabrication',`<select name="request-method">${choices.map(([name,ready,reason])=>`<option value="${esc(name)}" ${name===request.method?'selected':''} ${ready?'':'disabled'}>${esc(name)}${ready?'':' — '+reason}</option>`).join('')}</select>`)}<div class="readout">${hasReference?'Une référence du sujet accompagne la demande d’animation.':'Ce sujet n’a pas de référence. Commencez par importer ou fabriquer une image fixe ; elle servira au départ du clip.'}</div>${demo('Les moyens de fabrication sont des profils fictifs, pas un catalogue de modèles conseillé.')}`,button('Annuler','close')+button('Relire avant l’envoi','review-request',available.length?'':'disabled'));
  }
  function captureRequest() {
    request.kind=value('request-kind')==='Image fixe'?'image':'animation';request.movement=value('request-movement').trim();request.direction=value('request-direction');request.brief=value('request-brief');request.method=value('request-method');
  }
  function reviewRequest() {
    captureRequest();const s=currentSubject();if(!request.movement){toast('Donnez un nom au résultat ou au mouvement.');return;}
    if(request.kind==='animation'&&!s.image&&!s.results.some(r=>!r.animated)&&!request.method.startsWith('3D')){toast('Une image de départ est nécessaire. Choisissez « Image fixe » pour préparer cette référence.');return;}
    const local=!request.method.startsWith('API');request.estimate=local?'Temps local inconnu sur votre machine · exemple sans frais':'0,20 $ fictif · aucun appel payant';
    modal('Qu’est-ce qui part avec ?',`<p><strong>${esc(s.name)} · ${esc(request.movement)} · ${esc(request.direction)}</strong></p><div class="line"><span class="label">Univers</span><p>${esc(state.game.style)}</p></div><div class="line"><span class="label">Sujet</span><p>${esc(s.description)}</p></div><div class="line"><span class="label">Cette fabrication</span><p>${esc(request.brief)}</p></div><div class="line"><span class="label">Références & méthode</span><p>${request.kind==='animation'?'Image de départ du sujet':'Références du sujet si présentes'} · ${esc(request.method)}</p></div><p class="space">${esc(request.estimate)}</p>${demo('Cet écran entier rend l’envoi relisible. Dans la maquette, confirmer crée uniquement un travail fictif dans la liste.')}`,button('Modifier','back-request')+button('Lancer la simulation','send-request','class="rust"'));
  }
  function sendRequest() {
    const s=currentSubject();state.jobs.push({id:id(),subjectId:s.id,subjectName:s.name,title:request.kind==='image'?request.movement:`${request.movement} · ${request.direction}`,origin:request.origin,method:request.method,kind:request.kind,brief:request.brief,estimate:request.estimate,status:'En attente',resultId:null});save();dialog.close();page='jobs';render();toast('Demande fictive ajoutée. Faites-la avancer depuis cette liste.');
  }
  function editCard(cardId) {
    const c=state.canvas.cards.find(c=>c.id===cardId);if(!c)return;canvasSelected=c.id;
    modal('Annoter la carte',`${field('Titre',input('card-title',c.title,'text','maxlength="80"'))}${field('Texte',`<textarea name="card-text">${esc(c.text)}</textarea>`)}${field('Îlot',`<select name="card-island"><option value="">Sans îlot</option>${state.canvas.islands.map(i=>`<option value="${i.id}" ${i.id===c.island?'selected':''}>${esc(i.title)}</option>`).join('')}</select>`)}<div class="two">${field('Position horizontale',input('card-x',Math.round(c.x),'number','min="0" max="1200"'))}${field('Position verticale',input('card-y',Math.round(c.y),'number','min="0" max="640"'))}</div>`,button('Garder la carte','save-card'));
  }
  function importForm(forCanvas=false) {
    modal(forCanvas?'Ajouter une image à la toile':'Importer une source',`<p>Choisissez une image de votre ordinateur pour tester l’import local. Elle reste dans les données de démonstration de ce navigateur.</p>${field('Fichier image (2 Mo maximum)', '<input id="import-file" type="file" accept="image/png,image/jpeg,image/webp">')}${forCanvas?'':`<div class="line"><h3>Essayer un clip sans fichier</h3><p class="small">Utiliser la séquence de marche préparée dans le dépôt.</p>${button('Ouvrir le clip de démonstration','sample-clip')}</div>`}`,button('Importer cette image',forCanvas?'upload-canvas':'upload-image'));
  }
  async function upload(forCanvas) {
    const file=$('#import-file')?.files[0];if(!file){toast('Choisissez une image.');return;}if(file.size>2*1024*1024){toast('Pour la maquette, choisissez une image de moins de 2 Mo.');return;}
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Formats acceptés : PNG, JPEG et WebP.');return;}
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const image=new Image();image.src=url;try{await image.decode();}catch{toast('Cette image ne peut pas être lue. Essayez un autre fichier.');return;}
    if(forCanvas){const card={id:id(),kind:'image',title:file.name,text:'Référence importée',image:url,x:120,y:100,island:''};state.canvas.cards.push(card);canvasSelected=card.id;page='universe';}
    else {const s=currentSubject();s.image=url;const r=result(file.name,false);r.image=url;r.provenance='Image importée dans la maquette';s.results.push(r);tab='images';page='subject';}
    save();dialog.close();render();
  }
  function exportFeedback() {
    const text=`# Essai de la maquette Asset Kitchen\n\n${new Date().toLocaleString('fr-FR')}\n\n`+SCENARIOS.map(([k,,t])=>`- [${state.checks[k]?'x':' '}] ${t}`).join('\n')+'\n\n'+state.remarks.map(r=>`## ${r.context} · ${r.kind}\n\n${r.text}\n`).join('\n');
    modal('Remarques prêtes à transmettre',field('Texte à copier',`<textarea id="feedback-export" rows="14" readonly>${esc(text)}</textarea>`)+`<p class="small">Copiez ce texte dans notre conversation. Vous pouvez aussi le télécharger si votre navigateur le permet.</p>`,button('Tout sélectionner','select-feedback')+button('Télécharger le Markdown','download-feedback'));
  }
  const handlers={
    close:()=>dialog.close(),
    'new-subject':()=>subjectForm(), 'edit-subject':()=>subjectForm(true),
    'create-subject':()=>{const name=value('subject-name').trim();if(!name){toast('Donnez un nom à l’asset.');return;}const s={id:id(),name,family:value('subject-family'),goal:value('subject-goal'),description:value('subject-description'),movements:['Repos','Marche'],directions:state.game.directions.slice(),results:[],equipment:[]};state.subjects.push(s);subjectId=s.id;tab=s.goal==='Images fixes'?'images':'animations';save();dialog.close();page='subject';render();},
    'save-subject':()=>{if(!value('subject-name').trim()){toast('Le nom ne peut pas être vide.');return;}Object.assign(currentSubject(),{name:value('subject-name').trim(),family:value('subject-family'),goal:value('subject-goal'),description:value('subject-description')});save();dialog.close();render();},
    subject:el=>leave(()=>{subjectId=el.dataset.id;tab='animations';compareIds=[];stop();page='subject';render();}),
    tab:el=>{tab=el.dataset.tab;render();},
    objectives:objectivesForm,
    'save-objectives':()=>{const m=[...new Set(value('movements').split(',').map(x=>x.trim()).filter(Boolean))].slice(0,12),d=$$('input[name="direction"]:checked',dialog).map(x=>x.value);if(!m.length||!d.length){toast('Gardez au moins un mouvement et une direction.');return;}Object.assign(currentSubject(),{movements:m,directions:d,goal:value('objective-goal')});save();dialog.close();render();},
    request:el=>requestForm(el.dataset),
    'agent-request':()=>requestForm({},'Agent MCP · développe le jeu'),
    'review-request':reviewRequest,'back-request':showRequest,'send-request':sendRequest,
    'job-finish':el=>{const j=state.jobs.find(j=>j.id===el.dataset.id),s=state.subjects.find(s=>s.id===j.subjectId);if(j.status!=='En attente')return;const r=result(j.title,j.kind==='animation');r.provenance='Résultat simulé · '+j.method;s.results.push(r);j.resultId=r.id;j.status='Terminé';if(j.method.startsWith('3D'))s.model3d.renders=(s.model3d.renders||0)+1;save();render();},
    'job-fail':el=>{state.jobs.find(j=>j.id===el.dataset.id).status='Échec';save();render();},
    'job-cancel':el=>{state.jobs.find(j=>j.id===el.dataset.id).status='Interrompu';save();render();},
    'job-retry':el=>{const j=state.jobs.find(j=>j.id===el.dataset.id);j.status='En attente';save();render();toast('Reprise explicite de la même demande fictive.');},
    'job-open':el=>{const j=state.jobs.find(j=>j.id===el.dataset.id);subjectId=j.subjectId;const r=currentSubject().results.find(r=>r.id===j.resultId);if(r)openEditor(r);else toast('Ce résultat a été écarté de la bibliothèque.');},
    'edit-result':el=>leave(()=>openEditor(currentSubject().results.find(r=>r.id===el.dataset.id))),
    favorite:el=>{const r=currentSubject().results.find(r=>r.id===el.dataset.id);r.favorite=!r.favorite;save();render();},
    choose:el=>{const r=currentSubject().results.find(r=>r.id===el.dataset.id);r.chosen=!r.chosen;save();render();},
    'discard-result':el=>{modal('Écarter ce résultat ?', '<p>Ce résultat sera retiré de la bibliothèque de démonstration et des choix de la prochaine livraison. Les livraisons passées conservent leur historique.</p>',button('Annuler','close')+button('Écarter','confirm-discard-result',`data-id="${el.dataset.id}"`));},
    'confirm-discard-result':el=>{currentSubject().results=currentSubject().results.filter(r=>r.id!==el.dataset.id);compareIds=compareIds.filter(i=>i!==el.dataset.id);save();dialog.close();render();},
    'compare-add':el=>{if(!compareIds.includes(el.dataset.id))compareIds.push(el.dataset.id);compareIds=compareIds.slice(-2);page='compare';render();},
    'compare-source':()=>{modal('Source et retouche ouverte',`<div class="two"><section><h3>Source conservée</h3><div class="sprite compare-preview"><canvas id="raw-preview" width="64" height="64"></canvas></div></section><section><h3>Avec les retouches</h3><div class="sprite compare-preview"><canvas id="edited-preview" width="64" height="64"></canvas></div></section></div>`);drawFrame($('#raw-preview'),draft,cursor,true);drawFrame($('#edited-preview'),draft,cursor);},
    'save-editor':()=>{saveEditor();render();},
    'save-leave':()=>{saveEditor();dialog.close();confirmAction?.();confirmAction=null;},
    'discard-leave':()=>{dirty=false;draft=null;dialog.close();confirmAction?.();confirmAction=null;},
    tool:el=>{tool=el.dataset.tool;render();},
    frame:(el,e)=>{stop();cursor=Number(el.dataset.index);if(e.ctrlKey||e.metaKey){selectedFrames=selectedFrames.includes(cursor)?selectedFrames.filter(i=>i!==cursor):[...selectedFrames,cursor];if(!selectedFrames.length)selectedFrames=[cursor];}else selectedFrames=[cursor];render();},
    'select-all':()=>{selectedFrames=draft.frames.map((_,i)=>i);render();},
    duplicate:()=>{stop();snapshot();const originals=selectedFrames.slice().sort((a,b)=>a-b),added=[];let shift=0;for(const i of originals){const copy=clone(draft.frames[i+shift]);copy.id=id();draft.frames.splice(i+shift+1,0,copy);added.push(i+shift+1);shift++;}selectedFrames=added;cursor=added[0];changed();render();},
    'move-frame':el=>{if(selectedFrames.length!==1){toast('Choisissez une seule frame pour la déplacer.');return;}const from=selectedFrames[0],to=from+Number(el.dataset.delta);if(to<0||to>=draft.frames.length)return;stop();snapshot();const [f]=draft.frames.splice(from,1);draft.frames.splice(to,0,f);cursor=to;selectedFrames=[to];changed();render();},
    'remove-frame':()=>{if(selectedFrames.length>=draft.frames.length)return;stop();snapshot();draft.frames=draft.frames.filter((_,i)=>!selectedFrames.includes(i));cursor=Math.min(cursor,draft.frames.length-1);selectedFrames=[cursor];changed();render();},
    'extract-frame':()=>{const r=result(`${draft.title} · frame ${cursor+1}`,false);r.frames=[clone(draft.frames[cursor])];r.recipe=clone(draft.recipe);r.sourceAnimation=true;r.provenance='Frame extraite dans la maquette';currentSubject().results.push(r);save();toast('Image fixe ajoutée à l’onglet Images fixes. Les retouches de l’animation restent à garder.');},
    undo:()=>{if(!undo.length)return;stop();redo.push(clone(draft));draft=undo.pop();cursor=Math.min(cursor,draft.frames.length-1);selectedFrames=[cursor];changed();render();},
    redo:()=>{if(!redo.length)return;stop();undo.push(clone(draft));draft=redo.pop();cursor=Math.min(cursor,draft.frames.length-1);selectedFrames=[cursor];changed();render();},
    play,
    'clear-strokes':()=>{snapshot();targetFrames().forEach(f=>f.strokes=[]);changed();render();},
    'save-recipe':()=>modal('Nommer cette recette',field('Nom de la recette',input('recipe-name','Retouche du marais')),button('Garder la recette','confirm-recipe')),
    'confirm-recipe':()=>{const name=value('recipe-name').trim();if(!name)return;state.recipes.push({id:id(),name,recipe:clone(draft.recipe)});save();dialog.close();toast('Recette nommée gardée. Elle contient les réglages, pas les traits propres aux frames.');},
    'load-recipe':()=>modal('Réappliquer une recette',state.recipes.length?field('Recette',`<select name="recipe-id">${state.recipes.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select>`):'<p>Aucune recette nommée. Gardez d’abord les réglages d’un résultat.</p>',button('Appliquer au résultat','apply-recipe',state.recipes.length?'':'disabled')),
    'apply-recipe':()=>{snapshot();draft.recipe=clone(state.recipes.find(r=>r.id===value('recipe-id')).recipe);changed();dialog.close();render();},
    import:()=>importForm(false),'upload-image':()=>upload(false),'upload-canvas':()=>upload(true),
    'sample-clip':()=>{dialog.close();const r=result('Bande extraite du clip de démonstration');currentSubject().results.push(r);save();openEditor(r);tool='Découpe';render();},
    equipment:()=>modal('Associer une pièce',field('Pièce',select('equipment',['La lanterne','Cape de voyage','Sac de voyage'],'La lanterne')),button('Associer au personnage','save-equipment')),
    'save-equipment':()=>{const s=currentSubject(),v=value('equipment');if(!s.equipment.includes(v))s.equipment.push(v);save();dialog.close();render();},
    'remove-equipment':el=>{currentSubject().equipment.splice(Number(el.dataset.index),1);save();render();},
    'canvas-note':()=>{const card={id:id(),kind:'note',title:'Une nouvelle idée',text:'',x:150,y:150,island:''};state.canvas.cards.push(card);canvasSelected=card.id;save();render();editCard(card.id);},
    'canvas-image':()=>importForm(true),
    'canvas-island':()=>modal('Créer un îlot',field('Nom de l’îlot',input('island-name','Une nouvelle région')),button('Créer l’îlot','save-island')),
    'save-island':()=>{const title=value('island-name').trim();if(!title)return;state.canvas.islands.push({id:id(),title,x:450,y:450});save();dialog.close();render();},
    'canvas-edit':el=>editCard(el.dataset.id||canvasSelected),
    'save-card':()=>{const c=state.canvas.cards.find(c=>c.id===canvasSelected);Object.assign(c,{title:value('card-title'),text:value('card-text'),island:value('card-island'),x:Math.max(0,Math.min(1200,Number(value('card-x'))||0)),y:Math.max(0,Math.min(640,Number(value('card-y'))||0))});save();dialog.close();render();},
    'canvas-delete':()=>{if(!canvasSelected)return;const key=canvasSelected;state.canvas.cards=state.canvas.cards.filter(c=>c.id!==key);state.canvas.links=state.canvas.links.filter(l=>!l.includes(key));canvasSelected=null;save();render();toast('Carte de démonstration supprimée.');},
    'canvas-link':()=>{linkFrom=linkFrom?null:'pick';render();},
    'settings-tab':el=>{settingsTab=el.dataset.tab;render();},
    'save-game':()=>{const name=value('game-name',main).trim();if(!name){toast('Le jeu doit garder un nom.');return;}Object.assign(state.game,{name,description:value('game-description',main),style:value('game-style',main),size:Number(value('game-size',main))});save();render();toast('Règles gardées dans la maquette.');},
    'save-policy':()=>{Object.assign(state.policy,{local:checked('policy-local',main),paid:checked('policy-paid',main),provisional:checked('policy-provisional',main),budget:Math.max(0,Number(value('policy-budget',main))||0),attempts:Math.max(1,Math.min(10,Number(value('policy-attempts',main))||1))});save();toast('Cadre de démonstration gardé.');},
    destination:()=>{const d=value('destination',main).trim();if(!d){toast('Indiquez la destination proposée.');return;}state.destination=d;save();toast('Destination de démonstration gardée.');},
    deliver:()=>{const items=state.subjects.flatMap(s=>s.results.filter(r=>r.chosen).map(r=>({subject:s.id,result:r.id,revision:r.revision})));if(!items.length)return;state.deliveries.push({id:id(),date:new Date().toISOString(),destination:state.destination,items});save();render();toast('Livraison simulée. Aucun fichier écrit dans le jeu.');},
    conflict:()=>modal('Un fichier a changé dans le jeu',`<p>Scénario d’essai : une ressource déjà livrée a été modifiée depuis Godot. L’atelier doit vous laisser choisir, en montrant ce qui diffère.</p><div class="readout">Version du jeu : modifiée à la main<br>Version de l’atelier : une nouvelle révision est prête</div>${demo('Le conflit est fictif ; aucune comparaison de fichiers n’est exécutée.')}`,button('Conserver le fichier du jeu','resolve-conflict','data-choice="Fichier du jeu conservé"')+button('Créer une copie à côté','resolve-conflict','data-choice="Copie séparée simulée"')),
    'resolve-conflict':el=>{dialog.close();toast(el.dataset.choice+' · aucune écriture réelle.');},
    'create-model':()=>{currentSubject().model3d={id:id(),rig:false,renders:0};save();render();},
    'rig-model':()=>{currentSubject().model3d.rig=true;save();render();},
    'render-model':()=>requestForm({method:'3D · rendu de démonstration',movement:'Marche'}),
    feedback:()=>{feedbackContext=`${NAMES[page]}${page==='editor'?' / '+tool:''}`;modal('Noter une remarque',`<p class="small">Écran : ${esc(feedbackContext)}</p>${field('Type de remarque',select('feedback-kind',['Difficile à utiliser','Il manque quelque chose','Une idée','À conserver'],'Difficile à utiliser'))}${field('Ce que vous vouliez faire, et ce qui vous gêne', '<textarea name="feedback-text" placeholder="Ex. Je veux corriger trois frames, mais je ne vois pas lesquelles seront modifiées."></textarea>')}<p class="small">La note reste ici. Exportez-la pour me la transmettre ; elle n’est pas envoyée automatiquement.</p>`,button('Garder la remarque','save-feedback'));},
    'save-feedback':()=>{const text=value('feedback-text').trim();if(!text){toast('Écrivez votre remarque avant de la garder.');return;}state.remarks.push({id:id(),context:feedbackContext,kind:value('feedback-kind'),text,date:new Date().toISOString()});save();dialog.close();if(page==='remarks')render();toast('Remarque gardée dans ce navigateur.');},
    'export-feedback':exportFeedback,
    'select-feedback':()=>{$('#feedback-export').focus();$('#feedback-export').select();},
    'download-feedback':()=>{const blob=new Blob([$('#feedback-export').value],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='remarques-maquette-asset-kitchen.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Téléchargement demandé. Si le navigateur ne le propose pas, copiez le texte affiché.');},
    reset:()=>modal('Recommencer la démonstration ?', '<p>Les essais et remarques de cette maquette seront effacés de ce navigateur. Vos vrais projets ne sont jamais concernés.</p>',button('Annuler','close')+button('Réinitialiser les essais','confirm-reset')),
    'confirm-reset':()=>{stop();state=seed();subjectId='pelerin';page='home';draft=null;dirty=false;compareIds=[];canvasSelected=null;linkFrom=null;save();dialog.close();render();}
  };
  document.addEventListener('click',async e=>{
    const el=e.target.closest('button');if(!el||el.disabled)return;
    if(el.dataset.page){navigate(el.dataset.page);return;}
    const action=handlers[el.dataset.action];if(action){try{await action(el,e);}catch(error){console.error(error);toast('Ce geste de la maquette a rencontré une erreur. Vous pouvez noter le parcours pour le corriger.');}}
  });
  function updateRecipe(el) {
    stop();if(!el.dataset.editing){snapshot();el.dataset.editing='yes';}
    const k=el.dataset.recipe;draft.recipe[k]=el.type==='checkbox'?el.checked:['colour','background'].includes(k)?el.value:Number(el.value);
    if(k==='fps')draft.recipe.fps=Math.max(1,Math.min(60,draft.recipe.fps||8));changed();drawAll();
  }
  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.recipe){updateRecipe(el);render();}
    else if(el.dataset.setting){snapshot();draft.recipe.settings[el.dataset.setting]=Number(el.value);changed();}
    else if(page==='editor'&&el.closest('#tool-content')&&el.name){snapshot();draft.recipe.settings[`${tool}:${el.name}`]=el.value;changed();}
    else if(el.id==='scope'){scope={'Cette frame':'frame','Les frames sélectionnées':'selection','Toute l’animation':'all'}[el.value];}
    else if(el.id==='family'){family=el.value;render();}
    else if(el.id==='favorites'){favoriteOnly=el.checked;render();}
    else if(el.id==='canvas-zoom'){state.canvas.zoom=Number(el.value);save();render();}
    else if(el.id==='local-ready'||el.id==='api-ready'){state.providers[el.id==='local-ready'?'local':'api']=el.checked;save();}
    else if(el.dataset.check){state.checks[el.dataset.check]=el.checked;save();}
  });
  document.addEventListener('input',e=>{if(e.target.dataset.recipe)updateRecipe(e.target);else if(e.target.id==='search'){const start=e.target.selectionStart;filter=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(start,start);}});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  document.addEventListener('keydown',e=>{if(page==='editor'&&!dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();handlers[e.shiftKey?'redo':'undo']();}});
  save();render();
})();
