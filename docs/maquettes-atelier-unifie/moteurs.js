/* Maquette des moteurs — autonome. Rien n'est installé, aucun réseau n'est
   appelé : « Installer » et « Brancher une clé » simulent un délai puis
   changent l'état affiché, localement, dans ce navigateur. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sidebar = $('#sidebar'), main = $('#main');
  let messageMinuterie;
  function toast(texte) { $('#message').textContent = texte; clearTimeout(messageMinuterie); messageMinuterie = setTimeout(() => { $('#message').textContent = ''; }, 5000); }

  /* ——— Le catalogue, tel qu'il devrait se lire une fois rangé (MOM) ———
     Un moteur porte ses réglages par capacité — c'est la description unique
     que le plan demande : la même liste sert la page Moteurs et les trois
     outils, jamais recopiée. Noms et familles repris de
     `atelier/fournisseur/catalogue_styles.py` (styles et outils locaux) et des
     modèles OpenRouter déjà nommés dans le code (`docs/PLAN-catalogue-des-
     moteurs.md`, `atelier/services/agent.py`, `essais/banc_planche_objets.py`). */
  const CAPACITES = {
    creer: 'Créer une image', repeindre: 'Repeindre une zone', animer: 'Animer',
    finir: 'Finir une animation sur une image', detourer: 'Détourer',
    son: 'Faire un son', objet3d: 'Faire un objet 3D',
  };

  const MACHINE = [
    { id: 'qwen21', nom: 'Qwen-Image 2.1', defautInstalle: true,
      vitesse: 'de 12 secondes à 2 minutes par image selon le réglage',
      reglages: {
        creer: [{ nom: 'Très rapide', formats: ['512', '1024'] }, { nom: 'Meilleure qualité', formats: ['512', '1024', '1536'] }],
        // MO1 : le point de départ du chantier — les deux mêmes réglages,
        // pas un seul comme aujourd'hui dans Repeindre.
        repeindre: [{ nom: 'Très rapide', formats: ['512', '1024'] }, { nom: 'Meilleure qualité', formats: ['512', '1024', '1536'] }],
      } },
    { id: 'zimage', nom: 'Z-Image Turbo', defautInstalle: true,
      vitesse: 'environ 30 secondes par image',
      reglages: {
        creer: [{ nom: 'Pixel art net et rapide' }, { nom: 'Pixel art Redmond' }, { nom: 'Personnage pixel' }],
        repeindre: [{ nom: 'Retouche de zone' }],
      } },
    { id: 'klein', nom: 'FLUX.2 Klein', defautInstalle: false,
      vitesse: '1 à 3 minutes par image',
      manque: ['le LoRA pixel_art_sprite_flux2_klein', 'le modèle de base flux2-klein-4b'],
      reglages: {
        creer: [{ nom: 'Pixel art détaillé' }, { nom: 'Planche de marche 4 directions' }, { nom: 'Tuiles et décors' }],
        repeindre: [{ nom: 'Retouche de zone' }],
      } },
    { id: 'flux1', nom: 'FLUX.1-dev', defautInstalle: false,
      vitesse: '3 à 6 minutes par image',
      manque: ['le fichier flux1dev.gguf', 'les LoRA de style'],
      reglages: {
        creer: [{ nom: 'Assets 2D dessinés' }, { nom: 'Pixel art moderne' }, { nom: 'Rétro 8 bits' }],
        repeindre: [{ nom: 'Retouche de zone' }],
      } },
    { id: 'sdxl', nom: 'SDXL', defautInstalle: true,
      vitesse: 'environ 40 secondes par image',
      reglages: {
        creer: [{ nom: 'Pixel art SDXL' }, { nom: 'Icônes 16 × 16 vraies' }, { nom: 'Texture raccordable' }],
        repeindre: [{ nom: 'Retouche de zone' }],
      } },
    { id: 'isnet', nom: 'isnet-general-use', defautInstalle: true,
      vitesse: '170 Mo, environ 0,7 seconde par image',
      reglages: { detourer: [{ nom: 'Détourage général (le défaut depuis le 3 septembre)' }] } },
    { id: 'u2net', nom: 'u2net', defautInstalle: false,
      vitesse: '168 Mo, l’ancien défaut',
      manque: ['le fichier de poids u2net.onnx'],
      reglages: { detourer: [{ nom: 'Détourage rapide' }] } },
    { id: 'wan', nom: 'Wan2.2-I2V-A14B', fournisseurAffiche: 'Maison', defautInstalle: false,
      vitesse: 'mesuré au premier tirage — un lot ne recharge pas le modèle',
      manque: ['environ 9 Go de poids, pas encore descendus'],
      reglages: { animer: [{ nom: 'Image → vidéo' }], finir: [{ nom: 'Finir sur une image' }] } },
    { id: 'stableaudio', nom: 'Stable Audio 3 Small-SFX', defautInstalle: true,
      vitesse: 'quelques secondes par son',
      reglages: { son: [{ nom: 'Bruitage et ambiance' }] } },
    { id: 'asset3d', nom: 'asset3d', defautInstalle: false,
      vitesse: 'programme à part, ses réglages restent les siens',
      manque: ['le programme n’a jamais été lancé sur cette machine'],
      reglages: { objet3d: [{ nom: 'Reconstruction depuis une image' }] } },
  ];

  const LIGNE = [
    { id: 'gpt-image-2', fournisseur: 'OpenRouter', nom: 'openai/gpt-image-2',
      cout: 'coût illustratif, croît avec la qualité demandée',
      reglages: { creer: [{ nom: 'qualité basse' }, { nom: 'qualité moyenne' }, { nom: 'qualité haute' }] } },
    { id: 'gpt-image-sunburst', fournisseur: 'OpenRouter', nom: 'openai/gpt-image-2.5-sunburst',
      cout: 'coût illustratif, par appel',
      reglages: { creer: [{ nom: 'standard' }], repeindre: [{ nom: 'standard' }] } },
    { id: 'seedance', fournisseur: 'OpenRouter', nom: 'bytedance/seedance-2.0-mini',
      cout: 'coût illustratif, par seconde de clip',
      reglages: { animer: [{ nom: 'Image → vidéo' }], finir: [{ nom: 'Finir sur une image' }] } },
  ];

  const state = {
    page: 'moteurs', outil: 'creer',
    comfyui: true, openrouter: true,
    installes: new Set(), enCours: new Set(),
    formCle: false,
    modeleChoisi: {},
    pickerOuvert: false,
    signale: null,
  };

  function tousLesMoteurs() { return [...MACHINE.map(m => ({ ...m, groupe: 'machine' })), ...LIGNE.map(m => ({ ...m, groupe: 'ligne' }))]; }
  function moteur(id) { return tousLesMoteurs().find(m => m.id === id); }

  /* ——— L'état d'un moteur : la règle du point 8ter — ce qui manque au
     fournisseur grise ses modèles à lui, jamais tous, et le routage se fait
     par le fournisseur (le nom du groupe ici). ——— */
  function etatMoteur(m) {
    if (state.enCours.has(m.id)) return 'en-cours';
    if (m.groupe === 'ligne') return state.openrouter ? 'installe' : 'cle-manquante';
    if (!state.comfyui) return 'non-lance';
    return (m.defautInstalle || state.installes.has(m.id)) ? 'installe' : 'a-installer';
  }
  const LIBELLE_ETAT = { installe: 'Installé', 'a-installer': 'À installer', 'cle-manquante': 'Clé manquante', 'non-lance': 'ComfyUI non lancé', 'en-cours': 'Installation…' };

  function raisonMoteur(m, e) {
    if (e === 'installe' || e === 'en-cours') return '';
    if (e === 'non-lance') return 'ComfyUI n’est pas lancé sur cette machine.';
    if (e === 'cle-manquante') return `Aucune clé ${m.fournisseur} n’est branchée.`;
    return (m.manque || []).join(' · ') || 'À installer.';
  }

  /* ——— Actions ——— */
  function installer(id) {
    state.enCours.add(id);
    render();
    setTimeout(() => {
      state.enCours.delete(id);
      state.installes.add(id);
      render();
      toast(`${moteur(id).nom} installé (simulé) — rien n’a été téléchargé pour de vrai.`);
    }, 1200);
  }
  function ouvrirCle(fournisseur) { state.formCle = fournisseur; render(); }
  function enregistrerCle() {
    state.openrouter = true;
    state.formCle = false;
    render();
    toast('Clé OpenRouter enregistrée (simulé) — rien n’est vraiment envoyé.');
  }

  /* ——— La navigation ——— */
  const PORTES = [['Le jeu', null], ['Univers & toile', null], ['Les sujets', null], ['Galerie', null], ['Fabrications', 'creer'], ['Réglages', 'moteurs'], ['Guide', null]];
  function vueCarnet() {
    const courante = state.page === 'moteurs' ? 'moteurs' : (['creer', 'repeindre', 'animer'].includes(state.page) ? 'creer' : null);
    return `<div class="sidebar-heading"><div class="brand">Asset Kitchen</div></div>
      <div class="game"><div class="label">Le jeu ouvert</div><h3>Les marais d’ambre</h3><small>Pixel art · 32 px</small></div>
      <nav aria-label="Atelier">${PORTES.map(([n, p]) => p
        ? `<button data-action="aller" data-page="${p}" ${courante === p ? 'aria-current="page"' : ''}>${n}</button>`
        : `<button data-action="ailleurs" title="Ouvre la maquette de l’atelier">${n}<span class="muted">↗</span></button>`).join('')}</nav>
      <div class="sidefoot"><p class="small">Cette maquette ne montre que les moteurs. Les portes marquées ↗ ouvrent la maquette de l’atelier.</p></div>`;
  }

  /* ——— La page « Moteurs » (case 1 de MOM) ——— */
  function vueMoteurs() {
    const ONGLETS = [['Univers', false], ['Moteurs', true], ['Agent MCP', false], ['Consommations', false]];
    return `<div class="crumb"><span>Les marais d’ambre / Réglages</span></div>
      <div class="heading"><div><h1>Réglages</h1></div></div>
      <nav class="reglages-tabs" aria-label="Réglages">${ONGLETS.map(([n, actif]) => actif
        ? `<button type="button" aria-current="page">${n}</button>`
        : `<button type="button" disabled title="Hors de cette maquette">${n}</button>`).join('')}</nav>
      <p class="note-attention">Chaque moteur est décrit une seule fois ici. Les outils (Créer, Repeindre, Animer…)
        lisent cette même liste — voir <button class="petit" data-action="saut" data-id="creer">Créer</button> et
        <button class="petit" data-action="saut" data-id="repeindre">Repeindre</button>.</p>
      <div class="demo-bascules">
        <p>Pour essayer : ces deux boutons simulent ce qui manque côté fournisseur. Remarquez que couper l’un ne grise jamais les moteurs de l’autre (point 8ter).</p>
        <button type="button" data-action="basculer-comfyui" aria-pressed="${state.comfyui}">ComfyUI · ${state.comfyui ? 'lancé' : 'arrêté'}</button>
        <button type="button" data-action="basculer-openrouter" aria-pressed="${state.openrouter}">OpenRouter · ${state.openrouter ? 'clé branchée' : 'clé retirée'}</button>
      </div>
      <section class="groupe-moteurs" aria-label="Sur cette machine">
        <h2>Sur cette machine</h2>
        <p class="small muted">ComfyUI, une fois installé, sert tous les moteurs de ce groupe.</p>
        <div class="liste-moteurs">${MACHINE.map(vueCarteMachine).join('')}</div>
      </section>
      <section class="groupe-moteurs" aria-label="En ligne">
        <h2>En ligne</h2>
        <p class="small muted">La liste arrive d’OpenRouter ; elle entre dans le même catalogue, sans en changer la source.</p>
        ${state.formCle ? vueFormCle() : ''}
        <div class="liste-moteurs">${LIGNE.map(vueCarteLigne).join('')}</div>
      </section>`;
  }

  function vueFormCle() {
    return `<div class="cle-form"><label class="small" for="cle-input">Clé ${esc(state.formCle)}</label>
      <input id="cle-input" type="text" placeholder="sk-or-… (simulé, rien n’est envoyé)" autofocus>
      <button type="button" class="petit" data-action="enregistrer-cle">Enregistrer</button>
      <button type="button" class="petit quiet" data-action="annuler-cle">Annuler</button></div>`;
  }

  function vueBouton(m, e) {
    if (e === 'installe') return `<span class="small muted">rien à faire ici</span>`;
    if (e === 'en-cours') return `<button type="button" disabled>Installation…</button>`;
    if (e === 'non-lance') return `<button type="button" disabled title="Lancer ComfyUI d’abord, hors de cette maquette">Installer</button>`;
    if (e === 'cle-manquante') return `<button type="button" data-action="ouvrir-cle" data-fournisseur="${esc(m.fournisseur)}">Brancher une clé</button>`;
    return `<button type="button" data-action="installer" data-id="${m.id}">Installer</button>`;
  }

  function vueCarteMachine(m) {
    const e = etatMoteur({ ...m, groupe: 'machine' });
    const capacites = Object.keys(m.reglages);
    const reglages = capacites.flatMap(c => m.reglages[c].map(r => r.nom));
    const raison = raisonMoteur(m, e);
    return `<article class="moteur-carte ${state.signale === m.id ? 'signale' : ''}" data-moteur-carte="${m.id}">
      <div class="moteur-tete"><h3 class="moteur-nom">${esc(m.nom)}</h3><span class="pousse"></span>
        <span class="etat-badge ${e}">${LIBELLE_ETAT[e]}</span></div>
      <div class="capacites">${capacites.map(c => `<span class="capacite">${CAPACITES[c]}</span>`).join('')}</div>
      <div class="moteur-corps">
        <div>
          <div class="reglages-liste">${[...new Set(reglages)].map(n => `<span class="reglage-tag">${esc(n)}</span>`).join('')}</div>
          <p class="moteur-detail">${esc(m.vitesse)}</p>
          ${raison ? `<p class="moteur-manque">${esc(raison)}</p>` : ''}
        </div>
        <div class="moteur-actions">${vueBouton(m, e)}</div>
      </div>
    </article>`;
  }

  function vueCarteLigne(m) {
    const e = etatMoteur({ ...m, groupe: 'ligne' });
    const capacites = Object.keys(m.reglages);
    const reglages = capacites.flatMap(c => m.reglages[c].map(r => r.nom));
    const raison = raisonMoteur(m, e);
    return `<article class="moteur-carte ${state.signale === m.id ? 'signale' : ''}" data-moteur-carte="${m.id}">
      <div class="moteur-tete"><h3 class="moteur-nom"><span class="fournisseur">${esc(m.fournisseur)} · </span>${esc(m.nom)}</h3><span class="pousse"></span>
        <span class="etat-badge ${e}">${LIBELLE_ETAT[e]}</span></div>
      <div class="capacites">${capacites.map(c => `<span class="capacite">${CAPACITES[c]}</span>`).join('')}</div>
      <div class="moteur-corps">
        <div>
          <div class="reglages-liste">${[...new Set(reglages)].filter(n => n !== 'standard').map(n => `<span class="reglage-tag">${esc(n)}</span>`).join('')}</div>
          <p class="moteur-detail">${esc(m.cout)}</p>
          ${raison ? `<p class="moteur-manque">${esc(raison)}</p>` : ''}
        </div>
        <div class="moteur-actions">${vueBouton(m, e)}</div>
      </div>
    </article>`;
  }

  /* ——— Le choix du modèle dans un outil (case 2 de MOM) ——— */
  const OUTILS = [['creer', 'Créer'], ['repeindre', 'Repeindre'], ['animer', 'Animer']];
  function optionsPour(capacite) {
    const options = [];
    for (const m of MACHINE) {
      const rs = m.reglages[capacite];
      if (!rs) continue;
      const e = etatMoteur({ ...m, groupe: 'machine' });
      rs.forEach((r, i) => options.push({ id: `machine:${m.id}:${i}`, groupe: 'Sur cette machine', engineId: m.id, libelle: `${m.nom} · ${r.nom}`, etat: e, raison: raisonMoteur(m, e) }));
    }
    for (const m of LIGNE) {
      const rs = m.reglages[capacite];
      if (!rs) continue;
      const e = etatMoteur({ ...m, groupe: 'ligne' });
      rs.forEach((r, i) => options.push({ id: `ligne:${m.id}:${i}`, groupe: 'En ligne', engineId: m.id, libelle: r.nom === 'standard' ? `${m.fournisseur} · ${m.nom}` : `${m.fournisseur} · ${m.nom} · ${r.nom}`, etat: e, raison: raisonMoteur(m, e) }));
    }
    return options;
  }
  function defautPour(capacite) {
    const options = optionsPour(capacite);
    return (options.find(o => o.etat === 'installe') || options[0] || null)?.id ?? null;
  }

  function vuePicker(capacite) {
    const options = optionsPour(capacite);
    const choisiId = state.modeleChoisi[capacite] ?? defautPour(capacite);
    const choisi = options.find(o => o.id === choisiId) ?? null;
    const groupes = ['Sur cette machine', 'En ligne'];
    return `<div class="picker">
      <button type="button" class="picker-bouton" aria-haspopup="listbox" aria-expanded="${state.pickerOuvert}" data-action="picker-bascule">
        <span>${choisi ? esc(choisi.libelle) : 'Choisir un modèle…'}</span><span aria-hidden="true">${state.pickerOuvert ? '▾' : '▸'}</span>
      </button>
      <div class="picker-liste ${state.pickerOuvert ? '' : 'repliee'}" role="listbox" aria-label="Liste des modèles">
        ${groupes.map(g => {
          const de = options.filter(o => o.groupe === g);
          if (!de.length) return '';
          return `<div class="picker-section"><span class="label small">${g}</span>${de.map(o => vueOption(o, capacite, o.id === choisiId)).join('')}</div>`;
        }).join('')}
      </div>
      ${choisi && choisi.etat !== 'installe' ? `<p class="picker-choisi">Ce choix reste sélectionné, mais grisé : rien ne partira tant que le moteur n’est pas prêt.</p>` : ''}
    </div>`;
  }
  function vueOption(o, capacite, actif) {
    const gris = o.etat !== 'installe';
    // **Le bouton du lien vit à côté, jamais dedans** : `<button><a>…</a></button>`
    // est un imbriquement que le HTML interdit (contenu interactif dans un
    // bouton) — certains moteurs de rendu referment alors le bouton avant
    // l'heure, et le lien « l'installer dans Moteurs › » ne répond plus.
    return `<div class="picker-option-ligne">
      <button type="button" role="option" aria-selected="${actif}" aria-pressed="${actif}"
        class="picker-option ${gris ? 'gris' : ''}" aria-disabled="${gris}"
        data-action="${gris ? 'aucune' : 'choisir-modele'}" data-capacite="${capacite}" data-id="${o.id}">
        <span>${esc(o.libelle)}</span>
      </button>
      ${gris ? `<p class="raison">${esc(o.raison)} <button type="button" class="picker-lien" data-action="aller-moteurs" data-engine="${o.engineId}">l’installer dans Moteurs ›</button></p>` : ''}
    </div>`;
  }

  function vueOutil() {
    const TITRES = { creer: 'Créer', repeindre: 'Repeindre', animer: 'Animer une image' };
    const CAP = { creer: 'creer', repeindre: 'repeindre', animer: 'animer' };
    const capacite = CAP[state.outil];
    return `<div class="crumb"><span>Les marais d’ambre / Fabrications / ${TITRES[state.outil]}</span></div>
      <div class="heading"><div><h1>${TITRES[state.outil]}</h1></div></div>
      <div class="outil-tabs">${OUTILS.map(([id, n]) => `<button type="button" data-action="saut" data-id="${id}" aria-pressed="${state.outil === id}">${n}</button>`).join('')}</div>
      <div class="outil-surface">
        ${vueSurfaceOutil(state.outil)}
        <div class="outil-champ"><span>Modèle — mêmes noms, mêmes groupes qu’en page Moteurs</span>${vuePicker(capacite)}</div>
        <div class="row"><button type="button" class="rust" disabled>Lancer</button><span class="small muted">Maquette : le bouton ne part jamais.</span></div>
      </div>`;
  }
  function vueSurfaceOutil(outil) {
    if (outil === 'creer') return `<label class="outil-champ"><span>Décrire l’image</span><textarea placeholder="Ex. : le pèlerin, trois-quarts, lanterne allumée" readonly></textarea></label>`;
    if (outil === 'repeindre') return `<div class="outil-zone-demo"><div class="apercu"></div><p>Une zone peinte sur l’image du pèlerin — la retouche ne touche que ce qui est peint ici.</p></div>`;
    return `<div class="outil-zone-demo"><div class="apercu"></div><p>Image de départ obligatoire pour un clip (point 8bis) — aucun plafond ne la fait céder.</p></div>`;
  }

  /* ——— Rendu et événements ——— */
  function render() {
    sidebar.innerHTML = vueCarnet();
    main.innerHTML = state.page === 'moteurs' ? vueMoteurs() : vueOutil();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]');
    if (!b) { if (state.pickerOuvert && !e.target.closest('.picker')) { state.pickerOuvert = false; render(); } return; }
    const action = b.dataset.action;
    if (action === 'aller') { state.page = b.dataset.page; state.pickerOuvert = false; render(); }
    else if (action === 'ailleurs') { toast('Cette maquette ne montre que les moteurs — ouvrir la maquette de l’atelier : 02-atelier.html'); }
    else if (action === 'saut') {
      const id = b.dataset.id;
      if (id === 'moteurs') { state.page = 'moteurs'; }
      else { state.page = id; state.outil = id; }
      state.pickerOuvert = false;
      render();
    }
    else if (action === 'basculer-comfyui') { state.comfyui = !state.comfyui; render(); }
    else if (action === 'basculer-openrouter') { state.openrouter = !state.openrouter; render(); }
    else if (action === 'installer') { installer(b.dataset.id); }
    else if (action === 'ouvrir-cle') { ouvrirCle(b.dataset.fournisseur); }
    else if (action === 'annuler-cle') { state.formCle = false; render(); }
    else if (action === 'enregistrer-cle') { enregistrerCle(); }
    else if (action === 'picker-bascule') { e.preventDefault(); state.pickerOuvert = !state.pickerOuvert; render(); }
    else if (action === 'choisir-modele') { state.modeleChoisi[b.dataset.capacite] = b.dataset.id; state.pickerOuvert = false; render(); }
    else if (action === 'aller-moteurs') {
      e.preventDefault();
      state.page = 'moteurs'; state.signale = b.dataset.engine; state.pickerOuvert = false;
      render();
      const carte = $(`[data-moteur-carte="${state.signale}"]`);
      if (carte) carte.scrollIntoView({ block: 'center' });
      setTimeout(() => { state.signale = null; $$('.moteur-carte.signale').forEach(c => c.classList.remove('signale')); }, 2200);
      toast(`Vous voilà sur la fiche de ce moteur, dans Réglages › Moteurs.`);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.pickerOuvert) { state.pickerOuvert = false; render(); }
  });

  render();
})();
