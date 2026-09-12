/* Contrat observable des livraisons simulées : fichiers, choix et historique, sans fournisseur. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const clone = value => JSON.parse(JSON.stringify(value));
const source = fs.readFileSync(path.join(__dirname, '../docs/maquettes-atelier-unifie/toile-livraison.js'), 'utf8');
const noop = () => {};

function result(id = 'marche-a') {
  return { id, title: 'Marche · Sud', movement: 'Marche', direction: 'Sud', animated: true,
    chosen: true, revision: 1, frames: [{ id: 'frame-a', source: 0, strokes: [] }],
    recipe: { fps: 11, loop: true }, layers: [{ id: 'main', visible: true }] };
}
function fixture() {
  return { destination: 'res://assets/', subjects: [{ id: 'heros', name: 'Le pèlerin', results: [result()] }],
    deliveries: [], workspace: {}, canvas: { cards: [], islands: [], links: [], zoom: 100 } };
}
function open(state) {
  const scope = { window: { addEventListener: noop }, document: { addEventListener: noop }, setInterval, clearInterval };
  vm.runInNewContext(source, scope);
  let sequence = 0;
  return scope.window.creerFinitionMaquette({ state: () => state, page: () => 'delivery',
    clone, id: () => `livraison-${++sequence}-${state.deliveries.length}`, esc: value => String(value ?? ''),
    heading: (title, description, buttons) => title + description + buttons,
    button: (label, action, attrs = '') => `<button data-action="${action}" ${attrs}>${label}</button>`,
    field: (label, content) => label + content, input: () => '', save: noop, render: noop, toast: noop });
}
function unchecked(app, id) { app.change({ dataset: { deliverySelect: id }, checked: false }, false); }
function isChecked(app, id) {
  const markup = app.views.delivery();
  return new RegExp(`data-delivery-select="${id}" checked`).test(markup);
}

test('une autre version retenue de la même cible remplace les mêmes fichiers et garde un historique immuable', () => {
  let state = fixture(), app = open(state);
  app.handlers['delivery-commit']();
  const original = clone(state.deliveries[0]), paths = original.items[0].files;
  assert.match(app.views.delivery(), /1 inchangés/);
  assert.equal(isChecked(app, 'marche-a'), false);

  state.subjects[0].results[0].chosen = false;
  state.subjects[0].name = 'Le veilleur';
  const next = result('marche-b');
  next.title = 'Marche alternative';
  next.recipe.fps = 8;
  next.frames[0].strokes.push({ points: [{ x: 7, y: 11 }], colour: '#a8492c' });
  state.subjects[0].results.push(next);
  state = clone(state); app = open(state); // La reprise relit les données enregistrées.
  assert.match(app.views.delivery(), /1 modifiés/);
  assert.equal(isChecked(app, 'marche-b'), true);
  app.handlers['delivery-commit']();
  assert.deepEqual(clone(state.deliveries[1].items[0].files), paths);
  assert.equal(state.deliveries[1].items[0].result, 'marche-b');

  state.subjects[0].results[0].frames[0].strokes.push({ points: [{ x: 1, y: 2 }] });
  state.subjects[0].results[0].recipe.fps = 24;
  state.subjects[0].results[0].layers[0].visible = false;
  assert.deepEqual(clone(state.deliveries[0]), original, 'Les pixels, calques, cadence, noms et chemins livrés restent ceux de cet instant');
});

test('décocher survit à la reprise mais une nouvelle révision ou version redevient proposée', () => {
  let state = fixture(), app = open(state);
  unchecked(app, 'marche-a');
  state = clone(state); app = open(state);
  assert.equal(isChecked(app, 'marche-a'), false);
  state.subjects[0].results[0].revision = 2;
  assert.equal(isChecked(app, 'marche-a'), true);
  unchecked(app, 'marche-a');
  state.subjects[0].results[0].chosen = false;
  state.subjects[0].results.push(result('marche-b'));
  assert.equal(isChecked(app, 'marche-b'), true);
});

test('une livraison de l’ancien format conserve son nom même après renommage et remplacement du résultat', () => {
  const state = fixture();
  state.deliveryNames = { 'marche-a': 'le-pelerin/marche-sud-nom-historique' };
  const files = ['png', 'json', 'tres', 'atelier.json'].map(ext => 'res://assets/le-pelerin/marche-sud-nom-historique.' + ext);
  state.deliveries.push({ id: 'ancienne', date: '2026-09-11T12:00:00Z', destination: 'res://assets',
    items: [{ subject: 'heros', subjectName: 'Le pèlerin', result: 'marche-a', revision: 1, files, snapshot: clone(state.subjects[0].results[0]) }] });
  state.subjects[0].name = 'Le veilleur';
  state.subjects[0].results[0].chosen = false;
  state.subjects[0].results.push(result('marche-b'));
  const app = open(state);
  assert.match(app.views.delivery(), /1 modifiés/);
  app.handlers['delivery-commit']();
  assert.deepEqual(clone(state.deliveries[1].items[0].files), files);
});

test('mettre en réserve puis reprendre une carte conserve son îlot, ses coordonnées et son texte', () => {
  let state = fixture();
  state.canvas.cards.push({ id: 'note', kind: 'note', title: 'Ambiance', text: 'Lumière basse', island: 'marais', x: 245, y: 176 });
  state.workspace.toile = { selected: ['note'], query: '' };
  const expected = clone(state.canvas.cards[0]);
  open(state).handlers['world-reserve']();
  state = clone(state);
  open(state).handlers['world-restore']({ dataset: { id: 'note' } });
  const restored = clone(state.canvas.cards[0]);
  delete restored.reserve;
  assert.deepEqual(restored, expected);
});
