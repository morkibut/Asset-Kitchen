/* Maquette du son — autonome. Les sons sont simulés : formes d'onde dessinées, lecture figurée
   par une tête qui avance. Aucun fichier audio, aucun appel, rien n'est gardé après rechargement. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MOINS = '−';
  const virgule = (n, d = 2) => n.toFixed(d).replace('.', ',');
  const db = n => (n < -0.05 ? MOINS : '') + virgule(Math.abs(n), 1);
  const pad2 = n => String(n).padStart(2, '0');
  const sidebar = $('#sidebar'), main = $('#main');

  function dureeTexte(s) {
    if (s < 10) return virgule(s, s < 1 ? 2 : 1) + ' s';
    if (s < 60) return Math.round(s) + ' s';
    const m = Math.floor(s / 60), r = Math.round(s - m * 60);
    return m + ' min ' + pad2(r);
  }
  function calculTexte(s) {
    if (s <= 1) return 'tout de suite';
    if (s < 60) return 'environ ' + Math.max(5, Math.ceil(s / 5) * 5) + ' s de calcul';
    const m = s / 60;
    if (m < 3) { const h = Math.round(m * 2) / 2; return 'environ ' + Math.floor(h) + ' min' + (h % 1 ? ' 30' : '') + ' de calcul'; }
    return 'environ ' + Math.round(m) + ' min de calcul';
  }
  const MOTS_VIDES = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'and', 'with', 'out', 'to', 'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'et', 'sur', 'dans', 'd', 'l']);
  function slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').split('_').filter(m => m && !MOTS_VIDES.has(m)).slice(0, 3).join('_') || 'son';
  }
  function alea(graine) {
    let a = graine >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let messageMinuterie;
  function toast(texte) { $('#message').textContent = texte; clearTimeout(messageMinuterie); messageMinuterie = setTimeout(() => { $('#message').textContent = ''; }, 5000); }

  /* ——— Le jeu, son univers sonore, ses familles ——— */
  const UNIVERS = {
    epoque: 'medieval fantasy, wood, leather, iron, no modern sounds',
    rendu: 'retro 16-bit game',
    orchestre: 'acoustic folk ensemble: lute, fiddle, flute, frame drum, harp',
    humeur: 'warm, whimsical, slightly melancholic',
    tonalite: 'ré mineur', tempo: 90,
  };
  const TON_EN = { 'ré mineur': 'D minor', 'la mineur': 'A minor', 'mi mineur': 'E minor', 'do majeur': 'C major', 'sol majeur': 'G major', 'fa majeur': 'F major' };
  const TEMPS = { '4/4': 4, '3/4': 3, '2/4': 2 };
  const ABSENT_MEDIUM = 'fichier absent : stable_audio_3_medium.safetensors, à poser dans models/checkpoints';
  const NIVEAU_COURT = ['Crête à −3 dB', 'Crête à −1 dB', 'Crête à −6 dB'];
  const FAMILLES = {
    bruitage: { nom: 'Bruitage', prefixe: 'sfx', tirages: [4, 8, 12], defTirages: 8, durees: [0.5, 1, 2, 4], defDuree: 1, calcul: d => 6 + dureeDe(d) * 1.5,
      moteurs: [['Stable Audio 3 Small-SFX', ''], ['Stable Audio Open 1.0', ''], ['Stable Audio 3 Medium', ABSENT_MEDIUM]],
      exemple: 'Ex. : sword slides out of a leather sheath', niveaux: NIVEAU_COURT, mono: true, boucle: false },
    interface: { nom: 'Interface et rétro', prefixe: 'ui', tirages: [4, 8, 12], defTirages: 8, calcul: () => 0.1,
      moteurs: [['sfxr, sans IA', '']], departs: ['Clic', 'Validation', 'Erreur', 'Saut', 'Pièce', 'Explosion'], niveaux: NIVEAU_COURT, mono: true, boucle: false },
    ambiance: { nom: 'Ambiance', prefixe: 'amb', tirages: [4, 8, 12], defTirages: 8, durees: [20, 30, 45, 60], defDuree: 30, calcul: d => dureeDe(d) * 0.8,
      moteurs: [['Stable Audio 3 Small-SFX', ''], ['Stable Audio 3 Medium', ABSENT_MEDIUM]],
      exemple: 'Ex. : rain in a stone cave, slow drips, distant wind', niveaux: ['−26 LUFS', '−24 LUFS', '−28 LUFS'], mono: false, boucle: true },
    musique: { nom: 'Musique', prefixe: 'mus', tirages: [2, 4, 6], defTirages: 4, calcul: d => 20 + dureeMusique(d.musique) * 0.6,
      moteurs: [['ACE-Step 1.5', ''], ['Stable Audio 3 Medium', ABSENT_MEDIUM]],
      exemple: 'Ex. : exploration, calm forest path at dawn', niveaux: ['−17 LUFS', '−16 LUFS', '−18 LUFS'], mono: false, boucle: true },
    chanson: { nom: 'Chanson et jingle', prefixe: 'mus', tirages: [2, 4, 6], defTirages: 4, durees: [2, 4, 8], defDuree: 4, calcul: d => d.mode === 'chanson' ? 180 : 10 + dureeDe(d) * 2,
      moteurs: [['ACE-Step 1.5 pour un jingle, YuE2 pour une chanson', '']],
      exemple: 'Ex. : victory fanfare, short and bright', exempleChanson: 'Ex. : tavern drinking song, male voice, lively', niveaux: ['−17 LUFS', '−16 LUFS', '−18 LUFS'], mono: false, boucle: false },
    voix: { nom: 'Voix', prefixe: 'vo', tirages: [2, 4, 8], defTirages: 4, calcul: () => 8,
      moteurs: [['Qwen3-TTS puis Chatterbox', '']],
      exemple: 'La réplique, en français. Ex. : Encore une nuit sans étoiles…', niveaux: ['−17 LUFS', '−16 LUFS', '−18 LUFS'], mono: true, boucle: false },
  };
  const VOIX = ['Le pèlerin', 'Le marchand', 'La narratrice'];
  const ANIMS = {
    'marche-sud': { nom: 'Marche · sud', n: 6 },
    'marche-nord': { nom: 'Marche · nord', n: 6 },
    'attaque-sud': { nom: 'Attaque · sud', n: 5 },
  };
  const CADENCES = [6, 8, 12];

  function dureeMusique(m) { return (m.mesures + 1) * TEMPS[m.mesure] * 60 / m.tempo; }
  function dureeBoucle(m) { return m.mesures * TEMPS[m.mesure] * 60 / m.tempo; }
  function dureeDe(d) { const F = FAMILLES[d.famille]; return d.durees[d.famille] ?? F.defDuree; }
  function aDuree(d) { return !!FAMILLES[d.famille].durees && !(d.famille === 'chanson' && d.mode === 'chanson'); }
  function nbTirages(d) { return d.tirages[d.famille] ?? FAMILLES[d.famille].defTirages; }
  function texteDe(d) { return d.textes[d.famille] ?? ''; }
  function estFrancais(t) { return /[éèêàùçôîœ]/i.test(t) || /\b(le|la|les|un|une|des|du|et|sur|dans|avec|qui|au|aux|épée)\b/i.test(t); }

  function nouvelleDemande(famille, texte = '') {
    return { famille, textes: { [famille]: texte }, durees: {}, tirages: {}, moteurs: {}, mode: 'jingle', depart: 'Clic', voix: 'Le pèlerin', emotion: 0.5,
      paroles: '[Verse]\nPour the ale and raise the light\n[Chorus]\nSing until the morning comes',
      musique: { tempo: UNIVERS.tempo, tonalite: UNIVERS.tonalite, mesure: '4/4', mesures: 24, instrumental: true },
      manuel: null, panneau: null };
  }
  function nouveauCtx(famille, texte) { return { demande: nouvelleDemande(famille, texte), series: [], courante: -1, nom: '', dest: 'jeu' }; }

  /* ——— Le texte qui part ——— */
  function compose(d) {
    const tx = texteDe(d).trim();
    const T = tx ? [{ t: tx }] : [{ t: '…', vide: 1 }];
    const A = t => ({ t, a: 1 });
    const m = d.musique;
    switch (d.famille) {
      case 'bruitage': return [{ parts: [A('TrackType: SFX. '), ...T, A(`, ${UNIVERS.rendu}, one-shot, close-mic'd, dry, no reverb, isolated.`)] }];
      case 'ambiance': return [{ parts: [A('TrackType: SFX. '), ...T, A(`, continuous, steady, field recording, no music, stereo, ${UNIVERS.epoque}.`)] }];
      case 'musique': return [
        { cle: 'Style', parts: [...T, A(`, ${UNIVERS.orchestre}, ${UNIVERS.humeur}`)] },
        { cle: 'Paroles', parts: [A(m.instrumental ? '[Intro] [Instrumental] [Outro]' : '[Intro] [Verse] [Chorus] [Outro]')] },
        { cle: 'Tempo', parts: [{ t: m.tempo + ' BPM' }] },
        { cle: 'Tonalité', parts: [{ t: TON_EN[m.tonalite] }] },
        { cle: 'Mesure', parts: [{ t: m.mesure }] },
        { cle: 'Durée', parts: [{ t: virgule(dureeMusique(m), 1) + ' s' }, A(` (${m.mesures + 1} mesures, dont une de marge pour couper la boucle)`)] }];
      case 'chanson':
        if (d.mode === 'jingle') return [
          { cle: 'Style', parts: [...T, A(`, ${UNIVERS.orchestre}`)] },
          { cle: 'Tempo', parts: [A(UNIVERS.tempo + ' BPM')] },
          { cle: 'Tonalité', parts: [A(TON_EN[UNIVERS.tonalite])] },
          { cle: 'Durée', parts: [{ t: dureeDe(d) + ' s' }] }];
        return [
          { cle: 'Style', parts: [A('English, '), ...T, A(`, ${UNIVERS.orchestre}, ${UNIVERS.tempo} BPM`)] },
          { cle: 'Paroles', parts: [{ t: d.paroles }] }];
      case 'voix': return [
        { cle: 'Voix', parts: [{ t: d.voix }, A(' (son enregistrement de référence)')] },
        { cle: 'Texte', parts: T },
        { cle: 'Émotion', parts: [{ t: virgule(d.emotion, 1) }] }];
      default: return null;
    }
  }
  function composeTexte(d) {
    const l = compose(d); if (!l) return '';
    return l.map(x => (x.cle ? x.cle + ' : ' : '') + x.parts.map(p => p.vide ? '' : p.t).join('')).join('\n');
  }
  function raisonGrisee(d) {
    if (d.famille === 'interface') return '';
    if (!texteDe(d).trim()) return d.famille === 'voix' ? 'Écrivez d’abord la réplique.' : 'Écrivez d’abord ce qu’on doit entendre.';
    return '';
  }
  function titreDe(d) {
    if (d.famille === 'interface') return 'Départ « ' + d.depart + ' »';
    return texteDe(d).trim();
  }

  /* ——— Les emplacements du pèlerin ——— */
  const EMPS = [
    { id: 'pas', nom: 'Pas', famille: 'bruitage', suggestion: 'Soft leather boots, footsteps on packed dirt', demo: [0, 2, 5], anim: 'marche-sud', reperes: { 'marche-sud': [3] } },
    { id: 'attaque', nom: 'Attaque', famille: 'bruitage', suggestion: 'Wooden staff swing, short whoosh', demo: [0, 1, 4, 7], anim: 'attaque-sud', reperes: { 'attaque-sud': [4] } },
    { id: 'coup', nom: 'Coup reçu', famille: 'bruitage', suggestion: 'Dull hit on a thick wool cloak', reperes: {} },
    { id: 'mort', nom: 'Mort', famille: 'bruitage', suggestion: 'Body falls on packed dirt, lantern glass cracks', reperes: {} },
    { id: 'replique', nom: 'Réplique', famille: 'voix', suggestion: 'Encore une nuit sans étoiles…', reperes: {} },
  ];
  const AUTRES = [
    { cle: 'mus-exploration', titre: 'Exploration', famille: 'musique', nom: 'mus_exploration', n: 1, musique: { tempo: 90, mesures: 24, mesure: '4/4' } },
    { cle: 'amb-foret', titre: 'Forêt au crépuscule', famille: 'ambiance', nom: 'amb_foret', n: 1 },
  ];

  const state = {
    page: 'atelier', ctxId: null, onglet: 'sons',
    libre: nouveauCtx('bruitage', ''),
    emps: EMPS.map(e => ({ ...e, reperes: JSON.parse(JSON.stringify(e.reperes)), cadence: 8, ctx: null, dernier: 0, joue: false })),
    selection: null, volet: null, calage: null, ajoutEmp: false,
    plis: {}, livrer: { exclus: new Set(), livreA: '' },
    no: 0,
  };
  const emp = id => state.emps.find(e => e.id === id);
  const ctx = () => state.ctxId ? emp(state.ctxId).ctx : state.libre;
  const serieCourante = (c = ctx()) => c.series[c.courante] || null;
  const gardes = c => c ? c.series.flatMap(s => s.tirages.filter(t => t.pret && t.garde).map(t => ({ s, t }))) : [];
  const trouver = (no, i) => { for (const c of tousCtx()) { const s = c.series.find(s => s.no === no); if (s) return { s, t: s.tirages[i] }; } return null; };
  const tousCtx = () => [state.libre, ...state.emps.map(e => e.ctx).filter(Boolean)];
  const nomEmp = e => FAMILLES[e.famille].prefixe + '_pelerin_' + slug(e.nom);
  function nomLibre(c) {
    if (c.nom) return c.nom;
    const g = gardes(c)[0]; const s = g ? g.s : serieCourante(c);
    return s ? FAMILLES[s.famille].prefixe + '_' + slug(s.titre) : 'sfx_son';
  }

  /* ——— Fabriquer une série (simulé) ——— */
  function creerSerie(d) {
    const n = nbTirages(d);
    return { no: ++state.no, famille: d.famille, mode: d.mode, titre: titreDe(d), texte: d.manuel ?? composeTexte(d), duree: dureeDe(d),
      musique: { ...d.musique }, tirages: Array.from({ length: n }, (_, i) => ({ i, pret: false, garde: false })) };
  }
  function genererOnde(s, r) {
    const f = s.famille, longue = f === 'musique' || (f === 'chanson' && s.mode === 'chanson');
    const n = longue ? 260 : f === 'ambiance' ? 200 : 120;
    const pts = new Array(n); const phi = r() * 6;
    if (f === 'bruitage') {
      const coups = [{ t: 0.02 + r() * 0.06, a: 1, k: 9 + r() * 8 }];
      if (r() < 0.6) coups.push({ t: 0.3 + r() * 0.25, a: 0.45 + r() * 0.35, k: 10 + r() * 8 });
      for (let i = 0; i < n; i++) { const x = i / (n - 1); let a = 0; coups.forEach(h => { if (x >= h.t) a += h.a * Math.exp(-(x - h.t) * h.k); else if (x > h.t - 0.02) a += h.a * (1 - (h.t - x) / 0.02) * 0.8; }); pts[i] = Math.min(1, a * (0.35 + 0.65 * r())); }
    } else if (f === 'interface') {
      const fin = 0.55 + r() * 0.3, marche = r() < 0.5;
      for (let i = 0; i < n; i++) { const x = i / (n - 1); let a = x < 0.04 ? x / 0.04 : x < fin ? (marche && x > fin / 2 ? 0.6 : 0.9) * (1 - (x - 0.04) / fin * 0.3) : Math.max(0, 0.6 * (1 - (x - fin) / 0.12)); pts[i] = a * (0.85 + 0.15 * r()); }
    } else if (f === 'ambiance') {
      for (let i = 0; i < n; i++) { const x = i / (n - 1); let a = 0.32 + 0.1 * Math.sin(x * 6.28 * 3 + phi) + 0.06 * Math.sin(x * 6.28 * 13 + phi * 2); a *= 0.55 + 0.45 * r(); if (r() > 0.965) a += 0.25 + r() * 0.2; pts[i] = Math.min(1, a); }
    } else if (longue) {
      const B = TEMPS[s.musique.mesure] || 4, mes = f === 'musique' ? s.musique.mesures + 1 : 40, temps = mes * B;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1), b = x * temps, frac = b % 1, mesure = Math.floor(b / B), accent = Math.floor(b) % B === 0 ? 1 : 0.7;
        let dyn = mesure < 2 ? 0.5 + 0.2 * mesure : mesure >= mes - 1 ? 0.3 : 0.82 + 0.12 * Math.sin(mesure * 0.9 + phi);
        if (f === 'chanson') dyn *= 0.8 + 0.2 * Math.sin(x * 20 + phi);
        pts[i] = Math.min(1, dyn * (0.35 + 0.45 * accent * Math.exp(-frac * 4)) * (0.8 + 0.2 * r()));
      }
    } else if (f === 'chanson') {
      for (let i = 0; i < n; i++) { const x = i / (n - 1); const a = x < 0.7 ? 0.3 + 0.5 * x / 0.7 : x < 0.75 ? 1 : Math.exp(-(x - 0.75) * 8); pts[i] = Math.min(1, a * (0.75 + 0.25 * r())); }
    } else {
      const syl = 4 + Math.floor(r() * 4), centres = Array.from({ length: syl }, (_, k) => 0.1 + 0.8 * (k + 0.3 * r()) / syl), hauts = centres.map(() => 0.5 + 0.5 * r());
      for (let i = 0; i < n; i++) { const x = i / (n - 1); let a = 0; centres.forEach((c, k) => { a += hauts[k] * Math.exp(-Math.pow((x - c) / 0.035, 2)); }); pts[i] = Math.min(1, a * (0.7 + 0.3 * r())); }
    }
    return pts;
  }
  function fabriquer(s, t) {
    const r = alea(s.no * 1009 + t.i * 7 + 13);
    const f = s.famille;
    t.duree = f === 'bruitage' ? s.duree * (0.75 + r() * 0.3) : f === 'interface' ? 0.08 + r() * 0.25 : f === 'ambiance' ? s.duree
      : f === 'musique' ? dureeMusique(s.musique) : f === 'chanson' ? (s.mode === 'chanson' ? 90 + r() * 60 : s.duree) : 1.2 + r() * 1.6;
    t.onde = genererOnde(s, r);
    t.sature = f === 'bruitage' && t.i === 4;
    if (t.sature) t.onde = t.onde.map(v => Math.min(1, v * 1.6));
    t.crete = t.sature ? 0 : -(0.5 + r() * 4.5);
    const L = { ambiance: [-30, -22], musique: [-19, -14], chanson: [-18, -13], voix: [-20, -15] }[f];
    t.niveau = L ? L[0] + r() * (L[1] - L[0]) : null;
    t.pret = true;
  }
  const minuteries = new Set();
  function planifier(s) {
    const pas = { musique: 650, chanson: 750 }[s.famille] || 260;
    const tic = () => {
      const t = s.tirages.find(t => !t.pret);
      if (!t) { minuteries.delete(s.no); majCarnet(); return; }
      fabriquer(s, t);
      const suivant = s.tirages.find(t => !t.pret);
      [t, suivant].filter(Boolean).forEach(x => { const el = $(`[data-tirage="${s.no}-${x.i}"]`); if (el) el.outerHTML = vueTuile(s, x); });
      const r = $('#restant-' + s.no); if (r) r.textContent = restantTexte(s);
      majCarnet();
      setTimeout(tic, pas);
    };
    minuteries.add(s.no);
    setTimeout(tic, pas);
  }
  function restantTexte(s) {
    const reste = s.tirages.filter(t => !t.pret).length;
    if (!reste) return '';
    const d = { famille: s.famille, mode: s.mode, durees: { [s.famille]: s.duree }, musique: s.musique };
    const sec = FAMILLES[s.famille].calcul(d) * reste;
    return 'Il reste ' + (sec < 60 ? 'environ ' + Math.max(5, Math.ceil(sec / 5) * 5) + ' s' : 'environ ' + Math.round(sec / 60) + ' min') + ' · ' + reste + ' tirage' + (reste > 1 ? 's' : '') + ' à venir';
  }
  function reglageParDefaut(s, t) {
    const F = FAMILLES[s.famille];
    return { debut: 0, fin: t.duree, fonduE: 0, fonduS: F.boucle ? 0 : 20, boucle: F.boucle, bDebut: 0, bFin: t.duree, bmD: 1, bmF: s.musique.mesures,
      enchaine: s.famille === 'ambiance' ? 50 : 0, niveau: F.niveaux[0], mono: F.mono, version: 1 };
  }
  function lancer() {
    const c = ctx(), d = c.demande;
    if (raisonGrisee(d)) return;
    const s = creerSerie(d);
    c.series.push(s); c.courante = c.series.length - 1;
    state.selection = { no: s.no, i: 0 }; state.volet = null; d.panneau = null;
    arreterLecture();
    if (FAMILLES[s.famille].calcul(d) <= 1) s.tirages.forEach(t => fabriquer(s, t));
    else planifier(s);
    render();
  }
  function remplirDemo(e) {
    e.ctx = nouveauCtx(e.famille, e.suggestion);
    const s = creerSerie(e.ctx.demande);
    s.tirages.forEach(t => fabriquer(s, t));
    (e.demo || []).forEach(i => { const t = s.tirages[i]; t.garde = true; t.reglage = reglageParDefaut(s, t); });
    e.ctx.series.push(s); e.ctx.courante = 0;
  }
  state.emps.forEach(e => { if (e.demo) remplirDemo(e); });

  /* ——— Formes d'onde ——— */
  function chemin(pts, w, h, env) {
    const n = pts.length, m = h / 2, haut = [], bas = [];
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) * w).toFixed(1);
      const v = Math.max(0.6, pts[i] * (env ? env(i / (n - 1)) : 1) * m * 0.94);
      haut.push(x + ',' + (m - v).toFixed(1)); bas.push(x + ',' + (m + v).toFixed(1));
    }
    return 'M' + haut.join('L') + 'L' + bas.reverse().join('L') + 'Z';
  }
  function cadreOnde(cle, pts, o = {}) {
    const h = o.h || 64, d = chemin(pts, 1000, h, o.env);
    let fond = '', dessus = '';
    const ligne = (x, cls) => `<line x1="${x}" x2="${x}" y1="0" y2="${h}" class="${cls}" vector-effect="non-scaling-stroke"/>`;
    if (o.barres) for (let k = 1; k < o.barres; k++) fond += ligne((k / o.barres * 1000).toFixed(1), 'barre');
    if (o.hors) dessus += `<rect x="0" y="0" width="${(o.hors[0] * 1000).toFixed(1)}" height="${h}" class="hors"/><rect x="${(o.hors[1] * 1000).toFixed(1)}" y="0" width="${((1 - o.hors[1]) * 1000).toFixed(1)}" height="${h}" class="hors"/>`;
    if (o.boucle) o.boucle.forEach(f => { dessus += ligne((f * 1000).toFixed(1), 'boucle'); });
    if (o.joint != null) dessus += ligne((o.joint * 1000).toFixed(1), 'joint');
    const svg = cls => `<svg class="${cls}" viewBox="0 0 1000 ${h}" preserveAspectRatio="none" aria-hidden="true">${cls === 'fond' ? fond : ''}<path d="${d}"/>${dessus}</svg>`;
    return `<span class="onde-cadre" data-lecture="${cle}" style="height:${h}px">${svg('fond')}${svg('jouee')}<span class="tete"></span></span>`;
  }

  /* ——— La lecture simulée ——— */
  let lecture = null, lectureMinuterie = null;
  function demarrerLecture(cle, total, depuis, fin, boucle) {
    arreterLecture();
    lecture = { cle, total, pos0: depuis, fin, boucle, t0: performance.now() };
    majBoutonsLecture();
    lectureMinuterie = setInterval(() => tic(performance.now()), 33);
    tic(performance.now());
  }
  function arreterLecture() {
    clearInterval(lectureMinuterie); lectureMinuterie = null;
    if (!lecture) return;
    const cle = lecture.cle; lecture = null;
    $$(`[data-lecture="${cle}"]`).forEach(c => { c.classList.remove('joue'); const j = c.querySelector('.jouee'); if (j) j.style.clipPath = ''; });
    majBoutonsLecture();
  }
  function tic(now) {
    const L = lecture; if (!L) return;
    let pos = L.pos0 + (now - L.t0) / 1000;
    if (pos >= L.fin) {
      if (L.boucle) { L.pos0 = L.boucle[0]; L.fin = L.boucle[1]; L.t0 = now; pos = L.pos0; }
      else { arreterLecture(); return; }
    }
    const f = Math.max(0, Math.min(1, pos / L.total));
    $$(`[data-lecture="${L.cle}"]`).forEach(c => {
      c.classList.add('joue');
      const j = c.querySelector('.jouee'); if (j) j.style.clipPath = `inset(0 ${((1 - f) * 100).toFixed(2)}% 0 0)`;
      const t = c.querySelector('.tete'); if (t) t.style.left = (f * 100).toFixed(2) + '%';
    });
  }
  function majBoutonsLecture() {
    $$('[data-bouton-lecture]').forEach(b => {
      const joue = lecture && lecture.cle === b.dataset.boutonLecture;
      b.textContent = (joue ? '■ Arrêter' : '▶ ' + (b.dataset.libelle || 'Écouter'));
    });
  }
  function ecouterTirage(no, i, fraction = 0) {
    const x = trouver(no, i); if (!x || !x.t.pret) return;
    const cle = `t${no}-${i}`;
    state.selection = { no, i }; majSelection();
    if (lecture && lecture.cle === cle) { arreterLecture(); return; }
    demarrerLecture(cle, x.t.duree, fraction * x.t.duree, x.t.duree, null);
  }
  function majSelection() {
    $$('.tirage').forEach(el => {
      const [no, i] = el.dataset.tirage.split('-').map(Number);
      const sel = state.selection && state.selection.no === no && state.selection.i === i;
      el.classList.toggle('choisi', !!sel);
      if (sel) el.scrollIntoView({ block: 'nearest' });
    });
  }

  /* ——— Le carnet ——— */
  const PORTES = [['Le jeu', null], ['Univers & toile', null], ['Les sujets', 'sujet'], ['Galerie', null], ['Fabrications', 'atelier'], ['Livrer au jeu', 'livrer'], ['Réglages', null], ['Guide', null]];
  function vueCarnet() {
    const enCours = minuteries.size;
    const courante = state.page === 'atelier' && state.ctxId ? 'sujet' : state.page;
    return `<div class="sidebar-heading"><div class="brand">Asset Kitchen</div></div>
      <div class="game"><div class="label">Le jeu ouvert</div><h3>Les marais d’ambre</h3><small>Pixel art · 32 px</small></div>
      <nav aria-label="Atelier">${PORTES.map(([n, p]) => p
        ? `<button data-action="aller" data-page="${p}" ${courante === p ? 'aria-current="page"' : ''}>${n}${n === 'Fabrications' && enCours ? `<span class="mono">${enCours}</span>` : ''}</button>`
        : `<button data-action="ailleurs" title="Ouvre la maquette de l’atelier">${n}<span class="muted">↗</span></button>`).join('')}</nav>
      <div class="sidefoot"><p class="small">Cette maquette ne montre que le son. Les portes marquées ↗ ouvrent la maquette de l’atelier.</p></div>`;
  }
  function majCarnet() { sidebar.innerHTML = vueCarnet(); }

  /* ——— Un son : la demande, la série, les gardés ——— */
  function vueAtelier() {
    const c = ctx(), e = state.ctxId ? emp(state.ctxId) : null;
    const fil = e ? `Les marais d’ambre / Les sujets / Le pèlerin / Sons / ${esc(e.nom)}` : 'Les marais d’ambre / Fabrications / Un son';
    const cible = state.volet && trouver(state.volet.no, state.volet.i);
    return `<div class="crumb"><span>${fil}</span></div>
      <div class="heading"><div><h1>${e ? esc(e.nom) + ' · Le pèlerin' : 'Un son'}</h1></div>${e ? '<div class="row"><button data-action="retour-sujet">Retour au pèlerin</button></div>' : ''}</div>
      <div class="son-plan ${cible ? 'avec-volet' : ''}"><div class="son-colonne">${vueDemande(c)}${vueSerie(c)}</div>${cible ? vueVolet(cible.s, cible.t) : ''}</div>`;
  }
  function vueDemande(c) {
    const d = c.demande, F = FAMILLES[d.famille], e = state.ctxId ? emp(state.ctxId) : null;
    const familles = e ? `<span class="puce actif">${F.nom}</span>`
      : Object.entries(FAMILLES).map(([id, f]) => `<button class="puce" data-action="famille" data-id="${id}" aria-pressed="${d.famille === id}">${f.nom}</button>`).join('');
    let haut = '', corps = '';
    if (d.famille === 'interface') haut = `<div class="ligne-choix"><span class="small">Départ</span>${F.departs.map(x => `<button class="puce" data-action="depart" data-v="${x}" aria-pressed="${d.depart === x}">${x}</button>`).join('')}</div>`;
    if (d.famille === 'chanson') haut = `<div class="ligne-choix">${[['jingle', 'Jingle'], ['chanson', 'Chanson']].map(([v, n]) => `<button class="puce" data-action="mode" data-v="${v}" aria-pressed="${d.mode === v}">${n}</button>`).join('')}</div>`;
    if (d.famille === 'voix') haut = `<label class="ligne-choix small">Voix <select id="voix" data-champ="voix">${VOIX.map(v => `<option ${v === d.voix ? 'selected' : ''}>${v}</option>`).join('')}</select><span class="muted">sa voix gardée sur sa fiche</span></label>`;
    if (d.famille !== 'interface') {
      const ph = d.famille === 'chanson' && d.mode === 'chanson' ? F.exempleChanson : F.exemple;
      corps += `<textarea id="texte" class="texte-son" data-champ="texte" rows="2" placeholder="${esc(ph)}" aria-label="Ce qu’on doit entendre">${esc(texteDe(d))}</textarea>`;
      if (d.famille === 'chanson' && d.mode === 'chanson') corps += `<textarea id="paroles" class="texte-son paroles" data-champ="paroles" aria-label="Paroles">${esc(d.paroles)}</textarea>`;
      if (d.famille !== 'voix' && estFrancais(texteDe(d))) corps += `<p class="note-attention">Le moteur comprend l’anglais. Ce texte part tel quel, sans traduction.</p>`;
    }
    if (d.famille === 'musique') {
      const m = d.musique;
      corps += `<div class="musique-ligne">
        <label>Tempo<span><input id="m-tempo" type="number" min="40" max="200" data-champ="m:tempo" value="${m.tempo}"> BPM</span></label>
        <label>Tonalité<select id="m-ton" data-champ="m:tonalite">${Object.keys(TON_EN).map(t => `<option ${t === m.tonalite ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Mesure<select id="m-mes" data-champ="m:mesure">${Object.keys(TEMPS).map(t => `<option ${t === m.mesure ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Mesures<input id="m-n" type="number" min="4" max="96" data-champ="m:mesures" value="${m.mesures}"></label>
        <span class="duree-calculee"><span class="muted">Durée de la boucle</span><strong class="mono">${dureeTexte(dureeBoucle(m))}</strong></span>
        <label class="coche"><input id="m-inst" type="checkbox" data-champ="m:instrumental" ${m.instrumental ? 'checked' : ''}> Instrumental</label></div>`;
    }
    if (d.famille === 'chanson' && d.mode === 'jingle') corps += `<p class="small muted" style="margin:0">Tonalité et tempo de l’univers : ${UNIVERS.tonalite} · ${UNIVERS.tempo} BPM.</p>`;
    const raison = raisonGrisee(d), n = nbTirages(d), sec = F.calcul(d) * n;
    const resume = [aDuree(d) ? virgule(dureeDe(d), dureeDe(d) % 1 ? 1 : 0) + ' s' : null, n + ' tirages'].filter(Boolean).join(' · ');
    return `<section class="demande" aria-label="La demande">
      <div class="familles">${familles}</div>${haut}${corps}
      <div class="demande-pied">
        <button class="bascule" data-action="panneau" data-id="relire" aria-expanded="${d.panneau === 'relire'}">Relire avant l’envoi${d.manuel !== null ? ' · modifié à la main' : ''}</button>
        <button class="bascule" data-action="panneau" data-id="reglages" aria-expanded="${d.panneau === 'reglages'}">Réglages · <span class="mono">${resume}</span></button>
        ${raison ? `<span class="cout">${raison}</span>` : `<span class="cout"><span class="ok">Gratuit</span> · ${calculTexte(sec)}</span>`}
        <button class="rust" data-action="lancer" ${raison ? 'disabled' : ''}>Lancer ${n} tirages</button>
      </div>
      ${d.panneau === 'relire' ? vueRelire(d) : d.panneau === 'reglages' ? vueReglages(d) : ''}
    </section>`;
  }
  function vueRelire(d) {
    if (d.famille === 'interface') return `<div class="panneau"><p style="margin:0">Aucun texte ne part : sfxr part du réglage « ${esc(d.depart)} » et en tire ${nbTirages(d)} variantes.</p></div>`;
    if (d.manuel !== null) return `<div class="panneau"><p class="small" style="margin:0">Modifier pour cette génération uniquement.</p><textarea id="manuel" class="compose-edit" data-champ="manuel" aria-label="Texte qui part">${esc(d.manuel)}</textarea><div><button class="petit" data-action="manuel-annuler">Revenir au texte composé</button></div></div>`;
    const lignes = compose(d).map(l => `<div>${l.cle ? `<span class="cle">${l.cle} : </span>` : ''}${l.parts.map(p => `<span class="${p.a ? 'ajout' : p.vide ? 'vide' : ''}">${esc(p.t)}</span>`).join('')}</div>`).join('');
    return `<div class="panneau"><p class="small" style="margin:0">Le texte final tel qu’il sera envoyé.</p><div class="compose">${lignes}</div>
      <div class="row between"><p class="small" style="margin:0"><span class="legende-vous">en noir : votre texte</span> · <span class="legende-ajout">en gris : ajouté par l’univers et la famille</span></p><button class="petit" data-action="manuel-ouvrir">Éditer ce texte ›</button></div></div>`;
  }
  function vueReglages(d) {
    const F = FAMILLES[d.famille];
    const puces = (liste, courant, action, fmt) => liste.map(v => `<button class="puce" data-action="${action}" data-v="${v}" aria-pressed="${v === courant}">${fmt(v)}</button>`).join('');
    const moteur = d.moteurs[d.famille] ?? F.moteurs[0][0];
    return `<div class="panneau">
      ${aDuree(d) ? `<div class="ligne-choix"><span class="small">Durée</span>${puces(F.durees, dureeDe(d), 'duree', v => virgule(v, v % 1 ? 1 : 0) + ' s')}</div>` : ''}
      <div class="ligne-choix"><span class="small">Tirages</span>${puces(F.tirages, nbTirages(d), 'tirages', v => v)}</div>
      <label class="ligne-choix small">Fournisseur et modèle <select id="moteur" data-champ="moteur">${F.moteurs.map(([n, r]) => `<option value="${esc(n)}" ${r ? 'disabled' : ''} ${n === moteur ? 'selected' : ''}>Cette machine · ${esc(n)}${r ? ' — ' + esc(r) : ''}</option>`).join('')}</select></label>
      ${d.famille === 'voix' ? `<label class="reglage"><span>Émotion · 0,4 pour un narrateur, 0,9 pour un cri</span><span class="valeur mono" data-affiche="emotion">${virgule(d.emotion, 1)}</span><input id="emotion" type="range" min="0" max="1" step="0.1" value="${d.emotion}" data-champ="emotion"></label>` : ''}
    </div>`;
  }
  function vueSerie(c) {
    const s = serieCourante(c);
    if (!s) return `<div class="empty son-vide"><p>Les tirages arrivent ici, à écouter et à garder.</p></div>`;
    const F = FAMILLES[s.famille], longue = s.famille === 'musique' || (s.famille === 'chanson' && s.mode === 'chanson');
    const autres = c.series.filter(x => x !== s);
    return `<section class="serie" aria-label="La série">
      <div class="serie-tete"><div><h2>Série ${c.courante + 1}</h2><p class="small">${F.nom} · ${s.tirages.length} tirages · ${esc(s.titre)}</p></div>
        <p class="touches small"><kbd>←</kbd> <kbd>→</kbd> passer · <kbd>Espace</kbd> écouter · <kbd>G</kbd> garder</p></div>
      <p class="restant" id="restant-${s.no}">${restantTexte(s)}</p>
      <div class="grille ${longue ? 'longue' : ''}">${s.tirages.map(t => vueTuile(s, t)).join('')}</div>
      ${autres.length ? `<details class="precedentes" data-pli="precedentes" ${state.plis.precedentes ? 'open' : ''}><summary>Séries précédentes · ${autres.length}</summary>${c.series.map((x, k) => x === s ? '' : `<div class="line"><span>Série ${k + 1} · ${x.tirages.length} tirages · ${x.tirages.filter(t => t.garde).length} gardé${x.tirages.filter(t => t.garde).length > 1 ? 's' : ''} · <span class="muted">${esc(x.titre)}</span></span><button class="petit" data-action="rouvrir-serie" data-k="${k}">Rouvrir</button></div>`).join('')}</details>` : ''}
    </section>${vueGardes(c)}`;
  }
  function vueTuile(s, t) {
    const longue = s.famille === 'musique' || (s.famille === 'chanson' && s.mode === 'chanson');
    const h = longue ? 72 : 64;
    if (!t.pret) {
      const enCalcul = s.tirages.find(x => !x.pret) === t;
      return `<article class="tirage" data-tirage="${s.no}-${t.i}"><div class="tirage-tete"><span class="mono num">${t.i + 1}</span></div><span class="onde-cadre vide ${enCalcul ? 'calcul' : ''}" style="height:${h}px">${enCalcul ? 'en calcul' : 'en attente'}</span><div class="mesures mono"></div></article>`;
    }
    const sel = state.selection && state.selection.no === s.no && state.selection.i === t.i;
    const barres = s.famille === 'musique' ? s.musique.mesures + 1 : 0;
    const niveau = t.niveau != null ? ` · ${MOINS}${Math.round(Math.abs(t.niveau))} LUFS` : '';
    const version = t.garde && t.reglage.version > 1 ? `<span class="small">v${t.reglage.version}</span>` : '';
    return `<article class="tirage ${t.garde ? 'garde' : ''} ${sel ? 'choisi' : ''}" data-tirage="${s.no}-${t.i}">
      <div class="tirage-tete"><span class="mono num">${t.i + 1}</span>${t.sature ? '<span class="tag-attention">saturé</span>' : ''}${version}
        <span class="pousse"></span><button class="petit" data-action="garder" data-no="${s.no}" data-i="${t.i}" aria-pressed="${t.garde}">${t.garde ? '✓ Gardé' : 'Garder'}</button></div>
      <button class="onde" data-action="ecouter" data-no="${s.no}" data-i="${t.i}" aria-label="Écouter le tirage ${t.i + 1}">${cadreOnde(`t${s.no}-${t.i}`, t.onde, { h, barres })}</button>
      <div class="tirage-pied"><span class="mesures mono">${dureeTexte(t.duree)} · crête ${db(t.crete)} dB${niveau}</span>${t.garde ? `<button class="petit" data-action="regler" data-no="${s.no}" data-i="${t.i}">Régler</button>` : ''}</div>
    </article>`;
  }
  function vueGardes(c) {
    const g = gardes(c);
    if (!g.length) return c.series.length ? `<p class="small gardes-aide">Gardez un ou plusieurs tirages. Les autres restent dans la série.</p>` : '';
    const e = state.ctxId ? emp(state.ctxId) : null;
    const plusieurs = new Set(g.map(x => x.s)).size > 1;
    const puces = g.map(({ s, t }) => `<button class="puce" data-action="regler" data-no="${s.no}" data-i="${t.i}" aria-pressed="${!!state.volet && state.volet.no === s.no && state.volet.i === t.i}">${plusieurs ? 'série ' + (c.series.indexOf(s) + 1) + ' · ' : ''}${t.i + 1}</button>`).join('');
    const famille = g[0].s.famille;
    const vides = state.emps.filter(x => x.famille === famille && !gardes(x.ctx).length);
    const dest = e ? `<span class="small">Dans <strong>Le pèlerin › ${esc(e.nom)}</strong></span>`
      : `<label class="small">Ranger dans <select id="ranger" data-champ="ranger"><option value="jeu">les sons du jeu, sans sujet</option>${vides.map(x => `<option value="${x.id}">Le pèlerin › ${esc(x.nom)}</option>`).join('')}</select></label>`;
    const nom = e ? `<span class="mono small">${nomEmp(e)}</span>` : `<label class="small">Nom dans le jeu <input id="nom-jeu" data-champ="nom" value="${esc(nomLibre(c))}" spellcheck="false"></label>`;
    return `<div class="gardes-barre"><strong>${g.length} gardé${g.length > 1 ? 's' : ''}</strong><span class="row gardes-puces">${puces}</span>${g.length > 1 ? '<span class="small">Le jeu en jouera un au hasard.</span>' : ''}
      <span class="gardes-droite">${dest}${nom}<button data-action="aller" data-page="livrer">Voir ce qui part au jeu</button></span></div>`;
  }

  /* ——— Le volet : régler un son gardé ——— */
  function bornesBoucle(s, r) {
    if (s.famille === 'musique') { const bar = TEMPS[s.musique.mesure] * 60 / s.musique.tempo; return [(r.bmD - 1) * bar, r.bmF * bar]; }
    return [r.bDebut, r.bFin];
  }
  function enveloppe(t) {
    const r = t.reglage, D = t.duree;
    return x => {
      const tm = x * D; let v = 1;
      if (r.fonduE && tm < r.debut + r.fonduE / 1000) v = Math.max(0, (tm - r.debut) / (r.fonduE / 1000));
      if (r.fonduS && tm > r.fin - r.fonduS / 1000) v = Math.min(v, Math.max(0, (r.fin - tm) / (r.fonduS / 1000)));
      return v;
    };
  }
  function grandeOnde(s, t) {
    const r = t.reglage, D = t.duree, b = bornesBoucle(s, r);
    return cadreOnde('volet', t.onde, { h: 120, env: enveloppe(t), hors: [r.debut / D, r.fin / D], boucle: r.boucle ? [b[0] / D, b[1] / D] : null, barres: s.famille === 'musique' ? s.musique.mesures + 1 : 0 });
  }
  const raccordNet = (s, r) => s.famille === 'musique' || r.enchaine >= 20;
  function vueRaccord(s, t) {
    const r = t.reglage; if (!r.boucle) return '';
    const n = t.onde.length, D = t.duree, b = bornesBoucle(s, r), idx = f => Math.max(0, Math.min(n - 1, Math.round(f * (n - 1))));
    const w = Math.max(6, Math.round(n / D));
    const a = idx(b[1] / D), d = idx(b[0] / D);
    let gauche = t.onde.slice(Math.max(0, a - w), a), droite = t.onde.slice(d, d + w);
    if (!gauche.length) gauche = [t.onde[a]]; if (!droite.length) droite = [t.onde[d]];
    const net = raccordNet(s, r);
    const pts = net ? [...gauche, ...droite] : [...gauche, 1, 1, ...droite];
    return `<div class="raccord"><div class="row between"><span class="small">Le raccord, deux secondes autour</span><span class="small ${net ? 'ok' : 'attention'}">${net ? 'net' : 'on entend un clic'}</span></div>
      ${cadreOnde('raccord', pts, { h: 40, joint: gauche.length / (pts.length - 1) })}
      <div><button class="petit" data-action="raccord-ecouter" data-bouton-lecture="raccord" data-libelle="Écouter le raccord">▶ Écouter le raccord</button></div></div>`;
  }
  const resumeCoupe = (r, D) => (r.debut < 0.005 && r.fin > D - 0.005 && !r.fonduE && !r.fonduS) ? 'aucune' : `${virgule(r.debut)} → ${virgule(r.fin)} s${r.fonduE || r.fonduS ? ` · fondus ${r.fonduE} / ${r.fonduS} ms` : ''}`;
  const resumeBoucle = (s, r) => !r.boucle ? 'non' : s.famille === 'musique' ? `mesures ${r.bmD} à ${r.bmF}` : `${virgule(r.bDebut, 1)} → ${virgule(r.bFin, 1)} s`;
  const resumeNiveau = r => r.niveau + (r.mono ? ' · mono' : '');
  function curseur(cle, nom, val, min, max, step, fmt) {
    return `<label class="reglage"><span>${nom}</span><span class="valeur mono" data-affiche="${cle}">${fmt(val)}</span><input id="r-${cle}" type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-champ="r:${cle}"></label>`;
  }
  function pli(cle, titre, valeur, corps) {
    return `<details data-pli="${cle}" ${state.plis[cle] ? 'open' : ''}><summary><span>${titre}</span><span class="valeur" id="res-${cle}">${valeur}</span></summary><div class="pli-corps">${corps}</div></details>`;
  }
  function vueVolet(s, t) {
    const r = t.reglage, D = t.duree, F = FAMILLES[s.famille];
    const sec = v => virgule(v) + ' s', ms = v => v + ' ms';
    const maxFondu = D > 10 ? 3000 : 500;
    let boucle = `<label class="coche-ligne"><input id="r-boucle" type="checkbox" data-champ="r-boucle" ${r.boucle ? 'checked' : ''}> Jouer en boucle</label>`;
    if (r.boucle) {
      if (s.famille === 'musique') boucle += `<div class="reglage-mesures">De la mesure <input id="r-bmD" type="number" min="1" max="${s.musique.mesures + 1}" value="${r.bmD}" data-champ="r:bmD"> à la fin de la mesure <input id="r-bmF" type="number" min="1" max="${s.musique.mesures + 1}" value="${r.bmF}" data-champ="r:bmF"></div><p class="small" style="margin:0" id="res-boucle-duree">${r.bmF - r.bmD + 1} mesures · ${dureeTexte((r.bmF - r.bmD + 1) * TEMPS[s.musique.mesure] * 60 / s.musique.tempo)}</p>`;
      else boucle += curseur('bDebut', 'Début de boucle', r.bDebut, 0, D, 0.01, sec) + curseur('bFin', 'Fin de boucle', r.bFin, 0, D, 0.01, sec) + curseur('enchaine', 'Fondu enchaîné', r.enchaine, 0, 200, 5, ms);
      boucle += `<div id="raccord">${vueRaccord(s, t)}</div>`;
    }
    return `<aside class="volet" aria-label="Régler le tirage">
      <div class="volet-tete"><div class="row between"><h2>Tirage ${t.i + 1}</h2><button class="quiet" data-action="fermer-volet" aria-label="Fermer le volet">✕</button></div><p class="small">${esc(s.titre)}</p></div>
      <div class="volet-corps">
        ${t.sature ? '<p class="bandeau-attention">Ce son sature : on entend un grésillement au plus fort. Il se garde et se livre quand même.</p>' : ''}
        <div id="volet-onde">${grandeOnde(s, t)}</div>
        <div class="row"><button class="petit" data-action="volet-ecouter" data-bouton-lecture="volet">▶ Écouter</button><span class="small mono" id="volet-duree">${dureeTexte(r.fin - r.debut)}</span></div>
        ${pli('coupe', 'Coupe et fondus', resumeCoupe(r, D), curseur('debut', 'Début', r.debut, 0, D, 0.01, sec) + curseur('fin', 'Fin', r.fin, 0, D, 0.01, sec) + curseur('fonduE', 'Fondu d’entrée', r.fonduE, 0, maxFondu, 5, ms) + curseur('fonduS', 'Fondu de sortie', r.fonduS, 0, maxFondu, 5, ms))}
        ${pli('boucle', 'Boucle', resumeBoucle(s, r), boucle)}
        ${pli('niveau', 'Niveau', resumeNiveau(r), `<label class="coche-ligne">Niveau visé <select id="r-niveau" data-champ="r-niveau">${F.niveaux.map(n => `<option ${n === r.niveau ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${s.famille !== 'musique' && s.famille !== 'ambiance' ? `<label class="coche-ligne"><input id="r-mono" type="checkbox" data-champ="r-mono" ${r.mono ? 'checked' : ''}> En mono</label>` : ''}`)}
      </div>
      <div class="volet-pied"><p class="small">La source reste intacte.</p><button data-action="conserver">Conserver une version</button></div>
    </aside>`;
  }
  function peindreVolet() {
    const x = state.volet && trouver(state.volet.no, state.volet.i); if (!x) return;
    const { s, t } = x, r = t.reglage;
    const o = $('#volet-onde'); if (o) o.innerHTML = grandeOnde(s, t);
    const rc = $('#raccord'); if (rc) rc.innerHTML = vueRaccord(s, t);
    const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
    set('res-coupe', resumeCoupe(r, t.duree)); set('res-boucle', resumeBoucle(s, r)); set('res-niveau', resumeNiveau(r));
    set('volet-duree', dureeTexte(Math.max(0, r.fin - r.debut)));
    if (s.famille === 'musique') set('res-boucle-duree', `${r.bmF - r.bmD + 1} mesures · ${dureeTexte((r.bmF - r.bmD + 1) * TEMPS[s.musique.mesure] * 60 / s.musique.tempo)}`);
    majBoutonsLecture();
  }

  /* ——— La fiche du pèlerin, onglet Sons ——— */
  const ONGLETS = [['animations', 'Animations'], ['images', 'Images fixes'], ['sources', 'Sources & clips'], ['sons', 'Sons'], ['objectif', 'Objectif & règles']];
  function vueSujet() {
    const remplis = state.emps.filter(e => gardes(e.ctx).length).length;
    const contenu = state.onglet === 'sons'
      ? `<div class="emplacements-tete"><h2>Sons</h2><span class="small mono">${remplis} sur ${state.emps.length} remplis</span></div>
         <div class="emplacements">${state.emps.map(vueEmp).join('')}</div>
         ${state.ajoutEmp ? `<div class="ajout-emp"><input id="emp-nom" placeholder="Ex. : saut" aria-label="Nom de l’emplacement"><select id="emp-famille" aria-label="Famille">${Object.entries(FAMILLES).map(([id, f]) => `<option value="${id}">${f.nom}</option>`).join('')}</select><button data-action="ajout-emp-ok">Ajouter</button><button class="quiet" data-action="ajout-emp-annuler">Annuler</button></div>`
           : '<div class="ajout-emp"><button class="quiet" data-action="ajout-emp">+ Ajouter un emplacement</button></div>'}`
      : `<div class="empty autre-onglet"><p>Cet onglet est dessiné dans la maquette de l’atelier.</p><a href="02-atelier.html">Ouvrir la maquette de l’atelier</a></div>`;
    return `<div class="crumb"><span>Les marais d’ambre / Les sujets / Le pèlerin</span></div>
      <div class="heading"><div><h1>Le pèlerin</h1><p class="muted">Personnages</p></div></div>
      <div class="subject"><div class="sprite"><canvas class="figure-grande" data-figure="marche-sud" data-k="0" width="16" height="16" aria-label="Le pèlerin"></canvas></div><div><p>Petit voyageur encapuchonné. Sa lanterne reste visible pendant la marche.</p></div></div>
      <div class="tabs">${ONGLETS.map(([id, n]) => `<button data-action="onglet" data-id="${id}" aria-pressed="${state.onglet === id}">${n}</button>`).join('')}</div>
      ${contenu}`;
  }
  function texteReperes(e) {
    return Object.entries(e.reperes).filter(([, v]) => v.length).map(([a, v]) => `${ANIMS[a].nom.toLowerCase()}, image${v.length > 1 ? 's' : ''} ${v.join(' et ')}`).join(' · ');
  }
  function vueEmp(e) {
    const g = gardes(e.ctx), F = FAMILLES[e.famille];
    const nom = `<div class="emp-nom"><strong>${esc(e.nom)}</strong><span class="small">${F.nom}</span></div>`;
    if (!g.length) {
      const enCours = e.ctx && e.ctx.series.length;
      return `<div class="emp">${nom}<div class="emp-vide">${enCours ? 'une série, rien de gardé' : 'vide'}</div><div class="emp-actions"><button data-action="ouvrir-emp" data-id="${e.id}">${enCours ? 'Reprendre la série' : 'Fabriquer'}</button></div></div>`;
    }
    const v = g[Math.min(e.dernier, g.length - 1)];
    const reperes = texteReperes(e);
    const calable = e.famille !== 'voix';
    return `<div class="emp">${nom}
      <div class="emp-son"><button class="onde" data-action="ecouter-emp" data-id="${e.id}" aria-label="Écouter ${esc(e.nom)}">${cadreOnde('emp-' + e.id, v.t.onde, { h: 40 })}</button>
        <div><p class="small">${g.length > 1 ? g.length + ' variantes' : '1 son'}${e.joue && g.length > 1 ? ` · <span class="muted">joue la ${Math.min(e.dernier, g.length - 1) + 1}</span>` : ''}</p>${reperes ? `<p class="small muted">Calé sur ${reperes}</p>` : ''}<p class="small mono muted">${nomEmp(e)}</p></div></div>
      <div class="emp-actions"><button data-action="ouvrir-emp" data-id="${e.id}">Ouvrir</button>${calable ? `<button data-action="caler" data-id="${e.id}" aria-expanded="${state.calage === e.id}">${reperes ? 'Modifier le calage' : 'Caler sur une animation'}</button>` : ''}</div>
      ${state.calage === e.id ? vueCalage(e) : ''}</div>`;
  }
  let anim = null; // { id, k, minuterie }
  function vueCalage(e) {
    const a = e.anim || 'marche-sud', A = ANIMS[a], rep = e.reperes[a] || [], mot = e.nom.toLowerCase();
    const joue = anim && anim.id === e.id;
    return `<div class="calage">
      <div class="row"><label class="small">Animation <select id="cal-anim" data-champ="cal-anim" data-id="${e.id}">${Object.entries(ANIMS).map(([id, x]) => `<option value="${id}" ${id === a ? 'selected' : ''}>${x.nom}</option>`).join('')}</select></label>
        <label class="small">Cadence <select id="cal-cadence" data-champ="cal-cadence" data-id="${e.id}">${CADENCES.map(c => `<option value="${c}" ${c === e.cadence ? 'selected' : ''}>${c} images/s</option>`).join('')}</select></label>
        <button class="petit" data-action="jouer-anim" data-id="${e.id}">${joue ? '■ Arrêter' : '▶ Jouer'}</button></div>
      <div class="bande">${Array.from({ length: A.n }, (_, k) => `<button class="image-anim" data-action="image" data-id="${e.id}" data-k="${k + 1}" aria-pressed="${rep.includes(k + 1)}" aria-label="Image ${k + 1}"><canvas data-figure="${a}" data-k="${k}" width="16" height="16"></canvas><span class="mono small">${k + 1}</span><span class="repere-tag">${rep.includes(k + 1) ? esc(mot) : ''}</span></button>`).join('')}</div>
      <p class="small">Cliquez une image pour y poser « ${esc(mot)} ». ${rep.length ? rep.map(k => `Image ${k} : ${esc(mot)}.`).join(' ') : 'Aucun repère sur cette animation.'}</p>
    </div>`;
  }
  function arreterAnim() { if (anim) { clearInterval(anim.minuterie); anim = null; } }
  function jouerAnim(e) {
    arreterAnim();
    const a = e.anim || 'marche-sud', A = ANIMS[a];
    anim = { id: e.id, k: -1, minuterie: setInterval(() => {
      anim.k = (anim.k + 1) % A.n;
      const img = anim.k + 1;
      $$('.image-anim').forEach(b => b.classList.toggle('courante', Number(b.dataset.k) === img));
      if ((e.reperes[a] || []).includes(img)) {
        const b = $(`.image-anim[data-k="${img}"] .repere-tag`);
        if (b) { b.classList.add('eclat'); setTimeout(() => b.classList.remove('eclat'), 160); }
        ecouterEmp(e, false);
      }
    }, 1000 / e.cadence) };
  }
  function ecouterEmp(e, rendre = true) {
    const g = gardes(e.ctx); if (!g.length) return;
    if (g.length > 1) { let k; do { k = Math.floor(Math.random() * g.length); } while (k === e.dernier); e.dernier = k; } else e.dernier = 0;
    e.joue = true;
    if (rendre) render();
    else { const c = $(`[data-lecture="emp-${e.id}"]`); if (c) c.outerHTML = cadreOnde('emp-' + e.id, g[e.dernier].t.onde, { h: 40 }); }
    const t = g[e.dernier].t;
    demarrerLecture('emp-' + e.id, t.duree, 0, t.duree, null);
  }

  /* ——— Livrer au jeu ——— */
  function groupe(o) {
    const ext = ['musique', 'ambiance', 'chanson', 'voix'].includes(o.famille) ? 'ogg' : 'wav';
    const audio = o.n > 1 ? Array.from({ length: o.n }, (_, k) => `${o.nom}_${pad2(k + 1)}.${ext}`) : [`${o.nom}.${ext}`];
    const fichiers = o.n > 1 ? [...audio, `${o.nom}.tres`] : audio;
    let detail = o.n > 1 ? `${o.n} variantes · le jeu en joue une au hasard, jamais deux fois la même de suite`
      : o.famille === 'musique' && o.musique ? `en boucle · ${o.musique.tempo} BPM · ${o.musique.mesures} mesures`
      : o.famille === 'ambiance' ? 'en boucle' : 'un son';
    return { ...o, fichiers, caches: audio.map(f => f + '.import'), detail };
  }
  function groupes() {
    const G = [];
    state.emps.forEach(e => {
      const g = gardes(e.ctx); if (!g.length) return;
      const rep = Object.entries(e.reperes).filter(([, v]) => v.length).map(([a, v]) => `${ANIMS[a].nom} joue ce son à l’image ${v.join(' et ')}.`).join(' ');
      G.push(groupe({ cle: 'emp-' + e.id, titre: 'Le pèlerin · ' + e.nom.toLowerCase(), famille: e.famille, nom: nomEmp(e), n: g.length, repere: rep }));
    });
    const gl = gardes(state.libre);
    if (gl.length) G.push(groupe({ cle: 'libre', titre: gl[0].s.titre, famille: gl[0].s.famille, nom: nomLibre(state.libre), n: gl.length, musique: gl[0].s.musique }));
    AUTRES.forEach(a => G.push(groupe(a)));
    return G;
  }
  function vueLivrer() {
    const G = groupes(), inclus = G.filter(g => !state.livrer.exclus.has(g.cle));
    const tous = inclus.flatMap(g => [...g.fichiers, ...g.caches]).concat(inclus.length ? ['credits.json'] : []);
    return `<div class="crumb"><span>Les marais d’ambre / Livrer au jeu</span></div>
      <div class="heading"><div><h1>Livrer au jeu</h1><p class="muted">Dossier du jeu : <span class="mono">marais/sons/</span></p></div></div>
      <section class="surface livrer"><h2>Les sons</h2>
        ${G.map(g => `<div class="groupe ${state.livrer.exclus.has(g.cle) ? 'exclu' : ''}"><input type="checkbox" id="inc-${g.cle}" data-champ="inclure" data-cle="${g.cle}" ${state.livrer.exclus.has(g.cle) ? '' : 'checked'}>
          <div><label for="inc-${g.cle}"><strong>${esc(g.titre)}</strong> <span class="small">· ${FAMILLES[g.famille].nom}</span></label>
          <p class="small">${g.detail}</p>${g.repere ? `<p class="small">${esc(g.repere)}</p>` : ''}
          <p class="fichiers">${g.fichiers.map(f => `<span>${esc(f)}</span>`).join('')}</p></div></div>`).join('')}
        <p class="credits"><code class="mono">credits.json</code> · d’où vient chaque son : moteur, licence, graine, texte parti.</p>
        <details data-pli="tous" ${state.plis.tous ? 'open' : ''}><summary>Tous les fichiers · ${tous.length}</summary><ul class="fichiers-tous">${tous.map(f => `<li>${esc(f)}</li>`).join('')}</ul><p class="small">Chaque <span class="mono">.import</span> dit à Godot si le son boucle, et pour une musique son tempo et ses mesures.</p></details>
      </section>
      <div class="delivery-sendbar"><p>${tous.length} fichiers · rien n’est écrit tant que vous n’avez pas livré.${state.livrer.livreA ? ` Dernière livraison à ${state.livrer.livreA} (simulée).` : ''}</p><button class="rust" data-action="livrer" ${inclus.length ? '' : 'disabled'}>Livrer au jeu</button></div>`;
  }

  /* ——— Le pèlerin, en pixels ——— */
  function dessinerFigure(c, a, k) {
    const g = c.getContext('2d'); g.clearRect(0, 0, 16, 16);
    const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const marche = a !== 'attaque-sud', nord = a === 'marche-nord';
    const bob = marche ? [0, 1, 0, 0, 1, 0][k % 6] : 0;
    P(6, 1 + bob, 4, 1, '#3b2f4a'); P(5, 2 + bob, 6, 3, '#3b2f4a');
    if (!nord) { P(6, 3 + bob, 4, 2, '#e0b48a'); P(7, 4 + bob, 1, 1, '#221f1b'); P(9, 4 + bob, 1, 1, '#221f1b'); }
    P(4, 5 + bob, 8, 6, '#5b4a6e'); P(5, 11, 6, 1, '#5b4a6e');
    const gauche = marche ? [2, 3, 4, 3, 2, 2][k % 6] : 3, droite = marche ? [3, 2, 2, 2, 3, 4][k % 6] : 3;
    P(5, 12, 2, gauche - 1, '#2b2419'); P(5, 11 + gauche, 2, 1, '#6b4a2b');
    P(9, 12, 2, droite - 1, '#2b2419'); P(9, 11 + droite, 2, 1, '#6b4a2b');
    if (marche) { P(12, 7 + bob, 1, 1, '#221f1b'); P(12, 8 + bob, 2, 2, '#f2c14e'); }
    else {
      const bouts = [[[12, 6], [14, 1]], [[12, 5], [11, 0]], [[12, 6], [15, 3]], [[12, 8], [15, 12]], [[12, 8], [14, 13]]][k % 5];
      const [[x0, y0], [x1, y1]] = bouts, pasN = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= pasN; i++) P(Math.round(x0 + (x1 - x0) * i / pasN), Math.round(y0 + (y1 - y0) * i / pasN), 1, 1, '#8a6a3a');
    }
  }

  /* ——— Rendu ——— */
  function render() {
    const a = document.activeElement, id = a && a.id && main.contains(a) ? a.id : null;
    let s0 = null, s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch { /* rien */ }
    majCarnet();
    main.innerHTML = state.page === 'sujet' ? vueSujet() : state.page === 'livrer' ? vueLivrer() : vueAtelier();
    if (id) { const n = document.getElementById(id); if (n) { n.focus({ preventScroll: true }); try { if (s0 != null) n.setSelectionRange(s0, s1); } catch { /* rien */ } } }
    $$('canvas[data-figure]').forEach(c => dessinerFigure(c, c.dataset.figure, Number(c.dataset.k)));
    majBoutonsLecture();
  }
  function aller(page) {
    arreterLecture(); arreterAnim();
    state.page = page; state.volet = null;
    if (page === 'atelier') state.ctxId = null;
    main.scrollTop = 0; render();
  }

  /* ——— Les gestes ——— */
  const ACTIONS = {
    aller: b => aller(b.dataset.page),
    ailleurs: () => { location.href = '02-atelier.html'; },
    saut: b => {
      const id = b.dataset.id;
      if (id === 'sujet') { state.onglet = 'sons'; aller('sujet'); return; }
      if (id === 'livrer') { aller('livrer'); return; }
      const textes = { bruitage: 'Sword slides out of a leather sheath, slow', ambiance: 'Rain in a stone cave, slow drips, distant wind', musique: 'Exploration, calm forest path at dawn' };
      state.libre = nouveauCtx(id, textes[id]);
      aller('atelier');
    },
    famille: b => { const d = ctx().demande; d.famille = b.dataset.id; d.manuel = null; render(); },
    depart: b => { ctx().demande.depart = b.dataset.v; render(); },
    mode: b => { const d = ctx().demande; d.mode = b.dataset.v; d.manuel = null; render(); },
    panneau: b => { const d = ctx().demande; d.panneau = d.panneau === b.dataset.id ? null : b.dataset.id; render(); },
    duree: b => { const d = ctx().demande; d.durees[d.famille] = Number(b.dataset.v); render(); },
    tirages: b => { const d = ctx().demande; d.tirages[d.famille] = Number(b.dataset.v); render(); },
    'manuel-ouvrir': () => { const d = ctx().demande; d.manuel = composeTexte(d); render(); const m = $('#manuel'); if (m) m.focus(); },
    'manuel-annuler': () => { ctx().demande.manuel = null; render(); },
    lancer: () => lancer(),
    ecouter: (b, e) => {
      const box = b.getBoundingClientRect(); let f = e.clientX ? (e.clientX - box.left) / box.width : 0;
      if (f < 0.04) f = 0;
      ecouterTirage(Number(b.dataset.no), Number(b.dataset.i), Math.min(0.98, f));
    },
    garder: b => {
      const x = trouver(Number(b.dataset.no), Number(b.dataset.i)); if (!x) return;
      x.t.garde = !x.t.garde;
      if (x.t.garde && !x.t.reglage) x.t.reglage = reglageParDefaut(x.s, x.t);
      if (!x.t.garde && state.volet && state.volet.no === x.s.no && state.volet.i === x.t.i) state.volet = null;
      state.selection = { no: x.s.no, i: x.t.i };
      render();
    },
    regler: b => { arreterLecture(); state.volet = { no: Number(b.dataset.no), i: Number(b.dataset.i) }; render(); },
    'fermer-volet': () => { arreterLecture(); state.volet = null; render(); },
    'volet-ecouter': () => {
      if (lecture && lecture.cle === 'volet') { arreterLecture(); return; }
      const x = trouver(state.volet.no, state.volet.i); const r = x.t.reglage;
      demarrerLecture('volet', x.t.duree, r.debut, r.boucle ? Math.min(r.fin, bornesBoucle(x.s, r)[1]) : r.fin, r.boucle ? bornesBoucle(x.s, r) : null);
    },
    'raccord-ecouter': () => { if (lecture && lecture.cle === 'raccord') { arreterLecture(); return; } demarrerLecture('raccord', 2, 0, 2, [0, 2]); },
    conserver: () => { const x = trouver(state.volet.no, state.volet.i); x.t.reglage.version++; render(); toast(`Version ${x.t.reglage.version} conservée. La précédente reste dans l’historique du son.`); },
    'rouvrir-serie': b => { const c = ctx(); c.courante = Number(b.dataset.k); state.volet = null; arreterLecture(); render(); },
    'retour-sujet': () => { state.onglet = 'sons'; aller('sujet'); },
    'ouvrir-emp': b => {
      const e = emp(b.dataset.id); if (!e.ctx) e.ctx = nouveauCtx(e.famille, e.suggestion);
      arreterLecture(); arreterAnim(); state.ctxId = e.id; state.page = 'atelier'; state.volet = null; main.scrollTop = 0; render();
    },
    'ecouter-emp': b => { const e = emp(b.dataset.id); if (lecture && lecture.cle === 'emp-' + e.id) { arreterLecture(); return; } ecouterEmp(e); },
    caler: b => { arreterAnim(); state.calage = state.calage === b.dataset.id ? null : b.dataset.id; render(); },
    image: b => {
      const e = emp(b.dataset.id), a = e.anim || 'marche-sud', k = Number(b.dataset.k);
      const rep = e.reperes[a] = e.reperes[a] || [];
      const i = rep.indexOf(k); if (i >= 0) rep.splice(i, 1); else { rep.push(k); rep.sort((x, y) => x - y); }
      const relancer = anim && anim.id === e.id; render(); if (relancer) jouerAnim(e);
    },
    'jouer-anim': b => { const e = emp(b.dataset.id); if (anim && anim.id === e.id) arreterAnim(); else jouerAnim(e); render(); },
    onglet: b => { arreterAnim(); state.onglet = b.dataset.id; render(); },
    'ajout-emp': () => { state.ajoutEmp = true; render(); const n = $('#emp-nom'); if (n) n.focus(); },
    'ajout-emp-annuler': () => { state.ajoutEmp = false; render(); },
    'ajout-emp-ok': () => {
      const nom = ($('#emp-nom').value || '').trim(); if (!nom) { $('#emp-nom').focus(); return; }
      const famille = $('#emp-famille').value;
      const nomPropre = nom.charAt(0).toUpperCase() + nom.slice(1);
      state.emps.push({ id: 'e' + Date.now(), nom: nomPropre, famille, suggestion: '', reperes: {}, cadence: 8, ctx: null, dernier: 0, joue: false });
      state.ajoutEmp = false; render();
    },
    livrer: () => {
      const n = main.querySelectorAll('.fichiers-tous li').length;
      const h = new Date(); state.livrer.livreA = h.getHours() + ' h ' + pad2(h.getMinutes());
      render(); toast(`Livraison simulée : ${n} fichiers. Rien n’est écrit dans le jeu.`);
    },
  };
  const CHAMPS = {
    texte: el => { const d = ctx().demande; d.textes[d.famille] = el.value; render(); },
    paroles: el => { ctx().demande.paroles = el.value; render(); },
    manuel: el => { ctx().demande.manuel = el.value; },
    voix: el => { ctx().demande.voix = el.value; render(); },
    moteur: el => { const d = ctx().demande; d.moteurs[d.famille] = el.value; },
    emotion: (el, type) => { const d = ctx().demande; d.emotion = Number(el.value); const a = $('[data-affiche="emotion"]'); if (a) a.textContent = virgule(d.emotion, 1); if (type === 'change') render(); },
    nom: el => { ctx().nom = el.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'); },
    ranger: el => {
      if (el.value === 'jeu') return;
      const e = emp(el.value);
      e.ctx = state.libre; state.libre = nouveauCtx(e.ctx.demande.famille, '');
      state.ctxId = e.id; render(); toast(`Rangés dans Le pèlerin › ${e.nom}.`);
    },
    inclure: el => { const k = el.dataset.cle; if (el.checked) state.livrer.exclus.delete(k); else state.livrer.exclus.add(k); render(); },
    'cal-anim': el => { const e = emp(el.dataset.id); e.anim = el.value; arreterAnim(); render(); },
    'cal-cadence': el => { const e = emp(el.dataset.id); e.cadence = Number(el.value); const relancer = anim && anim.id === e.id; render(); if (relancer) jouerAnim(e); },
    'r-boucle': el => { const x = trouver(state.volet.no, state.volet.i); x.t.reglage.boucle = el.checked; state.plis.boucle = true; arreterLecture(); render(); },
    'r-niveau': el => { const x = trouver(state.volet.no, state.volet.i); x.t.reglage.niveau = el.value; peindreVolet(); },
    'r-mono': el => { const x = trouver(state.volet.no, state.volet.i); x.t.reglage.mono = el.checked; peindreVolet(); },
  };
  function champVolet(cle, el) {
    const x = state.volet && trouver(state.volet.no, state.volet.i); if (!x) return;
    const r = x.t.reglage, D = x.t.duree, v = Number(el.value);
    if (Number.isNaN(v)) return;
    const max = x.s.musique.mesures + 1;
    if (cle === 'debut') r.debut = Math.min(v, r.fin - 0.05);
    else if (cle === 'fin') r.fin = Math.max(v, r.debut + 0.05);
    else if (cle === 'bDebut') r.bDebut = Math.min(v, r.bFin - 0.1);
    else if (cle === 'bFin') r.bFin = Math.max(v, r.bDebut + 0.1);
    else if (cle === 'bmD') r.bmD = Math.max(1, Math.min(Math.round(v), r.bmF));
    else if (cle === 'bmF') r.bmF = Math.min(max, Math.max(Math.round(v), r.bmD));
    else r[cle] = v;
    r.fin = Math.min(r.fin, D);
    if (el.type === 'range' && Number(el.value) !== r[cle]) el.value = r[cle];
    const a = $(`[data-affiche="${cle}"]`);
    if (a) a.textContent = ['fonduE', 'fonduS', 'enchaine'].includes(cle) ? r[cle] + ' ms' : virgule(r[cle]) + ' s';
    peindreVolet();
  }
  function champMusique(cle, el) {
    const m = ctx().demande.musique;
    if (cle === 'instrumental') m.instrumental = el.checked;
    else if (cle === 'tempo' || cle === 'mesures') { const v = Number(el.value); if (!v) return; m[cle] = cle === 'tempo' ? Math.max(40, Math.min(200, v)) : Math.max(4, Math.min(96, Math.round(v))); }
    else m[cle] = el.value;
    render();
  }
  function surChamp(e, type) {
    const el = e.target, champ = el.dataset && el.dataset.champ; if (!champ) return;
    if (champ.startsWith('r:')) { champVolet(champ.slice(2), el); return; }
    if (champ.startsWith('m:')) { if (type === 'input' && el.tagName !== 'INPUT') return; if (type === 'change' && el.type === 'number') return; champMusique(champ.slice(2), el); return; }
    const fn = CHAMPS[champ]; if (!fn) return;
    const surInput = ['texte', 'paroles', 'manuel', 'nom', 'emotion'].includes(champ);
    if (type === 'input' && !surInput) return;
    if (type === 'change' && surInput && champ !== 'emotion') return;
    fn(el, type);
  }
  document.addEventListener('input', e => surChamp(e, 'input'));
  document.addEventListener('change', e => surChamp(e, 'change'));
  document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.pli) state.plis[d.dataset.pli] = d.open; }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
    const fn = ACTIONS[b.dataset.action]; if (!fn) return;
    e.preventDefault(); fn(b, e);
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'Escape' && state.volet) { arreterLecture(); state.volet = null; render(); return; }
    if (state.page !== 'atelier') return;
    const s = serieCourante(); if (!s) return;
    const prets = s.tirages.filter(t => t.pret); if (!prets.length) return;
    const courant = state.selection && state.selection.no === s.no ? state.selection.i : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const pos = prets.findIndex(t => t.i === courant);
      const suivant = prets[(pos + (e.key === 'ArrowRight' ? 1 : -1) + prets.length) % prets.length] || prets[0];
      if (lecture) arreterLecture();
      ecouterTirage(s.no, suivant.i, 0);
    } else if (e.key === ' ' && !(e.target.closest && e.target.closest('button'))) {
      e.preventDefault();
      ecouterTirage(s.no, courant >= 0 ? courant : prets[0].i, 0);
    } else if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
      const t = s.tirages[courant >= 0 ? courant : prets[0].i]; if (!t || !t.pret) return;
      t.garde = !t.garde; if (t.garde && !t.reglage) t.reglage = reglageParDefaut(s, t);
      if (!t.garde && state.volet && state.volet.no === s.no && state.volet.i === t.i) state.volet = null;
      state.selection = { no: s.no, i: t.i }; render();
    }
  });

  render();
})();
